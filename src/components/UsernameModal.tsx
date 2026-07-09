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
    <div className="modal-overlay">
      <div className="modal-content modal-small">
        <div className="modal-header">
          <h2>Choose a Username</h2>
        </div>

        <div className="username-modal-body">
          <div className="username-welcome">
            <div className="username-welcome-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4-4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <p>
              Welcome to StellarPay! Pick a unique username so others can send
              you payments easily — no need to share your long Stellar address.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="modal-form" style={{ paddingTop: 0 }}>
            <div className="form-group">
              <label>Username</label>
              <div className="username-input-wrapper">
                <span className="username-prefix">@</span>
                <input
                  type="text"
                  placeholder="satoshi"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                    if (status === "error") setStatus("idle");
                  }}
                  className="form-input username-input"
                  autoFocus
                  maxLength={20}
                />
              </div>
              <span className="form-hint">
                {username.length}/20 — letters, numbers, underscores
              </span>
            </div>

            <div className="username-address-preview">
              <span className="deposit-address-label">Your Stellar Address</span>
              <span className="deposit-address-value">
                {stellarAddress.slice(0, 8)}...{stellarAddress.slice(-8)}
              </span>
            </div>

            {status === "error" && (
              <div className="form-error">
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
              className="btn btn-primary btn-full"
              disabled={status === "registering" || username.length < 3}
            >
              {status === "registering" ? (
                <span className="btn-loading">
                  <div className="progress-spinner" />
                  Registering...
                </span>
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
