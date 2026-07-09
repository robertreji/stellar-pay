import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, password } = body;

    if (!accountId || !password) {
      return NextResponse.json({ error: "Account ID and password are required" }, { status: 400 });
    }

    const simRes = await fetch("http://localhost:8092/accounts/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, password }),
    });

    if (!simRes.ok) {
      const errorData = await simRes.json();
      return NextResponse.json({ error: errorData.error || "Login failed in bank-sim" }, { status: simRes.status });
    }

    const data = await simRes.json();
    return NextResponse.json({
      success: true,
      account: {
        accountId: data.account.id,
        name: data.account.name,
        balance: data.account.balance,
      },
    });
  } catch (error: any) {
    console.error("Bank login API error:", error);
    return NextResponse.json({ error: error.message || "Login failed" }, { status: 500 });
  }
}

