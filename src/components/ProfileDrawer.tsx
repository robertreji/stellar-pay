"use client";

import { useWallet } from "@/context/WalletContext";
import { useState, useEffect } from "react";

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onImageUpdated?: () => void;
}

export default function ProfileDrawer({
  isOpen,
  onClose,
  onImageUpdated,
}: ProfileDrawerProps) {
  const { connected, address, secretKey, username, disconnectWallet } = useWallet();
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Sync profile photo
  useEffect(() => {
    if (address && isOpen) {
      const stored = localStorage.getItem(`stellarpay_profile_image_${address}`);
      if (stored) {
        setProfileImage(stored);
      }
    }
  }, [address, isOpen]);

  if (!isOpen || !connected || !address) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert("Image size must be less than 1MB.");
        return;
      }
      setUploading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;

        // 1. Update locally
        localStorage.setItem(`stellarpay_profile_image_${address}`, base64);
        setProfileImage(base64);

        // 2. Upload to server
        try {
          const res = await fetch("/api/users", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stellarAddress: address, image: base64 }),
          });
          if (res.ok) {
            if (onImageUpdated) onImageUpdated();
          } else {
            console.warn("Failed to upload profile image to server.");
          }
        } catch (err) {
          console.error("Error uploading profile image:", err);
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleCopySecret = () => {
    if (!secretKey) return;
    navigator.clipboard.writeText(secretKey);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const getInitials = (nameOrAddr: string) => {
    const clean = nameOrAddr.replace("@", "");
    return clean.slice(0, 2).toUpperCase();
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "700" }}>Profile Settings</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", flex: 1, overflowY: "auto", paddingRight: "4px" }}>
          {/* Avatar Upload Container */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <div
              onClick={() => document.getElementById("drawer-avatar-input")?.click()}
              style={{
                width: "96px",
                height: "96px",
                borderRadius: "50%",
                background: profileImage ? "none" : "var(--gradient-primary)",
                border: "2px solid rgba(255,255,255,0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                position: "relative",
                overflow: "hidden",
                boxShadow: "var(--shadow-md)"
              }}
              title="Click to change profile photo"
            >
              {profileImage ? (
                <img src={profileImage} alt="Profile photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: "32px", fontWeight: "700", color: "white" }}>
                  {getInitials(username || address)}
                </span>
              )}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: 0,
                  transition: "opacity 0.2s ease",
                  color: "white",
                  fontSize: "12px",
                  fontWeight: "600"
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "0"}
              >
                {uploading ? "Uploading..." : "Change Photo"}
              </div>
            </div>
            <input
              type="file"
              id="drawer-avatar-input"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: "none" }}
            />
            {username && <span style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)" }}>@{username}</span>}
          </div>

          {/* Public Address Group */}
          <div className="form-group" style={{ width: "100%" }}>
            <label>Public Stellar Address</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <div
                style={{
                  flex: 1,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "12px",
                  padding: "12px",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  wordBreak: "break-all",
                  lineHeight: "1.4"
                }}
              >
                {address}
              </div>
              <button
                onClick={handleCopyAddress}
                className="btn btn-primary"
                style={{
                  padding: "0 16px",
                  borderRadius: "12px",
                  height: "auto",
                  background: copiedAddress ? "var(--success)" : undefined,
                  boxShadow: copiedAddress ? "0 4px 12px rgba(34,197,94,0.3)" : undefined
                }}
              >
                {copiedAddress ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Secret Key reveal / backup */}
          <div className="form-group" style={{ width: "100%" }}>
            <label>Secret Key Backup</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="btn"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "12px",
                  color: showSecret ? "var(--error)" : "var(--text-secondary)",
                  width: "100%",
                  padding: "12px"
                }}
              >
                {showSecret ? "Hide Secret Key" : "Reveal Secret Key (Warning)"}
              </button>

              {showSecret && secretKey && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", animation: "fadeIn 0.2s ease" }}>
                  <div
                    style={{
                      background: "rgba(239, 68, 68, 0.05)",
                      border: "1px solid rgba(239, 68, 68, 0.15)",
                      borderRadius: "12px",
                      padding: "12px",
                      fontSize: "11px",
                      color: "var(--error)",
                      lineHeight: "1.5"
                    }}
                  >
                    <strong>WARNING:</strong> Never share your secret key. Anyone with this key can access all your funds.
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <div
                      style={{
                        flex: 1,
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "12px",
                        padding: "12px",
                        fontFamily: "monospace",
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        wordBreak: "break-all",
                        lineHeight: "1.4"
                      }}
                    >
                      {secretKey}
                    </div>
                    <button
                      onClick={handleCopySecret}
                      className="btn btn-primary"
                      style={{
                        padding: "0 16px",
                        borderRadius: "12px",
                        height: "auto",
                        background: copiedSecret ? "var(--success)" : undefined,
                        boxShadow: copiedSecret ? "0 4px 12px rgba(34,197,94,0.3)" : undefined
                      }}
                    >
                      {copiedSecret ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid var(--border-subtle)" }}>
          <button
            onClick={() => {
              disconnectWallet();
              onClose();
            }}
            className="btn btn-primary btn-full"
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              color: "var(--error)",
              boxShadow: "none"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--error)";
              e.currentTarget.style.color = "white";
              e.currentTarget.style.boxShadow = "0 4px 16px rgba(239, 68, 68, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
              e.currentTarget.style.color = "var(--error)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            Disconnect Wallet
          </button>
        </div>
      </div>
    </div>
  );
}
