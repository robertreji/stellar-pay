"use client";

import { useWallet } from "@/context/WalletContext";
import { useState } from "react";

export default function BalanceCard() {
  const { balances, isLoadingBalances, connected, isSwapping, swapXlmToUsdc } = useWallet();
  const [showAsset, setShowAsset] = useState<"XLM" | "USDC">("XLM");
  const [swapError, setSwapError] = useState("");

  const xlmBalance = balances.find((b) => b.asset === "XLM")?.balance || "0";
  const usdcBalance = balances.find((b) => b.asset === "USDC")?.balance || "0";

  const displayBalance = showAsset === "XLM" ? xlmBalance : usdcBalance;
  const formattedBalance = parseFloat(displayBalance).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const toggleAsset = () => {
    setShowAsset((prev) => (prev === "XLM" ? "USDC" : "XLM"));
    setSwapError("");
  };

  const handleSwap = async () => {
    setSwapError("");
    try {
      await swapXlmToUsdc("10.00"); // Swap for 10 USDC
    } catch (err: any) {
      setSwapError(err.message || "Swap failed (insufficient DEX liquidity)");
    }
  };

  if (!connected) {
    return null; // Onboarding will be shown
  }

  return (
    <div className="balance-card">
      <div className="balance-card-bg" />
      <div className="balance-card-content">
        <div className="balance-header">
          <p className="balance-label">Available Balance</p>
          <button onClick={toggleAsset} className="asset-toggle">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            {showAsset}
          </button>
        </div>
        {isLoadingBalances ? (
          <div className="balance-loading">
            <div className="shimmer" />
          </div>
        ) : (
          <h1 className="balance-amount">
            {showAsset === "XLM" ? "" : "$"}
            {formattedBalance}
            {showAsset === "XLM" && <span className="balance-unit"> XLM</span>}
          </h1>
        )}
        <div className="balance-footer">
          <span className="balance-network">Stellar Testnet</span>
          <div className="balance-dot" />
        </div>
        {showAsset === "USDC" && parseFloat(usdcBalance) === 0 && (
          <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                onClick={handleSwap}
                disabled={isSwapping}
                className="btn btn-trustline"
                style={{ background: "var(--gradient-primary)", color: "white", padding: "8px 16px", border: "none" }}
              >
                {isSwapping ? "Swapping..." : "Swap XLM ➔ 10 USDC (Instant)"}
              </button>
            </div>
            {swapError && <p className="trustline-error" style={{ color: "#ff8a8a", fontSize: 11 }}>{swapError}</p>}
            <a
              href="https://faucet.circle.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="success-link"
              style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 6, opacity: 0.8 }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15,3 21,3 21,9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Or, request USDC from Circle Faucet
            </a>
          </div>
        )}
      </div>
    </div>
  );
}


