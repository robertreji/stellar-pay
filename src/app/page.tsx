"use client";

import { useState, useCallback } from "react";
import ConnectWallet from "@/components/ConnectWallet";
import BalanceCard from "@/components/BalanceCard";
import ActionButtons from "@/components/ActionButtons";
import QuickSend from "@/components/QuickSend";
import TransactionList from "@/components/TransactionList";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import PayModal from "@/components/PayModal";
import DepositModal from "@/components/DepositModal";
import TransferModal from "@/components/TransferModal";
import AddContactModal from "@/components/AddContactModal";
import WithdrawModal from "@/components/WithdrawModal";
import Onboarding from "@/components/Onboarding";
import { useWallet } from "@/context/WalletContext";
import { Contact } from "@/lib/contacts";

export default function Home() {
  const { connected } = useWallet();
  const [showPayModal, setShowPayModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [prefillAddress, setPrefillAddress] = useState("");
  const [prefillName, setPrefillName] = useState("");
  const [contactsKey, setContactsKey] = useState(0);

  const handleSelectContact = useCallback((contact: Contact) => {
    setPrefillAddress(contact.address);
    setPrefillName(contact.name);
    setShowPayModal(true);
  }, []);

  const handlePayOpen = useCallback(() => {
    setPrefillAddress("");
    setPrefillName("");
    setShowPayModal(true);
  }, []);

  const handleContactAdded = useCallback(() => {
    setContactsKey((prev) => prev + 1);
  }, []);

  if (!connected) {
    return <Onboarding />;
  }

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <div className="page-header">
          <div className="page-header-title">
            <h1>Your Wallet</h1>
            <div className="header-badge">
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#22c55e",
                  boxShadow: "0 0 6px #22c55e",
                }}
              />
              Testnet
            </div>
          </div>
          <div className="header-actions">
            <button className="header-icon-btn" title="Refresh">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="23,4 23,10 17,10" />
                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>
        </div>

        <ConnectWallet />
        <BalanceCard />
        <ActionButtons
          onPay={handlePayOpen}
          onDeposit={() => setShowDepositModal(true)}
          onTransfer={() => setShowTransferModal(true)}
          onWithdraw={() => setShowWithdrawModal(true)}
        />
        <QuickSend
          key={contactsKey}
          onSelectContact={handleSelectContact}
          onAddNew={() => setShowAddContactModal(true)}
        />
        <TransactionList />
      </main>

      <BottomNav />

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
    </div>
  );
}
