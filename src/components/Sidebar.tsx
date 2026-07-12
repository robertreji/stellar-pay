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
    <aside className="hidden md:flex fixed top-0 left-0 w-[280px] h-screen bg-bg-secondary border-r border-border-theme p-8 flex-col z-[100] xl:sticky">
      <div className="flex items-center gap-3 mb-10 px-2">
        <img src="/logo.png" alt="enteveed logo" className="w-9 h-9 object-contain" />
        <span className="text-xl font-extrabold text-[#132e22] tracking-tight">enteveed</span>
      </div>

      <nav className="flex flex-col gap-1.5 flex-1">
        <Link className="flex items-center gap-3 py-3 px-4 rounded-xl text-accent-purple font-bold bg-bg-card border border-border-theme border-l-3 border-l-accent-purple rounded-l-none text-sm transition-all duration-300" href="/">
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
        <div className="flex flex-col gap-3 pt-4 border-t border-border-theme">
          <div className="bg-bg-card border border-border-theme rounded-xl py-2.5 px-3.5 flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-success" />
            <span className="text-xs font-semibold text-text-secondary">Testnet</span>
          </div>

          <div className="flex items-center justify-between p-2.5 bg-bg-card border border-border-theme rounded-xl gap-2 transition-all duration-300 hover:border-border-theme-hover" onClick={onOpenProfile} style={{ cursor: onOpenProfile ? "pointer" : "default" }}>
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-full bg-accent-purple flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden border border-border-theme">
                {profileImage ? (
                  <img className="w-full h-full object-cover" src={profileImage} alt="User Avatar" />
                ) : (
                  getInitials(username || address)
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-semibold text-text-primary truncate">
                  {username ? `@${username}` : "Account 1"}
                </span>
                <span className="text-[11px] text-text-muted font-mono">
                  {formatAddress(address)}
                </span>
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={handleCopyAddress}
                className="bg-transparent border-0 text-text-muted cursor-pointer p-1 rounded-md flex items-center justify-center transition-all duration-200 hover:text-text-primary hover:bg-bg-hover"
                title={copied ? "Address Copied!" : "Copy Address"}
              >
                {copied ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2.5">
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
                className="bg-transparent border-0 text-text-muted cursor-pointer p-1 rounded-md flex items-center justify-center transition-all duration-200 hover:text-error hover:bg-error/10"
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
