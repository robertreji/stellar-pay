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

type DepositStep = "idle" | "initializing" | "interactive" | "success" | "error";

export default function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const { address, secretKey, refreshBalances } = useWallet();
  const [step, setStep] = useState<DepositStep>("idle");
  const [amount, setAmount] = useState("10");
  const [interactiveUrl, setInteractiveUrl] = useState("");
  const [localIp, setLocalIp] = useState("localhost");
  const [errorMsg, setErrorMsg] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [depositDetails, setDepositDetails] = useState<AnchorTransaction | null>(null);
  const [exchangeRates, setExchangeRates] = useState<{
    usdToInr: number;
    aedToInr: number;
  } | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);

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

  const getDepositConversion = () => {
    if (!exchangeRates || !amount || isNaN(parseFloat(amount))) {
      return {
        aedToUsd: 0.2723,
        usdcRaw: 0,
        fee: 0,
        receiveUsdc: 0,
      };
    }
    const rawAmountAed = parseFloat(amount);
    // AED -> USD rate = aedToInr / usdToInr
    const aedToUsd = exchangeRates.aedToInr / exchangeRates.usdToInr;
    const usdcRaw = rawAmountAed * aedToUsd;
    const fee = usdcRaw * 0.0075;
    const receiveUsdc = usdcRaw - fee;

    return {
      aedToUsd,
      usdcRaw,
      fee,
      receiveUsdc,
    };
  };

  const conversion = getDepositConversion();

  const handleCopyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = address;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

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

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch("/api/exchange-rate");
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.rates) {
          setExchangeRates(data.rates);
        }
      } catch (err) {
        console.warn("Failed to fetch exchange rates for deposit calculator:", err);
      }
    };
    fetchRates();
  }, []);

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

      const usdcAmount = conversion.receiveUsdc.toFixed(2);
      console.log("Calling initiateDeposit with final USDC amount:", usdcAmount);
      const res = await initiateDeposit(address, secretKey, "USDC", usdcAmount);
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
      <div className="bg-white border border-border-theme rounded-3xl w-full max-w-[500px] shadow-2xl flex flex-col overflow-hidden animate-[slideUp_0.3s_ease]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#113C2F]/10 text-[#113C2F] flex items-center justify-center shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19,12 12,19 5,12" />
              </svg>
            </div>
            <div className="flex flex-col">
              <h2 className="text-xl font-extrabold text-[#113C2F] leading-tight">Top-Up your wallet</h2>
              <span className="text-[11px] text-text-muted">Convert AED to USDC via Anchor Platform</span>
            </div>
          </div>
          <button className="bg-[#f4f2ea] border-0 text-text-muted cursor-pointer w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#113C2F]/5 hover:text-text-primary transition-all duration-200 shrink-0" onClick={handleClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {step === "idle" && (
            <div className="flex flex-col">
              <div className="flex flex-col items-center text-center gap-5">
                  <div className="w-20 h-16 shrink-0 relative flex items-center justify-end z-10">
                    <img
                      src="/bank_deposit_illustration.png"
                      alt="Bank Illustration"
                      className="h-full w-auto object-contain"
                    />
                  </div>

                <div className="w-full text-left mb-2">
                  <label className="block mb-2 text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                    Deposit Amount (AED)
                  </label>
                  <div className="relative flex items-center w-full bg-bg-secondary border border-border-theme focus-within:border-[#113C2F] focus-within:ring-4 focus-within:ring-[#113C2F]/10 rounded-2xl py-2 pl-3 pr-12 transition-all duration-300">
                    <div className="bg-[#f4f2ea] text-text-primary text-[10px] font-extrabold px-3 py-2 rounded-xl select-none mr-3 border border-border-theme">
                      AED
                    </div>
                    <input
                      type="number"
                      className="w-full bg-transparent border-0 py-2.5 text-base font-extrabold outline-none text-text-primary"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="100.00"
                      style={{ fontSize: "16px" }}
                    />
                    <div className="absolute right-4 text-text-muted flex items-center">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <line x1="12" y1="4" x2="12" y2="20" />
                        <circle cx="12" cy="12" r="4" />
                      </svg>
                    </div>
                  </div>
                </div>

                {parseFloat(amount) > 0 && (
                  <div className="w-full bg-[#fbfbfa] border border-[#113C2F]/10 rounded-2xl p-4 flex flex-col gap-4 text-xs mb-2">
                    {/* Exchange Rate Row */}
                    <div className="flex items-center justify-between gap-2 w-full">
                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="w-7 h-7 rounded-full bg-emerald-600/5 text-emerald-600 flex items-center justify-center shrink-0">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                          </svg>
                        </div>
                        <span className="text-[11px] text-text-secondary font-medium">Exchange Rate </span>
                      </div>
                      <div className="flex-grow border-b border-dashed border-border-theme mx-1 min-w-[20px] self-end mb-1"></div>
                      <span className="font-extrabold text-[#113C2F] shrink-0 text-[11px]">1 AED ≈ {conversion.aedToUsd.toFixed(4)} USDC</span>
                    </div>

                    {/* Raw USDC Row */}
                    <div className="flex items-center justify-between gap-2 w-full">
                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="w-7 h-7 rounded-full bg-emerald-600/5 text-emerald-600 flex items-center justify-center shrink-0">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="8" cy="8" r="6" />
                            <circle cx="18" cy="18" r="4" />
                          </svg>
                        </div>
                        <span className="text-[11px] text-text-secondary font-medium">Raw USDC Amount</span>
                      </div>
                      <div className="flex-grow border-b border-dashed border-border-theme mx-1 min-w-[20px] self-end mb-1"></div>
                      <span className="font-extrabold text-text-primary shrink-0 text-[11px]">{conversion.usdcRaw.toFixed(2)} USDC</span>
                    </div>

                    {/* Platform Fee Row */}
                    <div className="flex items-center justify-between gap-2 w-full">
                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="w-7 h-7 rounded-full bg-red-500/5 text-gray-700 flex items-center justify-center shrink-0">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="19" y1="5" x2="5" y2="19" />
                            <circle cx="6.5" cy="6.5" r="2.5" />
                            <circle cx="17.5" cy="17.5" r="2.5" />
                          </svg>
                        </div>
                        <span className="text-[11px] text-gray-700 font-semibold">Platform Fee (0.75%)</span>
                      </div>
                      <div className="flex-grow border-b border-dashed border-border-theme mx-1 min-w-[20px] self-end mb-1"></div>
                      <span className="font-extrabold text-violet-600 shrink-0 text-[11px]">-{conversion.fee.toFixed(2)} USDC</span>
                    </div>

                    <div className="border-t border-[#113C2F]/10 my-0.5"></div>

                    {/* Final "You will receive" Box */}
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#113C2F]/10 text-[#113C2F] flex items-center justify-center shrink-0">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="4" width="20" height="16" rx="2" />
                            <line x1="12" y1="4" x2="12" y2="20" />
                            <circle cx="12" cy="12" r="4" />
                          </svg>
                        </div>
                        <span className="text-xs font-extrabold text-text-primary">You will receive</span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xl font-black text-[#0b3d3b]">{conversion.receiveUsdc.toFixed(2)} USDC</span>
                        <span className="inline-flex items-center gap-1 py-0.5 px-2 rounded-full bg-[#113C2F]/5 text-[9px] font-extrabold text-[#113C2F]">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Secure & Fast
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  className="w-full py-4 px-6 rounded-2xl cursor-pointer bg-green-600 text-white flex flex-col items-center justify-center gap-0.5 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border-0 font-bold shadow-md shadow-[#113C2F]/10"
                  onClick={handleAnchorDeposit}
                  disabled={!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg tracking-wide">Top-Up </span>
                  </div>
                  <span className="text-[10px] text-white/70 font-medium">Proceed to secure bank details</span>
                </button>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between w-full mt-6 px-1 text-[9px] text-text-muted font-bold tracking-wider uppercase border-t border-border-theme/40 pt-4">
                <div className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#113C2F] shrink-0">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <span>Secure & Encrypted</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#113C2F] shrink-0">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>Typically 1-2 mins</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#113C2F] shrink-0">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <span>Best Rates via Oracle</span>
                </div>
              </div>
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
              <h3 className="text-lg font-bold text-text-primary">Scan this QR code in the stellar Bank app</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Open and  scan this QR code, and approve the deposit there.
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

                <div className="flex items-center gap-3 bg-bg-card border border-border-theme rounded-xl p-4 text-sm text-text-secondary mt-3">
                  <div className="progress-spinner" style={{ width: 14, height: 14 }} />
                  <span>Waiting for deposit confirmation on-chain...</span>
                </div>
              </div>
            </div>
          )}          {step === "success" && (
            <div className="flex flex-col items-center text-center p-6 gap-4">
              <div className="w-16 h-16 rounded-full bg-[#113C2F]/5 flex items-center justify-center">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22,4 12,14.01 9,11.01" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-text-primary">Account Funded! 🎉</h3>
              <p className="text-xs text-text-secondary">USDC deposit successfully completed via Anchor Platform.</p>
              <button className="w-full py-3.5 px-6 text-sm font-bold bg-[#113C2F] text-white rounded-2xl cursor-pointer hover:opacity-90 hover:shadow-lg transition-all duration-300 border-0 font-bold shadow-md shadow-[#113C2F]/10" onClick={handleClose}>
                Done
              </button>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center text-center p-6 gap-4">
              <div className="w-16 h-16 rounded-full bg-red-500/5 flex items-center justify-center">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-text-primary">Deposit Failed</h3>
              <p className="text-xs text-text-secondary">{errorMsg}</p>
              <button
                className="w-full py-3.5 px-6 text-sm font-bold bg-[#113C2F] text-white rounded-2xl cursor-pointer hover:opacity-90 hover:shadow-lg transition-all duration-300 border-0 font-bold shadow-md shadow-[#113C2F]/10"
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
