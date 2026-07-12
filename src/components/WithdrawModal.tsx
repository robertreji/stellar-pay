"use client";

import { useState, useEffect, useRef } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import { useWallet } from "@/context/WalletContext";
import {
  initiateWithdraw,
  getAnchorTransaction,
  authenticateWithAnchor,
  AnchorTransaction,
} from "@/lib/moneygram";
import { buildPaymentTx, submitClassicTransaction } from "@/lib/transactions";

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type WithdrawStep =
  | "idle"
  | "initializing"
  | "interactive"
  | "paying"
  | "success"
  | "error";

export default function WithdrawModal({ isOpen, onClose }: WithdrawModalProps) {
  const { address, secretKey, refreshBalances, usdcIssuer } = useWallet();
  const [step, setStep] = useState<WithdrawStep>("idle");
  const [amount, setAmount] = useState("10");
  const [interactiveUrl, setInteractiveUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [withdrawDetails, setWithdrawDetails] = useState<AnchorTransaction | null>(null);
  const [paymentHash, setPaymentHash] = useState("");

  const pollerRef = useRef<NodeJS.Timeout | null>(null);
  const tokenRef = useRef<string>("");

  useEffect(() => {
    if (isOpen && address && secretKey) {
      setStep("idle");
    }
    return () => {
      stopPolling();
    };
  }, [isOpen, address, secretKey]);

  const startFlow = async () => {
    if (!address || !secretKey) return;
    setStep("initializing");
    setErrorMsg("");
    setInteractiveUrl("");
    setTransactionId("");
    setWithdrawDetails(null);
    setPaymentHash("");

    try {
      const token = await authenticateWithAnchor(address, secretKey);
      tokenRef.current = token;

      const res = await initiateWithdraw(address, secretKey, "USDC", amount);
      setInteractiveUrl(res.url);
      setTransactionId(res.id);
      setStep("interactive");

      window.open(res.url, "_blank");

      startPolling(token, res.id);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to initialize withdrawal");
      setStep("error");
    }
  };

  const startPolling = (token: string, txId: string) => {
    stopPolling();
    pollerRef.current = setInterval(async () => {
      try {
        const tx = await getAnchorTransaction(token, txId);
        console.log("Anchor transaction status:", tx.status, tx);

        if (tx.status === "pending_user_transfer_start") {
          stopPolling();
          setWithdrawDetails(tx);
          executeOnChainPayment(tx);
        } else if (tx.status === "completed") {
          stopPolling();
          setStep("success");
        } else if (tx.status === "error" || tx.status === "no_market") {
          stopPolling();
          setErrorMsg("Anchor reported an error during interaction.");
          setStep("error");
        }
      } catch (err) {
        console.warn("Polling error:", err);
      }
    }, 3000);
  };

  const stopPolling = () => {
    if (pollerRef.current) {
      clearInterval(pollerRef.current);
      pollerRef.current = null;
    }
  };

  const executeOnChainPayment = async (details: AnchorTransaction) => {
    if (!address || !secretKey) return;
    setStep("paying");
    try {
      const amount = details.amount_in;
      const destination = details.withdraw_anchor_account;
      
      if (!destination) {
        throw new Error("Anchor did not provide a destination account for withdrawal.");
      }
      
      const account = await fetch(
        `https://horizon-testnet.stellar.org/accounts/${address}`
      ).then((res) => res.json());

      const asset = new StellarSdk.Asset("USDC", usdcIssuer || undefined);

      const memoType = details.withdraw_memo_type;
      const memoValue = details.withdraw_memo;

      let memoObj;
      if (memoType && memoValue) {
        if (memoType === "id") {
          memoObj = StellarSdk.Memo.id(memoValue);
        } else if (memoType === "text") {
          memoObj = StellarSdk.Memo.text(memoValue);
        } else if (memoType === "hash") {
          memoObj = StellarSdk.Memo.hash(memoValue);
        }
      }

      const txBuilder = new StellarSdk.TransactionBuilder(
        new StellarSdk.Account(address, account.sequence),
        {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: StellarSdk.Networks.TESTNET,
        }
      )
        .addOperation(
          StellarSdk.Operation.payment({
            destination: destination,
            asset: asset,
            amount: amount,
          })
        )
        .setTimeout(180);

      if (memoObj) {
        txBuilder.addMemo(memoObj);
      }

      const tx = txBuilder.build();
      tx.sign(StellarSdk.Keypair.fromSecret(secretKey));

      const signedXdr = tx.toXDR();

      const result = await submitClassicTransaction(signedXdr);
      setPaymentHash(result.hash);
      
      setStep("success");
      await refreshBalances();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "USDC payment submission failed");
      setStep("error");
    }
  };

  const handleClose = () => {
    stopPolling();
    setStep("idle");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#132e22]/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-6 animate-[fadeIn_0.2s_ease]" onClick={handleClose}>
      <div className="bg-bg-card border border-border-theme rounded-3xl w-full max-w-[480px] shadow-2xl flex flex-col overflow-hidden animate-[slideUp_0.3s_ease]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 pt-6">
          <h2 className="text-lg font-bold text-text-primary">Anchor Platform Withdrawal</h2>
          <button className="bg-transparent border-0 text-text-muted cursor-pointer p-1 flex items-center justify-center rounded-full hover:bg-bg-hover hover:text-text-primary transition-all duration-200" onClick={handleClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {step === "idle" && (
            <div className="flex flex-col items-center text-center gap-5">
              <div className="w-16 h-16 rounded-full bg-accent-purple/10 text-accent-purple flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2v20" />
                  <polyline points="5 9 12 2 19 9" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-text-primary">Interactive USD Withdrawal</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Withdraw USDC to your real bank account using the Anchor Platform.
              </p>
              <div className="w-full text-left">
                <label className="block mb-2 text-xs font-semibold text-text-secondary">
                  Withdrawal Amount (USDC)
                </label>
                <input
                  type="number"
                  className="w-full bg-bg-secondary border border-border-theme rounded-xl py-3.5 px-4 text-sm outline-none focus:border-accent-purple/50 focus:ring-4 focus:ring-accent-purple/10 text-text-primary transition-all duration-300 mb-5 focus:bg-bg-card"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                />
              </div>
              <button className="w-full py-4 px-6 text-sm font-bold bg-gradient-to-r from-accent-purple to-accent-indigo text-white rounded-xl cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300" onClick={startFlow}>
                Start Anchor Withdrawal
              </button>
            </div>
          )}

          {step === "initializing" && (
            <div className="flex flex-col items-center text-center py-8 gap-4">
              <div className="progress-spinner large-spinner" />
              <h3 className="text-lg font-bold text-text-primary">Connecting with Anchor Platform...</h3>
              <p className="text-xs text-text-secondary leading-relaxed">Authenticating secure transaction handshake via SEP-10...</p>
            </div>
          )}

          {step === "interactive" && interactiveUrl && (
            <div className="flex flex-col items-center text-center py-8 gap-4">
              <div className="w-16 h-16 rounded-full bg-accent-purple/10 text-accent-purple flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                  <polyline points="15,3 21,3 21,9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-text-primary">Portal Opened in New Tab</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                We've opened the Anchor portal in a new browser tab. Please complete their form to continue.
              </p>
              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={() => window.open(interactiveUrl, "_blank")}
                  className="w-full py-4 px-6 text-sm font-bold bg-gradient-to-r from-accent-purple to-accent-indigo text-white rounded-xl cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300"
                >
                  Re-open Portal Tab
                </button>
                <div className="flex items-center gap-3 bg-bg-card border border-border-theme rounded-xl p-4 text-sm text-text-secondary mt-3">
                  <div className="progress-spinner" style={{ width: 14, height: 14 }} />
                  <span>Waiting for your input in the other tab...</span>
                </div>
              </div>
            </div>
          )}

          {step === "paying" && (
            <div className="flex flex-col items-center text-center py-8 gap-4">
              <div className="progress-spinner large-spinner" />
              <h3 className="text-lg font-bold text-text-primary">Submitting USDC Payment...</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Interactive registration complete! Transferring{" "}
                <strong>{withdrawDetails?.amount_in} USDC</strong> directly on-chain to Anchor...
              </p>
            </div>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center text-center p-6 gap-4">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22,4 12,14.01 9,11.01" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-text-primary">Withdrawal Initiated!</h3>
              <p className="text-xs text-text-secondary">USDC payment successfully transferred to Anchor.</p>
              {paymentHash && (
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${paymentHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent-purple hover:underline"
                >
                  View Payment Ledger →
                </a>
              )}
              <button className="w-full py-4 px-6 text-sm font-bold bg-gradient-to-r from-accent-purple to-accent-indigo text-white rounded-xl cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300" onClick={handleClose}>
                Done
              </button>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center text-center p-6 gap-4">
              <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-text-primary">Withdrawal Failed</h3>
              <p className="text-xs text-text-secondary">{errorMsg}</p>
              <button className="w-full py-4 px-6 text-sm font-bold bg-gradient-to-r from-accent-purple to-accent-indigo text-white rounded-xl cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300" onClick={startFlow}>
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
