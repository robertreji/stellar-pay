import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import * as StellarSdk from "@stellar/stellar-sdk";
import { createClient } from "@supabase/supabase-js";

// Load dotenv from .env.local
const rootDir = path.join(__dirname, "..", "..");
const envPath = path.join(rootDir, ".env.local");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`[indexer] Loaded env file from ${envPath}`);
} else {
  console.warn(`[indexer] WARNING: .env.local not found at ${envPath}`);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
let supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseServiceRoleKey || supabaseServiceRoleKey.includes("your-supabase")) {
  supabaseServiceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
}

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("[indexer] Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/ANON_KEY must be configured!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";
const rpc = new StellarSdk.rpc.Server(rpcUrl);

const contractId = process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID!;
if (!contractId) {
  console.error("[indexer] Error: NEXT_PUBLIC_REGISTRY_CONTRACT_ID must be configured!");
  process.exit(1);
}

const LEDGER_FILE = path.join(rootDir, "last_synced_ledger.txt");
const POLL_INTERVAL_MS = 5000;

async function getStartLedger(): Promise<number> {
  if (fs.existsSync(LEDGER_FILE)) {
    const raw = fs.readFileSync(LEDGER_FILE, "utf-8").trim();
    const val = parseInt(raw, 10);
    if (!isNaN(val)) {
      return val;
    }
  }
  
  // Fallback: get current ledger and start from 10 ledgers back
  console.log("[indexer] No sync ledger file found. Querying RPC for current ledger...");
  const latest = await rpc.getLatestLedger();
  const start = latest.sequence - 10;
  fs.writeFileSync(LEDGER_FILE, start.toString(), "utf-8");
  return start;
}

async function runIndexer() {
  console.log("==================================================");
  console.log(`[indexer] Registry Event Indexer Started`);
  console.log(`[indexer] Contract ID: ${contractId}`);
  console.log(`[indexer] RPC URL: ${rpcUrl}`);
  console.log("==================================================");

  let lastLedger = await getStartLedger();

  while (true) {
    try {
      const latestInfo = await rpc.getLatestLedger();
      const currentHeight = latestInfo.sequence;

      if (lastLedger > currentHeight) {
        console.log(`[indexer] lastLedger (${lastLedger}) is ahead of current ledger (${currentHeight}). Waiting...`);
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        continue;
      }

      console.log(`[indexer] Querying events from ledger ${lastLedger} to ${currentHeight}...`);

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
      if (events.length > 0) {
        console.log(`[indexer] Found ${events.length} events.`);
      }

      for (const event of events) {
        // Parse topic[0] which is ScVal Symbol for event name (e.g. "reg", "release")
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
            console.error("[indexer] Error parsing registration event ScVals:", e);
            continue;
          }

          console.log(`[indexer] Observed on-chain registration: @${username} -> ${owner}`);

          // Authoritative write to usernames_cache
          const { error: upsertErr } = await supabase.from("usernames_cache").upsert({
            username: username.toLowerCase(),
            owner_address: owner,
            tx_hash: event.txHash || "",
            registered_at: new Date().toISOString(),
            last_synced_ledger: event.ledger,
          });

          if (upsertErr) {
            console.error(`[indexer] Error caching username @${username}:`, upsertErr);
          } else {
            // Delete matching row from usernames_pending
            await supabase.from("usernames_pending").delete().eq("username", username.toLowerCase());
          }

        } else if (topic0 === "release") {
          let username = "";
          try {
            username = StellarSdk.scValToNative(event.topic[1]);
          } catch (e) {
            console.error("[indexer] Error parsing release event ScVals:", e);
            continue;
          }

          console.log(`[indexer] Observed on-chain release of username: @${username}`);

          const { error: deleteErr } = await supabase
            .from("usernames_cache")
            .delete()
            .eq("username", username.toLowerCase());

          if (deleteErr) {
            console.error(`[indexer] Error deleting released username @${username}:`, deleteErr);
          }
        }
      }

      // Save next start ledger (current ledger + 1)
      lastLedger = currentHeight + 1;
      fs.writeFileSync(LEDGER_FILE, lastLedger.toString(), "utf-8");

    } catch (error: any) {
      console.error("[indexer] Error during sync loop:", error.message || error);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

runIndexer().catch((err) => {
  console.error("[indexer] Indexer crash:", err);
  process.exit(1);
});
