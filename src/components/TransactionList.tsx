"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/context/WalletContext";
import { getPaymentHistory, PaymentRecord } from "@/lib/stellar";
import { getContacts, Contact } from "@/lib/contacts";

export default function TransactionList() {
  const { address, connected } = useWallet();
  const [transactions, setTransactions] = useState<PaymentRecord[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const fetchTransactions = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const history = await getPaymentHistory(address, 20);
      setTransactions(history);
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (connected && address) {
      fetchTransactions();
      setContacts(getContacts());
    }
  }, [connected, address, fetchTransactions]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getInitials = (nameOrAddr: string) => {
    const clean = nameOrAddr.replace("@", "");
    return clean.slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (addr: string) => {
    const colors = [
      "#6c2bd9", "#9333ea", "#ec4899", "#06b6d4",
      "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6",
    ];
    let hash = 0;
    for (let i = 0; i < addr.length; i++) {
      hash = addr.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const displayTxs = showAll ? transactions : transactions.slice(0, 5);

  if (!connected) {
    return (
      <div className="transaction-list">
        <div className="section-header">
          <h3 className="section-title">Recent Transactions</h3>
        </div>
        <div className="transaction-empty">
          <p>Connect your wallet to see transactions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="transaction-list">
      <div className="section-header">
        <h3 className="section-title">Recent Transactions</h3>
        {transactions.length > 5 && (
          <button
            className="view-all-btn"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Show Less" : "View All"}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="transaction-loading">
          {[1, 2, 3].map((i) => (
            <div key={i} className="transaction-skeleton">
              <div className="skeleton-avatar shimmer" />
              <div className="skeleton-content">
                <div className="skeleton-line shimmer" style={{ width: "60%" }} />
                <div className="skeleton-line shimmer" style={{ width: "40%" }} />
              </div>
              <div className="skeleton-amount shimmer" />
            </div>
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="transaction-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p>No transactions yet</p>
          <p className="transaction-empty-sub">
            Make a payment or deposit to get started
          </p>
        </div>
      ) : (
        <div className="transaction-items">
          {displayTxs.map((tx) => {
            const counterparty = tx.isIncoming ? tx.from : tx.to;
            const contact = contacts.find((c) => c.address === counterparty);
            const displayName = contact
              ? contact.name.startsWith("@")
                ? contact.name
                : `@${contact.name}`
              : `${counterparty.slice(0, 4)}...${counterparty.slice(-4)}`;

            return (
              <a
                key={tx.id}
                className="transaction-item"
                href={`https://stellar.expert/explorer/testnet/tx/${tx.transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div
                  className="transaction-avatar"
                  style={{
                    background: contact?.image ? "none" : `linear-gradient(135deg, ${contact ? contact.color : getAvatarColor(counterparty)}, ${contact ? contact.color : getAvatarColor(counterparty)}88)`,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0
                  }}
                >
                  {contact?.image ? (
                    <img
                      src={contact.image}
                      alt={contact.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    contact ? getInitials(contact.name) : getInitials(counterparty)
                  )}
                </div>
                <div className="transaction-details">
                  <span className="transaction-counterparty">{displayName}</span>
                  <span className="transaction-type">
                    {tx.isIncoming ? "Received" : "Sent"} · {formatTime(tx.createdAt)}
                  </span>
                </div>
                <span
                  className={`transaction-amount ${tx.isIncoming ? "incoming" : "outgoing"}`}
                >
                  {tx.isIncoming ? "+" : "-"}
                  {parseFloat(tx.amount).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  {tx.asset}
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
