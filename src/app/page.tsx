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
    <div className="app-layout">
      <Sidebar onOpenProfile={() => setShowProfileDrawer(true)} />

      <main className="main-content">
        {/* Top Header */}
        <header className="top-header">
          <div className="top-header-left">
            <span className="top-header-welcome">Welcome back,</span>
            <div className="top-header-account-group">
              <h2 className="top-header-account-name">
                {username ? `@${username}` : "Account 1"}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </h2>
              <div className="top-header-badge">
                <div className="badge-dot" />
                <span>Testnet</span>
              </div>
            </div>
          </div>

          <div className="top-header-right">
            <button
              onClick={handleRefresh}
              className="top-header-icon-btn"
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
                className={isRefreshing ? "spin-icon" : ""}
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            </button>
            <button
              onClick={toggleFullscreen}
              className="top-header-icon-btn"
              title="Toggle Fullscreen"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            </button>
            <button
              className="top-header-icon-btn"
              title="Notifications"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9m-9.73 13a3 3 0 0 0 5.46 0" />
              </svg>
              <div className="top-header-notification-dot" />
            </button>
            <div
              className="top-header-avatar"
              title="Profile Settings"
              onClick={() => setShowProfileDrawer(true)}
            >
              {profileImage ? (
                <img src={profileImage} alt="Profile avatar" />
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
          <div className="announcement-card">
            <div className="announcement-content">
              <div className="announcement-icon-wrapper">
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
              className="announcement-close-btn"
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
