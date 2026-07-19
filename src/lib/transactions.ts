import * as StellarSdk from "@stellar/stellar-sdk";
import { horizon, config, getUsdcAsset } from "./stellar";

export async function buildPaymentTx(
  sourceAddress: string,
  destinationAddress: string,
  amount: string,
  assetType: "XLM" | "USDC" = "XLM",
  usdcIssuer?: string,
  memo?: string
): Promise<string> {
  const account = await horizon.loadAccount(sourceAddress);
  const asset =
    assetType === "USDC" ? getUsdcAsset(usdcIssuer) : StellarSdk.Asset.native();

  const builder = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  });

  if (memo) {
    builder.addMemo(StellarSdk.Memo.text(memo));
  }

  const transaction = builder
    .addOperation(
      StellarSdk.Operation.payment({
        destination: destinationAddress,
        asset: asset,
        amount: amount,
      })
    )
    .setTimeout(180)
    .build();

  return transaction.toXDR();
}

export async function submitClassicTransaction(signedXdr: string) {
  const transaction = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    config.networkPassphrase
  ) as StellarSdk.Transaction;

  try {
    const response = await horizon.submitTransaction(transaction);
    return {
      success: true,
      hash: response.hash,
      ledger: response.ledger,
    };
  } catch (error: unknown) {
    const err = error as {
      response?: { data?: { extras?: { result_codes?: { operations?: string[]; transaction?: string } } } };
    };
    const codes = err.response?.data?.extras?.result_codes;
    throw new Error(
      `Transaction failed: ${codes?.transaction || "unknown"} ${
        codes?.operations?.join(", ") || ""
      }`
    );
  }
}

export async function fundWithFriendbot(
  address: string
): Promise<{ success: boolean }> {
  if (!config.friendbotUrl) {
    throw new Error("Friendbot not available on this network");
  }
  const response = await fetch(
    `${config.friendbotUrl}?addr=${encodeURIComponent(address)}`
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Friendbot failed: ${text}`);
  }
  return { success: true };
}

export async function buildChangeTrustTx(
  sourceAddress: string,
  asset: StellarSdk.Asset
): Promise<string> {
  const account = await horizon.loadAccount(sourceAddress);
  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: asset,
      })
    )
    .setTimeout(180)
    .build();

  return transaction.toXDR();
}

export async function buildSwapTx(
  sourceAddress: string,
  destAsset: StellarSdk.Asset,
  destAmount: string
): Promise<string> {
  const account = await horizon.loadAccount(sourceAddress);
  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.pathPaymentStrictReceive({
        sendAsset: StellarSdk.Asset.native(),
        sendMax: "500.00",
        destination: sourceAddress,
        destAsset: destAsset,
        destAmount: destAmount,
        path: [],
      })
    )
    .setTimeout(180)
    .build();

  return transaction.toXDR();
}


