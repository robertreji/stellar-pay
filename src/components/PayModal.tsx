"use client";

import { useState, useEffect, useRef } from "react";
import { useWallet } from "@/context/WalletContext";
import { buildPaymentTx, submitClassicTransaction } from "@/lib/transactions";
import { config, getExplorerTxUrl } from "@/lib/stellar";
import { isValidStellarAddress } from "@/lib/contacts";
import { Html5Qrcode } from "html5-qrcode";

interface PayModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillAddress?: string;
  prefillName?: string;
}

type TxStatus = "idle" | "building" | "signing" | "submitting" | "success" | "error";

interface SearchResult {
  username: string;
  stellar_address: string;
}

export default function PayModal({
  isOpen,
  onClose,
  prefillAddress = "",
  prefillName = "",
}: PayModalProps) {
  const { address, sign, refreshBalances, usdcIssuer } = useWallet();
  const [destination, setDestination] = useState(prefillAddress);
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState<"XLM" | "USDC">("XLM");
  const [status, setStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Username search state
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [resolvedUsername, setResolvedUsername] = useState(prefillName);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // QR Code Scanner State
  const [showScanner, setShowScanner] = useState(false);
  const qrReaderRef = useRef<Html5Qrcode | null>(null);

  // Reset when prefill changes
  useEffect(() => {
    setDestination(prefillAddress);
    setResolvedUsername(prefillName);
  }, [prefillAddress, prefillName]);

  // Handle camera scanner lifecycle
  useEffect(() => {
    if (showScanner && isOpen) {
      const html5QrCode = new Html5Qrcode("qr-reader");
      qrReaderRef.current = html5QrCode;

      html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: (width, height) => {
            const size = Math.min(width, height) * 0.80;
            return { width: size, height: size };
          }
        },
        (decodedText) => {
          handleQrDecoded(decodedText);
        },
        () => {
          // Suppress scanner noise logs
        }
      ).catch((err) => {
        console.error("Failed to start camera scanner:", err);
      });

      return () => {
        if (qrReaderRef.current && qrReaderRef.current.isScanning) {
          qrReaderRef.current.stop().then(() => {
            qrReaderRef.current = null;
          }).catch(err => console.error("Failed to stop scanner:", err));
        }
      };
    }
  }, [showScanner, isOpen]);

  const handleQrDecoded = (decodedText: string) => {
    const cleanText = decodedText.trim();
    
    // Stop camera if running
    if (qrReaderRef.current && qrReaderRef.current.isScanning) {
      qrReaderRef.current.stop().then(() => {
        qrReaderRef.current = null;
        setShowScanner(false);
      }).catch(() => {
        setShowScanner(false);
      });
    } else {
      setShowScanner(false);
    }

    if (cleanText.startsWith("G") && cleanText.length === 56) {
      setDestination(cleanText);
      setResolvedUsername("");
    } else {
      const cleanUsername = cleanText.replace(/^@/, "");
      setDestination(cleanUsername);
      // Fetch details from server to pre-resolve username info
      fetch(`/api/users/${encodeURIComponent(cleanUsername)}`)
        .then(res => res.json())
        .then(data => {
          if (data.user?.stellar_address) {
            setDestination(data.user.stellar_address);
            setResolvedUsername(data.user.username);
          }
        })
        .catch(err => {
          console.warn("Failed to resolve scanned username QR code details:", err);
        });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const html5QrCodeFile = new Html5Qrcode("qr-reader-file");
      const decodedText = await html5QrCodeFile.scanFile(file, true);
      handleQrDecoded(decodedText);
      html5QrCodeFile.clear();
    } catch (err) {
      alert("No valid QR code found in selected image. Please upload a clear QR code.");
    }
  };

  const resetForm = () => {
    setDestination(prefillAddress);
    setAmount("");
    setAsset("XLM");
    setStatus("idle");
    setTxHash("");
    setErrorMsg("");
    setSearchResults([]);
    setShowDropdown(false);
    setResolvedUsername(prefillName);
    setShowScanner(false);
  };

  const handleClose = () => {
    if (qrReaderRef.current && qrReaderRef.current.isScanning) {
      qrReaderRef.current.stop().then(() => {
        qrReaderRef.current = null;
        resetForm();
        onClose();
      }).catch(() => {
        resetForm();
        onClose();
      });
    } else {
      resetForm();
      onClose();
    }
  };

  // Search users as user types
  const handleDestinationChange = (value: string) => {
    setDestination(value);
    setResolvedUsername("");

    // If it looks like a Stellar address, don't search
    if (value.startsWith("G") && value.length > 10) {
      setShowDropdown(false);
      setSearchResults([]);
      return;
    }

    // If it looks like a username search (non-empty, not a G address)
    if (value.length >= 2 && !value.startsWith("G")) {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => searchUsers(value), 300);
    } else {
      setShowDropdown(false);
      setSearchResults([]);
    }
  };

  const searchUsers = async (query: string) => {
    setIsSearching(true);
    try {
      const res = await fetch(`/api/users?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.users && data.users.length > 0) {
        setSearchResults(data.users);
        setShowDropdown(true);
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const selectUser = (user: SearchResult) => {
    setDestination(user.stellar_address);
    setResolvedUsername(user.username);
    setShowDropdown(false);
    setSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    // Resolve username if destination doesn't look like an address
    let finalDestination = destination;
    if (!destination.startsWith("G") || destination.length !== 56) {
      try {
        const res = await fetch(`/api/resolve/${encodeURIComponent(destination)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.address) {
            finalDestination = data.address;
          } else {
            setErrorMsg("Username not found. Enter a valid username or Stellar address (G...).");
            setStatus("error");
            return;
          }
        } else {
          setErrorMsg("Username not found. Enter a valid username or Stellar address (G...).");
          setStatus("error");
          return;
        }
      } catch {
        setErrorMsg("Failed to resolve username.");
        setStatus("error");
        return;
      }
    }

    if (!isValidStellarAddress(finalDestination)) {
      setErrorMsg("Invalid Stellar address. Must start with G and be 56 characters.");
      setStatus("error");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setErrorMsg("Please enter a valid amount.");
      setStatus("error");
      return;
    }

    try {
      setStatus("building");
      const xdr = await buildPaymentTx(
        address,
        finalDestination,
        amount,
        asset,
        usdcIssuer || undefined
      );

      setStatus("signing");
      const signedXdr = await sign(xdr);

      setStatus("submitting");
      const result = await submitClassicTransaction(signedXdr);

      setTxHash(result.hash);
      setStatus("success");
      await refreshBalances();
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || "Transaction failed");
      setStatus("error");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#132e22]/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-6 animate-[fadeIn_0.2s_ease]" onClick={handleClose}>
      <div id="qr-reader-file" className="hidden" />
      <div className="bg-bg-card border border-border-theme rounded-3xl w-full max-w-[480px] shadow-2xl flex flex-col overflow-hidden animate-[slideUp_0.3s_ease]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 pt-6">
          <h2 className="text-lg font-bold text-text-primary">Send Payment</h2>
          <button className="bg-transparent border-0 text-text-muted cursor-pointer p-1 flex items-center justify-center rounded-full hover:bg-bg-hover hover:text-text-primary transition-all duration-200" onClick={handleClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {status === "success" ? (
          <div className="p-6 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22,4 12,14.01 9,11.01" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-text-primary">Payment Sent!</h3>
            <p className="text-2xl font-extrabold text-text-primary">
              {amount} {asset}
            </p>
            {resolvedUsername && (
              <p className="text-sm text-text-secondary">to @{resolvedUsername}</p>
            )}
            <a
              href={getExplorerTxUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent-purple hover:underline"
            >
              View on Stellar Expert →
            </a>
            <button className="w-full py-4 px-6 text-sm font-bold bg-gradient-to-r from-accent-purple to-accent-indigo text-white rounded-xl cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300" onClick={handleClose}>
              Done
            </button>
          </div>
        ) : showScanner ? (
          /* Camera and File Scan View */
          <div className="p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-text-primary">Scan QR Code</span>
              <button
                type="button"
                onClick={() => setShowScanner(false)}
                className="bg-transparent border-0 text-text-muted cursor-pointer text-xs font-semibold hover:text-text-primary transition-colors"
              >
                ← Enter Details
              </button>
            </div>

            <div className="relative w-full aspect-square rounded-2xl border border-border-theme overflow-hidden bg-black flex items-center justify-center">
              <div id="qr-reader" className="w-full h-full" />
              
              {/* Scan Overlay Frame */}
              <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40 flex items-center justify-center">
                <div className="w-[180px] h-[180px] border-2 border-accent-purple rounded-xl relative">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-accent-purple -translate-x-0.5 -translate-y-0.5" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-accent-purple translate-x-0.5 -translate-y-0.5" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-accent-purple -translate-x-0.5 translate-y-0.5" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-accent-purple translate-x-0.5 translate-y-0.5" />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3.5 items-center">
              <span className="text-[11px] text-text-secondary text-center leading-normal">
                Point your camera at a StellarPay / enteveed QR code card
              </span>
              
              <button
                type="button"
                onClick={() => document.getElementById("qr-file-upload")?.click()}
                className="py-2.5 px-4 text-xs font-bold bg-bg-secondary border border-border-theme text-text-primary rounded-xl cursor-pointer hover:bg-bg-hover hover:border-border-theme-hover transition-all duration-300 flex items-center justify-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Upload QR Code Image
              </button>
              <input
                type="file"
                id="qr-file-upload"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        ) : (
          /* Standard Payment Input Form */
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
            {(prefillName || resolvedUsername) && (
              <div className="bg-accent-purple/10 border border-accent-purple/15 text-accent-purple rounded-xl p-3 text-xs text-center">
                Sending to <strong>@{resolvedUsername || prefillName}</strong>
              </div>
            )}

            <div className="flex flex-col gap-2 w-full relative" ref={dropdownRef}>
              <label className="text-xs font-semibold text-text-secondary">Recipient (Username or Address)</label>
              <div className="relative flex items-center w-full">
                <input
                  type="text"
                  placeholder="@username or G..."
                  value={resolvedUsername ? `@${resolvedUsername}` : destination}
                  onChange={(e) => {
                    const val = e.target.value.replace(/^@/, "");
                    handleDestinationChange(val);
                  }}
                  onFocus={() => {
                    if (searchResults.length > 0) setShowDropdown(true);
                  }}
                  disabled={status !== "idle" && status !== "error"}
                  className="w-full bg-bg-secondary border border-border-theme rounded-xl py-3.5 pl-4 pr-12 text-sm outline-none focus:border-accent-purple/50 focus:ring-4 focus:ring-accent-purple/10 text-text-primary transition-all duration-300 focus:bg-bg-card"
                />
                <div className="absolute right-3.5 flex items-center gap-2">
                  {isSearching ? (
                    <div className="progress-spinner" style={{ width: 16, height: 16 }} />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowScanner(true)}
                      className="bg-transparent border-0 text-text-muted cursor-pointer hover:text-accent-purple transition-colors p-1"
                      title="Scan QR Code"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                        <path d="M7 17h2v2H7z M17 7h2v2h-2z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {showDropdown && searchResults.length > 0 && (
                <div className="absolute top-[calc(100%_+_4px)] left-0 right-0 bg-bg-card border border-border-theme rounded-xl shadow-lg z-[1100] max-h-[220px] overflow-y-auto flex flex-col p-1.5 gap-1">
                  {searchResults.map((user) => (
                    <button
                      key={user.username}
                      type="button"
                      className="w-full flex items-center gap-2.5 p-2 rounded-lg cursor-pointer bg-transparent border-0 hover:bg-bg-hover text-left"
                      onClick={() => selectUser(user)}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{
                          background: `linear-gradient(135deg, #1b4332, #c29d58)`,
                        }}
                      >
                        {user.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-bold text-text-primary">@{user.username}</span>
                        <span className="text-[10px] text-text-muted font-mono truncate">
                          {user.stellar_address.slice(0, 4)}...{user.stellar_address.slice(-4)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 w-full">
              <label className="text-xs font-semibold text-text-secondary">Amount</label>
              <div className="relative flex items-center w-full">
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={status !== "idle" && status !== "error"}
                  className="w-full bg-bg-secondary border border-border-theme rounded-xl py-3.5 pl-4 pr-32 text-sm outline-none focus:border-accent-purple/50 focus:ring-4 focus:ring-accent-purple/10 text-text-primary transition-all duration-300 focus:bg-bg-card"
                  step="any"
                  min="0"
                />
                <div className="absolute right-2 flex gap-1 bg-bg-secondary p-1 rounded-lg border border-border-theme">
                  <button
                    type="button"
                    className={`py-1 px-2.5 rounded-md text-[10px] font-bold bg-transparent cursor-pointer transition-all duration-200 ${
                      asset === "XLM" ? "bg-accent-purple text-white shadow-sm" : "text-text-muted hover:text-text-primary"
                    }`}
                    onClick={() => setAsset("XLM")}
                  >
                    XLM
                  </button>
                  <button
                    type="button"
                    className={`py-1 px-2.5 rounded-md text-[10px] font-bold bg-transparent cursor-pointer transition-all duration-200 ${
                      asset === "USDC" ? "bg-accent-purple text-white shadow-sm" : "text-text-muted hover:text-text-primary"
                    }`}
                    onClick={() => setAsset("USDC")}
                  >
                    USDC
                  </button>
                </div>
              </div>
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
              className="w-full py-4 px-6 text-sm font-bold bg-gradient-to-r from-accent-purple to-accent-indigo text-white rounded-xl cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={status !== "idle" && status !== "error"}
            >
              {status === "building" && "Building Transaction..."}
              {status === "signing" && "Signing Transaction..."}
              {status === "submitting" && "Submitting..."}
              {(status === "idle" || status === "error") && "Send Payment"}
            </button>

            {(status === "building" || status === "signing" || status === "submitting") && (
              <div className="flex items-center gap-3 bg-bg-card border border-border-theme rounded-xl p-4 text-sm text-text-secondary animate-[fadeIn_0.2s_ease]">
                <div className="progress-spinner" />
                <span>
                  {status === "building" && "Building transaction..."}
                  {status === "signing" && "Signing transaction securely locally..."}
                  {status === "submitting" && "Submitting to Stellar network..."}
                </span>
              </div>
            )}

          </form>
        )}
      </div>
    </div>
  );
}
