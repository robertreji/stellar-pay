"use client";

import { useWallet } from "@/context/WalletContext";
import { useState } from "react";

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReceiveModal({ isOpen, onClose }: ReceiveModalProps) {
  const { address } = useWallet();
  const [copied, setCopied] = useState(false);

  if (!isOpen || !address) return null;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(address)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Receive Funds</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body" style={{ padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", textAlign: "center", lineHeight: "1.5" }}>
            Scan this QR code or copy the address below to receive Stellar payments.
          </p>

          <div
            style={{
              background: "#ffffff",
              padding: "16px",
              borderRadius: "20px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <img
              src={qrUrl}
              alt="Stellar Address QR Code"
              width="200"
              height="200"
              style={{ display: "block", borderRadius: "8px" }}
            />
          </div>

          <div className="deposit-address" style={{ width: "100%" }}>
            <span className="deposit-address-label">Your Wallet Address</span>
            <span className="deposit-address-value" style={{ wordBreak: "break-all", fontSize: "13px", lineHeight: "1.4" }}>
              {address}
            </span>
          </div>

          <button
            onClick={handleCopy}
            className="btn btn-primary btn-full"
            style={{
              background: copied ? "var(--success)" : undefined,
              boxShadow: copied ? "0 4px 16px rgba(34,197,94,0.3)" : undefined,
              transition: "all 0.2s ease"
            }}
          >
            {copied ? "Copied to Clipboard!" : "Copy Address"}
          </button>
        </div>
      </div>
    </div>
  );
}
