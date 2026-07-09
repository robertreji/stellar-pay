import { NextRequest, NextResponse } from "next/server";
import { savePendingWithdrawal } from "@/lib/db";

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
    const { transactionId, token, accountId, amount, kind } = body;

    if (!transactionId || !token || !accountId || !amount || !kind) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const amountVal = parseFloat(amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // 1. Fetch transaction details from Platform API
    const platformTxRes = await fetch(`http://localhost:8085/transactions/${transactionId}`);
    if (!platformTxRes.ok) {
      return NextResponse.json({ error: `Failed to fetch transaction from Platform: ${platformTxRes.statusText}` }, { status: 500 });
    }
    const txData = await platformTxRes.json();
    const asset = txData.amount_expected?.asset || "stellar:USDC:GDCD2HWDLUMQN37V7PMVIMPMT5MD5YPW3P6WPLCVBHQ4F25B2PJOCCB7";

    if (kind === "deposit") {
      // 2. Transition Platform transaction status to pending_user_transfer_start FIRST
      try {
        console.log(`[stellar-pay] Transitioning deposit tx ${transactionId} to pending_user_transfer_start...`);
        const fee = amountVal * 0.1;
        await callPlatformRpc("request_offchain_funds", {
          transaction_id: transactionId,
          message: "waiting on the user to transfer funds",
          amount_in: {
            asset: "iso4217:USD",
            amount: amountVal.toFixed(2),
          },
          amount_out: {
            asset,
            amount: (amountVal - fee).toFixed(2),
          },
          fee_details: {
            total: fee.toFixed(2),
            asset: "iso4217:USD",
          },
        });
      } catch (err: any) {
        console.error("Failed to transition deposit state on Platform:", err);
      }

      // 3. Call bank-sim transfers endpoint to initiate the fiat wire
      //    This synchronously fires the webhook, so the Anchor must already know the amounts!
      console.log(`[stellar-pay] Transferring ${amountVal} USD from ${accountId} to ACC_ANCHOR in bank-sim...`);
      const transferRes = await fetch("http://localhost:8092/transfers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from_account: accountId,
          to_account: "ACC_ANCHOR",
          amount: amountVal,
          currency: "USD",
          reference_id: transactionId,
          idempotency_key: `dep-${transactionId}`,
        }),
      });

      if (!transferRes.ok) {
        const errData = await transferRes.json();
        return NextResponse.json({ error: `Bank transfer failed: ${errData.error}` }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: "Bank deposit authorized and processed! Webhook triggered." });
    } else if (kind === "withdrawal") {
      // 1. Save pending withdrawal info locally
      console.log(`[stellar-pay] Pre-registering withdrawal mapping: tx ${transactionId} -> bank account ${accountId}`);
      savePendingWithdrawal(transactionId, accountId, amountVal);

      // 2. Transition Platform transaction to pending_user_transfer_start (waiting for on-chain payment)
      console.log(`[stellar-pay] Transitioning withdrawal tx ${transactionId} to pending_user_transfer_start...`);
      const fee = amountVal * 0.1;
      await callPlatformRpc("request_onchain_funds", {
        transaction_id: transactionId,
        message: "waiting on the user to transfer funds",
        amount_in: {
          asset,
          amount: amountVal.toFixed(2),
        },
        amount_out: {
          asset: "iso4217:USD",
          amount: (amountVal - fee).toFixed(2),
        },
        fee_details: {
          total: fee.toFixed(2),
          asset,
        },
      });

      return NextResponse.json({ success: true, message: "Bank withdrawal authorized! Waiting for user payment on-chain..." });
    }

    return NextResponse.json({ error: "Invalid kind. Must be 'deposit' or 'withdrawal'" }, { status: 400 });
  } catch (error: any) {
    console.error("Bank settle API error:", error);
    return NextResponse.json({ error: error.message || "Settlement failed" }, { status: 500 });
  }
}

