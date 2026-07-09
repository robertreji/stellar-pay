"use client";

import { useWallet } from "@/context/WalletContext";

interface ActionButtonsProps {
  onPay: () => void;
  onDeposit: () => void;
  onTransfer: () => void;
  onWithdraw: () => void;
}

export default function ActionButtons({
  onPay,
  onDeposit,
  onTransfer,
  onWithdraw,
}: ActionButtonsProps) {
  const { connected } = useWallet();

  return (
    <div className="action-buttons">
      <button
        className="action-btn"
        onClick={onPay}
        disabled={!connected}
      >
        <span className="action-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
        </span>
        Pay
      </button>
      <button
        className="action-btn"
        onClick={onDeposit}
        disabled={!connected}
      >
        <span className="action-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v20M2 12h20" />
          </svg>
        </span>
        Deposit
      </button>
      <button
        className="action-btn"
        onClick={onTransfer}
        disabled={!connected}
      >
        <span className="action-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="17,1 21,5 17,9" />
            <path d="M3 11V9a4 4 0 014-4h14" />
            <polyline points="7,23 3,19 7,15" />
            <path d="M21 13v2a4 4 0 01-4 4H3" />
          </svg>
        </span>
        Transfer
      </button>
      <button
        className="action-btn"
        onClick={onWithdraw}
        disabled={!connected}
      >
        <span className="action-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
        </span>
        Withdraw
      </button>
    </div>
  );
}
