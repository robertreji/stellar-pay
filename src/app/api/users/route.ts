import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const address = searchParams.get("address");

    // Lookup by address
    if (address) {
      // First check usernames_cache
      const { data: cacheData } = await supabase
        .from("usernames_cache")
        .select("*")
        .eq("owner_address", address)
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

      // Then check usernames_pending
      const { data: pendingData } = await supabase
        .from("usernames_pending")
        .select("*")
        .eq("owner_address", address)
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

      return NextResponse.json({ user: null });
    }

    // Search by username query
    if (query) {
      // Search in cache
      const { data: cacheUsers } = await supabase
        .from("usernames_cache")
        .select("username, owner_address")
        .ilike("username", `%${query}%`)
        .limit(10);

      // Search in pending
      const { data: pendingUsers } = await supabase
        .from("usernames_pending")
        .select("username, owner_address")
        .ilike("username", `%${query}%`)
        .limit(10);

      const combined = [
        ...(cacheUsers || []).map((u) => ({
          username: u.username,
          stellar_address: u.owner_address,
          status: "confirmed",
        })),
        ...(pendingUsers || []).map((u) => ({
          username: u.username,
          stellar_address: u.owner_address,
          status: "pending",
        })),
      ];

      // Deduplicate by username
      const seen = new Set();
      const unique = combined.filter((u) => {
        if (seen.has(u.username)) return false;
        seen.add(u.username);
        return true;
      });

      return NextResponse.json({
        users: unique,
        source: "cache",
      });
    }

    return NextResponse.json(
      { error: "Provide ?address= or ?q= parameter" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Users API GET error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
