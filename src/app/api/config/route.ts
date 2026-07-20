import { NextRequest, NextResponse } from "next/server";
import { USDC_ISSUER } from "@/lib/stellar";
import os from "os";

import * as StellarSdk from "@stellar/stellar-sdk";

function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    if (iface) {
      for (const alias of iface) {
        if (alias.family === "IPv4" && !alias.internal) {
          return alias.address;
        }
      }
    }
  }
  return "localhost";
}

const SPONSOR_SECRET = process.env.SPONSOR_SECRET_KEY || "SCD63ZJ2DNEDU5RO5F7S245PYE5DNI3KNIKOOVLY3GZRHIUC3HNWLKHZ";
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
      localIp: getLocalIpAddress(),
    });
  } catch (error) {
    console.error("Config GET error:", error);
    return NextResponse.json(
      { error: "Failed to get config" },
      { status: 500 }
    );
  }
}
