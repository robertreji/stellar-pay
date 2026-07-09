"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import { getBalances, BalanceInfo, config, getUsdcAsset, horizon } from "@/lib/stellar";
import { buildChangeTrustTx, buildSwapTx, submitClassicTransaction } from "@/lib/transactions";
import {
  generateWallet,
  getStoredWallet,
  storeWallet,
  clearWallet,
  signXdr,
} from "@/lib/wallet";

interface WalletContextType {
  connected: boolean;
  address: string | null;
  secretKey: string | null;
  network: string;
  balances: BalanceInfo[];
  isLoadingBalances: boolean;
  username: string | null;
  isRegistered: boolean;
  needsRegistration: boolean;
  hasUsdcTrustline: boolean;
  isCreatingTrustline: boolean;
  usdcIssuer: string | null;
  isInitializing: boolean;
  initError: string | null;
  isSwapping: boolean;
  createAccountWallet: (username: string) => Promise<void>;
  importAccountWallet: (secretKey: string, username: string) => Promise<void>;
  disconnectWallet: () => void;
  sign: (xdr: string) => Promise<string>;
  refreshBalances: () => Promise<void>;
  swapXlmToUsdc: (amount: string) => Promise<void>;
}


const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [balances, setBalances] = useState<BalanceInfo[]>([]);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [usdcIssuer, setUsdcIssuer] = useState<string | null>(null);
  const [isCreatingTrustline, setIsCreatingTrustline] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Get dynamic config from server on mount
  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch("/api/config");
        const data = await res.json();
        if (data.usdcIssuer) {
          setUsdcIssuer(data.usdcIssuer);
        }
      } catch (err) {
        console.error("Failed to load USDC config:", err);
      }
    }
    fetchConfig();
  }, []);

  const hasUsdcTrustline = balances.some(
    (b) => b.asset === "USDC" && b.issuer === usdcIssuer
  );

  const refreshBalances = useCallback(async () => {
    if (!address) {
      setBalances([]);
      return;
    }
    setIsLoadingBalances(true);
    try {
      const bals = await getBalances(address);
      setBalances(bals);
    } catch (err) {
      console.error("Failed to fetch balances:", err);
    } finally {
      setIsLoadingBalances(false);
    }
  }, [address]);

  // Load stored wallet on mount
  useEffect(() => {
    const stored = getStoredWallet();
    if (stored) {
      setAddress(stored.publicKey);
      setSecretKey(stored.secretKey);
      checkRegistration(stored.publicKey);
    }
  }, []);

  // Update balances when address is set
  useEffect(() => {
    if (address) {
      refreshBalances();
    }
  }, [address, refreshBalances]);

  const checkRegistration = async (publicKey: string) => {
    try {
      const res = await fetch(`/api/users?address=${encodeURIComponent(publicKey)}`);
      const data = await res.json();
      if (data.user) {
        setUsername(data.user.username);
        setIsRegistered(true);
        setNeedsRegistration(false);
      } else {
        setUsername(null);
        setIsRegistered(false);
        setNeedsRegistration(true);
      }
    } catch {
      setNeedsRegistration(false);
    }
  };

  const createAccountWallet = async (uname: string) => {
    setInitError(null);
    setIsInitializing(true);
    try {
      // 1. Generate Wallet Locally
      const newWallet = generateWallet();

      // 2. Fund XLM Faucet on Server
      const fundXlmRes = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: newWallet.publicKey, asset: "XLM" }),
      });
      if (!fundXlmRes.ok) {
        const errData = await fundXlmRes.json();
        throw new Error(errData.error || "Failed to fund XLM");
      }

      // 3. Register Username
      const regRes = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: uname,
          stellarAddress: newWallet.publicKey,
        }),
      });
      if (!regRes.ok) {
        const errData = await regRes.json();
        throw new Error(errData.error || "Failed to register username");
      }

      // 4. Fetch the dynamic usdcIssuer config if not loaded
      let currentIssuer = usdcIssuer;
      if (!currentIssuer) {
        const configRes = await fetch("/api/config");
        const configData = await configRes.json();
        currentIssuer = configData.usdcIssuer;
        if (currentIssuer) setUsdcIssuer(currentIssuer);
      }

      if (!currentIssuer) {
        throw new Error("USDC issuer configuration not available");
      }

      // 5. Build and Sign Change Trust Transaction Locally
      const usdcAsset = getUsdcAsset(currentIssuer);
      const trustXdr = await buildChangeTrustTx(newWallet.publicKey, usdcAsset);
      const signedTrustXdr = signXdr(
        trustXdr,
        newWallet.secretKey,
        config.networkPassphrase
      );

      // Submit trustline to Horizon
      await submitClassicTransaction(signedTrustXdr);

      // Store credentials and set context state
      storeWallet(newWallet.secretKey);
      setAddress(newWallet.publicKey);
      setSecretKey(newWallet.secretKey);
      setUsername(uname);
      setIsRegistered(true);
      setNeedsRegistration(false);
    } catch (err: any) {
      console.error(err);
      setInitError(err.message || "Wallet setup failed");
      throw err;
    } finally {
      setIsInitializing(false);
    }
  };

  const importAccountWallet = async (sKey: string, uname: string) => {
    setInitError(null);
    setIsInitializing(true);
    try {
      const keypair = StellarSdk.Keypair.fromSecret(sKey);
      const publicKey = keypair.publicKey();

      // Store in memory & LocalStorage
      storeWallet(sKey);
      setAddress(publicKey);
      setSecretKey(sKey);

      // Check if username is already registered in DB
      const userCheckRes = await fetch(`/api/users?address=${encodeURIComponent(publicKey)}`);
      const userCheckData = await userCheckRes.json();

      if (userCheckData.user) {
        setUsername(userCheckData.user.username);
        setIsRegistered(true);
        setNeedsRegistration(false);
      } else {
        // Register the user under this new username if not present
        const regRes = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: uname,
            stellarAddress: publicKey,
          }),
        });
        if (!regRes.ok) {
          const errData = await regRes.json();
          throw new Error(errData.error || "Failed to register username");
        }
        setUsername(uname);
        setIsRegistered(true);
        setNeedsRegistration(false);
      }
    } catch (err: any) {
      console.error(err);
      setInitError(err.message || "Failed to import wallet");
      throw err;
    } finally {
      setIsInitializing(false);
    }
  };

  const disconnectWallet = () => {
    clearWallet();
    setAddress(null);
    setSecretKey(null);
    setBalances([]);
    setUsername(null);
    setIsRegistered(false);
    setNeedsRegistration(false);
  };

  const [isSwapping, setIsSwapping] = useState(false);

  const swapXlmToUsdc = useCallback(
    async (amount: string) => {
      if (!address || !secretKey) return;
      setIsSwapping(true);
      try {
        const usdcAsset = getUsdcAsset(); // Defaults to official Circle Testnet USDC

        const account = await horizon.loadAccount(address);
        const txBuilder = new StellarSdk.TransactionBuilder(account, {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: config.networkPassphrase,
        });

        // 1. Check if user has trustline for official USDC. If not, bundle changeTrust
        const hasLine = balances.some(
          (b) => b.asset === "USDC" && b.issuer === usdcAsset.issuer
        );
        if (!hasLine) {
          txBuilder.addOperation(
            StellarSdk.Operation.changeTrust({
              asset: usdcAsset,
            })
          );
        }

        // 2. Add path payment operation to buy USDC using XLM
        txBuilder.addOperation(
          StellarSdk.Operation.pathPaymentStrictReceive({
            sendAsset: StellarSdk.Asset.native(),
            sendMax: "500.00",
            destination: address,
            destAsset: usdcAsset,
            destAmount: amount,
            path: [],
          })
        );

        const tx = txBuilder.setTimeout(180).build();
        tx.sign(StellarSdk.Keypair.fromSecret(secretKey));

        await submitClassicTransaction(tx.toXDR());
        await refreshBalances();
      } catch (err) {
        console.error("Swap failed:", err);
        throw err;
      } finally {
        setIsSwapping(false);
      }
    },
    [address, secretKey, balances, refreshBalances]
  );


  const sign = useCallback(
    async (xdr: string) => {
      if (!secretKey) throw new Error("No wallet loaded");
      return signXdr(xdr, secretKey, config.networkPassphrase);
    },
    [secretKey]
  );

  return (
    <WalletContext.Provider
      value={{
        connected: !!address,
        address,
        secretKey,
        network: "TESTNET",
        balances,
        isLoadingBalances,
        username,
        isRegistered,
        needsRegistration,
        hasUsdcTrustline,
        isCreatingTrustline,
        usdcIssuer,
        isInitializing,
        initError,
        isSwapping,
        createAccountWallet,
        importAccountWallet,
        disconnectWallet,
        sign,
        refreshBalances,
        swapXlmToUsdc,
      }}
    >
      {children}
    </WalletContext.Provider>

  );
}

export function useWallet(): WalletContextType {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
