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

    if (selectedUser) {
      addContact(selectedUser.username, selectedUser.stellar_address, selectedUser.profile_image || undefined);
      handleClose();
      onAdded();
      return;
    }

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
    <div className="fixed inset-0 bg-[#132e22]/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-6 animate-[fadeIn_0.2s_ease]" onClick={handleClose}>
      <div className="bg-bg-card border border-border-theme rounded-3xl w-full max-w-[440px] shadow-2xl flex flex-col overflow-hidden animate-[slideUp_0.3s_ease]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 pt-6">
          <h2 className="text-lg font-bold text-text-primary">Add Contact</h2>
          <button className="bg-transparent border-0 text-text-muted cursor-pointer p-1 flex items-center justify-center rounded-full hover:bg-bg-hover hover:text-text-primary transition-all duration-200" onClick={handleClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 relative">
          
          <div className="flex flex-col gap-2 w-full relative">
            <label className="text-xs font-semibold text-text-secondary">Username</label>
            <div className="relative flex items-center w-full">
              <span className="absolute left-3.5 text-text-muted text-base font-semibold select-none">@</span>
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
                className="w-full bg-bg-secondary border border-border-theme rounded-xl py-3.5 pl-8 pr-10 text-sm outline-none focus:border-accent-purple/50 focus:ring-4 focus:ring-accent-purple/10 text-text-primary transition-all duration-300 focus:bg-bg-card"
                autoComplete="off"
                autoFocus
              />
              {selectedUser && (
                <button
                  type="button"
                  onClick={handleDeselectUser}
                  className="absolute right-3 bg-text-muted/10 border-none rounded-full w-5 h-5 text-text-muted cursor-pointer flex items-center justify-center text-[10px]"
                  title="Clear selection"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dynamic Dropdown for User Matching */}
            {searchResults.length > 0 && !selectedUser && (
              <div className="absolute top-[calc(100%_+_6px)] left-0 right-0 bg-bg-card border border-border-theme rounded-xl shadow-2xl z-[200] max-h-[180px] overflow-y-auto p-1.5 flex flex-col gap-1">
                {searchResults.map((user) => {
                  const initials = user.username.slice(0, 2).toUpperCase();
                  return (
                    <div
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className="flex items-center gap-3 p-2 rounded-lg cursor-pointer bg-transparent hover:bg-bg-hover transition-colors duration-150"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden"
                        style={{
                          background: user.profile_image ? "none" : "linear-gradient(135deg, var(--color-accent-purple), var(--color-accent-indigo))",
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
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-text-primary">@{user.username}</span>
                        <span className="text-[10px] text-text-muted font-mono overflow-hidden text-ellipsis whitespace-nowrap">
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
            <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-success/8 border border-success/15 animate-[fadeIn_0.2s_ease]">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden"
                style={{
                  background: selectedUser.profile_image ? "none" : "linear-gradient(135deg, var(--color-accent-purple), var(--color-accent-indigo))",
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
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-bold text-text-primary">@{selectedUser.username}</span>
                <span className="text-[10px] text-text-muted font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                  {selectedUser.stellar_address.slice(0, 8)}...{selectedUser.stellar_address.slice(-8)}
                </span>
              </div>
              <div className="w-5.5 h-5.5 rounded-full bg-success flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                ✓
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-error bg-error/8 border border-error/15 rounded-xl p-3 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <button type="submit" className="w-full py-4 px-6 text-sm font-bold bg-gradient-to-r from-accent-purple to-accent-indigo text-white rounded-xl cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed" disabled={isSearching}>
            {selectedUser ? "Save Contact" : isSearching ? "Searching..." : "Search & Save"}
          </button>
        </form>
      </div>
    </div>
  );
}
