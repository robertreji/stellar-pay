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
    <div className="action-buttons">
      <button
        className="action-btn-card"
        onClick={onReceive}
        disabled={!connected}
        title="Receive Funds"
      >
        <span className="action-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
        </span>
        <span>Receive</span>
      </button>

      <button
        className="action-btn-card"
        onClick={onSend}
        disabled={!connected}
        title="Send Funds"
      >
        <span className="action-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: "rotate(45deg) translate(-1px, 1px)" }}>
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </span>
        <span>Send</span>
      </button>

      <button
        className="action-btn-card"
        onClick={onDeposit}
        disabled={!connected}
        title="Deposit Funds"
      >
        <span className="action-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </span>
        <span>Deposit</span>
      </button>

      <button
        className="action-btn-card"
        onClick={onWithdraw}
        disabled={!connected}
        title="Withdraw Funds"
      >
        <span className="action-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </span>
        <span>Withdraw</span>
      </button>
    </div>
  );
}
