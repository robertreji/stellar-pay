import { NextRequest, NextResponse } from "next/server";
import * as StellarSdk from "@stellar/stellar-sdk";
import { horizon, config, USDC_ISSUER } from "@/lib/stellar";

const DIST_SECRET = process.env.ANCHOR_DISTRIBUTION_SECRET || "SCD63ZJ2DNEDU5RO5F7S245PYE5DNI3KNIKOOVLY3GZRHIUC3HNWLKHZ";

// Helper to call Platform API JSON-RPC
async function callPlatformRpc(method: string, params: any) {
  const url = "http://localhost:8085"; // Platform API endpoint
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      {
        id: Math.random().toString(36).substring(2, 9),
        jsonrpc: "2.0",
        method,
        params,
      },
    ]),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Platform RPC error (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  if (json[0]?.error) {
    throw new Error(`Platform RPC error payload: ${JSON.stringify(json[0].error)}`);
  }
  return json[0]?.result;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reference_id, amount, from_account } = body;

    console.log(`[anchor-webhook] Received webhook for reference_id: ${reference_id}, amount: ${amount}, from: ${from_account}`);

    if (!reference_id) {
      return NextResponse.json({ error: "Missing reference_id" }, { status: 400 });
    }

    // 1. Fetch transaction details from Platform API
    let txData: any;
    try {
      const platformTxRes = await fetch(`http://localhost:8085/transactions/${reference_id}`);
      if (!platformTxRes.ok) {
        throw new Error(`Platform returned status ${platformTxRes.status}`);
      }
      txData = await platformTxRes.json();
    } catch (err: any) {
      // EDGE CASE: Transfer arrives with a reference_id that doesn't match any known transaction
      console.warn(`[anchor-webhook] WARNING: Transfer received with unknown transaction ID (reference_id): ${reference_id}`);
      console.warn(`[anchor-webhook] Option to refund: To refund this transfer in bank-sim, run:`);
      console.warn(`[anchor-webhook] curl -X POST http://localhost:8092/transfers -H "Content-Type: application/json" -d '{"from_account": "ACC_ANCHOR", "to_account": "${from_account}", "amount": ${amount}, "currency": "USD", "idempotency_key": "refund-${reference_id}"}'`);
      
      // Respond 200 OK so bank-sim doesn't keep retrying, but log warning as requested
      return NextResponse.json({ success: true, warning: "Unknown transaction ID", refund_instructions_logged: true });
    }

    // 2. Prevent duplicate processing
    // If status is already completed, pending_anchor, or pending_stellar, ignore duplicate webhook delivery
    if (txData.status !== "incomplete" && txData.status !== "pending_user_transfer_start") {
      console.log(`[anchor-webhook] Transaction ${reference_id} is already in status '${txData.status}'. Skipping duplicate processing.`);
      return NextResponse.json({ success: true, message: "Transaction already processed" });
    }

    if (txData.kind !== "deposit") {
      console.warn(`[anchor-webhook] Expected deposit transaction, got kind: ${txData.kind}`);
      return NextResponse.json({ error: "Invalid transaction kind" }, { status: 400 });
    }

    const destinationAddress = txData.destination_account;
    if (!destinationAddress) {
      return NextResponse.json({ error: "No destination account specified in transaction" }, { status: 400 });
    }

    // Read amount_out which represents the USDC amount to deliver
    const amountUSDC = txData.amount_out?.amount;
    const assetString = txData.amount_out?.asset || txData.amount_expected?.asset || "";
    // e.g. "stellar:USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
    const usdcIssuer = assetString.split(":")[2] || USDC_ISSUER;

    if (!amountUSDC) {
      return NextResponse.json({ error: "Amount out (USDC) is not specified in transaction" }, { status: 400 });
    }

    console.log(`[anchor-webhook] Processing deposit payout of ${amountUSDC} USDC to ${destinationAddress}...`);

    // 3. Transition Platform status to pending_anchor
    try {
      await callPlatformRpc("notify_offchain_funds_received", {
        transaction_id: reference_id,
        message: "Fiat funds received. Preparing USDC payment.",
      });
    } catch (err: any) {
      console.error("[anchor-webhook] Failed to transition to pending_anchor on Platform:", err.message);
    }

    // 4. Send USDC on-chain
    let txHash = "";
    try {
      const keypair = StellarSdk.Keypair.fromSecret(DIST_SECRET);
      const sourceAccount = await horizon.loadAccount(keypair.publicKey());
      const usdcAsset = new StellarSdk.Asset("USDC", usdcIssuer);

      const builder = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: config.networkPassphrase,
      });

      if (txData.memo) {
        let memoObj;
        if (txData.memo_type === "id") {
          memoObj = StellarSdk.Memo.id(txData.memo);
        } else if (txData.memo_type === "hash") {
          memoObj = StellarSdk.Memo.hash(txData.memo);
        } else {
          memoObj = StellarSdk.Memo.text(txData.memo);
        }
        builder.addMemo(memoObj);
      }

      builder.addOperation(
        StellarSdk.Operation.payment({
          destination: destinationAddress,
          asset: usdcAsset,
          amount: amountUSDC,
        })
      );

      const tx = builder.setTimeout(180).build();
      tx.sign(keypair);
      const submitRes = await horizon.submitTransaction(tx);
      txHash = submitRes.hash;
      console.log(`[anchor-webhook] Successfully submitted USDC payment. Tx Hash: ${txHash}`);
    } catch (err: any) {
      console.error("[anchor-webhook] Failed to send USDC payment on-chain:", err.message);
      
      // Notify transaction error on platform
      try {
        await callPlatformRpc("notify_transaction_error", {
          transaction_id: reference_id,
          message: `On-chain payout failed: ${err.message}`,
        });
      } catch (rpcErr) {
        console.error("[anchor-webhook] Failed to notify transaction error on Platform:", rpcErr);
      }

      return NextResponse.json({ error: `On-chain payment failed: ${err.message}` }, { status: 500 });
    }

    // 5. Finalize Platform transaction
    try {
      console.log(`[anchor-webhook] Transitioning deposit tx ${reference_id} to completed...`);
      await callPlatformRpc("notify_onchain_funds_sent", {
        transaction_id: reference_id,
        stellar_transaction_id: txHash,
      });
    } catch (err: any) {
      console.error("[anchor-webhook] Failed to mark transaction completed on Platform:", err.message);
    }

    return NextResponse.json({ success: true, txHash });
  } catch (error: any) {
    console.error("[anchor-webhook] Webhook endpoint error:", error);
    return NextResponse.json({ error: error.message || "Webhook processing failed" }, { status: 500 });
  }
}
