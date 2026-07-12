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

        // Update locally
        localStorage.setItem(`stellarpay_profile_image_${address}`, base64);
        setProfileImage(base64);

        // Upload to server
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
    <div className="fixed inset-0 bg-[#132e22]/40 backdrop-blur-sm flex justify-end z-[1000] p-0 animate-[fadeIn_0.2s_ease]" onClick={onClose}>
      <div className="bg-bg-secondary border-l border-border-theme w-full max-w-[400px] h-screen p-8 flex flex-col shadow-2xl animate-[slideInRight_0.3s_ease]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-lg font-bold text-text-primary">Profile Settings</h2>
          <button className="bg-transparent border-0 text-text-muted cursor-pointer p-1 flex items-center justify-center rounded-full hover:bg-bg-hover hover:text-text-primary transition-all duration-200" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-6 pr-1">
          {/* Avatar Upload Container */}
          <div className="flex flex-col items-center gap-2.5">
            <div
              onClick={() => document.getElementById("drawer-avatar-input")?.click()}
              className="w-24 h-24 rounded-full flex items-center justify-center cursor-pointer relative overflow-hidden border border-border-theme shadow-md bg-gradient-to-r from-accent-purple to-accent-indigo text-white group"
              title="Click to change profile photo"
            >
              {profileImage ? (
                <img src={profileImage} alt="Profile photo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold">
                  {getInitials(username || address)}
                </span>
              )}
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs font-semibold">
                {uploading ? "Uploading..." : "Change Photo"}
              </div>
            </div>
            <input
              type="file"
              id="drawer-avatar-input"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            {username && <span className="text-lg font-bold text-text-primary">@{username}</span>}
          </div>

          {/* Public Address Group */}
          <div className="flex flex-col gap-2 w-full">
            <label className="text-xs font-semibold text-text-secondary">Public Stellar Address</label>
            <div className="flex gap-2">
              <div className="flex-1 bg-bg-card border border-border-theme rounded-xl p-3 font-mono text-xs text-text-secondary break-all leading-normal">
                {address}
              </div>
              <button
                onClick={handleCopyAddress}
                className={`py-3 px-4 text-xs font-bold rounded-xl cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ${
                  copiedAddress
                    ? "bg-success text-white shadow-[0_4px_12px_rgba(34,197,94,0.3)]"
                    : "bg-gradient-to-r from-accent-purple to-accent-indigo text-white"
                }`}
              >
                {copiedAddress ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Secret Key reveal / backup */}
          <div className="flex flex-col gap-2 w-full">
            <label className="text-xs font-semibold text-text-secondary">Secret Key Backup</label>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className={`w-full py-3 px-4 text-xs font-bold rounded-xl border border-border-theme cursor-pointer transition-all duration-200 ${
                  showSecret
                    ? "bg-error/10 border-error/20 text-error"
                    : "bg-bg-card text-text-secondary hover:bg-bg-hover hover:border-border-theme-hover"
                }`}
              >
                {showSecret ? "Hide Secret Key" : "Reveal Secret Key (Warning)"}
              </button>

              {showSecret && secretKey && (
                <div className="flex flex-col gap-2.5 w-full animate-[fadeIn_0.2s_ease]">
                  <div className="bg-error/5 border border-error/15 rounded-xl p-3 text-[11px] text-error leading-normal font-semibold">
                    <strong>WARNING:</strong> Never share your secret key. Anyone with this key can access all your funds.
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-bg-card border border-border-theme rounded-xl p-3 font-mono text-xs text-text-secondary break-all leading-normal">
                      {secretKey}
                    </div>
                    <button
                      onClick={handleCopySecret}
                      className={`py-3 px-4 text-xs font-bold rounded-xl cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ${
                        copiedSecret
                          ? "bg-success text-white shadow-[0_4px_12px_rgba(34,197,94,0.3)]"
                          : "bg-gradient-to-r from-accent-purple to-accent-indigo text-white"
                      }`}
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
        <div className="mt-6 pt-6 border-t border-border-theme">
          <button
            onClick={() => {
              disconnectWallet();
              onClose();
            }}
            className="w-full py-4 px-6 text-sm font-bold bg-error/10 border border-error/20 text-error rounded-xl cursor-pointer hover:bg-error hover:text-white hover:shadow-[0_4px_16px_rgba(239,68,68,0.3)] transition-all duration-300"
          >
            Disconnect Wallet
          </button>
        </div>
      </div>
    </div>
  );
}
