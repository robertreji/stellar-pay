"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@/context/WalletContext";
import { RemittanceTx } from "@/lib/services/remittanceService";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface RemittanceListProps {
  refreshTrigger: number;
}

export default function RemittanceList({ refreshTrigger }: RemittanceListProps) {
  const { username, connected } = useWallet();
  const [remittances, setRemittances] = useState<RemittanceTx[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  const fetchHistory = useCallback(async () => {
    if (!username) return;
    try {
      const res = await fetch(`/api/remittance/history?username=${encodeURIComponent(username)}`);
      if (res.ok) {
        const data = await res.json();
        setRemittances(data.remittances || []);
      }
    } catch (err) {
      console.error("Failed to load remittance history:", err);
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  // Load and set up polling when connected
  useEffect(() => {
    if (!connected) return;
    
    fetchHistory();

    // Poll every 4 seconds for real-time status updates (e.g. pending -> completed)
    const timer = setInterval(() => {
      fetchHistory();
    }, 4000);

    return () => clearInterval(timer);
  }, [connected, fetchHistory, refreshTrigger]);

  // GSAP animation for staggering entry of list items
  useGSAP(() => {
    if (remittances.length > 0 && listRef.current) {
      gsap.fromTo(
        listRef.current.children,
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.45, stagger: 0.06, ease: "power2.out" }
      );
    }
  }, [remittances]);

  const getStatusBadge = (status: RemittanceTx["status"]) => {
    const base = "px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase flex items-center gap-1.5 ";
    switch (status) {
      case "pending":
      case "payment_detected":
      case "processing":
        return (
          <span className={base + "bg-[#C9A34E]/10 text-[#C9A34E] border border-[#C9A34E]/20"}>
            <span className="w-1 h-1 rounded-full bg-[#C9A34E] animate-pulse" />
            Pending
          </span>
        );
      case "completed":
        return (
          <span className={base + "bg-[#164A3A]/8 text-[#164A3A] border border-[#164A3A]/15"}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#164A3A]" />
            Completed
          </span>
        );
      case "failed":
        return (
          <span className={base + "bg-[#D9534F]/10 text-[#D9534F] border border-[#D9534F]/20"}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#D9534F]" />
            Failed
          </span>
        );
      case "refunded":
        return (
          <span className={base + "bg-text-muted/10 text-text-muted border border-border-theme"}>
            <span className="w-1.5 h-1.5 rounded-full bg-text-muted" />
            Refunded
          </span>
        );
      default:
        return <span className={base + "bg-bg-secondary text-text-secondary"}>{status}</span>;
    }
  };

  const getInitials = (nameOrAddr: string) => {
    const clean = nameOrAddr.replace("@", "");
    return clean.slice(0, 2).toUpperCase();
  };

  if (!connected) return null;

  return (
    <div className="flex flex-col gap-4 mt-2">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Recent Remittances</h3>
        <span className="text-[10px] text-text-muted flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          Auto-refreshing live
        </span>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="shimmer h-[76px] rounded-2xl" />
          ))}
        </div>
      ) : remittances.length === 0 ? (
        <div className="bg-bg-card border border-border-theme rounded-[24px] p-8 text-center text-xs text-text-secondary flex flex-col items-center gap-2.5 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-accent-purple/5 text-accent-purple/40 flex items-center justify-center text-lg">
            💸
          </div>
          <span>No remittance history found. Tap "Send Money Home" to start.</span>
        </div>
      ) : (
        <div ref={listRef} className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
          {remittances.map((tx) => (
            <div
              key={tx.id}
              className="bg-white border border-[#164A3A]/6 rounded-2xl p-4 flex justify-between items-center gap-4 hover:border-[#164A3A]/15 hover:shadow-[0_4px_16px_rgba(22,74,58,0.03)] transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-center gap-3.5 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-[#164A3A]/5 border border-[#164A3A]/10 text-[#164A3A] font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
                  {getInitials(tx.recipient_name)}
                </div>
                <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-[#164A3A] truncate">{tx.recipient_name}</span>
                    {getStatusBadge(tx.status)}
                  </div>
                  <div className="text-[10.5px] text-[#4E6B4A] truncate">
                    {tx.recipient_upi}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="flex flex-col items-end">
                  <span className="text-xs font-black text-[#164A3A]">
                    ${tx.amount_usdc.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10.5px] text-[#4E6B4A] font-medium">
                    ≈ ₹{tx.amount_inr.toLocaleString("en-IN", { minimumFractionDigits: 2 })} INR
                  </span>
                  <span className="text-[9.5px] text-[#8A9886] mt-0.5">
                    {tx.created_at ? new Date(tx.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                  </span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4E6B4A" strokeWidth="2.5" className="text-text-muted opacity-70">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
