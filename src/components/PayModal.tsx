"use client";

import { useState, useEffect, useRef } from "react";
import { useWallet } from "@/context/WalletContext";
import { buildPaymentTx, submitClassicTransaction } from "@/lib/transactions";
import { config } from "@/lib/stellar";
import { isValidStellarAddress } from "@/lib/contacts";

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

  // Reset when prefill changes
  useEffect(() => {
    setDestination(prefillAddress);
    setResolvedUsername(prefillName);
  }, [prefillAddress, prefillName]);

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
  };

  const handleClose = () => {
    resetForm();
    onClose();
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
      // Try to resolve as username
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(destination)}`);
        if (res.ok) {
          const data = await res.json();
          finalDestination = data.user.stellar_address;
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
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Send Payment</h2>
          <button className="modal-close" onClick={handleClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {status === "success" ? (
          <div className="modal-success">
            <div className="success-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22,4 12,14.01 9,11.01" />
              </svg>
            </div>
            <h3>Payment Sent!</h3>
            <p className="success-amount">
              {amount} {asset}
            </p>
            {resolvedUsername && (
              <p className="success-to">to @{resolvedUsername}</p>
            )}
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="success-link"
            >
              View on Stellar Expert →
            </a>
            <button className="btn btn-primary" onClick={handleClose}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="modal-form">
            {(prefillName || resolvedUsername) && (
              <div className="prefill-badge">
                Sending to <strong>@{resolvedUsername || prefillName}</strong>
              </div>
            )}

            <div className="form-group" style={{ position: "relative" }} ref={dropdownRef}>
              <label>Recipient (Username or Address)</label>
              <div className="destination-input-wrapper">
                <input
                  type="text"
                  placeholder="@username or G..."
                  value={resolvedUsername ? `@${resolvedUsername}` : destination}
                  onChange={(e) => {
                    const val = e.target.value.replace(/^@/, "");
                    handleDestinationChange(val);
                  }}
                  onFocus={() => {
                    if (resolvedUsername) {
                      // Allow editing by clearing resolved state
                    }
                    if (searchResults.length > 0) setShowDropdown(true);
                  }}
                  disabled={status !== "idle" && status !== "error"}
                  className="form-input"
                />
                {isSearching && (
                  <div className="input-spinner">
                    <div className="progress-spinner" style={{ width: 16, height: 16 }} />
                  </div>
                )}
              </div>

              {showDropdown && searchResults.length > 0 && (
                <div className="search-dropdown">
                  {searchResults.map((user) => (
                    <button
                      key={user.username}
                      type="button"
                      className="search-result-item"
                      onClick={() => selectUser(user)}
                    >
                      <div
                        className="search-result-avatar"
                        style={{
                          background: `linear-gradient(135deg, #6c2bd9, #9333ea)`,
                        }}
                      >
                        {user.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="search-result-info">
                        <span className="search-result-username">@{user.username}</span>
                        <span className="search-result-address">
                          {user.stellar_address.slice(0, 4)}...{user.stellar_address.slice(-4)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Amount</label>
              <div className="amount-input-wrapper">
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={status !== "idle" && status !== "error"}
                  className="form-input amount-input"
                  step="any"
                  min="0"
                />
                <div className="asset-selector">
                  <button
                    type="button"
                    className={`asset-btn ${asset === "XLM" ? "active" : ""}`}
                    onClick={() => setAsset("XLM")}
                  >
                    XLM
                  </button>
                  <button
                    type="button"
                    className={`asset-btn ${asset === "USDC" ? "active" : ""}`}
                    onClick={() => setAsset("USDC")}
                  >
                    USDC
                  </button>
                </div>
              </div>
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
              disabled={status !== "idle" && status !== "error"}
            >
              {status === "building" && "Building Transaction..."}
              {status === "signing" && "Signing Transaction..."}
              {status === "submitting" && "Submitting..."}
              {(status === "idle" || status === "error") && "Send Payment"}
            </button>

            {(status === "building" || status === "signing" || status === "submitting") && (
              <div className="tx-progress">
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
