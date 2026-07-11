"use client";

import { useWallet } from "@/context/WalletContext";
import { useState, useEffect } from "react";

export default function ConnectWallet() {
  const { connected, address, secretKey, network, username, disconnectWallet } =
    useWallet();
  const [showSecret, setShowSecret] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // Load user's profile image bound to their Stellar address and sync with server
  useEffect(() => {
    if (address) {
      const stored = localStorage.getItem(`stellarpay_profile_image_${address}`);
      if (stored) {
        setProfileImage(stored);
      }

      // Sync from database so other users can see it
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // Limit to 1MB
        alert("Image size must be less than 1MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        
        // 1. Update locally
        localStorage.setItem(`stellarpay_profile_image_${address}`, base64);
        setProfileImage(base64);

        // 2. Upload to server so others can see it
        try {
          const res = await fetch("/api/users", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stellarAddress: address, image: base64 }),
          });
          if (!res.ok) {
            console.warn("Failed to upload profile image to server.");
          }
        } catch (err) {
          console.error("Error uploading profile image:", err);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (!connected || !address) {
    return null;
  }

  return (
    <div className="connect-wallet connected-card">
      <div className="wallet-connected-header">
        <div className="wallet-info">
          <div
            className="wallet-avatar"
            onClick={() => document.getElementById("own-avatar-input")?.click()}
            style={{
              cursor: "pointer",
              overflow: "hidden",
              position: "relative",
              background: profileImage ? "none" : undefined,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
            title="Click to upload profile photo"
          >
            {profileImage ? (
              <img
                src={profileImage}
                alt="My Profile"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : username ? (
              username.slice(0, 2).toUpperCase()
            ) : (
              address.slice(0, 2)
            )}
            <input
              type="file"
              id="own-avatar-input"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: "none" }}
            />
          </div>
          <div className="wallet-details">
            {username && <span className="wallet-username">@{username}</span>}
            <span className="wallet-address">
              {address.slice(0, 8)}...{address.slice(-8)}
            </span>
            <span className="wallet-network testnet">{network}</span>
          </div>
        </div>
        <button
          onClick={disconnectWallet}
          className="btn btn-disconnect"
          title="Disconnect Wallet"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16,17 21,12 16,7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>

      <div className="wallet-export-section">
        <button
          type="button"
          className="export-toggle-btn"
          onClick={() => setShowSecret(!showSecret)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {showSecret ? (
              <>
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </>
            ) : (
              <>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
          {showSecret ? "Hide Secret Key" : "Reveal Secret Key (Backup)"}
        </button>

        {showSecret && secretKey && (
          <div className="secret-key-display">
            <span className="secret-key-val">{secretKey}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(secretKey);
                alert("Secret Key copied to clipboard! Keep it secure.");
              }}
              className="copy-btn"
            >
              Copy
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
