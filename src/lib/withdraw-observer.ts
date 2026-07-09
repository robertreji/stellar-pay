import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "stellarpay.db");

// Initialize sqlite db connection directly
let db: Database.Database;
try {
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  console.log(`[withdraw-observer] Connected to database: ${DB_PATH}`);
} catch (e: any) {
  console.error("[withdraw-observer] Database connection failed:", e.message);
  process.exit(1);
}

// JSON-RPC helper for Platform API
async function callPlatformRpc(method: string, params: any) {
  const url = "http://localhost:8085"; // Platform API endpoint
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      {
        id: Math.random().toString(36).substring(2, 9),
        jsonrpc: "2.0",
        method,
        params,
      },
    ]),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Platform RPC error (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  if (json[0]?.error) {
    throw new Error(`Platform RPC error payload: ${JSON.stringify(json[0].error)}`);
  }
  return json[0]?.result;
}

// Database helper functions
function getPendingWithdrawal(transactionId: string) {
  try {
    return db.prepare("SELECT * FROM pending_withdrawals WHERE transaction_id = ?").get(transactionId) as any;
  } catch {
    return null;
  }
}

function deletePendingWithdrawal(transactionId: string) {
  try {
    db.prepare("DELETE FROM pending_withdrawals WHERE transaction_id = ?").run(transactionId);
  } catch (err: any) {
    console.error(`[withdraw-observer] Failed to delete pending withdrawal ${transactionId}:`, err.message);
  }
}

async function checkPendingWithdrawals() {
  try {
    // 1. Fetch pending_anchor transactions from Platform
    const platformRes = await fetch("http://localhost:8085/transactions?sep=24");
    if (!platformRes.ok) {
      console.error(`[withdraw-observer] Failed to fetch transactions from Platform: ${platformRes.statusText}`);
      return;
    }

    const data = await platformRes.json();
    const transactions = data.records || [];

    // Filter for kind = withdrawal and status = pending_anchor
    const pendingWithdrawals = transactions.filter(
      (tx: any) => tx.kind === "withdrawal" && tx.status === "pending_anchor"
    );

    if (pendingWithdrawals.length > 0) {
      console.log(`[withdraw-observer] Found ${pendingWithdrawals.length} pending withdrawals on Platform.`);
    }

    for (const tx of pendingWithdrawals) {
      const txId = tx.id;
      const mappedRecord = getPendingWithdrawal(txId);

      if (!mappedRecord) {
        console.warn(`[withdraw-observer] WARNING: Withdrawal transaction ${txId} is pending_anchor, but has no local mapping in pending_withdrawals. Skipping.`);
        continue;
      }

      const { bank_account_id, amount } = mappedRecord;
      console.log(`[withdraw-observer] Mapped withdrawal ${txId} to bank account: ${bank_account_id}, amount: ${amount} USD`);

      // 2. Call bank-sim transfers endpoint
      console.log(`[withdraw-observer] Initiating bank-sim transfer of ${amount} USD from ACC_ANCHOR to ${bank_account_id}...`);
      try {
        const transferRes = await fetch("http://localhost:8092/transfers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from_account: "ACC_ANCHOR",
            to_account: bank_account_id,
            amount: parseFloat(amount),
            currency: "USD",
            reference_id: txId,
            idempotency_key: `with-${txId}`,
          }),
        });

        if (!transferRes.ok) {
          // If conflict (409) is returned, it means transfer was already executed. We can treat it as success.
          if (transferRes.status === 409) {
            console.log(`[withdraw-observer] Bank transfer was already executed for withdrawal ${txId}. Proceeding to finalize.`);
          } else {
            const errData = await transferRes.json();
            throw new Error(`Bank simulator returned error: ${errData.error}`);
          }
        }

        // 3. Transition Platform status to completed
        console.log(`[withdraw-observer] Transitioning withdrawal tx ${txId} to completed...`);
        await callPlatformRpc("notify_offchain_funds_sent", {
          transaction_id: txId,
          message: "Funds delivered to bank account.",
        });

        // 4. Remove mapping from DB
        deletePendingWithdrawal(txId);
        console.log(`[withdraw-observer] Successfully completed withdrawal transaction: ${txId}`);

      } catch (transferErr: any) {
        console.error(`[withdraw-observer] Failed to execute bank payout for transaction ${txId}:`, transferErr.message);
      }
    }
  } catch (error: any) {
    console.error("[withdraw-observer] Error checking pending withdrawals:", error.message);
  }
}

// Polling interval (5 seconds)
const INTERVAL = 5000;
console.log(`[withdraw-observer] Starting withdrawal observer. Polling Platform API every ${INTERVAL / 1000}s...`);

setInterval(checkPendingWithdrawals, INTERVAL);

// Run immediately on start
checkPendingWithdrawals();
