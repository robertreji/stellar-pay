import { NextRequest, NextResponse } from "next/server";
import * as StellarSdk from "@stellar/stellar-sdk";

// In-memory rate limiter maps
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }
  if (record.count >= limit) return true;
  record.count += 1;
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    if (checkRateLimit(`ip:${ip}`, 10, 60000)) {
      return NextResponse.json({ error: "Too many requests from this IP" }, { status: 429 });
    }

    const { username, user_pubkey } = await request.json();
    if (!username || !user_pubkey) {
      return NextResponse.json({ error: "username and user_pubkey are required" }, { status: 400 });
    }

    if (checkRateLimit(`key:${user_pubkey}`, 5, 60000)) {
      return NextResponse.json({ error: "Too many requests for this public key" }, { status: 429 });
    }

    // Lowercase normalization
    const normalizedUsername = username.toLowerCase();

    // Enforce charset [a-z0-9_] and length 3-20
    if (!/^[a-z0-9_]{3,20}$/.test(normalizedUsername)) {
      return NextResponse.json(
        { error: "Username must be 3-20 characters, lowercase letters, numbers, and underscores only" },
        { status: 400 }
      );
    }

    // Validate user_pubkey is a valid Stellar address
    if (!/^G[A-Z2-7]{55}$/.test(user_pubkey)) {
      return NextResponse.json({ error: "Invalid public key" }, { status: 400 });
    }

    const contractId = process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID;
    if (!contractId) {
      return NextResponse.json({ error: "Registry contract ID not configured on server" }, { status: 500 });
    }

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";
    const rpc = new StellarSdk.rpc.Server(rpcUrl);

    // 1. Direct contract read (not Supabase) to check if username is free
    // Querying getLedgerEntries for DataKey::Username(String)
    const enumVariant = StellarSdk.nativeToScVal("Username", { type: "symbol" });
    const usernameVal = StellarSdk.nativeToScVal(normalizedUsername, { type: "string" });
    const keyScVal = StellarSdk.xdr.ScVal.scvVec([enumVariant, usernameVal]);

    const ledgerKey = StellarSdk.xdr.LedgerKey.contractData(
      new StellarSdk.xdr.LedgerKeyContractData({
        contract: new StellarSdk.Address(contractId).toScAddress(),
        key: keyScVal,
        durability: StellarSdk.xdr.ContractDataDurability.persistent(),
      })
    );

    const entries = await rpc.getLedgerEntries(ledgerKey);
    if (entries.entries && entries.entries.length > 0) {
      return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
    }

    // 2. Build mock invocation transaction to get the authorization entry via simulation
    const sponsorSecret = process.env.SPONSOR_SECRET_KEY;
    if (!sponsorSecret) {
      return NextResponse.json({ error: "Sponsor account not configured on server" }, { status: 500 });
    }
    const sponsorKeypair = StellarSdk.Keypair.fromSecret(sponsorSecret);
    const sponsorAddress = sponsorKeypair.publicKey();

    const rpcAccount = await rpc.getAccount(sponsorAddress);
    const contract = new StellarSdk.Contract(contractId);
    
    // We invoke register(owner: Address, username: String)
    const registerOp = contract.call(
      "register",
      StellarSdk.Address.fromString(user_pubkey).toScVal(),
      StellarSdk.nativeToScVal(normalizedUsername, { type: "string" })
    );

    const tx = new StellarSdk.TransactionBuilder(rpcAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" 
        ? StellarSdk.Networks.PUBLIC 
        : StellarSdk.Networks.TESTNET,
    })
      .addOperation(registerOp)
      .setTimeout(180)
      .build();

    const sim = await rpc.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(sim)) {
      return NextResponse.json({ error: `Simulation failed: ${sim.error}` }, { status: 400 });
    }

    if (!sim.result || !sim.result.auth || sim.result.auth.length === 0) {
      return NextResponse.json({ error: "Simulation did not return any authorization entries" }, { status: 500 });
    }

    // Return the authorization entry XDR (base64 string) to the client
    const authEntry = sim.result.auth[0];
    const authEntryXdr = authEntry.toXDR("base64");
    return NextResponse.json({
      authEntry: authEntryXdr,
      username: normalizedUsername,
    });
  } catch (error: any) {
    console.error("Build endpoint error:", error);
    return NextResponse.json({ error: error.message || "Failed to build registration transaction" }, { status: 500 });
  }
}
