"use client";

import { useWallet } from "@/context/WalletContext";
import { useState, useEffect } from "react";

export default function BalanceCard() {
  const { balances, isLoadingBalances, connected } = useWallet();
  const [currency, setCurrency] = useState<"USD" | "XLM">("USD");
  const [showBalance, setShowBalance] = useState(true);

  const xlmBalance = balances.find((b) => b.asset === "XLM")?.balance || "0";
  const usdcBalance = balances.find((b) => b.asset === "USDC")?.balance || "0";

  const displayBalance = currency === "USD" ? usdcBalance : xlmBalance;
  const formattedBalance = parseFloat(displayBalance).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Load balance visibility preference on mount
  useEffect(() => {
    const stored = localStorage.getItem("stellarpay_show_balance");
    if (stored !== null) {
      setShowBalance(stored === "true");
    }
  }, []);

  const toggleVisibility = () => {
    const nextState = !showBalance;
    setShowBalance(nextState);
    localStorage.setItem("stellarpay_show_balance", String(nextState));
  };



  if (!connected) {
    return null;
  }

  return (
    <div className="balance-card">
      <div className="balance-header">
        <div className="balance-label-wrapper">
          <span className="balance-label">Total Balance</span>
          <button
            onClick={toggleVisibility}
            className="balance-visibility-btn"
            title={showBalance ? "Hide Balance" : "Show Balance"}
          >
            {showBalance ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        <div className="currency-select-container">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "USD" | "XLM")}
            className="currency-selector-select"
          >
            <option value="USD">USD</option>
            <option value="XLM">XLM</option>
          </select>
          <svg className="currency-select-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {isLoadingBalances ? (
        <div className="balance-loading">
          <div className="shimmer" style={{ width: "160px", height: "40px", borderRadius: "8px" }} />
        </div>
      ) : (
        <h1 className="balance-amount">
          {!showBalance ? (
            "••••••"
          ) : (
            <>
              {currency === "USD" ? "$" : ""}
              {formattedBalance}
              {currency === "XLM" && <span className="balance-unit">XLM</span>}
            </>
          )}
        </h1>
      )}

      <div className="balance-footer" style={{ margin: 0 }}>
        <div className="balance-network-badge">
          <div className="badge-dot" />
          <span>Testnet</span>
        </div>
      </div>
    </div>
  );
}
