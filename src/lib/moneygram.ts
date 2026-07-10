import * as StellarSdk from "@stellar/stellar-sdk";
import { config } from "./stellar";

const ANCHOR_URL =
  process.env.NEXT_PUBLIC_ANCHOR_URL || "http://127.0.0.1:8080";

export interface InteractiveResponse {
  type: string;
  url: string;
  id: string;
}

export interface AnchorTransaction {
  id: string;
  status: string;
  amount_in: string;
  amount_out: string;
  withdraw_memo?: string;
  withdraw_memo_type?: string;
  withdraw_anchor_account?: string;
}

// 1. SEP-10 Web Authentication Flow
export async function authenticateWithAnchor(
  publicKey: string,
  secretKey: string
): Promise<string> {
  console.log("authenticateWithAnchor started for:", publicKey);
  // A. Request Challenge Transaction from Anchor
  console.log("Fetching challenge from:", `${ANCHOR_URL}/auth?account=${encodeURIComponent(publicKey)}`);
  const challengeRes = await fetch(
    `${ANCHOR_URL}/auth?account=${encodeURIComponent(publicKey)}`
  );
  console.log("Challenge response status:", challengeRes.status);
  if (!challengeRes.ok) {
    throw new Error("Failed to fetch auth challenge from anchor");
  }
  const challengeData = await challengeRes.json();
  const challengeXdr = challengeData.transaction;
  console.log("Got challenge XDR");

  // B. Sign the Challenge Transaction locally
  const transaction = StellarSdk.TransactionBuilder.fromXDR(
    challengeXdr,
    config.networkPassphrase
  ) as StellarSdk.Transaction;

  const keypair = StellarSdk.Keypair.fromSecret(secretKey);
  transaction.sign(keypair);
  const signedXdr = transaction.toXDR();
  console.log("Signed challenge XDR");

  // C. Submit the signed challenge back to Anchor to get JWT token
  console.log("Submitting signed challenge to get JWT...");
  const tokenRes = await fetch(`${ANCHOR_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transaction: signedXdr }),
  });
  console.log("Token response status:", tokenRes.status);

  if (!tokenRes.ok) {
    throw new Error("Failed to authenticate challenge with anchor");
  }

  const tokenData = await tokenRes.json();
  console.log("Got token successfully");
  return tokenData.token;
}

// 2. SEP-24 Interactive Withdraw Initiation
export async function initiateWithdraw(
  publicKey: string,
  secretKey: string,
  assetCode: string = "USDC",
  amount?: string
): Promise<InteractiveResponse> {
  // Authenticate first to get the JWT token
  const token = await authenticateWithAnchor(publicKey, secretKey);

  const requestBody: any = {
    asset_code: assetCode,
    account: publicKey,
  };
  if (amount) {
    requestBody.amount = amount;
  }

  // Call the interactive withdraw endpoint
  const response = await fetch(`${ANCHOR_URL}/sep24/transactions/withdraw/interactive`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anchor withdrawal initiation failed: ${errorText}`);
  }

  return response.json();
}

// 2B. SEP-24 Interactive Deposit Initiation
export async function initiateDeposit(
  publicKey: string,
  secretKey: string,
  assetCode: string = "USDC",
  amount?: string
): Promise<InteractiveResponse> {
  // Authenticate first to get the JWT token
  const token = await authenticateWithAnchor(publicKey, secretKey);

  const requestBody: any = {
    asset_code: assetCode,
    account: publicKey,
  };
  if (amount) {
    requestBody.amount = amount;
  }

  // Call the interactive deposit endpoint
  const response = await fetch(`${ANCHOR_URL}/sep24/transactions/deposit/interactive`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anchor deposit initiation failed: ${errorText}`);
  }

  return response.json();
}

// 3. Poll Anchor Transaction Status
export async function getAnchorTransaction(
  token: string,
  transactionId: string
): Promise<AnchorTransaction> {
  const response = await fetch(
    `/api/anchor/transaction?id=${encodeURIComponent(transactionId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch transaction details from anchor");
  }

  const data = await response.json();
  return data.transaction || data;
}
export { ANCHOR_URL };

