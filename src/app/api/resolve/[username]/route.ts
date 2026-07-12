import { NextRequest, NextResponse } from "next/server";
import * as StellarSdk from "@stellar/stellar-sdk";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    if (!username) {
      return NextResponse.json({ error: "Missing username parameter" }, { status: 400 });
    }

    const normalizedUsername = username.toLowerCase();

    const contractId = process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID;
    if (!contractId) {
      return NextResponse.json({ error: "Registry contract ID not configured on server" }, { status: 500 });
    }

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";
    const rpc = new StellarSdk.rpc.Server(rpcUrl);

    // Direct contract read (authoritative source of truth)
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
    if (!entries.entries || entries.entries.length === 0) {
      return NextResponse.json({ address: null, source: "on-chain" }, { status: 200 });
    }

    // Parse the owner address from the contract data value
    const contractDataVal = entries.entries[0].val.contractData().val();
    const address = StellarSdk.scValToNative(contractDataVal);

    return NextResponse.json({ address, source: "on-chain" });
  } catch (error: any) {
    console.error("Resolve API error:", error);
    return NextResponse.json({ error: error.message || "Failed to resolve username on-chain" }, { status: 500 });
  }
}
