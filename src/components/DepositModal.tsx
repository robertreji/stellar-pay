"use client";

import { useState, useEffect, useRef } from "react";
import { useWallet } from "@/context/WalletContext";
import { fundWithFriendbot } from "@/lib/transactions";
import {
  initiateDeposit,
  getAnchorTransaction,
  authenticateWithAnchor,
  AnchorTransaction,
} from "@/lib/moneygram";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DepositMethod = "friendbot" | "anchor";
type DepositStep = "idle" | "initializing" | "interactive" | "success" | "error";

export default function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const { address, secretKey, refreshBalances } = useWallet();
  const [method, setMethod] = useState<DepositMethod>("friendbot");
  const [step, setStep] = useState<DepositStep>("idle");
  const [amount, setAmount] = useState("10");
  const [interactiveUrl, setInteractiveUrl] = useState("");
  const [localIp, setLocalIp] = useState("localhost");
  const [errorMsg, setErrorMsg] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [depositDetails, setDepositDetails] = useState<AnchorTransaction | null>(null);

  const pollerRef = useRef<NodeJS.Timeout | null>(null);
  const tokenRef = useRef<string>("");

  const interactivePortalUrl = interactiveUrl
    ? (() => {
        try {
          const url = new URL(interactiveUrl);
          url.hostname = localIp;
          url.protocol = "https:";
          if (transactionId) {
            url.search = `?id=${transactionId}`;
          }
          return url.toString();
        } catch {
          return interactiveUrl.replace("localhost", localIp).replace("http://", "https://");
        }
      })()
    : "";

  const interactiveQrUrl = interactivePortalUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(interactivePortalUrl)}`
    : "";

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  useEffect(() => {
    const loadLocalIp = async () => {
      try {
        const response = await fetch("/api/config");
        if (!response.ok) return;
        const data = await response.json();
        if (data.localIp) {
          setLocalIp(data.localIp);
        }
      } catch (err) {
        console.warn("Failed to load local IP for deposit portal QR:", err);
      }
    };

    loadLocalIp();
  }, []);

  const handleFriendbotDeposit = async () => {
    if (!address) return;
    setStep("initializing");
    setErrorMsg("");
    try {
      await fundWithFriendbot(address);
      setStep("success");
      await refreshBalances();
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || "Friendbot funding failed");
      setStep("error");
    }
  };

  const handleAnchorDeposit = async () => {
    if (!address || !secretKey) return;
    setStep("initializing");
    setErrorMsg("");
    setInteractiveUrl("");
    setTransactionId("");
    setDepositDetails(null);

    try {
      console.log("Calling authenticateWithAnchor...");
      // 1. Get SEP-10 Auth Token
      const token = await authenticateWithAnchor(address, secretKey);
      console.log("Got token:", token);
      tokenRef.current = token;

      console.log("Calling initiateDeposit with amount:", amount);
      // 2. Initiate Interactive Deposit
      const res = await initiateDeposit(address, secretKey, "USDC", amount);
      console.log("Got initiateDeposit response:", res);
      setInteractiveUrl(res.url);
      setTransactionId(res.id);
      setStep("interactive");

      console.log("Starting polling for txId:", res.id);
      // 3. Start polling the anchor transaction status
      startPolling(token, res.id);
    } catch (err: any) {
      console.error("handleAnchorDeposit error caught:", err);
      setErrorMsg(err.message || "Failed to initialize anchor deposit");
      setStep("error");
    }
  };

  const startPolling = (token: string, txId: string) => {
    stopPolling();
    let errorCount = 0;
    pollerRef.current = setInterval(async () => {
      try {
        const tx = await getAnchorTransaction(token, txId);
        console.log("Anchor deposit status:", tx.status, tx);
        errorCount = 0; // Reset on success

        if (tx.status === "completed") {
          stopPolling();
          setDepositDetails(tx);
          setStep("success");
          await refreshBalances();
        } else if (tx.status === "error" || tx.status === "no_market") {
          stopPolling();
          setErrorMsg("Anchor reported an error during interactive deposit.");
          setStep("error");
        }
      } catch (err: any) {
        console.warn("Polling error:", err);
        errorCount++;
        if (errorCount >= 3) {
          stopPolling();
          setErrorMsg(err.message || "Failed to poll transaction status.");
          setStep("error");
        }
      }
    }, 3000);
  };

  const stopPolling = () => {
    if (pollerRef.current) {
      clearInterval(pollerRef.current);
      pollerRef.current = null;
    }
  };

  const handleClose = () => {
    stopPolling();
    setStep("idle");
    setErrorMsg("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Deposit Funds</h2>
          <button className="modal-close" onClick={handleClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {step === "idle" && (
          <div className="modal-tabs-container">
            <div className="modal-tabs" style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              <button
                className={`btn btn-tab ${method === "friendbot" ? "btn-primary" : "btn-secondary"}`}
                style={{ flex: 1 }}
                onClick={() => setMethod("friendbot")}
              >
                Friendbot (XLM)
              </button>
              <button
                className={`btn btn-tab ${method === "anchor" ? "btn-primary" : "btn-secondary"}`}
                style={{ flex: 1 }}
                onClick={() => setMethod("anchor")}
              >
                Anchor Platform (USDC)
              </button>
            </div>

            {method === "friendbot" ? (
              <div className="deposit-content">
                <div className="deposit-info">
                  <div className="deposit-icon-large">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 12l4 4 4-4" />
                      <path d="M12 8v8" />
                    </svg>
                  </div>
                  <h3>Stellar Testnet Faucet</h3>
                  <p>
                    Fund your testnet account with 10,000 XLM from the Stellar
                    Friendbot. This is free testnet XLM for development.
                  </p>
                  {address && (
                    <div className="deposit-address">
                      <span className="deposit-address-label">Your Address</span>
                      <span className="deposit-address-value">
                        {address.slice(0, 8)}...{address.slice(-8)}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  className="btn btn-primary btn-full"
                  onClick={handleFriendbotDeposit}
                >
                  Fund with Friendbot
                </button>
              </div>
            ) : (
              <div className="deposit-content">
                <div className="deposit-info">
                  <div className="deposit-icon-large" style={{ background: "var(--gradient-accent)", color: "#fff" }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                      <path d="M12 2v20" />
                    </svg>
                  </div>
                  <h3>Interactive USD Deposit</h3>
                  <p>
                    Convert fiat USD to USDC using the local Anchor Platform.
                    This launches a secure interactive flow to specify bank details.
                  </p>
                  {address && (
                    <div className="deposit-address">
                      <span className="deposit-address-label">Your Address</span>
                      <span className="deposit-address-value">
                        {address.slice(0, 8)}...{address.slice(-8)}
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", color: "var(--color-text-secondary)" }}>
                    Deposit Amount (USD)
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
                <button
                  className="btn btn-primary btn-full"
                  onClick={handleAnchorDeposit}
                >
                  Start Anchor Deposit
                </button>
              </div>
            )}
          </div>
        )}

        {step === "initializing" && (
          <div className="onboarding-loading">
            <div className="progress-spinner large-spinner" />
            <h3 className="loading-status">Connecting with Anchor Platform...</h3>
            <p className="loading-sub">Initiating secure transaction handshake via SEP-10 & SEP-24...</p>
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
              <h3 className="loading-status">Scan this QR code in the sim bank app</h3>
              <p className="loading-sub" style={{ marginBottom: "24px" }}>
                Open the simulated bank portal on your phone, scan this QR code, and approve the deposit there.
              </p>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", width: "100%" }}>
                <div
                  style={{
                    background: "#fff",
                    padding: "14px",
                    borderRadius: "16px",
                    boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
                  }}
                >
                  <img
                    src={interactiveQrUrl}
                    alt="QR code for the simulated bank portal"
                    width="220"
                    height="220"
                    style={{ display: "block" }}
                  />
                </div>
                <div className="deposit-address" style={{ width: "100%", textAlign: "left" }}>
                  <span className="deposit-address-label">Portal Link</span>
                  <span className="deposit-address-value" style={{ wordBreak: "break-all" }}>
                    {interactivePortalUrl || interactiveUrl}
                  </span>
                </div>
                <div className="interactive-status-bar" style={{ justifyContent: "center" }}>
                  <div className="progress-spinner" style={{ width: 14, height: 14 }} />
                  <span>Waiting for deposit confirmation on-chain...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="modal-success">
            <div className="success-icon deposit-success">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22,4 12,14.01 9,11.01" />
              </svg>
            </div>
            <h3>Account Funded! 🎉</h3>
            {method === "friendbot" ? (
              <p>10,000 XLM has been added to your testnet account.</p>
            ) : (
              <p>USDC deposit successfully completed via Anchor Platform.</p>
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
            <h3>Deposit Failed</h3>
            <p>{errorMsg}</p>
            <button
              className="btn btn-primary"
              onClick={() => {
                setStep("idle");
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
