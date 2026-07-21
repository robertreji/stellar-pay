import { NextRequest, NextResponse } from "next/server";
import { getRemittanceByReferenceId, updateRemittanceStatus } from "@/lib/services/remittanceService";
import { bankService } from "@/lib/services/bankService";
import { horizon } from "@/lib/stellar";

export async function POST(request: NextRequest) {
  try {
    const { reference_id, stellar_tx_hash } = await request.json();

    if (!reference_id || !stellar_tx_hash) {
      return NextResponse.json(
        { error: "Missing required fields: reference_id, stellar_tx_hash" },
        { status: 400 }
      );
    }

    // 1. Fetch remittance from database
    const remittance = await getRemittanceByReferenceId(reference_id);
    if (!remittance) {
      return NextResponse.json({ error: "Remittance record not found" }, { status: 404 });
    }

    // If it's already completed or processing, we don't need to do it again
    if (remittance.status === "completed") {
      return NextResponse.json({ success: true, message: "Remittance already completed" });
    }

    // 2. Fetch transaction from Stellar Horizon to verify it exists and matches
    console.log(`[api/remittance/confirm] Verifying Tx ${stellar_tx_hash} on Stellar network...`);
    let tx;
    try {
      tx = await horizon.transactions().transaction(stellar_tx_hash).call();
    } catch (err) {
      return NextResponse.json({ error: "Stellar transaction not found or pending" }, { status: 400 });
    }

    // Verify memo matches reference ID (prevent double spend or wrong tx spoofing)
    if (tx.memo !== reference_id) {
      return NextResponse.json({ error: "Transaction memo does not match reference ID" }, { status: 400 });
    }

    // 3. Mark as processing and execute bank transfer immediately (real-time)
    console.log(`[api/remittance/confirm] Triggering instant bank payout for ${reference_id}...`);
    await updateRemittanceStatus(reference_id, "processing", stellar_tx_hash);

    const payout = await bankService.payout({
      fromAccount: "ACC_ANCHOR",
      toAccount: remittance.recipient_upi,
      amountUsd: remittance.amount_usdc,
      referenceId: reference_id,
      idempotencyKey: `rem-${reference_id}`,
    });

    if (payout.success) {
      await updateRemittanceStatus(reference_id, "completed", stellar_tx_hash);
      return NextResponse.json({ success: true, message: "Payout completed successfully" });
    } else {
      await updateRemittanceStatus(reference_id, "failed", stellar_tx_hash);
      return NextResponse.json({ error: payout.error || "Bank payout failed" }, { status: 500 });
    }

  } catch (error: any) {
    console.error("Confirm API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to confirm remittance" },
      { status: 500 }
    );
  }
}
