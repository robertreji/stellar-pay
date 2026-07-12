"use client";

import { useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { buildPaymentTx, submitClassicTransaction } from "@/lib/transactions";

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TxStatus = "idle" | "building" | "signing" | "submitting" | "success" | "error";

export default function TransferModal({ isOpen, onClose }: TransferModalProps) {
  const { address, balances, sign, refreshBalances, usdcIssuer } = useWallet();
  const [destinationAddress, setDestinationAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [fromAsset, setFromAsset] = useState<"XLM" | "USDC">("XLM");
  const [status, setStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const xlmBalance = balances.find((b) => b.asset === "XLM")?.balance || "0";
  const usdcBalance = balances.find((b) => b.asset === "USDC")?.balance || "0";

  const resetForm = () => {
    setDestinationAddress("");
    setAmount("");
    setFromAsset("XLM");
    setStatus("idle");
    setTxHash("");
    setErrorMsg("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    if (!destinationAddress || !destinationAddress.startsWith("G") || destinationAddress.length !== 56) {
      setErrorMsg("Please enter a valid Stellar address (G...)");
      setStatus("error");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setErrorMsg("Please enter a valid amount.");
      setStatus("error");
      return;
    }

    try {
      setStatus("building");
      const xdr = await buildPaymentTx(
        address,
        destinationAddress,
        amount,
        fromAsset,
        usdcIssuer || undefined
      );

      setStatus("signing");
      const signedXdr = await sign(xdr);

      setStatus("submitting");
      const result = await submitClassicTransaction(signedXdr);

      setTxHash(result.hash);
      setStatus("success");
      await refreshBalances();
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || "Transfer failed");
      setStatus("error");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#132e22]/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-6 animate-[fadeIn_0.2s_ease]" onClick={handleClose}>
      <div className="bg-bg-card border border-border-theme rounded-3xl w-full max-w-[480px] shadow-2xl flex flex-col overflow-hidden animate-[slideUp_0.3s_ease]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 pt-6">
          <h2 className="text-lg font-bold text-text-primary">Transfer</h2>
          <button className="bg-transparent border-0 text-text-muted cursor-pointer p-1 flex items-center justify-center rounded-full hover:bg-bg-hover hover:text-text-primary transition-all duration-200" onClick={handleClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {status === "success" ? (
          <div className="p-6 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22,4 12,14.01 9,11.01" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-text-primary">Transfer Complete!</h3>
            <p className="text-2xl font-extrabold text-text-primary">
              {amount} {fromAsset}
            </p>
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent-purple hover:underline"
            >
              View on Stellar Expert →
            </a>
            <button className="w-full py-4 px-6 text-sm font-bold bg-gradient-to-r from-accent-purple to-accent-indigo text-white rounded-xl cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300" onClick={handleClose}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleTransfer} className="p-6 flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3">
              <div
                className={`flex flex-col p-4 bg-bg-secondary border rounded-2xl cursor-pointer transition-all duration-300 gap-1.5 hover:border-border-theme-hover ${
                  fromAsset === "XLM" ? "bg-accent-purple/10 border-accent-purple/20 shadow-sm" : "border-border-theme"
                }`}
                onClick={() => setFromAsset("XLM")}
              >
                <span className={`text-xs font-bold ${fromAsset === "XLM" ? "text-accent-purple" : "text-text-muted"}`}>XLM</span>
                <span className="text-lg font-extrabold text-text-primary">
                  {parseFloat(xlmBalance).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                    useGrouping: true,
                  })}
                </span>
                <span className="text-[10px] text-text-muted">Stellar Lumens</span>
              </div>
              <div
                className={`flex flex-col p-4 bg-bg-secondary border rounded-2xl cursor-pointer transition-all duration-300 gap-1.5 hover:border-border-theme-hover ${
                  fromAsset === "USDC" ? "bg-accent-purple/10 border-accent-purple/20 shadow-sm" : "border-border-theme"
                }`}
                onClick={() => setFromAsset("USDC")}
              >
                <span className={`text-xs font-bold ${fromAsset === "USDC" ? "text-accent-purple" : "text-text-muted"}`}>USDC</span>
                <span className="text-lg font-extrabold text-text-primary">
                  {parseFloat(usdcBalance).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                    useGrouping: true,
                  })}
                </span>
                <span className="text-[10px] text-text-muted">USD Coin</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full">
              <label className="text-xs font-semibold text-text-secondary">Destination Address</label>
              <input
                type="text"
                placeholder="G..."
                value={destinationAddress}
                onChange={(e) => setDestinationAddress(e.target.value)}
                disabled={status !== "idle" && status !== "error"}
                className="w-full bg-bg-secondary border border-border-theme rounded-xl py-3.5 px-4 text-sm outline-none focus:border-accent-purple/50 focus:ring-4 focus:ring-accent-purple/10 text-text-primary transition-all duration-300 focus:bg-bg-card"
              />
            </div>

            <div className="flex flex-col gap-2 w-full">
              <label className="text-xs font-semibold text-text-secondary">Amount ({fromAsset})</label>
              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={status !== "idle" && status !== "error"}
                className="w-full bg-bg-secondary border border-border-theme rounded-xl py-3.5 px-4 text-sm outline-none focus:border-accent-purple/50 focus:ring-4 focus:ring-accent-purple/10 text-text-primary transition-all duration-300 focus:bg-bg-card"
                step="any"
                min="0"
              />
            </div>

            {status === "error" && (
              <div className="text-sm text-error bg-error/8 border border-error/15 rounded-xl p-3 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-4 px-6 text-sm font-bold bg-gradient-to-r from-accent-purple to-accent-indigo text-white rounded-xl cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={status !== "idle" && status !== "error"}
            >
              {status === "building" && "Building Transaction..."}
              {status === "signing" && "Signing Transaction..."}
              {status === "submitting" && "Submitting..."}
              {(status === "idle" || status === "error") && `Transfer ${fromAsset}`}
            </button>

            {(status === "building" || status === "signing" || status === "submitting") && (
              <div className="flex items-center gap-3 bg-bg-card border border-border-theme rounded-xl p-4 text-sm text-text-secondary animate-[fadeIn_0.2s_ease]">
                <div className="progress-spinner" />
                <span>
                  {status === "building" && "Building transaction..."}
                  {status === "signing" && "Signing transaction securely locally..."}
                  {status === "submitting" && "Submitting to Stellar network..."}
                </span>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
