import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json({ error: "AccountId is required" }, { status: 400 });
    }

    const simRes = await fetch(`http://localhost:8092/accounts/${encodeURIComponent(accountId)}/balance`);
    if (!simRes.ok) {
      const errorData = await simRes.json();
      return NextResponse.json({ error: errorData.error || "Failed to fetch balance from bank-sim" }, { status: simRes.status });
    }

    const data = await simRes.json();
    return NextResponse.json({
      success: true,
      balance: data.balance,
      name: data.name,
      transactions: data.transactions,
    });
  } catch (error: any) {
    console.error("Bank balance API error:", error);
    return NextResponse.json({ error: error.message || "Operation failed" }, { status: 500 });
  }
}

