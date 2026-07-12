"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
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
import { encryptSecretKey, decryptSecretKey } from "@/lib/crypto";

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
  createAccountWallet: (username: string, password?: string) => Promise<string>;
  confirmWalletCreation: () => void;
  importAccountWallet: (secretKey: string, username: string, password?: string) => Promise<void>;
  loginAccountWallet: (username: string, password: string) => Promise<void>;
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

  // Holds wallet data between createAccountWallet and confirmWalletCreation
  const pendingWalletRef = useRef<{ publicKey: string; secretKey: string; username: string } | null>(null);

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

  const registerUsernameOnChain = async (uname: string, publicKey: string, secretKey: string) => {
    // 1. Build authorization entry
    const buildRes = await fetch("/api/register/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: uname,
        user_pubkey: publicKey,
      }),
    });
    if (!buildRes.ok) {
      const errData = await buildRes.json();
      throw new Error(errData.error || "Failed to build username registration transaction");
    }

    const { authEntry, username: normalizedUsername } = await buildRes.json();

    // 2. Parse and Sign authorization entry client-side
    const entry = StellarSdk.xdr.SorobanAuthorizationEntry.fromXDR(authEntry, "base64");
    const rpc = new StellarSdk.rpc.Server(config.rpcUrl);
    const latest = await rpc.getLatestLedger();
    const validUntil = latest.sequence + 100;

    const keypair = StellarSdk.Keypair.fromSecret(secretKey);
    const signedEntry = await StellarSdk.authorizeEntry(
      entry,
      keypair,
      validUntil,
      config.networkPassphrase
    );
    const signedAuthEntry = signedEntry.toXDR("base64");

    // 3. Submit signed entry to sponsored relayer
    const submitRes = await fetch("/api/register/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signedAuthEntry,
        username: normalizedUsername,
        user_pubkey: publicKey,
      }),
    });

    if (!submitRes.ok) {
      const errData = await submitRes.json();
      throw new Error(errData.error || "Failed to submit signed username registration");
    }
  };

  const createAccountWallet = async (uname: string, password?: string) => {
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

      // 3. Register Username On-Chain (Sponsored)
      await registerUsernameOnChain(uname, newWallet.publicKey, newWallet.secretKey);

      // 4. Save client-side encrypted backup to database if password is provided
      if (password) {
        const encryptedBackup = await encryptSecretKey(newWallet.secretKey, password);
        const backupRes = await fetch("/api/wallet/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: uname,
            owner_address: newWallet.publicKey,
            encrypted_secret_key: encryptedBackup.encryptedKey,
            encryption_salt: encryptedBackup.salt,
            encryption_iv: encryptedBackup.iv,
          }),
        });

        if (!backupRes.ok) {
          const errData = await backupRes.json();
          throw new Error(errData.error || "Failed to save encrypted wallet backup");
        }
      }

      // 5. Fetch the dynamic usdcIssuer config if not loaded
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

      // 6. Build and Sign Change Trust Transaction Locally
      const usdcAsset = getUsdcAsset(currentIssuer);
      const trustXdr = await buildChangeTrustTx(newWallet.publicKey, usdcAsset);
      const signedTrustXdr = signXdr(
        trustXdr,
        newWallet.secretKey,
        config.networkPassphrase
      );

      // Submit trustline to Horizon
      await submitClassicTransaction(signedTrustXdr);

      // Store pending wallet — do NOT connect yet.
      // The UI will show a "backup your key" screen first.
      pendingWalletRef.current = {
        publicKey: newWallet.publicKey,
        secretKey: newWallet.secretKey,
        username: uname,
      };

      return newWallet.secretKey;
    } catch (err: any) {
      console.error(err);
      setInitError(err.message || "Wallet setup failed");
      throw err;
    } finally {
      setIsInitializing(false);
    }
  };

  const confirmWalletCreation = () => {
    const pending = pendingWalletRef.current;
    if (!pending) return;
    storeWallet(pending.secretKey);
    setAddress(pending.publicKey);
    setSecretKey(pending.secretKey);
    setUsername(pending.username);
    setIsRegistered(true);
    setNeedsRegistration(false);
    pendingWalletRef.current = null;
  };

  const importAccountWallet = async (sKey: string, uname: string, password?: string) => {
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
        await registerUsernameOnChain(uname, publicKey, sKey);
        setUsername(uname);
        setIsRegistered(true);
        setNeedsRegistration(false);
      }

      // Save encrypted backup for future logins
      if (password) {
        const encryptedBackup = await encryptSecretKey(sKey, password);
        await fetch("/api/wallet/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: uname,
            owner_address: publicKey,
            encrypted_secret_key: encryptedBackup.encryptedKey,
            encryption_salt: encryptedBackup.salt,
            encryption_iv: encryptedBackup.iv,
          }),
        });
        // We ignore error here since backup might already exist
      }
    } catch (err: any) {
      console.error(err);
      setInitError(err.message || "Failed to import wallet");
      throw err;
    } finally {
      setIsInitializing(false);
    }
  };

  const loginAccountWallet = async (uname: string, pass: string) => {
    setInitError(null);
    setIsInitializing(true);
    try {
      const normalizedUsername = uname.trim().toLowerCase();

      // 1. Fetch encrypted backup
      const res = await fetch(`/api/wallet/fetch?username=${encodeURIComponent(normalizedUsername)}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to retrieve wallet backup");
      }

      const { encrypted_secret_key, encryption_salt, encryption_iv, owner_address } = await res.json();

      // 2. Decrypt locally
      const decryptedSecret = await decryptSecretKey(
        {
          encryptedKey: encrypted_secret_key,
          salt: encryption_salt,
          iv: encryption_iv,
        },
        pass
      );

      // 3. Verify owner address matches
      const keypair = StellarSdk.Keypair.fromSecret(decryptedSecret);
      if (keypair.publicKey() !== owner_address) {
        throw new Error("Decrypted secret key does not match the registered on-chain owner address");
      }

      // 4. Store credentials in session and state
      storeWallet(decryptedSecret);
      setAddress(owner_address);
      setSecretKey(decryptedSecret);
      setUsername(normalizedUsername);
      setIsRegistered(true);
      setNeedsRegistration(false);
    } catch (err: any) {
      console.error(err);
      setInitError(err.message || "Login failed");
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
        confirmWalletCreation,
        importAccountWallet,
        loginAccountWallet,
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
