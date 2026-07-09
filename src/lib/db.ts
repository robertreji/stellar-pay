import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "stellarpay.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL COLLATE NOCASE,
        stellar_address TEXT UNIQUE NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS bank_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        balance REAL NOT NULL DEFAULT 1000.0,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS bank_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        timestamp TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(account_id) REFERENCES bank_accounts(account_id)
      );
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_address ON users(stellar_address);
      CREATE INDEX IF NOT EXISTS idx_bank_accounts_id ON bank_accounts(account_id);
      CREATE TABLE IF NOT EXISTS pending_withdrawals (
        transaction_id TEXT PRIMARY KEY,
        bank_account_id TEXT NOT NULL,
        amount REAL NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_pending_withdrawals_id ON pending_withdrawals(transaction_id);
    `);
  }
  return db;
}

export function getConfig(key: string): string | null {
  const database = getDb();
  const row = database
    .prepare("SELECT value FROM config WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setConfig(key: string, value: string): void {
  const database = getDb();
  database
    .prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)")
    .run(key, value);
}


export interface User {
  id: number;
  username: string;
  stellar_address: string;
  created_at: string;
}

export function registerUser(
  username: string,
  stellarAddress: string
): { success: boolean; error?: string } {
  const database = getDb();

  // Check if username is taken
  const existingUsername = database
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(username) as User | undefined;
  if (existingUsername) {
    return { success: false, error: "Username already taken" };
  }

  // Check if address is already registered
  const existingAddress = database
    .prepare("SELECT id FROM users WHERE stellar_address = ?")
    .get(stellarAddress) as User | undefined;
  if (existingAddress) {
    return { success: false, error: "This address is already registered" };
  }

  try {
    database
      .prepare("INSERT INTO users (username, stellar_address) VALUES (?, ?)")
      .run(username, stellarAddress);
    return { success: true };
  } catch {
    return { success: false, error: "Registration failed" };
  }
}

export function getUserByUsername(username: string): User | null {
  const database = getDb();
  const user = database
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username) as User | undefined;
  return user || null;
}

export function getUserByAddress(stellarAddress: string): User | null {
  const database = getDb();
  const user = database
    .prepare("SELECT * FROM users WHERE stellar_address = ?")
    .get(stellarAddress) as User | undefined;
  return user || null;
}

export function searchUsers(query: string, limit: number = 10): User[] {
  const database = getDb();
  const users = database
    .prepare(
      "SELECT * FROM users WHERE username LIKE ? ORDER BY username LIMIT ?"
    )
    .all(`%${query}%`, limit) as User[];
  return users;
}

export interface BankAccount {
  id: number;
  account_id: string;
  password?: string;
  name: string;
  balance: number;
  created_at: string;
}

export interface BankTransaction {
  id: number;
  account_id: string;
  type: string;
  amount: number;
  timestamp: string;
}

export function createBankAccount(
  accountId: string,
  passwordPlain: string,
  name: string,
  initialBalance: number = 1000.0
): { success: boolean; error?: string } {
  const database = getDb();
  try {
    database
      .prepare(
        "INSERT INTO bank_accounts (account_id, password, name, balance) VALUES (?, ?, ?, ?)"
      )
      .run(accountId, passwordPlain, name, initialBalance);
    // Log initial deposit transaction
    logBankTransaction(accountId, "INITIAL_DEPOSIT", initialBalance);
    return { success: true };
  } catch (err: any) {
    console.error("Create bank account failed:", err);
    return { success: false, error: err.message || "Account creation failed" };
  }
}

export function getBankAccount(accountId: string): BankAccount | null {
  const database = getDb();
  try {
    const row = database
      .prepare("SELECT * FROM bank_accounts WHERE account_id = ?")
      .get(accountId) as BankAccount | undefined;
    return row || null;
  } catch {
    return null;
  }
}

export function updateBankBalance(accountId: string, amountChange: number): boolean {
  const database = getDb();
  try {
    const account = getBankAccount(accountId);
    if (!account) return false;
    const newBalance = account.balance + amountChange;
    if (newBalance < 0) return false; // Prevent overdraft
    database
      .prepare("UPDATE bank_accounts SET balance = ? WHERE account_id = ?")
      .run(newBalance, accountId);
    return true;
  } catch (err) {
    console.error("Update bank balance failed:", err);
    return false;
  }
}

export function logBankTransaction(accountId: string, type: string, amount: number): void {
  const database = getDb();
  try {
    database
      .prepare("INSERT INTO bank_transactions (account_id, type, amount) VALUES (?, ?, ?)")
      .run(accountId, type, amount);
  } catch (err) {
    console.error("Log bank transaction failed:", err);
  }
}

export function getBankTransactions(accountId: string): BankTransaction[] {
  const database = getDb();
  try {
    return database
      .prepare("SELECT * FROM bank_transactions WHERE account_id = ? ORDER BY id DESC")
      .all(accountId) as BankTransaction[];
  } catch {
    return [];
  }
}

export function savePendingWithdrawal(transactionId: string, bankAccountId: string, amount: number): void {
  const database = getDb();
  database
    .prepare("INSERT OR REPLACE INTO pending_withdrawals (transaction_id, bank_account_id, amount) VALUES (?, ?, ?)")
    .run(transactionId, bankAccountId, amount);
}

export function getPendingWithdrawal(transactionId: string): { transaction_id: string; bank_account_id: string; amount: number } | null {
  const database = getDb();
  try {
    const row = database
      .prepare("SELECT * FROM pending_withdrawals WHERE transaction_id = ?")
      .get(transactionId) as any;
    return row || null;
  } catch {
    return null;
  }
}

export function deletePendingWithdrawal(transactionId: string): void {
  const database = getDb();
  database
    .prepare("DELETE FROM pending_withdrawals WHERE transaction_id = ?")
    .run(transactionId);
}


