"use client";

import { useState, useEffect } from "react";
import { addContact } from "@/lib/contacts";

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export default function AddContactModal({
  isOpen,
  onClose,
  onAdded,
}: AddContactModalProps) {
  const [username, setUsername] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");

  // Autocomplete Search Effect (Debounced)
  useEffect(() => {
    const cleanUsername = username.replace("@", "").trim();
    if (cleanUsername.length < 1) {
      setSearchResults([]);
      return;
    }

    // Skip query if current input matches the already selected user
    if (selectedUser && cleanUsername.toLowerCase() === selectedUser.username.toLowerCase()) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      setError("");
      try {
        const res = await fetch(`/api/users?q=${encodeURIComponent(cleanUsername)}`);
        if (res.ok) {
          const data = await res.json();
          // Filter out potential duplicates or inactive records
          setSearchResults(data.users || []);
        }
      } catch (err) {
        console.error("Autocomplete search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(delayDebounceFn);
  }, [username, selectedUser]);

  const handleSelectUser = (user: any) => {
    setSelectedUser(user);
    setUsername(user.username);
    setSearchResults([]);
    setError("");
  };

  const handleDeselectUser = () => {
    setSelectedUser(null);
    setUsername("");
    setSearchResults([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 1. If a valid user is selected from the dropdown, save immediately
    if (selectedUser) {
      addContact(selectedUser.username, selectedUser.stellar_address, selectedUser.profile_image || undefined);
      handleClose();
      onAdded();
      return;
    }

    // 2. Fallback: Lookup typed username if user hits enter without clicking dropdown
    const cleanUsername = username.replace("@", "").trim();
    if (!cleanUsername) {
      setError("Please enter or select a username.");
      return;
    }

    setIsSearching(true);
    fetch(`/api/users?q=${encodeURIComponent(cleanUsername)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Search failed");
        return res.json();
      })
      .then((data) => {
        const matchedUser = data.users?.find(
          (u: any) => u.username.toLowerCase() === cleanUsername.toLowerCase()
        );
        if (!matchedUser) {
          setError(`User "${username}" not found on the network.`);
        } else {
          addContact(matchedUser.username, matchedUser.stellar_address, matchedUser.profile_image || undefined);
          handleClose();
          onAdded();
        }
      })
      .catch((err) => {
        setError(err.message || "An error occurred during lookup.");
      })
      .finally(() => {
        setIsSearching(false);
      });
  };

  const handleClose = () => {
    setUsername("");
    setSearchResults([]);
    setSelectedUser(null);
    setError("");
    setIsSearching(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Contact</h2>
          <button className="modal-close" onClick={handleClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form" style={{ position: "relative" }}>
          
          <div className="form-group" style={{ marginBottom: "20px", position: "relative" }}>
            <label>Username</label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <span style={{ position: "absolute", left: "14px", color: "rgba(255, 255, 255, 0.4)", fontSize: "16px", fontWeight: "600", userSelect: "none" }}>@</span>
              <input
                type="text"
                placeholder="e.g., alice"
                value={username.replace("@", "")}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (selectedUser && e.target.value !== selectedUser.username) {
                    setSelectedUser(null);
                  }
                }}
                className="form-input"
                style={{ paddingLeft: "30px", width: "100%", paddingRight: selectedUser ? "40px" : "12px" }}
                autoComplete="off"
                autoFocus
              />
              {selectedUser && (
                <button
                  type="button"
                  onClick={handleDeselectUser}
                  style={{
                    position: "absolute",
                    right: "12px",
                    background: "rgba(255,255,255,0.08)",
                    border: "none",
                    borderRadius: "50%",
                    width: "20px",
                    height: "20px",
                    color: "rgba(255,255,255,0.6)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "10px"
                  }}
                  title="Clear selection"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dynamic Dropdown for User Matching */}
            {searchResults.length > 0 && !selectedUser && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  background: "#161b40",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "12px",
                  marginTop: "6px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  zIndex: 200,
                  maxHeight: "180px",
                  overflowY: "auto",
                  padding: "6px"
                }}
              >
                {searchResults.map((user) => {
                  const initials = user.username.slice(0, 2).toUpperCase();
                  return (
                    <div
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        transition: "background 0.2s"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          background: user.profile_image ? "none" : "linear-gradient(135deg, #a855f7, #3b82f6)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                          fontSize: "12px",
                          fontWeight: "700",
                          flexShrink: 0
                        }}
                      >
                        {user.profile_image ? (
                          <img
                            src={user.profile_image}
                            alt={user.username}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          initials
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <span style={{ fontSize: "14px", fontWeight: "600", color: "white" }}>@{user.username}</span>
                        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {user.stellar_address}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Validated Selected User Preview Card */}
          {selectedUser && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "14px 16px",
                borderRadius: "16px",
                background: "rgba(34, 197, 94, 0.08)",
                border: "1px solid rgba(34, 197, 94, 0.15)",
                marginBottom: "20px",
                animation: "fadeIn 0.2s ease"
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  background: selectedUser.profile_image ? "none" : "linear-gradient(135deg, #a855f7, #3b82f6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  fontSize: "14px",
                  fontWeight: "700",
                  flexShrink: 0
                }}
              >
                {selectedUser.profile_image ? (
                  <img
                    src={selectedUser.profile_image}
                    alt={selectedUser.username}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  selectedUser.username.slice(0, 2).toUpperCase()
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: "15px", fontWeight: "700", color: "#fff" }}>@{selectedUser.username}</span>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {selectedUser.stellar_address.slice(0, 8)}...{selectedUser.stellar_address.slice(-8)}
                </span>
              </div>
              <div
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  background: "#22c55e",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "11px",
                  fontWeight: "bold",
                  flexShrink: 0
                }}
              >
                ✓
              </div>
            </div>
          )}

          {error && (
            <div className="form-error" style={{ marginBottom: "20px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-full" disabled={isSearching}>
            {selectedUser ? "Save Contact" : isSearching ? "Searching..." : "Search & Save"}
          </button>
        </form>
      </div>
    </div>
  );
}
