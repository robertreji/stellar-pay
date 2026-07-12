"use client";

import { useState } from "react";

interface UsernameModalProps {
  isOpen: boolean;
  stellarAddress: string;
  onRegistered: (username: string) => void;
}

export default function UsernameModal({
  isOpen,
  stellarAddress,
  onRegistered,
}: UsernameModalProps) {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "registering" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const trimmed = username.trim().toLowerCase();

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmed)) {
      setErrorMsg("3-20 characters, letters, numbers, and underscores only");
      setStatus("error");
      return;
    }

    setStatus("registering");

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: trimmed,
          stellarAddress,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Registration failed");
        setStatus("error");
        return;
      }

      onRegistered(trimmed);
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#132e22]/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-6 animate-[fadeIn_0.2s_ease]">
      <div className="bg-bg-card border border-border-theme rounded-3xl w-full max-w-[440px] shadow-2xl flex flex-col overflow-hidden animate-[slideUp_0.3s_ease]">
        <div className="flex justify-between items-center px-6 pt-6">
          <h2 className="text-lg font-bold text-text-primary">Choose a Username</h2>
        </div>

        <div className="flex flex-col">
          <div className="flex flex-col items-center text-center gap-3.5 mb-2 px-6 pt-4">
            <div className="w-14 h-14 rounded-full bg-accent-purple/10 text-accent-purple flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4-4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Welcome to enteveed! Pick a unique username so others can send
              you payments easily — no need to share your long Stellar address.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 pt-2 flex flex-col gap-4">
            <div className="flex flex-col gap-2 w-full">
              <label className="text-xs font-semibold text-text-secondary">Username</label>
              <div className="relative flex items-center w-full">
                <span className="absolute left-3.5 text-text-muted text-base font-semibold select-none">@</span>
                <input
                  type="text"
                  placeholder="satoshi"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                    if (status === "error") setStatus("idle");
                  }}
                  className="w-full bg-bg-secondary border border-border-theme rounded-xl py-3.5 pl-8 pr-4 text-sm outline-none focus:border-accent-purple/50 focus:ring-4 focus:ring-accent-purple/10 text-text-primary transition-all duration-300 focus:bg-bg-card"
                  autoFocus
                  maxLength={20}
                />
              </div>
              <span className="text-[10px] text-text-muted">
                {username.length}/20 — letters, numbers, underscores
              </span>
            </div>

            <div className="flex flex-col gap-1.5 w-full bg-bg-secondary border border-border-theme rounded-xl p-3.5">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Your Stellar Address</span>
              <span className="text-xs text-text-primary font-mono break-all leading-normal">
                {stellarAddress.slice(0, 8)}...{stellarAddress.slice(-8)}
              </span>
            </div>

            {status === "error" && (
              <div className="text-sm text-error bg-error/8 border border-error/15 rounded-xl p-3 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-4 px-6 text-sm font-bold bg-gradient-to-r from-accent-purple to-accent-indigo text-white rounded-xl cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={status === "registering" || username.length < 3}
            >
              {status === "registering" ? (
                <>
                  <div className="progress-spinner" style={{ width: 16, height: 16 }} />
                  <span>Registering...</span>
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
