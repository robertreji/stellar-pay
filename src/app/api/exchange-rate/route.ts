import { NextRequest, NextResponse } from "next/server";
import { getExchangeRates } from "@/lib/services/exchangeRateService";

export async function GET(request: NextRequest) {
  try {
    const rates = await getExchangeRates();
    return NextResponse.json({ success: true, rates });
  } catch (error: any) {
    console.error("Exchange rate endpoint error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch exchange rates" },
      { status: 500 }
    );
  }
}
