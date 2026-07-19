import { NextRequest, NextResponse } from "next/server";
import { USDC_ISSUER } from "@/lib/stellar";
import { getConfig } from "@/lib/db";
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
    const dbIssuer = getConfig("usdc_issuer_public");
    return NextResponse.json({
      network: "testnet",
      usdcIssuer: dbIssuer || USDC_ISSUER,
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


