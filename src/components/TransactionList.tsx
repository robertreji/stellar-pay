"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@/context/WalletContext";
import { getPaymentHistory, PaymentRecord } from "@/lib/stellar";
import { getContacts, Contact } from "@/lib/contacts";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export default function TransactionList() {
  const { address, connected } = useWallet();
  const [transactions, setTransactions] = useState<PaymentRecord[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

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

  // GSAP animation for staggering entry of list items
  useGSAP(() => {
    if (transactions.length > 0 && listRef.current) {
      gsap.fromTo(
        listRef.current.children,
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.45, stagger: 0.06, ease: "power2.out" }
      );
    }
  }, [transactions, showAll]);

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
      <div className="flex flex-col gap-4 mt-2">
        <div className="flex justify-between items-center w-full">
          <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Recent Transactions</h3>
        </div>
        <div className="bg-bg-card border border-border-theme rounded-2xl p-8 flex flex-col items-center justify-center text-center text-text-muted gap-2 min-h-[160px]">
          <p>Connect your wallet to see transactions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 mt-2">
      <div className="flex justify-between items-center w-full">
        <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Recent Transactions</h3>
        {transactions.length > 5 && (
          <button
            className="bg-transparent border-0 text-accent-purple cursor-pointer text-xs font-bold transition-opacity hover:opacity-80"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Show Less" : "View All"}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 bg-bg-card border border-border-theme rounded-2xl p-4 shimmer">
              <div className="w-10 h-10 rounded-full bg-bg-secondary" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="h-3 rounded bg-bg-secondary" style={{ width: "60%" }} />
                <div className="h-3 rounded bg-bg-secondary" style={{ width: "40%" }} />
              </div>
              <div className="w-14 h-4 rounded bg-bg-secondary" />
            </div>
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="bg-bg-card border border-border-theme rounded-[24px] p-8 flex flex-col items-center justify-center text-center text-text-muted gap-2 min-h-[160px] shadow-sm">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="font-semibold text-sm">No transactions yet</p>
          <p className="text-xs opacity-70">
            Make a payment or deposit to get started
          </p>
        </div>
      ) : (
        <div ref={listRef} className="flex flex-col gap-2.5">
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
                className="flex items-center gap-3.5 bg-white border border-[#164A3A]/6 rounded-2xl p-4 transition-all duration-300 text-[#164A3A] hover:border-[#164A3A]/15 hover:shadow-[0_4px_16px_rgba(22,74,58,0.03)] no-underline cursor-pointer"
                href={`https://stellar.expert/explorer/testnet/tx/${tx.transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-[#164A3A] bg-[#164A3A]/5 border border-[#164A3A]/10 flex-shrink-0 shadow-sm"
                  style={{
                    background: contact?.image ? "none" : undefined,
                    overflow: "hidden",
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
                <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                  <span className="text-[13px] font-bold text-[#164A3A] truncate">{displayName}</span>
                  <span className="text-[10.5px] text-[#4E6B4A] font-medium">
                    {tx.isIncoming ? "Received" : "Sent"} · {formatTime(tx.createdAt)}
                  </span>
                </div>
                <span
                  className={`text-xs font-black flex-shrink-0 font-mono ${tx.isIncoming ? "text-[#164A3A]" : "text-text-primary"}`}
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
