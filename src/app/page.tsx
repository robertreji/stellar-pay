"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import BalanceCard from "@/components/BalanceCard";
import ActionButtons from "@/components/ActionButtons";
import TransactionList from "@/components/TransactionList";
import ContactsSidebar from "@/components/ContactsSidebar";
import BottomNav from "@/components/BottomNav";
import PayModal from "@/components/PayModal";
import DepositModal from "@/components/DepositModal";
import TransferModal from "@/components/TransferModal";
import AddContactModal from "@/components/AddContactModal";
import WithdrawModal from "@/components/WithdrawModal";
import ReceiveModal from "@/components/ReceiveModal";
import ProfileDrawer from "@/components/ProfileDrawer";
import Onboarding from "@/components/Onboarding";
import SendMoneyModal from "@/components/SendMoneyModal";
import RemittanceList from "@/components/RemittanceList";
import { useWallet } from "@/context/WalletContext";
import { Contact } from "@/lib/contacts";
import { Recipient } from "@/lib/services/recipientService";

export default function Home() {
  const { connected, address, username, refreshBalances, disconnectWallet } = useWallet();
  const [activeTab, setActiveTab] = useState<"home" | "activity" | "wallet" | "settings">("home");
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showSendMoneyModal, setShowSendMoneyModal] = useState(false);
  const [isViewAllContacts, setIsViewAllContacts] = useState(false);
  
  const [prefillAddress, setPrefillAddress] = useState("");
  const [prefillName, setPrefillName] = useState("");
  const [contactsKey, setContactsKey] = useState(0);
  const [announcementDismissed, setAnnouncementDismissed] = useState(true);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(0);
  
  // Remittance-first states
  const [aedToInr, setAedToInr] = useState(22.56);
  const [usdToInr, setUsdToInr] = useState(82.87);
  const [recipients, setRecipients] = useState<Recipient[]>([]);

  // Prefill for Send Money Home modal
  const [prefillUpi, setPrefillUpi] = useState("");
  const [prefillRecipName, setPrefillRecipName] = useState("");

  // Sync profile photo
  useEffect(() => {
    if (address) {
      const stored = localStorage.getItem(`stellarpay_profile_image_${address}`);
      if (stored) {
        setProfileImage(stored);
      }
    } else {
      setProfileImage(null);
    }
  }, [address, avatarRefreshKey]);

  // Load announcement dismissed state
  useEffect(() => {
    const dismissed = localStorage.getItem("stellarpay_announcement_dismissed") === "true";
    setAnnouncementDismissed(dismissed);
  }, []);

  // Fetch AED -> INR rate & saved recipients
  const fetchRatesAndRecipients = useCallback(async () => {
    try {
      const ratesRes = await fetch("/api/exchange-rate");
      if (ratesRes.ok) {
        const ratesData = await ratesRes.json();
        if (ratesData.rates) {
          setAedToInr(ratesData.rates.aedToInrWithSpread);
          setUsdToInr(ratesData.rates.usdToInrWithSpread);
        }
      }

      if (username) {
        const recRes = await fetch(`/api/recipients?username=${encodeURIComponent(username)}`);
        if (recRes.ok) {
          const recData = await recRes.json();
          setRecipients(recData.recipients || []);
        }
      }
    } catch (e) {
      console.warn("Failed to load dashboard metrics:", e);
    }
  }, [username]);

  useEffect(() => {
    if (connected) {
      fetchRatesAndRecipients();
    }
  }, [connected, fetchRatesAndRecipients, refreshKey]);

  const handleDismissAnnouncement = () => {
    setAnnouncementDismissed(true);
    localStorage.setItem("stellarpay_announcement_dismissed", "true");
  };

  const handleSelectContact = useCallback((contact: Contact) => {
    setPrefillAddress(contact.address);
    setPrefillName(contact.name);
    setShowPayModal(true);
  }, []);

  const handleSelectRecipient = (recip: Recipient) => {
    setPrefillRecipName(recip.name);
    setPrefillUpi(recip.upi_id);
    setShowSendMoneyModal(true);
  };

  const handleSendOpen = useCallback(() => {
    setPrefillAddress("");
    setPrefillName("");
    setShowPayModal(true);
  }, []);

  const handleContactAdded = useCallback(() => {
    setContactsKey((prev) => prev + 1);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshBalances();
      await fetchRatesAndRecipients();
      setRefreshKey((prev) => prev + 1);
      setContactsKey((prev) => prev + 1);
    } catch (err) {
      console.error("Failed to refresh:", err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 800);
    }
  }, [refreshBalances, fetchRatesAndRecipients]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const getInitials = (nameOrAddr: string) => {
    const clean = nameOrAddr.replace("@", "");
    return clean.slice(0, 2).toUpperCase();
  };

  if (!connected) {
    return <Onboarding />;
  }

  return (
    <div className="flex min-h-screen bg-bg-primary xl:grid xl:grid-cols-[280px_1fr]">
      <Sidebar 
        onOpenProfile={() => setShowProfileDrawer(true)} 
        activeTab={activeTab}
        onChangeTab={(tab) => {
          if (tab === "settings") {
            setShowProfileDrawer(true);
          } else {
            setActiveTab(tab as any);
          }
        }}
      />

      <main className="flex-1 p-6 pb-24 max-w-[760px] mx-auto w-full flex flex-col gap-6 bg-bg-main xl:ml-0 xl:max-w-none xl:p-10 xl:h-screen xl:overflow-y-auto">
        {/* Top Header */}
        <header className="flex justify-between items-center w-full pb-4 border-b border-border-theme">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 py-0.5 px-2 bg-warning/10 border border-warning/15 rounded-full text-[9px] font-bold text-warning">
                <div className="w-1 h-1 rounded-full bg-warning animate-pulse" />
                <span>Testnet</span>
              </div>
            </div>

          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="w-10 h-10 rounded-full bg-white border border-border-theme text-text-primary flex items-center justify-center cursor-pointer transition-all duration-300 hover:bg-bg-card-hover hover:text-text-primary relative shadow-sm"
              title="Refresh Data"
              disabled={isRefreshing}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className={isRefreshing ? "animate-spin" : ""}
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            </button>
            <button
              onClick={toggleFullscreen}
              className="hidden md:flex w-10 h-10 rounded-full bg-white border border-border-theme text-text-primary items-center justify-center cursor-pointer transition-all duration-300 hover:bg-bg-card-hover hover:text-text-primary relative shadow-sm"
              title="Toggle Fullscreen"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            </button>
            <button
              className="w-10 h-10 rounded-full bg-white border border-border-theme text-text-primary flex items-center justify-center cursor-pointer transition-all duration-300 hover:bg-bg-card-hover hover:text-text-primary relative shadow-sm"
              title="Notifications"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9m-9.73 13a3 3 0 0 0 5.46 0" />
              </svg>
              <div className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-error border-2 border-white" />
            </button>
            <div
              className="w-10 h-10 rounded-full bg-accent-purple flex items-center justify-center text-xs font-bold text-white cursor-pointer overflow-hidden border border-white/10 hover:opacity-90 transition-opacity shadow-sm"
              title="Profile Settings"
              onClick={() => setShowProfileDrawer(true)}
            >
              {profileImage ? (
                <img className="w-full h-full object-cover" src={profileImage} alt="Profile avatar" />
              ) : (
                <span className="font-bold tracking-wider">{getInitials(username || address || "AB")}</span>
              )}
            </div>
          </div>
        </header>

        {/* Home view */}
        {activeTab === "home" && (
          <>
            <BalanceCard />

            {/* CONTACTS Section */}
            <div className="bg-white border border-[#164A3A]/8 rounded-[20px] sm:rounded-[24px] p-4 sm:p-5 flex flex-col gap-3.5 sm:gap-4 shadow-[0_8px_30px_rgba(22,74,58,0.02)] w-full">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-[#164A3A] uppercase tracking-wider">
                  Contacts
                </span>
              </div>
 
              <div className="grid grid-cols-4 gap-y-5 gap-x-2 w-full justify-items-center">
                {/* New Contact Circle */}
                <button
                  type="button"
                  onClick={() => {
                    setPrefillRecipName("");
                    setPrefillUpi("");
                    setShowSendMoneyModal(true);
                  }}
                  className="flex flex-col items-center gap-2 bg-transparent border-0 cursor-pointer group"
                >
                  <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-emerald-600/5 text-emerald-600 border border-emerald-600/10 hover:bg-emerald-600/10 transition-all duration-300 flex items-center justify-center shadow-sm">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="8.5" cy="7" r="4" />
                      <line x1="20" y1="8" x2="20" y2="14" />
                      <line x1="17" y1="11" x2="23" y2="11" />
                    </svg>
                  </div>
                  <div className="flex flex-col items-center text-center leading-tight">
                    <span className="text-[10px] font-bold text-text-primary group-hover:text-[#164A3A] transition-colors">New</span>
                    <span className="text-[10px] font-bold text-text-primary group-hover:text-[#164A3A] transition-colors">Contact</span>
                  </div>
                </button>
 
                {/* Contacts List */}
                {recipients.length === 0 ? (
                  <div className="col-span-3 flex items-center justify-center text-text-muted text-[10px] font-medium h-12">
                    No saved contacts yet
                  </div>
                ) : (
                  (isViewAllContacts ? recipients : recipients.slice(0, 7)).map((contact) => {
                    const colors = ["#164A3A", "#8b5cf6", "#3b82f6", "#ec4899", "#f59e0b"];
                    // Generate color key based on recipient id string
                    const colorIndex = contact.id ? contact.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
                    const avatarColor = colors[colorIndex % colors.length];
                    const displayPhone = contact.upi_id;
                    const displayName = contact.nickname || contact.name;
 
                    return (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => handleSelectRecipient(contact)}
                        className="flex flex-col items-center gap-2 bg-transparent border-0 cursor-pointer group w-full"
                      >
                        <div 
                          className="w-12 h-12 sm:w-13 sm:h-13 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
                          style={{
                            background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor}cc)`,
                          }}
                        >
                          {getInitials(contact.name)}
                        </div>
                        <div className="flex flex-col items-center text-center w-full max-w-[68px] leading-tight">
                          <span className="text-[10px] font-bold text-text-primary group-hover:text-[#164A3A] transition-colors truncate w-full">
                            {displayName}
                          </span>
                          <span className="text-[8px] text-text-muted truncate w-full">
                            {displayPhone.includes("@") ? displayPhone.split("@")[0] : displayPhone}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
 
              {/* View all contacts bottom centered link */}
              {recipients.length > 7 && (
                <div className="flex justify-center mt-1 pt-3 border-t border-border-theme/40">
                  <button
                    type="button"
                    onClick={() => setIsViewAllContacts(!isViewAllContacts)}
                    className="text-[11px] font-extrabold text-[#164A3A] hover:text-[#164A3A]/80 transition-colors bg-transparent border-0 cursor-pointer flex items-center gap-1 py-1 px-3 rounded-lg hover:bg-bg-hover"
                  >
                    <span>{isViewAllContacts ? "Show less" : "View all contacts"}</span>
                    <svg 
                      width="10" 
                      height="10" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="3"
                      className={`transition-transform duration-300 ${isViewAllContacts ? "rotate-180" : ""}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Primary CTA: Send Money Home Card */}
            <div className="bg-white border border-[#164A3A]/8 rounded-[28px] overflow-hidden shadow-[0_8px_30px_rgba(22,74,58,0.02)] group hover:shadow-md transition-all duration-300 flex flex-col relative">
              <div className="p-6 md:p-8 flex justify-between relative min-h-[230px]">
                {/* Left Content */}
                <div className="relative z-10 flex flex-col gap-3.5 max-w-[62%] sm:max-w-[60%]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">🇮🇳</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#4E6B4A]">
                      OUTWARD REMITTANCE CORRIDOR
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[#164A3A]">
                      Send Money Home to <span className="text-[#164A3A]">India</span>
                    </h2>
                    <p className="text-xs text-[#4E6B4A] leading-relaxed font-medium">
                      Instant bank transfers using UPI. Send USDC from your wallet; our Anchor instantly converts it into INR and credits the recipient's bank account with zero platform fees.
                    </p>
                  </div>
                  <div className="mt-2.5">
                    <button
                      onClick={() => {
                        setPrefillRecipName("");
                        setPrefillUpi("");
                        setShowSendMoneyModal(true);
                      }}
                      className="py-3 px-6 text-xs font-bold bg-[#164A3A] text-white rounded-full cursor-pointer hover:bg-[#164A3A]/90 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 transition-all duration-300 flex items-center gap-2 shadow-sm"
                    >
                      <span>Send Money Home Now</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="rotate-45">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Right Background: Aeroplane Globe Transfer SVG */}
                <div className="absolute inset-y-0 right-0 w-[55%] sm:w-[48%] pointer-events-none select-none z-0 flex items-center justify-end pr-2 sm:pr-4">
                  <svg
                    className="w-full h-full max-h-[190px] object-contain opacity-80"
                    viewBox="0 0 240 180"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Globe Outline */}
                    <circle cx="120" cy="110" r="65" stroke="#164A3A" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.12" fill="none" />
                    <path d="M55 110 h130" stroke="#164A3A" strokeWidth="1" opacity="0.08" />
                    <path d="M120 45 v130" stroke="#164A3A" strokeWidth="1" opacity="0.08" />
                    <path d="M65 85 Q120 120 175 85" stroke="#164A3A" strokeWidth="1" strokeDasharray="2 2" opacity="0.08" fill="none" />
                    <path d="M65 135 Q120 100 175 135" stroke="#164A3A" strokeWidth="1" strokeDasharray="2 2" opacity="0.08" fill="none" />

                    {/* Gulf Side (UAE) */}
                    <g opacity="0.9">
                      <path d="M45 130 h10 v-25 h-2 v-8 h-2 v8 h-2 v25 Z" fill="#164A3A" opacity="0.15" />
                      <path d="M38 130 h6 v-15 h-6 z" fill="#164A3A" opacity="0.1" />
                      <path d="M56 130 h8 v-18 h-8 z" fill="#164A3A" opacity="0.1" />
                      <text x="35" y="142" fill="#4E6B4A" fontSize="6.5" fontWeight="bold" opacity="0.6">UAE (GULF)</text>
                    </g>

                    {/* India Side (Taj Mahal Domes) */}
                    <g opacity="0.9">
                      <path d="M178 130 h24 v-12 h-2 v-4 h-2 v-6 c0-4 2-5 4-5 s4 1 4 5 v6 h-2 v4 h-2 v12 Z" fill="#164A3A" opacity="0.15" />
                      <rect x="173" y="112" width="2" height="18" fill="#164A3A" opacity="0.2" />
                      <rect x="205" y="112" width="2" height="18" fill="#164A3A" opacity="0.2" />
                      <text x="175" y="142" fill="#4E6B4A" fontSize="6.5" fontWeight="bold" opacity="0.6">INDIA (INR)</text>
                    </g>

                    {/* Flight Path (Gulf -> India) */}
                    <path d="M 50 105 Q 110 32 190 105" fill="none" stroke="#C9A34E" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" opacity="0.75" />

                    {/* Dotted Flight Trail (Glow) */}
                    <path d="M 50 105 Q 110 32 190 105" fill="none" stroke="#C9A34E" strokeWidth="4" opacity="0.1" />

                    {/* Coins / Floating Money Symbols */}
                    <g transform="translate(82, 65)">
                      <circle cx="0" cy="0" r="5.5" fill="#C9A34E" opacity="0.9" />
                      <text x="-2.5" y="2.2" fill="#FFFFFF" fontSize="7.5" fontWeight="bold" fontFamily="sans-serif">$</text>
                    </g>
                    <g transform="translate(148, 65)">
                      <circle cx="0" cy="0" r="5.5" fill="#C9A34E" opacity="0.9" />
                      <text x="-2.8" y="2.2" fill="#FFFFFF" fontSize="6.5" fontWeight="bold" fontFamily="sans-serif">₹</text>
                    </g>

                    {/* Airplane */}
                    <g transform="translate(110, 48) rotate(16)">
                      <path d="M0 4 L11 -1 L6 11 L4 6 Z" fill="#164A3A" />
                      <path d="M0 4 L4 6 L11 -1 Z" fill="#C9A34E" />
                    </g>
                    
                    {/* Micro Sparkles */}
                    <path d="M 98,42 L 100,38 L 102,42 L 100,46 Z" fill="#C9A34E" opacity="0.6" />
                    <path d="M 132,44 L 134,40 L 136,44 L 134,48 Z" fill="#C9A34E" opacity="0.6" />
                  </svg>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-[#164A3A]/8 w-full" />

              {/* Bottom Features Section */}
              <div className="bg-[#FAF8F4] px-3 sm:px-6 py-3.5 grid grid-cols-3 gap-1 sm:gap-4 justify-items-center w-full">
                <div className="flex items-center gap-1.5 sm:gap-2 justify-center w-full">
                  <div className="w-7 h-7 sm:w-8 h-8 rounded-full bg-white border border-[#164A3A]/5 flex items-center justify-center text-xs flex-shrink-0 shadow-[0_2px_6px_rgba(22,74,58,0.02)]">
                    ⚡
                  </div>
                  <span className="text-[9px] sm:text-xs font-bold text-[#164A3A] whitespace-nowrap">
                    Instant Settlement
                  </span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 justify-center w-full">
                  <div className="w-7 h-7 sm:w-8 h-8 rounded-full bg-white border border-[#164A3A]/5 flex items-center justify-center text-xs flex-shrink-0 shadow-[0_2px_6px_rgba(22,74,58,0.02)]">
                    🛡️
                  </div>
                  <span className="text-[9px] sm:text-xs font-bold text-[#164A3A] whitespace-nowrap">
                    Secure & Reliable
                  </span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 justify-center w-full">
                  <div className="w-7 h-7 sm:w-8 h-8 rounded-full bg-white border border-[#164A3A]/5 flex items-center justify-center text-xs flex-shrink-0 shadow-[0_2px_6px_rgba(22,74,58,0.02)]">
                    💰
                  </div>
                  <span className="text-[9px] sm:text-xs font-bold text-[#164A3A] whitespace-nowrap">
                    Zero Platform Fees
                  </span>
                </div>
              </div>
            </div>

            {/* Live Remittances List */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                Live UPI Remittances
              </span>
              <RemittanceList refreshTrigger={refreshKey} />
            </div>

            {/* Announcement Banner */}
            {!announcementDismissed && (
              <div className="bg-bg-card border border-border-theme rounded-2xl p-4 flex justify-between items-center shadow-md animate-[fadeIn_0.3s_ease]">
                <div className="flex items-center gap-3 text-sm text-text-secondary">
                  <div className="w-8 h-8 rounded-lg bg-accent-purple/10 text-accent-purple flex items-center justify-center flex-shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                      <line x1="12" y1="22" x2="12" y2="15.5" />
                      <polyline points="22 8.5 12 15.5 2 8.5" />
                      <polyline points="2 15.5 12 8.5 22 15.5" />
                      <line x1="12" y1="2" x2="12" y2="8.5" />
                    </svg>
                  </div>
                  <span>Outward remittance channels are now live to India (INR).</span>
                </div>
                <button
                  onClick={handleDismissAnnouncement}
                  className="bg-transparent border-0 text-text-muted cursor-pointer p-1.5 flex items-center justify-center rounded-full hover:bg-white/5 transition-all duration-300"
                  title="Dismiss announcement"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}

        {/* Activity view */}
        {activeTab === "activity" && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                Live UPI Remittances
              </span>
              <RemittanceList refreshTrigger={refreshKey} />
            </div>

            <div className="h-px bg-border-theme my-2" />

            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                Wallet-to-Wallet History
              </span>
              <TransactionList key={refreshKey} />
            </div>
          </div>
        )}

        {/* Wallet view */}
        {activeTab === "wallet" && (
          <>
            <BalanceCard />

            <div className="flex flex-col gap-3 mt-2">
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                Stellar Wallet Operations
              </span>
              <ActionButtons
                onReceive={() => setShowReceiveModal(true)}
                onSend={handleSendOpen}
                onDeposit={() => setShowDepositModal(true)}
                onWithdraw={() => setShowWithdrawModal(true)}
              />
            </div>

            <div className="h-px bg-border-theme my-2" />

            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                Wallet-to-Wallet History
              </span>
              <TransactionList key={refreshKey} />
            </div>
          </>
        )}

        {/* Settings view */}
        {activeTab === "settings" && (
          <div className="flex flex-col gap-6 bg-white border border-border-theme rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-4 pb-4 border-b border-border-theme">
              <div className="w-16 h-16 rounded-full bg-[#113C2F]/10 text-[#113C2F] flex items-center justify-center text-xl font-bold">
                {profileImage ? (
                  <img className="w-full h-full object-cover rounded-full" src={profileImage} alt="Profile avatar" />
                ) : (
                  getInitials(username || address || "AB")
                )}
              </div>
              <div className="flex flex-col">
                <h3 className="text-lg font-bold text-text-primary">{username ? `@${username}` : "Account 1"}</h3>
                <span className="text-xs text-text-muted font-mono break-all">{address}</span>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <button 
                onClick={() => setShowProfileDrawer(true)}
                className="w-full py-3 px-4 rounded-xl border border-border-theme bg-bg-secondary hover:bg-bg-hover text-text-primary font-semibold text-sm cursor-pointer flex items-center justify-between transition-colors duration-200"
              >
                <span>Edit Profile Picture</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>

              <button 
                onClick={() => {
                  navigator.clipboard.writeText(address || "");
                  alert("Address copied to clipboard!");
                }}
                className="w-full py-3 px-4 rounded-xl border border-border-theme bg-bg-secondary hover:bg-bg-hover text-text-primary font-semibold text-sm cursor-pointer flex items-center justify-between transition-colors duration-200"
              >
                <span>Copy Wallet Address</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>

              <button 
                onClick={() => {
                  disconnectWallet();
                }}
                className="w-full py-3 px-4 rounded-xl border border-red-200 bg-red-50/50 hover:bg-red-50 text-red-600 font-semibold text-sm cursor-pointer flex items-center justify-between transition-colors duration-200"
              >
                <span>Disconnect Wallet</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </main>

      <BottomNav 
        activeTab={activeTab}
        onChangeTab={(tab) => {
          if (tab === "settings") {
            setShowProfileDrawer(true);
            setActiveTab("settings");
          } else {
            setActiveTab(tab as any);
          }
        }}
        onSendClick={handleSendOpen}
      />

      {/* Modals */}
      <ReceiveModal
        isOpen={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
      />
      <PayModal
        isOpen={showPayModal}
        onClose={() => setShowPayModal(false)}
        prefillAddress={prefillAddress}
        prefillName={prefillName}
      />
      <DepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
      />
      <TransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
      />
      <WithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
      />
      <AddContactModal
        isOpen={showAddContactModal}
        onClose={() => setShowAddContactModal(false)}
        onAdded={handleContactAdded}
      />
      <ProfileDrawer
        isOpen={showProfileDrawer}
        onClose={() => setShowProfileDrawer(false)}
        onImageUpdated={() => setAvatarRefreshKey((prev) => prev + 1)}
      />
      <SendMoneyModal
        isOpen={showSendMoneyModal}
        onClose={() => setShowSendMoneyModal(false)}
        onSuccess={() => setRefreshKey((prev) => prev + 1)}
        {...(prefillRecipName ? { recipientName: prefillRecipName } : {})}
        {...(prefillUpi ? { recipientUpi: prefillUpi } : {})}
      />
    </div>
  );
}
