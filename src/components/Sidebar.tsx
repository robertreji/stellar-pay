"use client";

import Link from "next/link";
import { useWallet } from "@/context/WalletContext";
import { useState, useEffect } from "react";

export default function Sidebar({ onOpenProfile }: { onOpenProfile?: () => void }) {
  const { connected, address, username, disconnectWallet } = useWallet();
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Sync profile image from localStorage & server
  useEffect(() => {
    if (address) {
      const stored = localStorage.getItem(`stellarpay_profile_image_${address}`);
      if (stored) {
        setProfileImage(stored);
      }

      fetch(`/api/users?address=${encodeURIComponent(address)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.user?.profile_image) {
            localStorage.setItem(`stellarpay_profile_image_${address}`, data.user.profile_image);
            setProfileImage(data.user.profile_image);
          }
        })
        .catch((e) => console.warn("Failed to sync profile image from server:", e));
    } else {
      setProfileImage(null);
    }
  }, [address]);

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getInitials = (nameOrAddr: string) => {
    const clean = nameOrAddr.replace("@", "");
    return clean.slice(0, 2).toUpperCase();
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polygon points="12 2 2 22 22 22" />
          </svg>
        </div>
        <span className="logo-text">StellarPay</span>
      </div>

      <nav className="sidebar-nav">
        <Link className="sidebar-link active" href="/">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="9" />
            <rect x="14" y="3" width="7" height="5" />
            <rect x="14" y="12" width="7" height="9" />
            <rect x="3" y="16" width="7" height="5" />
          </svg>
          Dashboard
        </Link>
      </nav>

      {connected && address && (
        <div className="sidebar-footer">
          <div className="sidebar-network-card">
            <div className="network-dot" />
            <span>Testnet</span>
          </div>

          <div className="sidebar-account-switcher" onClick={onOpenProfile} style={{ cursor: onOpenProfile ? "pointer" : "default" }}>
            <div className="switcher-info">
              <div className="switcher-avatar">
                {profileImage ? (
                  <img src={profileImage} alt="User Avatar" />
                ) : (
                  getInitials(username || address)
                )}
              </div>
              <div className="switcher-details">
                <span className="switcher-name">
                  {username ? `@${username}` : "Account 1"}
                </span>
                <span className="switcher-address">
                  {formatAddress(address)}
                </span>
              </div>
            </div>
            <div className="switcher-actions">
              <button
                onClick={handleCopyAddress}
                className="switcher-btn"
                title={copied ? "Address Copied!" : "Copy Address"}
              >
                {copied ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  disconnectWallet();
                }}
                className="switcher-btn disconnect"
                title="Disconnect Wallet"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
