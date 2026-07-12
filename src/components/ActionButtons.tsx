"use client";

import { useWallet } from "@/context/WalletContext";

interface ActionButtonsProps {
  onReceive: () => void;
  onSend: () => void;
  onDeposit: () => void;
  onWithdraw: () => void;
}

export default function ActionButtons({
  onReceive,
  onSend,
  onDeposit,
  onWithdraw,
}: ActionButtonsProps) {
  const { connected } = useWallet();

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <button
        className="bg-bg-card border border-border-theme rounded-2xl p-5 flex flex-col items-center justify-center gap-3 text-text-primary cursor-pointer transition-all duration-300 font-semibold text-sm w-full hover:bg-bg-hover hover:border-border-theme-hover disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={onReceive}
        disabled={!connected}
        title="Receive Funds"
      >
        <span className="w-11 h-11 rounded-full bg-accent-purple/10 text-accent-purple flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
        </span>
        <span className="text-[11px] sm:text-xs md:text-sm">Receive</span>
      </button>

      <button
        className="bg-bg-card border border-border-theme rounded-2xl p-5 flex flex-col items-center justify-center gap-3 text-text-primary cursor-pointer transition-all duration-300 font-semibold text-sm w-full hover:bg-bg-hover hover:border-border-theme-hover disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={onSend}
        disabled={!connected}
        title="Send Funds"
      >
        <span className="w-11 h-11 rounded-full bg-accent-purple/10 text-accent-purple flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: "rotate(45deg) translate(-1px, 1px)" }}>
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </span>
        <span className="text-[11px] sm:text-xs md:text-sm">Send</span>
      </button>

      <button
        className="bg-bg-card border border-border-theme rounded-2xl p-5 flex flex-col items-center justify-center gap-3 text-text-primary cursor-pointer transition-all duration-300 font-semibold text-sm w-full hover:bg-bg-hover hover:border-border-theme-hover disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={onDeposit}
        disabled={!connected}
        title="Deposit Funds"
      >
        <span className="w-11 h-11 rounded-full bg-accent-purple/10 text-accent-purple flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </span>
        <span className="text-[11px] sm:text-xs md:text-sm">Deposit</span>
      </button>

      <button
        className="bg-bg-card border border-border-theme rounded-2xl p-5 flex flex-col items-center justify-center gap-3 text-text-primary cursor-pointer transition-all duration-300 font-semibold text-sm w-full hover:bg-bg-hover hover:border-border-theme-hover disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={onWithdraw}
        disabled={!connected}
        title="Withdraw Funds"
      >
        <span className="w-11 h-11 rounded-full bg-accent-purple/10 text-accent-purple flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </span>
        <span className="text-[11px] sm:text-xs md:text-sm">Withdraw</span>
      </button>
    </div>
  );
}
