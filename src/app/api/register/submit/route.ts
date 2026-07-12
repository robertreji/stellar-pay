import { NextRequest, NextResponse } from "next/server";
import * as StellarSdk from "@stellar/stellar-sdk";
import { supabase } from "@/lib/supabase";

// Promise queue to serialize submissions per sponsor account sequence
class PromiseQueue {
  private queue = Promise.resolve();
  add<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue = this.queue.then(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }
}

const submissionQueue = new PromiseQueue();

export async function POST(request: NextRequest) {
  try {
    const { signedAuthEntry, username, user_pubkey } = await request.json();

    if (!signedAuthEntry || !username || !user_pubkey) {
      return NextResponse.json({ error: "signedAuthEntry, username, and user_pubkey are required" }, { status: 400 });
    }

    const normalizedUsername = username.toLowerCase();
    const contractId = process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID;
    if (!contractId) {
      return NextResponse.json({ error: "Registry contract ID not configured on server" }, { status: 500 });
    }

    const sponsorSecret = process.env.SPONSOR_SECRET_KEY;
    if (!sponsorSecret) {
      return NextResponse.json({ error: "Sponsor account not configured on server" }, { status: 500 });
    }

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";
    const rpc = new StellarSdk.rpc.Server(rpcUrl);
    const networkPassphrase = process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
      ? StellarSdk.Networks.PUBLIC
      : StellarSdk.Networks.TESTNET;

    const sponsorKeypair = StellarSdk.Keypair.fromSecret(sponsorSecret);
    const sponsorAddress = sponsorKeypair.publicKey();

    // Parse the client-signed auth entry
    let parsedAuthEntry: StellarSdk.xdr.SorobanAuthorizationEntry;
    try {
      parsedAuthEntry = StellarSdk.xdr.SorobanAuthorizationEntry.fromXDR(signedAuthEntry, "base64");
    } catch (e) {
      return NextResponse.json({ error: "Invalid signedAuthEntry format" }, { status: 400 });
    }

    // Verify the auth entry targets the user public key
    const credentialsAddress = parsedAuthEntry.credentials().address().address();
    let credentialsPubKey = "";
    try {
      credentialsPubKey = StellarSdk.Address.fromScAddress(credentialsAddress).toString();
    } catch (e) {
      return NextResponse.json({ error: "Invalid credentials address in authorization entry" }, { status: 400 });
    }

    if (!credentialsPubKey.startsWith("G")) {
      return NextResponse.json({ error: "Only account address credentials are supported" }, { status: 400 });
    }

    if (credentialsPubKey !== user_pubkey) {
      return NextResponse.json({ error: "Authorization entry does not match user public key" }, { status: 400 });
    }

    // Submit transaction serialized in the queue
    const txHash = await submissionQueue.add(async () => {
      const sponsorAccount = await rpc.getAccount(sponsorAddress);
      const contract = new StellarSdk.Contract(contractId);

      const registerOp = contract.call(
        "register",
        StellarSdk.Address.fromString(user_pubkey).toScVal(),
        StellarSdk.nativeToScVal(normalizedUsername, { type: "string" })
      );

      // Create invoke host function operation with client auth entry
      const op = StellarSdk.Operation.invokeHostFunction({
        func: registerOp.body().invokeHostFunctionOp().hostFunction(),
        auth: [parsedAuthEntry],
      });

      // Build draft inner transaction using sponsor sequence number
      const innerTx = new StellarSdk.TransactionBuilder(sponsorAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase,
      })
        .addOperation(op)
        .setTimeout(180)
        .build();

      // Simulate the transaction to determine the footprint, CPU/memory, and resource fees
      const sim = await rpc.simulateTransaction(innerTx);
      if (StellarSdk.rpc.Api.isSimulationError(sim)) {
        throw new Error(`Transaction simulation failed: ${sim.error}`);
      }

      // Assemble the final inner transaction using the simulation result
      const assembledTx = StellarSdk.rpc.assembleTransaction(innerTx, sim).build();

      // Sign the assembled inner transaction with the sponsor key
      assembledTx.sign(sponsorKeypair);

      // Wrap in a fee-bump transaction
      const feeBumpTx = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
        sponsorAddress,
        StellarSdk.BASE_FEE,
        assembledTx,
        networkPassphrase
      );

      // Sign the fee-bump envelope
      feeBumpTx.sign(sponsorKeypair);

      // Submit to RPC
      const response = await rpc.sendTransaction(feeBumpTx);
      if (response.status === "ERROR") {
        throw new Error(`Transaction failed to submit: ${JSON.stringify(response.errorResult)}`);
      }

      // Poll for status
      let getResponse = await rpc.getTransaction(response.hash);
      let count = 0;
      while ((getResponse.status === "NOT_FOUND" || getResponse.status === "SUCCESS" && !getResponse.returnValue) && count < 30) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        getResponse = await rpc.getTransaction(response.hash);
        count++;
      }

      if (getResponse.status === "FAILED") {
        throw new Error(`Transaction failed on-chain: ${JSON.stringify(getResponse.resultXdr)}`);
      }

      if (getResponse.status !== "SUCCESS") {
        throw new Error(`Transaction timeout or unknown status: ${getResponse.status}`);
      }

      return response.hash;
    });

    // Write to Supabase pending table
    const { error: dbError } = await supabase.from("usernames_pending").insert({
      username: normalizedUsername,
      owner_address: user_pubkey,
    });
    if (dbError) {
      console.error("[submit-route] Error writing to usernames_pending:", dbError);
    }

    return NextResponse.json({ success: true, txHash });
  } catch (error: any) {
    console.error("Submit endpoint error:", error);
    // Handle the race where username is taken on-chain during simulation/submission
    if (error.message && (error.message.includes("taken") || error.message.includes("Error(Contract, u32(1))"))) {
      return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || "Failed to submit transaction" }, { status: 500 });
  }
}
