import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const {
      username,
      owner_address,
      encrypted_secret_key,
      encryption_salt,
      encryption_iv,
    } = await request.json();

    if (
      !username ||
      !owner_address ||
      !encrypted_secret_key ||
      !encryption_salt ||
      !encryption_iv
    ) {
      return NextResponse.json(
        { error: "All wallet backup fields are required" },
        { status: 400 }
      );
    }

    const normalizedUsername = username.toLowerCase();

    // 1. Verify the username exists in user_wallets to prevent overwrite
    const { data: existingBackup } = await supabase
      .from("user_wallets")
      .select("username")
      .eq("username", normalizedUsername)
      .maybeSingle();

    if (existingBackup) {
      return NextResponse.json(
        { error: "A wallet backup already exists for this username" },
        { status: 409 }
      );
    }

    // 2. Security Guard: Verify the username is registered on-chain
    // and matches the owner_address of the backup payload
    const { data: cacheData } = await supabase
      .from("usernames_cache")
      .select("owner_address")
      .eq("username", normalizedUsername)
      .maybeSingle();

    const { data: pendingData } = await supabase
      .from("usernames_pending")
      .select("owner_address")
      .eq("username", normalizedUsername)
      .maybeSingle();

    const registeredOwner = cacheData?.owner_address || pendingData?.owner_address;

    if (!registeredOwner) {
      return NextResponse.json(
        { error: "Username must be registered on-chain first" },
        { status: 400 }
      );
    }

    if (registeredOwner !== owner_address) {
      return NextResponse.json(
        { error: "Provided owner_address does not match the registered username owner" },
        { status: 400 }
      );
    }

    // 3. Save the encrypted backup
    const { error: dbError } = await supabase.from("user_wallets").insert({
      username: normalizedUsername,
      owner_address,
      encrypted_secret_key,
      encryption_salt,
      encryption_iv,
    });

    if (dbError) {
      console.error("[save-route] Error saving wallet backup:", dbError);
      return NextResponse.json(
        { error: "Failed to save wallet backup in database" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Save backup route error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process request" },
      { status: 500 }
    );
  }
}
