import { NextRequest, NextResponse } from "next/server";
import { getRemittancesByUsername } from "@/lib/services/remittanceService";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    if (!username) {
      return NextResponse.json({ error: "Username parameter is required" }, { status: 400 });
    }

    const history = await getRemittancesByUsername(username);
    return NextResponse.json({ success: true, remittances: history });
  } catch (error: any) {
    console.error("Remittance history GET error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve remittance history" },
      { status: 500 }
    );
  }
}
