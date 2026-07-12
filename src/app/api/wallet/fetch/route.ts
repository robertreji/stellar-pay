import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    if (!username) {
      return NextResponse.json(
        { error: "Username query parameter is required" },
        { status: 400 }
      );
    }

    const normalizedUsername = username.toLowerCase();

    // Query the backup data
    const { data: backup, error: dbError } = await supabase
      .from("user_wallets")
      .select("encrypted_secret_key, encryption_salt, encryption_iv, owner_address")
      .eq("username", normalizedUsername)
      .maybeSingle();

    if (dbError) {
      console.error("[fetch-route] Error retrieving wallet backup:", dbError);
      return NextResponse.json(
        { error: "Failed to query wallet backup from database" },
        { status: 500 }
      );
    }

    if (!backup) {
      return NextResponse.json(
        { error: "Wallet backup not found for this username" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      encrypted_secret_key: backup.encrypted_secret_key,
      encryption_salt: backup.encryption_salt,
      encryption_iv: backup.encryption_iv,
      owner_address: backup.owner_address,
    });
  } catch (error: any) {
    console.error("Fetch backup route error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process request" },
      { status: 500 }
    );
  }
}
