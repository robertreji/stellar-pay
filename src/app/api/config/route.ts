import { NextRequest, NextResponse } from "next/server";
import { USDC_ISSUER } from "@/lib/stellar";
import { getConfig } from "@/lib/db";
import os from "os";

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

export async function GET(_request: NextRequest) {
  try {
    const dbIssuer = getConfig("usdc_issuer_public");
    return NextResponse.json({
      network: "testnet",
      usdcIssuer: dbIssuer || USDC_ISSUER,
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


