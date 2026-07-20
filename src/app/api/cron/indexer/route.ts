import { NextRequest, NextResponse } from "next/server";
import * as StellarSdk from "@stellar/stellar-sdk";
import { supabase } from "@/lib/supabase";

// Security secret to prevent unauthorized triggers of the indexer cron
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    // 1. Verify Vercel Cron Authorization header (or local debug secret)
    const authHeader = request.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const contractId = process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID;
    if (!contractId) {
      return NextResponse.json({ error: "Registry contract ID not configured on server" }, { status: 500 });
    }

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";
    const rpc = new StellarSdk.rpc.Server(rpcUrl);

    // 2. Fetch the last synced ledger sequence from Supabase (or fallback to latest - 100)
    let lastLedger = 0;
    const { data: syncRow } = await supabase
      .from("usernames_cache")
      .select("last_synced_ledger")
      .eq("username", "_sys_last_synced_ledger_")
      .maybeSingle();

    const latestInfo = await rpc.getLatestLedger();
    const currentHeight = latestInfo.sequence;

    if (syncRow && syncRow.last_synced_ledger) {
      lastLedger = Number(syncRow.last_synced_ledger);
    } else {
      // Fallback: start 100 ledgers back from latest
      lastLedger = currentHeight - 100;
    }

    if (lastLedger > currentHeight) {
      return NextResponse.json({
        success: true,
        message: `Indexer is up to date. Start ledger (${lastLedger}) is ahead of current height (${currentHeight}).`
      });
    }

    console.log(`[cron-indexer] Syncing from ledger ${lastLedger} to ${currentHeight}...`);

    // 3. Query events from RPC (cap at 100 events)
    const response = await rpc.getEvents({
      startLedger: lastLedger,
      filters: [
        {
          type: "contract",
          contractIds: [contractId],
        },
      ],
      limit: 100,
    });

    const events = response.events || [];
    let registeredCount = 0;
    let releasedCount = 0;

    for (const event of events) {
      if (!event.topic || event.topic.length < 2) continue;

      let topic0 = "";
      try {
        topic0 = StellarSdk.scValToNative(event.topic[0]);
      } catch (e) {
        continue;
      }

      if (topic0 === "reg") {
        let username = "";
        let owner = "";
        try {
          username = StellarSdk.scValToNative(event.topic[1]);
          owner = StellarSdk.scValToNative(event.value);
        } catch (e) {
          console.error("[cron-indexer] Error parsing registration event:", e);
          continue;
        }

        console.log(`[cron-indexer] Syncing @${username} -> ${owner}`);

        // Authoritative write to cache
        await supabase.from("usernames_cache").upsert({
          username: username.toLowerCase(),
          owner_address: owner,
          tx_hash: event.txHash || "",
          registered_at: new Date().toISOString(),
          last_synced_ledger: event.ledger,
        });

        // Delete from pending table
        await supabase.from("usernames_pending").delete().eq("username", username.toLowerCase());
        registeredCount++;

      } else if (topic0 === "release") {
        let username = "";
        try {
          username = StellarSdk.scValToNative(event.topic[1]);
        } catch (e) {
          console.error("[cron-indexer] Error parsing release event:", e);
          continue;
        }

        console.log(`[cron-indexer] Releasing username: @${username}`);

        await supabase
          .from("usernames_cache")
          .delete()
          .eq("username", username.toLowerCase());
        releasedCount++;
      }
    }

    // 4. Update the sync height row in Supabase to mark our progress
    const nextStartLedger = currentHeight + 1;
    await supabase.from("usernames_cache").upsert({
      username: "_sys_last_synced_ledger_",
      owner_address: "SYSTEM", // Required field
      last_synced_ledger: nextStartLedger,
      registered_at: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      range: `${lastLedger} to ${currentHeight}`,
      processed: events.length,
      registrations: registeredCount,
      releases: releasedCount,
      nextStartLedger
    });

  } catch (error: any) {
    console.error("Cron indexer error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute cron indexer" },
      { status: 500 }
    );
  }
}
