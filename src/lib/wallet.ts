import * as StellarSdk from "@stellar/stellar-sdk";

export interface LocalWallet {
  publicKey: string;
  secretKey: string;
}

export function generateWallet(): LocalWallet {
  const keypair = StellarSdk.Keypair.random();
  return {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
  };
}

export function getStoredWallet(): LocalWallet | null {
  if (typeof window === "undefined") return null;
  const secret = localStorage.getItem("stellarpay_secret");
  if (!secret) return null;
  try {
    const keypair = StellarSdk.Keypair.fromSecret(secret);
    return {
      publicKey: keypair.publicKey(),
      secretKey: secret,
    };
  } catch {
    return null;
  }
}

export function storeWallet(secret: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    StellarSdk.Keypair.fromSecret(secret);
    localStorage.setItem("stellarpay_secret", secret);
    return true;
  } catch {
    return false;
  }
}

export function clearWallet(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("stellarpay_secret");
}

export function signXdr(
  xdr: string,
  secret: string,
  networkPassphrase: string
): string {
  const transaction = StellarSdk.TransactionBuilder.fromXDR(
    xdr,
    networkPassphrase
  ) as StellarSdk.Transaction;
  const keypair = StellarSdk.Keypair.fromSecret(secret);
  transaction.sign(keypair);
  return transaction.toXDR();
}
