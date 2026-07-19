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
  const { connected, address, username } = useWallet();
  const [profileImage, setProfileImage] = useState<string | null>(null);
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

        <div className="flex-1 flex flex-col justify-center items-center gap-6 pr-1">
          {/* Avatar Upload Container */}
          <div className="flex flex-col items-center gap-4">
            <div
              onClick={() => document.getElementById("drawer-avatar-input")?.click()}
              className="w-28 h-28 rounded-full flex items-center justify-center cursor-pointer relative overflow-hidden border-2 border-[#164A3A]/10 shadow-lg bg-gradient-to-r from-accent-purple to-accent-indigo text-white group transition-all duration-300 hover:scale-105"
              title="Click to change profile photo"
            >
              {profileImage ? (
                <img src={profileImage} alt="Profile photo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-extrabold tracking-wider">
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
            <div className="flex flex-col items-center text-center">
              {username && <span className="text-xl font-extrabold text-[#164A3A]">@{username}</span>}
              <span className="text-xs text-text-muted mt-2 max-w-[200px]">Tap the circle above to upload a profile photo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
