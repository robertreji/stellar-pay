"use client";
import { useWallet } from "@/context/WalletContext";
import { useState, useEffect } from "react";

export default function BalanceCard() {
  const { balances, isLoadingBalances, connected } = useWallet();
  const [currency, setCurrency] = useState<"USDC" | "XLM">("USDC");
  const [showBalance, setShowBalance] = useState(true);
  const [usdToInr, setUsdToInr] = useState(83.50);

  const xlmBalance = balances.find((b) => b.asset === "XLM")?.balance || "0";
  const usdcBalance = balances.find((b) => b.asset === "USDC")?.balance || "0";

  const displayBalance = currency === "USDC" ? usdcBalance : xlmBalance;
  const formattedBalance = parseFloat(displayBalance).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Fetch exchange rate for live conversions
  useEffect(() => {
    fetch("/api/exchange-rate")
      .then((res) => res.json())
      .then((data) => {
        if (data?.rates?.usdToInrWithSpread) {
          setUsdToInr(data.rates.usdToInrWithSpread);
        }
      })
      .catch((e) => console.warn("Failed to load exchange rates in BalanceCard:", e));
  }, []);

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

  // Calculate INR equivalent
  // Assume mock XLM price of ~$0.09 on Testnet
  const xlmPriceInUsd = 0.09;
  const numericBalance = parseFloat(displayBalance) || 0;
  const inrValue = currency === "USDC" 
    ? numericBalance * usdToInr 
    : numericBalance * xlmPriceInUsd * usdToInr;

  const formattedInr = inrValue.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="bg-gradient-to-br from-[#164A3A] via-[#1E5645] to-[#113C2F] text-white rounded-[28px] p-7 shadow-lg relative overflow-hidden mb-6 flex flex-col justify-between min-h-[190px] border border-white/5">
      
      {/* Background Gulf-Kerala-India Mixed Image */}
      <div className="absolute inset-y-0 right-0 w-[50%] sm:w-[55%] select-none pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-r from-[#164A3A] via-[#164A3A]/40 to-transparent z-10" />
        <img 
          src="/gulf_kerala_mix.png" 
          alt="Gulf Kerala India fusion background" 
          className="w-full h-full object-cover object-center opacity-85" 
        />
      </div>

      <div className="flex justify-between items-center w-full relative z-10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Total Balance</span>
          <button
            onClick={toggleVisibility}
            className="bg-transparent border-0 text-white/60 cursor-pointer p-1.5 flex items-center justify-center rounded-lg transition-all duration-200 hover:text-white hover:bg-white/10"
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
            onChange={(e) => setCurrency(e.target.value as "USDC" | "XLM")}
            className="appearance-none bg-white/10 border border-white/10 rounded-xl text-white py-1.5 pl-3 pr-8 text-xs font-bold cursor-pointer outline-none transition-all duration-200 hover:bg-white/15 hover:border-white/20 select-none"
          >
            <option value="USDC" className="bg-[#164A3A] text-white font-semibold">USDC</option>
            <option value="XLM" className="bg-[#164A3A] text-white font-semibold">XLM</option>
          </select>
          <svg className="absolute right-2.5 pointer-events-none text-white/75" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      <div className="my-2.5 relative z-10 flex flex-col gap-0.5">
        {isLoadingBalances ? (
          <div className="h-[48px] flex items-center">
            <div className="shimmer bg-white/5" style={{ width: "160px", height: "36px", borderRadius: "8px" }} />
          </div>
        ) : (
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none text-white">
            {!showBalance ? (
              "••••••"
            ) : (
              <>
                {formattedBalance}
                {currency === "USDC" && <span className="text-xl font-bold text-white/80 ml-1">USDC</span>}
                {currency === "XLM" && <span className="text-xl font-bold text-white/80 ml-1">XLM</span>}
              </>
            )}
          </h1>
        )}
        
        {!isLoadingBalances && (
          <span className="text-xs sm:text-sm font-semibold text-white/70">
            {!showBalance ? (
              "≈ ₹••••••"
            ) : (
              <>
                ≈ ₹{formattedInr} INR
              </>
            )}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 relative z-10 mt-1">
        <div className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-white/10 border border-white/10 text-[10px] font-bold tracking-wider uppercase text-white/90">
          <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)] animate-pulse" />
          <span>Testnet</span>
        </div>
      </div>
    </div>
  );
}
