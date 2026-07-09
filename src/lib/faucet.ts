import * as StellarSdk from "@stellar/stellar-sdk";
import { getConfig, setConfig } from "./db";
import { horizon, config } from "./stellar";

// We'll fallback to a stable testnet key if DB is read-only, but try to persist in SQLite
export async function getUsdcIssuerKeypair(): Promise<StellarSdk.Keypair> {
  let secret = getConfig("usdc_issuer_secret");
  if (!secret) {
    const keypair = StellarSdk.Keypair.random();
    secret = keypair.secret();
    try {
      setConfig("usdc_issuer_secret", secret);
      setConfig("usdc_issuer_public", keypair.publicKey());
    } catch (e) {
      console.warn("Failed to save issuer to DB, using memory/ephemeral key:", e);
    }

    // Fund the issuer key so it exists on-chain
    try {
      await fetch(
        `https://friendbot.stellar.org?addr=${encodeURIComponent(
          keypair.publicKey()
        )}`
      );
      // Wait a moment for ledger confirmation
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (err) {
      console.error("Failed to fund USDC issuer:", err);
    }
  }
  return StellarSdk.Keypair.fromSecret(secret);
}

export async function sendStartingUsdc(
  destinationAddress: string,
  amount: string = "100.00"
): Promise<{ success: boolean; hash?: string }> {
  const issuerKeypair = await getUsdcIssuerKeypair();
  const asset = new StellarSdk.Asset("USDC", issuerKeypair.publicKey());

  const issuerAccount = await horizon.loadAccount(issuerKeypair.publicKey());

  const transaction = new StellarSdk.TransactionBuilder(issuerAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: destinationAddress,
        asset: asset,
        amount: amount,
      })
    )
    .setTimeout(180)
    .build();

  transaction.sign(issuerKeypair);

  try {
    const response = await horizon.submitTransaction(transaction);
    return {
      success: true,
      hash: response.hash,
    };
  } catch (err: unknown) {
    const error = err as any;
    const codes = error.response?.data?.extras?.result_codes;
    console.error("USDC Funding failed:", codes);
    throw new Error(
      `USDC Funding failed: ${codes?.transaction || "unknown"} ${
        codes?.operations?.join(", ") || ""
      }`
    );
  }
}
