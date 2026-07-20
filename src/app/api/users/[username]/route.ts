import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const normalizedUsername = username.toLowerCase();

    if (normalizedUsername === "_sys_last_synced_ledger_") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check usernames_cache
    const { data: cacheData } = await supabase
      .from("usernames_cache")
      .select("*")
      .eq("username", normalizedUsername)
      .maybeSingle();

    if (cacheData) {
      return NextResponse.json({
        user: {
          username: cacheData.username,
          stellar_address: cacheData.owner_address,
        },
        source: "cache",
      });
    }

    // Check usernames_pending
    const { data: pendingData } = await supabase
      .from("usernames_pending")
      .select("*")
      .eq("username", normalizedUsername)
      .maybeSingle();

    if (pendingData) {
      return NextResponse.json({
        user: {
          username: pendingData.username,
          stellar_address: pendingData.owner_address,
        },
        source: "pending",
      });
    }

    return NextResponse.json({ error: "User not found" }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
