import { NextRequest, NextResponse } from "next/server";
import { fundWithFriendbot } from "@/lib/transactions";
import { sendStartingUsdc } from "@/lib/faucet";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, asset } = body;

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    if (asset === "XLM") {
      await fundWithFriendbot(address);
      return NextResponse.json({ success: true, message: "Funded with XLM" });
    }

    if (asset === "USDC") {
      const res = await sendStartingUsdc(address);
      return NextResponse.json({
        success: true,
        message: "Funded with USDC",
        hash: res.hash,
      });
    }

    return NextResponse.json(
      { error: "Invalid asset type. Use 'XLM' or 'USDC'" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Faucet API error:", error);
    return NextResponse.json(
      { error: error.message || "Faucet operation failed" },
      { status: 500 }
    );
  }
}
