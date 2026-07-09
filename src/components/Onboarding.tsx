"use client";

import { useState } from "react";
import { useWallet } from "@/context/WalletContext";

export default function Onboarding() {
  const { createAccountWallet, importAccountWallet, isInitializing, initError } =
    useWallet();

  const [mode, setMode] = useState<"welcome" | "create" | "import">("welcome");
  const [username, setUsername] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [step, setStep] = useState<string>("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      alert("Username must be 3-20 characters, letters, numbers, and underscores only");
      return;
    }

    setStep("Generating secure wallet keys...");
    try {
      await createAccountWallet(cleanUsername);
    } catch {
      setStep("");
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    const cleanSecret = secretKey.trim();

    if (!cleanSecret.startsWith("S") || cleanSecret.length !== 56) {
      alert("Invalid secret key. Must be a 56-character string starting with S");
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      alert("Username must be 3-20 characters, letters, numbers, and underscores only");
      return;
    }

    setStep("Importing wallet credentials...");
    try {
      await importAccountWallet(cleanSecret, cleanUsername);
    } catch {
      setStep("");
    }
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        {mode === "welcome" && (
          <div className="welcome-step">
            <div className="logo-icon-large">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12h8M12 8v8" />
              </svg>
            </div>
            <h1 className="welcome-title">Welcome to StellarPay</h1>
            <p className="welcome-subtitle">
              A premium, dynamic digital wallet simulating frictionless XLM and
              USDC payments on the Stellar testnet.
            </p>
            <div className="welcome-actions">
              <button
                className="btn btn-primary btn-full"
                onClick={() => setMode("create")}
              >
                Create New Wallet
              </button>
              <button
                className="btn action-btn btn-full"
                onClick={() => setMode("import")}
              >
                Import Secret Key
              </button>
            </div>
          </div>
        )}

        {mode === "create" && (
          <div className="create-step">
            <div className="onboarding-header">
              <button className="back-btn" onClick={() => setMode("welcome")} disabled={isInitializing}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12,19 5,12 12,5" />
                </svg>
              </button>
              <h2>Create Wallet</h2>
            </div>
            {isInitializing ? (
              <div className="onboarding-loading">
                <div className="progress-spinner large-spinner" />
                <h3 className="loading-status">{step}</h3>
                <p className="loading-sub">
                  This setup registers your username, requests testnet XLM, sets
                  up a USDC trustline, and faucets 100 starting USDC. Please wait
                  a few seconds.
                </p>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="modal-form">
                <div className="form-group">
                  <label>Choose a unique Username</label>
                  <div className="username-input-wrapper">
                    <span className="username-prefix">@</span>
                    <input
                      type="text"
                      placeholder="satoshi"
                      value={username}
                      onChange={(e) =>
                        setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                      }
                      className="form-input username-input"
                      required
                      autoFocus
                    />
                  </div>
                  <span className="form-hint">
                    This registers your account so users can send payments directly to you.
                  </span>
                </div>
                {initError && (
                  <div className="form-error">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {initError}
                  </div>
                )}
                <button type="submit" className="btn btn-primary btn-full" disabled={username.length < 3}>
                  Generate Secure Wallet
                </button>
              </form>
            )}
          </div>
        )}

        {mode === "import" && (
          <div className="import-step">
            <div className="onboarding-header">
              <button className="back-btn" onClick={() => setMode("welcome")} disabled={isInitializing}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12,19 5,12 12,5" />
                </svg>
              </button>
              <h2>Import Wallet</h2>
            </div>
            {isInitializing ? (
              <div className="onboarding-loading">
                <div className="progress-spinner large-spinner" />
                <h3 className="loading-status">{step}</h3>
                <p className="loading-sub">Linking your keypair to the username directory...</p>
              </div>
            ) : (
              <form onSubmit={handleImport} className="modal-form">
                <div className="form-group">
                  <label>Stellar Secret Key</label>
                  <input
                    type="password"
                    placeholder="S..."
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    className="form-input"
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>Link Username</label>
                  <div className="username-input-wrapper">
                    <span className="username-prefix">@</span>
                    <input
                      type="text"
                      placeholder="satoshi"
                      value={username}
                      onChange={(e) =>
                        setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                      }
                      className="form-input username-input"
                      required
                    />
                  </div>
                </div>
                {initError && (
                  <div className="form-error">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {initError}
                  </div>
                )}
                <button type="submit" className="btn btn-primary btn-full" disabled={username.length < 3 || secretKey.length !== 56}>
                  Import Account
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
