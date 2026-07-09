"use client";

import { useState } from "react";
import { addContact, isValidStellarAddress } from "@/lib/contacts";

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
  const [name, setName] = useState("");
  const [stellarAddress, setStellarAddress] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter a name.");
      return;
    }

    if (!isValidStellarAddress(stellarAddress)) {
      setError("Invalid Stellar address. Must start with G and be 56 characters.");
      return;
    }

    addContact(name.trim(), stellarAddress);
    setName("");
    setStellarAddress("");
    onAdded();
    onClose();
  };

  const handleClose = () => {
    setName("");
    setStellarAddress("");
    setError("");
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

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              placeholder="e.g., Alice"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Stellar Address</label>
            <input
              type="text"
              placeholder="G..."
              value={stellarAddress}
              onChange={(e) => setStellarAddress(e.target.value)}
              className="form-input"
            />
          </div>

          {error && (
            <div className="form-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-full">
            Save Contact
          </button>
        </form>
      </div>
    </div>
  );
}
