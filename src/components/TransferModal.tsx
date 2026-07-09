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
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Transfer</h2>
          <button className="modal-close" onClick={handleClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {status === "success" ? (
          <div className="modal-success">
            <div className="success-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22,4 12,14.01 9,11.01" />
              </svg>
            </div>
            <h3>Transfer Complete!</h3>
            <p className="success-amount">
              {amount} {fromAsset}
            </p>
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="success-link"
            >
              View on Stellar Expert →
            </a>
            <button className="btn btn-primary" onClick={handleClose}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleTransfer} className="modal-form">
            <div className="transfer-balances">
              <div
                className={`transfer-balance-card ${fromAsset === "XLM" ? "active" : ""}`}
                onClick={() => setFromAsset("XLM")}
              >
                <span className="transfer-asset-name">XLM</span>
                <span className="transfer-asset-balance">
                  {parseFloat(xlmBalance).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="transfer-asset-label">Stellar Lumens</span>
              </div>
              <div
                className={`transfer-balance-card ${fromAsset === "USDC" ? "active" : ""}`}
                onClick={() => setFromAsset("USDC")}
              >
                <span className="transfer-asset-name">USDC</span>
                <span className="transfer-asset-balance">
                  {parseFloat(usdcBalance).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="transfer-asset-label">USD Coin</span>
              </div>
            </div>

            <div className="form-group">
              <label>Destination Address</label>
              <input
                type="text"
                placeholder="G..."
                value={destinationAddress}
                onChange={(e) => setDestinationAddress(e.target.value)}
                disabled={status !== "idle" && status !== "error"}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Amount ({fromAsset})</label>
              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={status !== "idle" && status !== "error"}
                className="form-input"
                step="any"
                min="0"
              />
            </div>

            {status === "error" && (
              <div className="form-error">
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
              className="btn btn-primary btn-full"
              disabled={status !== "idle" && status !== "error"}
            >
              {status === "building" && "Building Transaction..."}
              {status === "signing" && "Signing Transaction..."}
              {status === "submitting" && "Submitting..."}
              {(status === "idle" || status === "error") && `Transfer ${fromAsset}`}
            </button>

            {(status === "building" || status === "signing" || status === "submitting") && (
              <div className="tx-progress">
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
