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
    <div className="bg-bg-card border border-border-theme rounded-[24px] p-7 shadow-md relative overflow-hidden mb-6 flex flex-col justify-between min-h-[180px]">
      <div className="flex justify-between items-center w-full">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-muted">Total Balance</span>
          <button
            onClick={toggleVisibility}
            className="bg-transparent border-0 text-text-muted cursor-pointer p-1 flex items-center justify-center rounded transition-all duration-200 hover:text-text-primary hover:bg-[#1b4332]/5"
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

        <div className="relative flex items-center">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "USD" | "XLM")}
            className="appearance-none bg-bg-secondary border border-border-theme rounded-lg text-text-primary py-1.5 pl-3 pr-7 text-xs font-semibold cursor-pointer outline-none transition-all duration-200 hover:bg-bg-card-hover hover:border-border-theme-hover"
          >
            <option value="USD">USD</option>
            <option value="XLM">XLM</option>
          </select>
          <svg className="absolute right-2.5 pointer-events-none text-text-secondary" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {isLoadingBalances ? (
        <div className="h-[60px] my-4 flex items-center">
          <div className="shimmer" style={{ width: "160px", height: "40px", borderRadius: "8px" }} />
        </div>
      ) : (
        <h1 className="text-4xl md:text-5.5xl font-extrabold text-text-primary leading-tight my-4 tracking-tight">
          {!showBalance ? (
            "••••••"
          ) : (
            <>
              {currency === "USD" ? "$" : ""}
              {formattedBalance}
              {currency === "XLM" && <span className="text-2xl font-semibold text-text-secondary ml-1">XLM</span>}
            </>
          )}
        </h1>
      )}

      <div className="flex items-center gap-2 mt-4" style={{ margin: 0 }}>
        <div className="flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-success/8 border border-success/15 text-[11px] font-semibold text-success">
          <div className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_6px_var(--color-success)]" />
          <span>Testnet</span>
        </div>
      </div>
    </div>
  );
}
