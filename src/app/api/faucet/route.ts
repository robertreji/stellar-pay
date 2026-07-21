import { NextRequest, NextResponse } from "next/server";
import { fundWithFriendbot, sponsorCreateAccount } from "@/lib/transactions";
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
      const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";
      if (network === "mainnet") {
        const res = await sponsorCreateAccount(address, "2.0");
        return NextResponse.json({
          success: true,
          message: "Funded with XLM via sponsor",
          hash: res.hash,
        });
      } else {
        await fundWithFriendbot(address);
        return NextResponse.json({ success: true, message: "Funded with XLM via Friendbot" });
      }
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
