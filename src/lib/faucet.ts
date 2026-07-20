import * as StellarSdk from "@stellar/stellar-sdk";
import { horizon, config } from "./stellar";

// USDC issuer secret key — must be set in environment variables for deployment.
// This account must already exist and be funded on the target network.
export function getUsdcIssuerKeypair(): StellarSdk.Keypair {
  const secret = process.env.USDC_ISSUER_SECRET;
  if (!secret) {
    throw new Error(
      "USDC_ISSUER_SECRET environment variable is not configured. " +
      "Set it to the secret key of your USDC issuer account."
    );
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
