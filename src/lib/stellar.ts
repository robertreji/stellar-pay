import * as StellarSdk from "@stellar/stellar-sdk";

const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";

export const config = {
  testnet: {
    horizonUrl:
      process.env.NEXT_PUBLIC_HORIZON_URL ||
      "https://horizon-testnet.stellar.org",
    rpcUrl:
      process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org",
    networkPassphrase: StellarSdk.Networks.TESTNET,
    friendbotUrl:
      process.env.NEXT_PUBLIC_FRIENDBOT_URL || "https://friendbot.stellar.org",
  },
  mainnet: {
    horizonUrl: "https://horizon.stellar.org",
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "",
    networkPassphrase: StellarSdk.Networks.PUBLIC,
    friendbotUrl: null as string | null,
  },
}[NETWORK]!;

export const horizon = new StellarSdk.Horizon.Server(config.horizonUrl);

export const USDC_ISSUER =
  process.env.NEXT_PUBLIC_USDC_ISSUER ||
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

export function getUsdcAsset(issuerAddress?: string): StellarSdk.Asset {
  return new StellarSdk.Asset("USDC", issuerAddress || USDC_ISSUER);
}


export interface BalanceInfo {
  asset: string;
  balance: string;
  issuer?: string;
}

export async function getBalances(address: string): Promise<BalanceInfo[]> {
  try {
    const account = await horizon.loadAccount(address);
    return account.balances.map((b) => {
      if (b.asset_type === "native") {
        return { asset: "XLM", balance: b.balance };
      }
      const bal = b as StellarSdk.Horizon.HorizonApi.BalanceLineAsset;
      return {
        asset: bal.asset_code,
        balance: bal.balance,
        issuer: bal.asset_issuer,
      };
    });
  } catch (error: unknown) {
    const err = error as { response?: { status?: number } };
    if (err.response?.status === 404) {
      return [{ asset: "XLM", balance: "0" }];
    }
    throw error;
  }
}

export interface PaymentRecord {
  id: string;
  type: string;
  from: string;
  to: string;
  amount: string;
  asset: string;
  createdAt: string;
  transactionHash: string;
  isIncoming: boolean;
}

export async function getPaymentHistory(
  address: string,
  limit: number = 20
): Promise<PaymentRecord[]> {
  try {
    const payments = await horizon
      .payments()
      .forAccount(address)
      .order("desc")
      .limit(limit)
      .call();

    return payments.records
      .filter(
        (p) =>
          p.type === "payment" ||
          p.type === "create_account" ||
          p.type === "path_payment_strict_send" ||
          p.type === "path_payment_strict_receive"
      )
      .map((p) => {
        const record = p as unknown as Record<string, string>;
        const from = record.from || record.source_account || "";
        const to = record.to || record.account || "";
        const amount = record.amount || record.starting_balance || "0";
        const assetCode = record.asset_code || "XLM";

        return {
          id: record.id,
          type: p.type,
          from,
          to,
          amount,
          asset: assetCode,
          createdAt: record.created_at,
          transactionHash: record.transaction_hash,
          isIncoming: to === address,
        };
      });
  } catch {
    return [];
  }
}
