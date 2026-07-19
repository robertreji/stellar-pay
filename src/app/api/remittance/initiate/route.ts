import { NextRequest, NextResponse } from "next/server";
import { createRemittance } from "@/lib/services/remittanceService";
import { getExchangeRates } from "@/lib/services/exchangeRateService";
import { bankService } from "@/lib/services/bankService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sender_wallet, sender_username, recipient_name, recipient_upi, amount_usdc } = body;

    // 1. Basic validation
    if (!sender_wallet || !sender_username || !recipient_name || !recipient_upi || !amount_usdc) {
      return NextResponse.json(
        { error: "Missing required fields: sender_wallet, sender_username, recipient_name, recipient_upi, amount_usdc" },
        { status: 400 }
      );
    }

    const usdcVal = parseFloat(amount_usdc);
    if (isNaN(usdcVal) || usdcVal <= 0) {
      return NextResponse.json({ error: "Invalid USDC amount" }, { status: 400 });
    }

    // 2. Validate UPI ID against the bank simulator
    console.log(`[api/remittance/initiate] Validating recipient UPI ID ${recipient_upi}...`);
    const validation = await bankService.validateUpiId(recipient_upi);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error || "Recipient UPI ID not found in bank simulator." },
        { status: 400 }
      );
    }

    // 3. Get exchange rates and calculate payout
    const rates = await getExchangeRates();
    const exchangeRate = rates.usdToInrWithSpread;
    const amountInr = parseFloat((usdcVal * exchangeRate).toFixed(2));

    // 4. Generate unique reference ID (fits in a Stellar text memo which is max 28 bytes)
    const randomHex = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    const referenceId = `rem-${randomHex}`.substring(0, 20);

    console.log(`[api/remittance/initiate] Initiating remittance ${referenceId}: ${usdcVal} USDC -> ${amountInr} INR at rate ${exchangeRate}`);

    // 5. Create transaction record in database (default status is 'pending')
    const remittance = await createRemittance({
      reference_id: referenceId,
      sender_wallet,
      sender_username,
      recipient_name,
      recipient_upi,
      amount_usdc: usdcVal,
      exchange_rate: exchangeRate,
      amount_inr: amountInr,
    });

    return NextResponse.json({
      success: true,
      remittance,
    });
  } catch (error: any) {
    console.error("Remittance initiation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to initiate remittance transaction" },
      { status: 500 }
    );
  }
}
