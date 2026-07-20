import { NextRequest, NextResponse } from "next/server";
import { USDC_ISSUER } from "@/lib/stellar";

import * as StellarSdk from "@stellar/stellar-sdk";

const SPONSOR_SECRET = process.env.SPONSOR_SECRET_KEY;
if (!SPONSOR_SECRET) {
  throw new Error("SPONSOR_SECRET_KEY environment variable is required");
}
const anchorKeypair = StellarSdk.Keypair.fromSecret(SPONSOR_SECRET);
const anchorAddress = anchorKeypair.publicKey();

export async function GET(_request: NextRequest) {
  try {
    // Read USDC issuer from env var, falling back to the value in stellar.ts
    const usdcIssuerPublic = process.env.USDC_ISSUER_PUBLIC || USDC_ISSUER;
    return NextResponse.json({
      network: process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet",
      usdcIssuer: usdcIssuerPublic,
      anchorAddress: anchorAddress,
    });
  } catch (error) {
    console.error("Config GET error:", error);
    return NextResponse.json(
      { error: "Failed to get config" },
      { status: 500 }
    );
  }
}
