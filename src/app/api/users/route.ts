import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

import * as StellarSdk from "@stellar/stellar-sdk";

async function queryOnChainUsername(username: string): Promise<string | null> {
  try {
    const contractId = process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID;
    if (!contractId) return null;

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";
    const rpc = new StellarSdk.rpc.Server(rpcUrl);

    const enumVariant = StellarSdk.nativeToScVal("Username", { type: "symbol" });
    const usernameVal = StellarSdk.nativeToScVal(username.toLowerCase(), { type: "string" });
    const keyScVal = StellarSdk.xdr.ScVal.scvVec([enumVariant, usernameVal]);

    const ledgerKey = StellarSdk.xdr.LedgerKey.contractData(
      new StellarSdk.xdr.LedgerKeyContractData({
        contract: new StellarSdk.Address(contractId).toScAddress(),
        key: keyScVal,
        durability: StellarSdk.xdr.ContractDataDurability.persistent(),
      })
    );

    const entries = await rpc.getLedgerEntries(ledgerKey);
    if (!entries.entries || entries.entries.length === 0) {
      return null;
    }

    const contractDataVal = entries.entries[0].val.contractData().val();
    return StellarSdk.scValToNative(contractDataVal);
  } catch (err) {
    console.error("[users-route] On-chain fallback query failed:", err);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const address = searchParams.get("address");

    // Lookup by address
    if (address) {
      try {
        // First check usernames_cache (excluding internal tracking keys)
        const { data: cacheData, error: cacheErr } = await supabase
          .from("usernames_cache")
          .select("*")
          .neq("username", "_sys_last_synced_ledger_")
          .eq("owner_address", address)
          .maybeSingle();

        if (cacheErr) throw cacheErr;

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
        const { data: pendingData, error: pendingErr } = await supabase
          .from("usernames_pending")
          .select("*")
          .eq("owner_address", address)
          .maybeSingle();

        if (pendingErr) throw pendingErr;

        if (pendingData) {
          return NextResponse.json({
            user: {
              username: pendingData.username,
              stellar_address: pendingData.owner_address,
            },
            source: "pending",
          });
        }
      } catch (dbErr) {
        console.warn("[users-route] Database address lookup failed, returning user null:", dbErr);
      }

      return NextResponse.json({ user: null });
    }

    // Search by username query
    if (query) {
      const cleanQuery = query.trim().replace(/^@/, "");
      let cacheUsers: any[] = [];
      let pendingUsers: any[] = [];
      let dbFailed = false;

      try {
        // Search in cache (excluding the indexer tracking row)
        const { data, error } = await supabase
          .from("usernames_cache")
          .select("username, owner_address")
          .neq("username", "_sys_last_synced_ledger_")
          .ilike("username", `%${cleanQuery}%`)
          .limit(10);
        if (error) throw error;
        cacheUsers = data || [];
      } catch (err) {
        console.error("[users-route] Failed to fetch cache users:", err);
        dbFailed = true;
      }

      try {
        // Search in pending
        const { data, error } = await supabase
          .from("usernames_pending")
          .select("username, owner_address")
          .ilike("username", `%${cleanQuery}%`)
          .limit(10);
        if (error) throw error;
        pendingUsers = data || [];
      } catch (err) {
        console.error("[users-route] Failed to fetch pending users:", err);
        dbFailed = true;
      }

      const combined = [
        ...cacheUsers.map((u) => ({
          username: u.username,
          stellar_address: u.owner_address,
          status: "confirmed",
        })),
        ...pendingUsers.map((u) => ({
          username: u.username,
          stellar_address: u.owner_address,
          status: "pending",
        })),
      ];

      // On-chain direct fallback if database fails or is empty, and query looks like a specific username
      if ((combined.length === 0 || dbFailed) && /^[a-z0-9_]{3,20}$/i.test(cleanQuery)) {
        console.log(`[users-route] Database check returned empty/failed. Attempting on-chain fallback for exact username: @${cleanQuery}`);
        const onChainAddress = await queryOnChainUsername(cleanQuery);
        if (onChainAddress) {
          combined.push({
            username: cleanQuery.toLowerCase(),
            stellar_address: onChainAddress,
            status: "confirmed",
          });
        }
      }

      // Deduplicate by username
      const seen = new Set();
      const unique = combined.filter((u) => {
        if (seen.has(u.username)) return false;
        seen.add(u.username);
        return true;
      });

      return NextResponse.json({
        users: unique,
        source: dbFailed ? "on-chain-fallback" : "cache",
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
