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
      const token = await authenticateWithAnchor(address, secretKey);
      console.log("Got token:", token);
      tokenRef.current = token;

      console.log("Calling initiateDeposit with amount:", amount);
      const res = await initiateDeposit(address, secretKey, "USDC", amount);
      console.log("Got initiateDeposit response:", res);
      setInteractiveUrl(res.url);
      setTransactionId(res.id);
      setStep("interactive");

      console.log("Starting polling for txId:", res.id);
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
        errorCount = 0;

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
    <div className="fixed inset-0 bg-[#132e22]/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-6 animate-[fadeIn_0.2s_ease]" onClick={handleClose}>
      <div className="bg-bg-card border border-border-theme rounded-3xl w-full max-w-[500px] shadow-2xl flex flex-col overflow-hidden animate-[slideUp_0.3s_ease]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 pt-6">
          <h2 className="text-lg font-bold text-text-primary">Deposit Funds</h2>
          <button className="bg-transparent border-0 text-text-muted cursor-pointer p-1 flex items-center justify-center rounded-full hover:bg-bg-hover hover:text-text-primary transition-all duration-200" onClick={handleClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {step === "idle" && (
            <div className="flex flex-col">
              <div className="flex gap-2.5 mb-5">
                <button
                  className={`flex-1 py-3 px-4 text-xs font-bold rounded-xl cursor-pointer transition-all duration-300 ${
                    method === "friendbot"
                      ? "bg-accent-purple text-white shadow-lg"
                      : "bg-bg-secondary border border-border-theme text-text-secondary hover:bg-bg-card-hover"
                  }`}
                  onClick={() => setMethod("friendbot")}
                >
                  Friendbot (XLM)
                </button>
                <button
                  className={`flex-1 py-3 px-4 text-xs font-bold rounded-xl cursor-pointer transition-all duration-300 ${
                    method === "anchor"
                      ? "bg-accent-purple text-white shadow-lg"
                      : "bg-bg-secondary border border-border-theme text-text-secondary hover:bg-bg-card-hover"
                  }`}
                  onClick={() => setMethod("anchor")}
                >
                  Anchor Platform (USDC)
                </button>
              </div>

              {method === "friendbot" ? (
                <div className="flex flex-col items-center text-center gap-5">
                  <div className="w-16 h-16 rounded-full bg-accent-purple/10 text-accent-purple flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 12l4 4 4-4" />
                      <path d="M12 8v8" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-text-primary">Stellar Testnet Faucet</h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Fund your testnet account with 10,000 XLM from the Stellar
                    Friendbot. This is free testnet XLM for development.
                  </p>
                  {address && (
                    <div className="flex flex-col gap-2 w-full bg-bg-secondary border border-border-theme rounded-xl p-4 text-left">
                      <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Your Address</span>
                      <span className="text-xs text-text-primary font-mono break-all leading-relaxed">
                        {address}
                      </span>
                    </div>
                  )}
                  <button
                    className="w-full py-4 px-6 text-sm font-bold bg-gradient-to-r from-accent-purple to-accent-indigo text-white rounded-xl cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300"
                    onClick={handleFriendbotDeposit}
                  >
                    Fund with Friendbot
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center gap-5">
                  <div className="w-16 h-16 rounded-full bg-accent-purple/10 text-accent-purple flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                      <path d="M12 2v20" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-text-primary">Interactive USD Deposit</h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Convert fiat USD to USDC using the local Anchor Platform.
                    This launches a secure interactive flow to specify bank details.
                  </p>
                  {address && (
                    <div className="flex flex-col gap-2 w-full bg-bg-secondary border border-border-theme rounded-xl p-4 text-left">
                      <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Your Address</span>
                      <span className="text-xs text-text-primary font-mono break-all leading-relaxed">
                        {address}
                      </span>
                    </div>
                  )}
                  <div className="w-full text-left">
                    <label className="block mb-2 text-xs font-semibold text-text-secondary">
                      Deposit Amount (USD)
                    </label>
                    <input
                      type="number"
                      className="w-full bg-bg-secondary border border-border-theme rounded-xl py-3.5 px-4 text-sm outline-none focus:border-accent-purple/50 focus:ring-4 focus:ring-accent-purple/10 text-text-primary transition-all duration-300 focus:bg-bg-card"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Enter amount"
                    />
                  </div>
                  <button
                    className="w-full py-4 px-6 text-sm font-bold bg-gradient-to-r from-accent-purple to-accent-indigo text-white rounded-xl cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300"
                    onClick={handleAnchorDeposit}
                  >
                    Start Anchor Deposit
                  </button>
                </div>
              )}
            </div>
          )}

          {step === "initializing" && (
            <div className="flex flex-col items-center text-center py-8 gap-4">
              <div className="progress-spinner large-spinner" />
              <h3 className="text-lg font-bold mb-3 text-[#1b4332]">Connecting with Anchor Platform...</h3>
              <p className="text-xs text-[#4a534e] leading-relaxed">Initiating secure transaction handshake via SEP-10 & SEP-24...</p>
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
              <h3 className="text-lg font-bold text-text-primary">Scan this QR code in the sim bank app</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Open the simulated bank portal on your phone, scan this QR code, and approve the deposit there.
              </p>
              <div className="flex flex-col items-center gap-3 w-full">
                <div className="bg-white p-3.5 rounded-2xl shadow-lg border border-border-theme flex items-center justify-center">
                  <img
                    src={interactiveQrUrl}
                    alt="QR code for the simulated bank portal"
                    width="220"
                    height="220"
                    className="block"
                  />
                </div>
                <div className="flex flex-col gap-2 w-full bg-bg-secondary border border-border-theme rounded-xl p-4 text-left">
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Portal Link</span>
                  <span className="text-xs text-text-primary font-mono break-all leading-relaxed">
                    {interactivePortalUrl || interactiveUrl}
                  </span>
                </div>
                <div className="flex items-center gap-3 bg-bg-card border border-border-theme rounded-xl p-4 text-sm text-text-secondary mt-3">
                  <div className="progress-spinner" style={{ width: 14, height: 14 }} />
                  <span>Waiting for deposit confirmation on-chain...</span>
                </div>
              </div>
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
              <h3 className="text-lg font-bold text-text-primary">Account Funded! 🎉</h3>
              {method === "friendbot" ? (
                <p className="text-xs text-text-secondary">10,000 XLM has been added to your testnet account.</p>
              ) : (
                <p className="text-xs text-text-secondary">USDC deposit successfully completed via Anchor Platform.</p>
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
              <h3 className="text-lg font-bold text-text-primary">Deposit Failed</h3>
              <p className="text-xs text-text-secondary">{errorMsg}</p>
              <button
                className="w-full py-4 px-6 text-sm font-bold bg-gradient-to-r from-accent-purple to-accent-indigo text-white rounded-xl cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300"
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
    </div>
  );
}
