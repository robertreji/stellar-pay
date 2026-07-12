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
import { useWallet } from "@/context/WalletContext";
import { Contact } from "@/lib/contacts";

export default function Home() {
  const { connected, address, username, refreshBalances } = useWallet();
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [prefillAddress, setPrefillAddress] = useState("");
  const [prefillName, setPrefillName] = useState("");
  const [contactsKey, setContactsKey] = useState(0);
  const [announcementDismissed, setAnnouncementDismissed] = useState(true);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(0);

  // Sync profile photo for the header avatar
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

  // Load announcement dismissed state on client mount
  useEffect(() => {
    const dismissed = localStorage.getItem("stellarpay_announcement_dismissed") === "true";
    setAnnouncementDismissed(dismissed);
  }, []);

  const handleDismissAnnouncement = () => {
    setAnnouncementDismissed(true);
    localStorage.setItem("stellarpay_announcement_dismissed", "true");
  };

  const handleSelectContact = useCallback((contact: Contact) => {
    setPrefillAddress(contact.address);
    setPrefillName(contact.name);
    setShowPayModal(true);
  }, []);

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
      setRefreshKey((prev) => prev + 1);
      setContactsKey((prev) => prev + 1);
    } catch (err) {
      console.error("Failed to refresh:", err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 800);
    }
  }, [refreshBalances]);

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
    <div className="flex min-h-screen bg-bg-primary xl:grid xl:grid-cols-[280px_1fr_340px]">
      <Sidebar onOpenProfile={() => setShowProfileDrawer(true)} />

      <main className="flex-1 p-6 pb-24 max-w-[760px] mx-auto w-full flex flex-col gap-6 bg-bg-main xl:ml-0 xl:max-w-none xl:p-10 xl:h-screen xl:overflow-hidden">
        {/* Top Header */}
        <header className="flex justify-between items-center w-full pb-3 border-b border-border-theme">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-text-muted uppercase tracking-wider font-semibold">Welcome back,</span>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-text-primary flex items-center gap-1 cursor-pointer">
                {username ? `@${username}` : "Account 1"}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </h2>
              <div className="flex items-center gap-1.5 py-0.5 px-2 bg-warning/8 border border-warning/15 rounded-full text-[10px] font-semibold text-warning">
                <div className="w-1.5 h-1.5 rounded-full bg-warning shadow-[0_0_6px_var(--color-warning)]" />
                <span>Testnet</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="w-9 h-9 rounded-full bg-bg-card border border-border-theme text-text-secondary flex items-center justify-center cursor-pointer transition-all duration-300 hover:bg-bg-card-hover hover:text-text-primary relative"
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
              className="hidden md:flex w-9 h-9 rounded-full bg-bg-card border border-border-theme text-text-secondary items-center justify-center cursor-pointer transition-all duration-300 hover:bg-bg-card-hover hover:text-text-primary relative"
              title="Toggle Fullscreen"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            </button>
            <button
              className="hidden md:flex w-9 h-9 rounded-full bg-bg-card border border-border-theme text-text-secondary items-center justify-center cursor-pointer transition-all duration-300 hover:bg-bg-card-hover hover:text-text-primary relative"
              title="Notifications"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9m-9.73 13a3 3 0 0 0 5.46 0" />
              </svg>
              <div className="absolute top-2 right-2.5 w-1.5 h-1.5 rounded-full bg-accent-purple" />
            </button>
            <div
              className="w-8 h-8 rounded-full bg-accent-purple flex items-center justify-center text-xs font-bold text-white cursor-pointer overflow-hidden border border-white/10 hover:opacity-90 transition-opacity"
              title="Profile Settings"
              onClick={() => setShowProfileDrawer(true)}
            >
              {profileImage ? (
                <img className="w-full h-full object-cover" src={profileImage} alt="Profile avatar" />
              ) : (
                getInitials(username || address || "A1")
              )}
            </div>
          </div>
        </header>

        {/* Balance Card */}
        <BalanceCard />

        {/* Quick Actions */}
        <ActionButtons
          onReceive={() => setShowReceiveModal(true)}
          onSend={handleSendOpen}
          onDeposit={() => setShowDepositModal(true)}
          onWithdraw={() => setShowWithdrawModal(true)}
        />

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
              <span>Get real-time updates on your crypto, NFTs, and more.</span>
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

        {/* Recent Transactions List */}
        <TransactionList key={refreshKey} />
      </main>

      {/* Right Contacts Sidebar */}
      <ContactsSidebar
        onSelectContact={handleSelectContact}
        onAddContact={() => setShowAddContactModal(true)}
        refreshTrigger={contactsKey}
      />

      <BottomNav />

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
    </div>
  );
}
