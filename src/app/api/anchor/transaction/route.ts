import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const token = request.headers.get("Authorization");

    if (!id) {
      return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
    }

    const ANCHOR_URL = process.env.NEXT_PUBLIC_ANCHOR_URL || "http://localhost:8080";
    
    console.log(`[anchor-proxy] Proxying getAnchorTransaction for ID: ${id}`);
    const anchorRes = await fetch(`${ANCHOR_URL}/sep24/transaction?id=${encodeURIComponent(id)}`, {
      headers: {
        ...(token ? { Authorization: token } : {}),
      },
    });

    if (!anchorRes.ok) {
      const errText = await anchorRes.text();
      return NextResponse.json({ error: `Anchor returned error: ${errText}` }, { status: anchorRes.status });
    }

    const data = await anchorRes.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Proxy anchor fetch error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch transaction details" }, { status: 500 });
  }
}
