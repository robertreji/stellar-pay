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
      // 1. Get SEP-10 Auth Token
      const token = await authenticateWithAnchor(address, secretKey);
      tokenRef.current = token;

      // 2. Initiate Interactive Withdraw
      const res = await initiateWithdraw(address, secretKey, "USDC", amount);
      setInteractiveUrl(res.url);
      setTransactionId(res.id);
      setStep("interactive");

      // 3. Open interactive URL in a new window/tab safely (bypasses iframe SAMEDOMAIN policies)
      window.open(res.url, "_blank");

      // 4. Start Polling the anchor transaction status
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


      // We build with dynamic memo
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

      // Submit payment
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
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Anchor Platform Withdrawal</h2>
          <button className="modal-close" onClick={handleClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="withdraw-modal-body">
          {step === "idle" && (
            <div className="deposit-content">
              <div className="deposit-info">
                <div className="deposit-icon-large" style={{ background: "var(--gradient-accent)", color: "#fff" }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 2v20" />
                    <polyline points="5 9 12 2 19 9" />
                  </svg>
                </div>
                <h3>Interactive USD Withdrawal</h3>
                <p>
                  Withdraw USDC to your real bank account using the Anchor Platform.
                </p>
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", color: "var(--color-text-secondary)" }}>
                  Withdrawal Amount (USDC)
                </label>
                <input
                  type="number"
                  className="modal-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-border)", background: "var(--color-bg-secondary)", color: "var(--color-text)", fontSize: "16px" }}
                />
              </div>
              <button className="btn btn-primary btn-full" onClick={startFlow}>
                Start Anchor Withdrawal
              </button>
            </div>
          )}

          {step === "initializing" && (
            <div className="onboarding-loading">
              <div className="progress-spinner large-spinner" />
              <h3 className="loading-status">Connecting with Anchor Platform...</h3>
              <p className="loading-sub">Authenticating secure transaction handshake via SEP-10...</p>
            </div>
          )}

          {step === "interactive" && interactiveUrl && (
            <div className="onboarding-loading">
              <div className="welcome-step" style={{ margin: "20px 0" }}>
                <div className="logo-icon-large" style={{ background: "var(--gradient-accent)", margin: "0 auto 20px" }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <polyline points="15,3 21,3 21,9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </div>
                <h3 className="loading-status">Portal Opened in New Tab</h3>
                <p className="loading-sub" style={{ marginBottom: "24px" }}>
                  We've opened the Anchor portal in a new browser tab. Please complete their form to continue.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
                  <button
                    onClick={() => window.open(interactiveUrl, "_blank")}
                    className="btn btn-primary btn-full"
                  >
                    Re-open Portal Tab
                  </button>
                  <div className="interactive-status-bar" style={{ justifyContent: "center" }}>
                    <div className="progress-spinner" style={{ width: 14, height: 14 }} />
                    <span>Waiting for your input in the other tab...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === "paying" && (
            <div className="onboarding-loading">
              <div className="progress-spinner large-spinner" />
              <h3 className="loading-status">Submitting USDC Payment...</h3>
              <p className="loading-sub">
                Interactive registration complete! Transferring{" "}
                <strong>{withdrawDetails?.amount_in} USDC</strong> directly on-chain to Anchor...
              </p>
            </div>
          )}

          {step === "success" && (
            <div className="modal-success">
              <div className="success-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22,4 12,14.01 9,11.01" />
                </svg>
              </div>
              <h3>Withdrawal Initiated!</h3>
              <p>USDC payment successfully transferred to Anchor.</p>
              {paymentHash && (
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${paymentHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="success-link"
                >
                  View Payment Ledger →
                </a>
              )}
              <button className="btn btn-primary" onClick={handleClose}>
                Done
              </button>
            </div>
          )}

          {step === "error" && (
            <div className="modal-error-view">
              <div className="error-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h3>Withdrawal Failed</h3>
              <p>{errorMsg}</p>
              <button className="btn btn-primary" onClick={startFlow}>
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
