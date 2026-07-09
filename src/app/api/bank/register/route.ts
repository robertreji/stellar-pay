import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, password, name, initialBalance } = body;

    if (!accountId || !password || !name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const balanceVal = initialBalance ? parseFloat(initialBalance) : 1000.0;

    const simRes = await fetch("http://localhost:8092/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner_type: "user",
        owner_ref: accountId,
        currency: "USD",
        password,
        name,
        initial_balance: balanceVal,
      }),
    });

    if (!simRes.ok) {
      const errorData = await simRes.json();
      return NextResponse.json({ error: errorData.error || "Failed to create account in bank-sim" }, { status: simRes.status });
    }

    return NextResponse.json({ success: true, message: "Bank account created successfully in bank-sim!" });
  } catch (error: any) {
    console.error("Bank register API error:", error);
    return NextResponse.json({ error: error.message || "Registration failed" }, { status: 500 });
  }
}

