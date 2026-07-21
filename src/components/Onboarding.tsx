"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/context/WalletContext";
import * as StellarSdk from "@stellar/stellar-sdk";

export default function Onboarding() {
  const { createAccountWallet, confirmWalletCreation, importAccountWallet, loginAccountWallet, isInitializing, initError } =
    useWallet();

  const [createdSecretKey, setCreatedSecretKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const [mode, setMode] = useState<"welcome" | "choice" | "create" | "login">("welcome");
  const [username, setUsername] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signInWithSecret, setSignInWithSecret] = useState(false);
  const [derivedUsername, setDerivedUsername] = useState<string | null>(null);
  const [showLinkUsername, setShowLinkUsername] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(false);
  const [step, setStep] = useState<string>("");
  const [activeTab, setActiveTab] = useState("send");

  // Automatically check the secret key on-chain / database cache to find registered username
  useEffect(() => {
    if (mode === "login" && signInWithSecret && secretKey.length === 56 && secretKey.startsWith("S")) {
      let active = true;
      const checkAddress = async () => {
        setIsCheckingKey(true);
        try {
          const keypair = StellarSdk.Keypair.fromSecret(secretKey);
          const address = keypair.publicKey();
          const res = await fetch(`/api/users?address=${encodeURIComponent(address)}`);
          const data = await res.json();
          if (!active) return;
          if (data.user) {
            setDerivedUsername(data.user.username);
            setShowLinkUsername(false);
          } else {
            setDerivedUsername(null);
            setShowLinkUsername(true);
          }
        } catch (err) {
          if (active) {
            setDerivedUsername(null);
            setShowLinkUsername(false);
          }
        } finally {
          if (active) setIsCheckingKey(false);
        }
      };
      checkAddress();
      return () => {
        active = false;
      };
    } else {
      setDerivedUsername(null);
      setShowLinkUsername(false);
      setIsCheckingKey(false);
    }
  }, [secretKey, mode, signInWithSecret]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      alert("Username must be 3-20 characters, lowercase letters, numbers, and underscores only");
      return;
    }

    if (password.length < 8) {
      alert("Password must be at least 8 characters long");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    setStep("Generating secure wallet keys...");
    try {
      const generatedSecret = await createAccountWallet(cleanUsername, password);
      setCreatedSecretKey(generatedSecret);
    } catch {
      setStep("");
    }
  };

  const handleCopyKey = async () => {
    if (!createdSecretKey) return;
    try {
      await navigator.clipboard.writeText(createdSecretKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 3000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = createdSecretKey;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 3000);
    }
  };

  const handleConfirmBackup = () => {
    confirmWalletCreation();
    setCreatedSecretKey(null);
    setCopiedKey(false);
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSecret = secretKey.trim();

    if (!cleanSecret.startsWith("S") || cleanSecret.length !== 56) {
      alert("Invalid secret key. Must be a 56-character string starting with S");
      return;
    }

    // Determine the username: either derived from key or entered manually (if fresh key)
    const targetUsername = (derivedUsername || username).trim().toLowerCase();

    if (!targetUsername) {
      alert("Please enter a username to link to this secret key");
      return;
    }

    if (!/^[a-z0-9_]{3,20}$/.test(targetUsername)) {
      alert("Username must be 3-20 characters, lowercase letters, numbers, and underscores only");
      return;
    }

    if (password && password.length < 8) {
      alert("Password must be at least 8 characters long to set up recovery");
      return;
    }

    setStep("Importing wallet credentials...");
    try {
      await importAccountWallet(cleanSecret, targetUsername, password || undefined);
    } catch {
      setStep("");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      alert("Username must be 3-20 characters, lowercase letters, numbers, and underscores only");
      return;
    }

    setStep("Retrieving and decrypting your wallet backup...");
    try {
      await loginAccountWallet(cleanUsername, password);
    } catch {
      setStep("");
    }
  };

  const scrollToSection = (id: string, tabName: string) => {
    setActiveTab(tabName);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (mode === "create" || mode === "login" || mode === "choice") {
    return (
      <div className="flex items-center justify-center min-h-screen p-6 bg-gradient-to-br from-[#faf9f5] to-[#f4f2ea]">
        <div className="bg-white border border-[#1b4332]/8 rounded-3xl w-full max-w-[440px] shadow-xl p-8 animate-[slideUp_0.4s_ease] text-[#4a534e]">
          
          {mode === "create" && (
            <div className="flex flex-col">
              {createdSecretKey ? (
                /* ─── Backup Your Secret Key Screen ─── */
                <div className="flex flex-col gap-5 animate-[slideUp_0.35s_ease]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#1b4332]/8 flex items-center justify-center">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1b4332" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                    <h2 className="text-[#132e22] font-extrabold text-xl">Backup Your Secret Key</h2>
                  </div>

                  <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3.5 flex gap-2.5 leading-relaxed">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 mt-0.5">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>
                      <strong>This is the only time your secret key will be shown.</strong> It cannot be recovered or displayed again. Copy it now and store it in a safe place.
                    </span>
                  </div>

                  <div className="relative">
                    <div className="bg-[#fbfbfa] border border-[#1b4332]/15 rounded-xl p-4 pr-12 font-mono text-xs text-[#132e22] break-all leading-relaxed select-all">
                      {createdSecretKey}
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyKey}
                      className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-white border border-[#1b4332]/15 flex items-center justify-center cursor-pointer hover:bg-[#1b4332]/5 transition-all duration-200"
                      title="Copy to clipboard"
                    >
                      {copiedKey ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1b4332" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1b4332" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {copiedKey && (
                    <div className="text-xs text-[#1b4332] font-semibold flex items-center gap-1.5 -mt-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      Copied to clipboard!
                    </div>
                  )}

                  <div className="text-xs text-[#4a534e]/80 bg-[#f4f2ea] border border-[#1b4332]/8 rounded-xl p-3.5 flex flex-col gap-1.5 leading-relaxed">
                    <span className="font-semibold text-[#132e22]">Why is this important?</span>
                    <span>You can still access your wallet using your <strong>username &amp; password</strong>. But if your password ever fails or you forget it, this secret key is your <strong>only way to recover your funds</strong>.</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmBackup}
                    className="w-full py-4 px-6 text-sm font-bold bg-[#1b4332] text-white rounded-xl cursor-pointer hover:bg-[#132e22] transition-colors duration-300"
                  >
                    I&apos;ve Saved My Key — Continue
                  </button>
                </div>
              ) : (
                /* ─── Create Wallet Form / Spinner ─── */
                <>
                  <div className="flex items-center gap-4 mb-6">
                    <button
                      className="w-9 h-9 rounded-full bg-[#f4f2ea] border border-[#1b4332]/10 text-[#1b4332] flex items-center justify-center cursor-pointer hover:bg-[#1b4332]/5 transition-all duration-300"
                      onClick={() => setMode("choice")}
                      disabled={isInitializing}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12,19 5,12 12,5" />
                      </svg>
                    </button>
                    <h2 className="text-[#132e22] font-extrabold text-2xl">Create Wallet</h2>
                  </div>
                  {isInitializing ? (
                    <div className="flex flex-col items-center text-center py-8">
                      <div className="progress-spinner large-spinner" />
                      <h3 className="text-lg font-bold mb-3 text-[#1b4332]">{step}</h3>
                      <p className="text-xs text-[#4a534e] leading-relaxed">
                        This setup registers your username, requests testnet XLM, sets
                        up a USDC trustline, and faucets 100 starting USDC. Please wait
                        a few seconds.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleCreate} className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-[#132e22] font-semibold text-sm">Choose a unique Username</label>
                        <div className="relative flex items-center w-full">
                          <span className="absolute left-3.5 text-[#1b4332]/40 text-base font-semibold select-none">@</span>
                          <input
                            type="text"
                            placeholder="satoshi"
                            value={username}
                            onChange={(e) =>
                              setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                            }
                            className="w-full py-3.5 pl-8 pr-4 text-sm rounded-xl outline-none bg-[#fbfbfa] border border-[#1b4332]/15 text-[#132e22] focus:border-[#1b4332] focus:ring-4 focus:ring-[#1b4332]/10"
                            required
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[#132e22] font-semibold text-sm">Create a secure Password</label>
                        <input
                          type="password"
                          placeholder="At least 8 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full py-3.5 px-4 text-sm rounded-xl outline-none bg-[#fbfbfa] border border-[#1b4332]/15 text-[#132e22] focus:border-[#1b4332] focus:ring-4 focus:ring-[#1b4332]/10"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[#132e22] font-semibold text-sm">Confirm Password</label>
                        <input
                          type="password"
                          placeholder="Re-enter password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full py-3.5 px-4 text-sm rounded-xl outline-none bg-[#fbfbfa] border border-[#1b4332]/15 text-[#132e22] focus:border-[#1b4332] focus:ring-4 focus:ring-[#1b4332]/10"
                          required
                        />
                      </div>

                      {initError && (
                        <div className="text-sm text-error bg-error/8 border border-error/15 rounded-xl p-3 flex items-center gap-2 mt-2">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          {initError}
                        </div>
                      )}
                      <button type="submit" className="w-full py-4 px-6 text-sm font-bold bg-[#1b4332] text-white rounded-xl cursor-pointer hover:bg-[#132e22] transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed" disabled={username.length < 3 || password.length < 8}>
                        Generate Secure Wallet
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          )}

          {mode === "login" && (
            <div className="flex flex-col">
              <div className="flex items-center gap-4 mb-6">
                <button
                  className="w-9 h-9 rounded-full bg-[#f4f2ea] border border-[#1b4332]/10 text-[#1b4332] flex items-center justify-center cursor-pointer hover:bg-[#1b4332]/5 transition-all duration-300"
                  onClick={() => {
                    setMode("choice");
                    setSignInWithSecret(false);
                  }}
                  disabled={isInitializing}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12,19 5,12 12,5" />
                  </svg>
                </button>
                <h2 className="text-[#132e22] font-extrabold text-2xl">
                  {signInWithSecret ? "Sign In (Key)" : "Sign In"}
                </h2>
              </div>
              {isInitializing ? (
                <div className="flex flex-col items-center text-center py-8">
                  <div className="progress-spinner large-spinner" />
                  <h3 className="text-lg font-bold mb-3 text-[#1b4332]">{step}</h3>
                  <p className="text-xs text-[#4a534e] leading-relaxed">
                    {signInWithSecret ? "Linking your keypair..." : "Decrypting wallet credentials locally..."}
                  </p>
                </div>
              ) : (
                <form onSubmit={signInWithSecret ? handleImport : handleLogin} className="flex flex-col gap-4">
                  
                  {!signInWithSecret ? (
                    <>
                      <div className="flex flex-col gap-2">
                        <label className="text-[#132e22] font-semibold text-sm">Username</label>
                        <div className="relative flex items-center w-full">
                          <span className="absolute left-3.5 text-[#1b4332]/40 text-base font-semibold select-none">@</span>
                          <input
                            type="text"
                            placeholder="satoshi"
                            value={username}
                            onChange={(e) =>
                              setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                            }
                            className="w-full py-3.5 pl-8 pr-4 text-sm rounded-xl outline-none bg-[#fbfbfa] border border-[#1b4332]/15 text-[#132e22] focus:border-[#1b4332] focus:ring-4 focus:ring-[#1b4332]/10"
                            required
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[#132e22] font-semibold text-sm">Password</label>
                        <input
                          type="password"
                          placeholder="Enter password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full py-3.5 px-4 text-sm rounded-xl outline-none bg-[#fbfbfa] border border-[#1b4332]/15 text-[#132e22] focus:border-[#1b4332] focus:ring-4 focus:ring-[#1b4332]/10"
                          required
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col gap-2">
                        <label className="text-[#132e22] font-semibold text-sm">Stellar Secret Key</label>
                        <input
                          type="password"
                          placeholder="S..."
                          value={secretKey}
                          onChange={(e) => setSecretKey(e.target.value)}
                          className="w-full py-3.5 px-4 text-sm rounded-xl outline-none bg-[#fbfbfa] border border-[#1b4332]/15 text-[#132e22] focus:border-[#1b4332] focus:ring-4 focus:ring-[#1b4332]/10"
                          required
                          autoFocus
                        />
                      </div>

                      {isCheckingKey && (
                        <div className="text-xs text-[#1b4332]/70 flex items-center gap-2 py-1 px-1">
                          <div className="progress-spinner small-spinner shrink-0" />
                          <span>Checking account registration...</span>
                        </div>
                      )}

                      {derivedUsername && (
                        <div className="text-xs text-[#1b4332] bg-[#1b4332]/6 border border-[#1b4332]/15 rounded-xl p-3 flex items-center gap-2">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 text-[#1b4332]">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                          </svg>
                          <span>
                            Identified registered account: <strong>@{derivedUsername}</strong>
                          </span>
                        </div>
                      )}

                      {showLinkUsername && (
                        <div className="flex flex-col gap-3 p-3.5 bg-[#c29d58]/6 border border-[#c29d58]/15 rounded-2xl animate-[slideUp_0.3s_ease]">
                          <span className="text-xs text-[#c29d58] font-semibold flex items-center gap-1.5">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            </svg>
                            Key has no registered username. Link it now:
                          </span>
                          <div className="relative flex items-center w-full">
                            <span className="absolute left-3.5 text-[#1b4332]/40 text-base font-semibold select-none">@</span>
                            <input
                              type="text"
                              placeholder="satoshi"
                              value={username}
                              onChange={(e) =>
                                setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                              }
                              className="w-full py-3 pl-8 pr-4 text-xs rounded-xl outline-none bg-white border border-[#1b4332]/15 text-[#132e22] focus:border-[#1b4332]"
                              required
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col gap-2">
                        <label className="text-[#132e22] font-semibold text-sm">Create a Password (optional)</label>
                        <input
                          type="password"
                          placeholder="To enable future password login"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full py-3.5 px-4 text-sm rounded-xl outline-none bg-[#fbfbfa] border border-[#1b4332]/15 text-[#132e22] focus:border-[#1b4332] focus:ring-4 focus:ring-[#1b4332]/10"
                        />
                        <span className="text-xs text-[#4a534e]/60">
                          If provided, this encrypts your key and backs it up so you can sign in with your password next time.
                        </span>
                      </div>
                    </>
                  )}

                  {initError && (
                    <div className="text-sm text-error bg-error/8 border border-error/15 rounded-xl p-3 flex items-center gap-2 mt-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {initError}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-4 px-6 text-sm font-bold bg-[#1b4332] text-white rounded-xl cursor-pointer hover:bg-[#132e22] transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={
                      isCheckingKey ||
                      (signInWithSecret
                        ? (secretKey.length !== 56 || (showLinkUsername && username.length < 3))
                        : (username.length < 3 || password.length < 8))
                    }
                  >
                    {signInWithSecret ? (showLinkUsername ? "Link & Access Wallet" : "Access Wallet") : "Access Wallet"}
                  </button>

                  <div className="text-center mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSignInWithSecret(!signInWithSecret);
                        setPassword("");
                        setSecretKey("");
                        setDerivedUsername(null);
                        setShowLinkUsername(false);
                      }}
                      className="text-xs font-semibold text-[#1b4332] hover:underline cursor-pointer bg-transparent border-0"
                    >
                      {signInWithSecret ? "Or Sign In with Password instead" : "Or Sign In with Secret Key instead"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {mode === "choice" && (
            <div className="flex flex-col gap-6 text-center">
              <div className="flex items-center gap-4 mb-2">
                <button
                  className="w-9 h-9 rounded-full bg-[#f4f2ea] border border-[#1b4332]/10 text-[#1b4332] flex items-center justify-center cursor-pointer hover:bg-[#1b4332]/5 transition-all duration-300"
                  onClick={() => setMode("welcome")}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12,19 5,12 12,5" />
                  </svg>
                </button>
                <h2 className="text-[#132e22] font-extrabold text-2xl">Get Started</h2>
              </div>

              <p className="text-sm text-[#4a534e] leading-relaxed">
                Create a new digital wallet or access your existing account to begin sending support home.
              </p>

              <div className="flex flex-col gap-3.5 mt-2">
                <button
                  className="w-full py-4 px-6 text-sm font-bold bg-[#1b4332] text-white rounded-xl cursor-pointer hover:bg-[#132e22] hover:-translate-y-0.5 transition-all duration-300 shadow-md hover:shadow-lg"
                  onClick={() => setMode("create")}
                >
                  Create New Wallet
                </button>
                <button
                  className="w-full py-4 px-6 text-sm font-bold border border-[#1b4332] bg-transparent text-[#1b4332] rounded-xl cursor-pointer hover:bg-[#1b4332]/5 hover:-translate-y-0.5 transition-all duration-300"
                  onClick={() => setMode("login")}
                >
                  Sign In
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-[#faf9f5] to-[#f4f2ea] text-[#4a534e] pb-24 md:pb-6 font-sans overflow-x-hidden">
      {/* Top Header */}
      <header className="flex justify-between items-center py-5 px-6 max-w-[1200px] mx-auto w-full" id="hero">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="enteveed logo" className="w-10 h-10 object-contain" />
          <div className="text-xl font-extrabold text-[#1b4332] leading-tight flex flex-col">
            enteveed
            <span className="text-[10px] font-medium text-[#c29d58] tracking-wider">Mi Home. Mi People.</span>
          </div>
        </div>
        <button
          className="bg-transparent border-0 text-[#1b4332] cursor-pointer p-2 flex items-center justify-center hover:opacity-80 transition-opacity"
          aria-label="Menu"
          onClick={() => scrollToSection("footer", "more")}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </header>

      {/* Hero Section */}
      <section className="max-w-[1200px] mx-auto px-6 py-6 flex flex-col md:flex-row gap-8 md:gap-16 items-center md:py-16">
        <div className="flex-1 flex flex-col items-start text-left">
          <div className="inline-flex items-center gap-1.5 bg-[#1b4332]/6 text-[#1b4332] py-1.5 px-3.5 rounded-full text-xs font-semibold mb-5 border border-[#1b4332]/10">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>GULF TO KERALA</span>
          </div>
          <h1 className="text-4xl md:text-5.5xl font-extrabold text-[#132e22] leading-tight mb-4 tracking-tight">
            Send love.<br />Home it reaches.
          </h1>
          <p className="text-base leading-relaxed text-[#4a534e] mb-7 max-w-[520px]">
            Fast, secure, and low-cost digital remittances from the Gulf to Kerala. Direct custodial account creation, powered by Stellar and USD Coin.
          </p>

          <div className="flex gap-4 mb-8 flex-wrap">
            <div className="flex items-center gap-2 bg-white py-2.5 px-4 rounded-xl text-xs font-semibold text-[#132e22] border border-[#1b4332]/8 shadow-sm">
              <div className="text-[#c29d58] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <span>Secure & Trusted</span>
            </div>
            <div className="flex items-center gap-2 bg-white py-2.5 px-4 rounded-xl text-xs font-semibold text-[#132e22] border border-[#1b4332]/8 shadow-sm">
              <div className="text-[#c29d58] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <span>Instant Transfers</span>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 w-full sm:w-auto">
            <button
              className="py-4 px-8 text-sm font-bold rounded-full cursor-pointer flex items-center justify-center gap-2 border bg-[#1b4332] text-white border-transparent hover:bg-[#132e22] hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 w-full sm:w-auto"
              onClick={() => setMode("choice")}
            >
              Get Started Now
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 w-full max-w-[500px] flex justify-center relative">
          <img
            src="/hero_family.png"
            alt="Happy Indian family looking at a smartphone"
            className="w-full h-auto rounded-3xl shadow-lg border-4 border-white object-cover"
          />
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-[1201px] mx-auto px-6 py-12 md:py-20" id="why-us">
        <div className="text-center mb-10 max-w-[600px] mx-auto">
          <h2 className="text-3xl font-extrabold text-[#132e22] mb-3">Why enteveed?</h2>
          <p className="text-sm text-[#4a534e] leading-relaxed">We build financial bridges that keep you close to your family, offering the best rates and instant deliveries.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white border border-[#1b4332]/8 rounded-2xl p-7 text-center shadow-sm hover:-translate-y-1.5 hover:shadow-md hover:border-[#1b4332]/15 transition-all duration-300 flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-[#1b4332]/5 text-[#1b4332] flex items-center justify-center mb-5 text-2xl">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#132e22] mb-2.5">Built for NRIs</h3>
            <p className="text-[13px] text-[#4a534e] leading-normal">Designed specifically for Malayalees and global expats in the Gulf region sending support home.</p>
          </div>

          <div className="bg-white border border-[#1b4332]/8 rounded-2xl p-7 text-center shadow-sm hover:-translate-y-1.5 hover:shadow-md hover:border-[#1b4332]/15 transition-all duration-300 flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-[#1b4332]/5 text-[#1b4332] flex items-center justify-center mb-5 text-2xl">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
                <line x1="12" y1="4" x2="12" y2="20" />
                <circle cx="12" cy="12" r="4" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#132e22] mb-2.5">Lowest Fees</h3>
            <p className="text-[13px] text-[#4a534e] leading-normal">More value for your hard-earned money. No predatory margins or hidden currency markups.</p>
          </div>

          <div className="bg-white border border-[#1b4332]/8 rounded-2xl p-7 text-center shadow-sm hover:-translate-y-1.5 hover:shadow-md hover:border-[#1b4332]/15 transition-all duration-300 flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-[#1b4332]/5 text-[#1b4332] flex items-center justify-center mb-5 text-2xl">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#132e22] mb-2.5">Instant Transfers</h3>
            <p className="text-[13px] text-[#4a534e] leading-normal">Money reaches home in minutes, not days. Fast settlement via the decentralized Stellar Ledger.</p>
          </div>

          <div className="bg-white border border-[#1b4332]/8 rounded-2xl p-7 text-center shadow-sm hover:-translate-y-1.5 hover:shadow-md hover:border-[#1b4332]/15 transition-all duration-300 flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-[#1b4332]/5 text-[#1b4332] flex items-center justify-center mb-5 text-2xl">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#132e22] mb-2.5">Safe & Secure</h3>
            <p className="text-[13px] text-[#4a534e] leading-normal">Platform-custodied keys and audited contracts protect you, your family, and every single transaction.</p>
          </div>
        </div>
      </section>


      {/* Bridging Miles Section */}
      <section className="max-w-[1200px] mx-auto px-6 py-12 md:py-20 flex flex-col md:flex-row-reverse gap-8 md:gap-16 items-center" id="bridge">
        <div className="flex-[1.2] flex flex-col items-start">
          <h2 className="text-3xl font-extrabold text-[#132e22] mb-3">Bridging miles.<br />Connecting hearts.</h2>
          <p className="text-base leading-relaxed text-[#4a534e] mb-7">
            From the Gulf to your home in Kerala, we make every transfer feel like you're right there. Our seamless connection to the Stellar blockchain keeps your hard-earned money moving directly to your loved ones without middlemen or delay. 💚
          </p>
          <button
            className="py-3.5 px-7 text-sm font-bold rounded-full cursor-pointer flex items-center justify-center gap-2 border bg-[#1b4332] text-white border-transparent hover:bg-[#132e22] hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300"
            onClick={() => setMode("choice")}
          >
            Get Started Now
          </button>
        </div>
        <div className="flex-1 w-full max-w-[440px]">
          <img
            src="/kerala_illustration.png"
            alt="Beautiful illustration of a Kerala houseboat on backwaters"
            className="w-full h-auto rounded-2xl shadow-sm border border-[#1b4332]/8 bg-white p-2.5"
          />
        </div>
      </section>

      {/* Footer partner and trust strip */}
      <footer className="bg-[#1b4332] text-white py-10 px-6" id="footer">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row md:justify-between gap-8 items-center">
          <div className="flex flex-col gap-3 text-center md:text-left">
            <span className="text-xs font-semibold text-white/70 uppercase tracking-widest">Trusted by Thousands</span>
            <div className="flex items-center justify-center md:justify-start">
              <span className="w-9 h-9 rounded-full border-2 border-[#1b4332] -ml-2 object-cover first:ml-0 bg-[#1e3a8a] text-white flex items-center justify-center text-[10px] font-bold">RV</span>
              <span className="w-9 h-9 rounded-full border-2 border-[#1b4332] -ml-2 object-cover first:ml-0 bg-[#065f46] text-white flex items-center justify-center text-[10px] font-bold">AM</span>
              <span className="w-9 h-9 rounded-full border-2 border-[#1b4332] -ml-2 object-cover first:ml-0 bg-[#991b1b] text-white flex items-center justify-center text-[10px] font-bold">KL</span>
              <span className="w-9 h-9 rounded-full border-2 border-[#1b4332] -ml-2 object-cover first:ml-0 bg-[#d97706] text-white flex items-center justify-center text-[10px] font-bold">SP</span>
              <span className="w-9 h-9 rounded-full border-2 border-[#1b4332] -ml-2 object-cover first:ml-0 bg-[#7c3aed] text-white flex items-center justify-center text-[10px] font-bold">KJ</span>
              <span className="ml-3 text-sm font-bold text-white">10K+ Happy Users</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 text-center md:text-right items-center md:items-end">
            <span className="text-xs font-semibold text-white/70 uppercase tracking-widest">Our Protocol Partners</span>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-base font-bold text-white no-underline">
                <svg width="24" height="24" viewBox="0 0 256 256" fill="currentColor" className="text-white">
                  <path d="M136.2 12.2c-5.7.8-10.7 4.2-13.3 9.3l-10 19.8-37.4 74.3c-2.4 4.8-.8 10.6 3.8 13.4 4.8 2.9 11 1.4 13.8-3.4L130 52l6 12 18.2 36.5 13.8 27.5-6.2 12.3-43 85.3-10 19.8c-2.8 5.6-.2 12.3 5.6 15l2 1c4.8 2.2 10.4.7 13.3-3.6l10-19.8 41.5-82.3c2.4-4.8.8-10.6-3.8-13.4-4.8-2.9-11-1.4-13.8 3.4L180.2 204l-6.2-12.3L156 155.1l-13.8-27.5 6.2-12.3 43-85.3 10-19.8c2.8-5.6.2-12.3-5.6-15-.6-.3-1.2-.5-1.9-.7l-4.7-.8zM57 91.2c-5.4 0-10.3 3.3-12.4 8.2L5 188.7c-2.6 6-.5 12.9 5.1 16.3 5.9 3.5 13.5.7 15.9-5.5l14-31.3h51.5l14 31.3c2.4 6.2 10 9 15.9 5.5 5.6-3.4 7.7-10.3 5.1-16.3L81.8 99.4C79.7 94.5 74.8 91.2 69.4 91.2H57zm4.3 23h8.3l18 40.5H39.2l18-40.5z" />
                </svg>
                <span>Stellar</span>
              </div>
              <div className="flex items-center gap-2 text-base font-bold text-white no-underline">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#2775ca]">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v12M15 8H10.5a2.5 2.5 0 0 0 0 5H13.5a2.5 2.5 0 0 1 0 5H9" />
                </svg>
                <span>USDC</span>
              </div>
            </div>
            <span className="text-[11px] text-white/50 mt-1">Powered by Stellar Blockchain</span>
          </div>
        </div>
      </footer>

      {/* Sticky Bottom Nav (Mobile Only) */}

    </div>
  );
}
