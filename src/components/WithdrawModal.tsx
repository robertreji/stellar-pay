"use client";

import { useState, useEffect, useRef } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import { useWallet } from "@/context/WalletContext";
import {
  initiateWithdraw,
  getAnchorTransaction,
  authenticateWithAnchor,
  AnchorTransaction,
} from "@/lib/moneygram";
import { buildPaymentTx, submitClassicTransaction } from "@/lib/transactions";
import { config, getExplorerTxUrl } from "@/lib/stellar";

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type WithdrawStep =
  | "idle"
  | "initializing"
  | "interactive"
  | "paying"
  | "success"
  | "error";

type PayoutMethod = "upi" | "bank";

interface BankDetails {
  accountHolder: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  bankName: string;
}

export default function WithdrawModal({ isOpen, onClose }: WithdrawModalProps) {
  const { address, secretKey, refreshBalances, usdcIssuer } = useWallet();
  const [step, setStep] = useState<WithdrawStep>("idle");
  const [amount, setAmount] = useState("10");
  const [interactiveUrl, setInteractiveUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [withdrawDetails, setWithdrawDetails] =
    useState<AnchorTransaction | null>(null);
  const [paymentHash, setPaymentHash] = useState("");
  const [bankUrl, setBankUrl] = useState("https://bank-sim-six.vercel.app");

  // Payout method state
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("upi");
  const [upiId, setUpiId] = useState("");
  const [bankDetails, setBankDetails] = useState<BankDetails>({
    accountHolder: "",
    accountNumber: "",
    confirmAccountNumber: "",
    ifscCode: "",
    bankName: "",
  });

  const pollerRef = useRef<NodeJS.Timeout | null>(null);
  const tokenRef = useRef<string>("");

  useEffect(() => {
    if (isOpen && address && secretKey) {
      setStep("idle");
    }
    return () => {
      stopPolling();
    };
  }, [isOpen, address, secretKey]);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/config");
        if (res.ok) {
          const data = await res.json();
          if (data.bankUrl) {
            setBankUrl(data.bankUrl);
          }
        }
      } catch (err) {
        console.warn("Failed to load config details:", err);
      }
    }
    loadConfig();
  }, []);

  const isFormValid = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return false;

    if (payoutMethod === "upi") {
      // Basic UPI format: something@something
      return /^[\w.\-]+@[\w.\-]+$/.test(upiId.trim());
    } else {
      return (
        bankDetails.accountHolder.trim().length > 0 &&
        bankDetails.accountNumber.trim().length >= 8 &&
        bankDetails.accountNumber === bankDetails.confirmAccountNumber &&
        /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(bankDetails.ifscCode.trim()) &&
        bankDetails.bankName.trim().length > 0
      );
    }
  };

  const startFlow = async () => {
    if (!address || !secretKey) return;
    setStep("initializing");
    setErrorMsg("");
    setInteractiveUrl("");
    setTransactionId("");
    setWithdrawDetails(null);
    setPaymentHash("");

    try {
      const token = await authenticateWithAnchor(address, secretKey);
      tokenRef.current = token;

      // 1. Get interactive transaction session from anchor
      const res = await initiateWithdraw(address, secretKey, "USDC", amount);
      setInteractiveUrl(res.url);
      setTransactionId(res.id);
      setStep("interactive");

      // 2. Automate bank interactive flow authorization in the background
      const targetBankAccountId = payoutMethod === "upi"
        ? (upiId.trim().includes("@") ? upiId.trim().split("@")[0].toLowerCase() : upiId.trim().toLowerCase())
        : bankDetails.accountNumber.trim();

      const bankSettleRes = await fetch(`${bankUrl}/api/bank/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: res.id,
          accountId: targetBankAccountId,
          amount: amount,
          kind: "withdrawal",
        }),
      });

      if (!bankSettleRes.ok) {
        const errData = await bankSettleRes.json();
        throw new Error(errData.error || "Failed to authorize withdrawal with bank.");
      }

      // 3. Start polling for anchor transaction status (which will hit pending_user_transfer_start instantly!)
      startPolling(token, res.id);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to initialize withdrawal");
      setStep("error");
    }
  };

  const startPolling = (token: string, txId: string) => {
    stopPolling();
    pollerRef.current = setInterval(async () => {
      try {
        const tx = await getAnchorTransaction(token, txId);
        console.log("Anchor transaction status:", tx.status, tx);

        if (tx.status === "pending_user_transfer_start") {
          stopPolling();
          setWithdrawDetails(tx);
          executeOnChainPayment(tx);
        } else if (tx.status === "completed") {
          stopPolling();
          setStep("success");
        } else if (tx.status === "error" || tx.status === "no_market") {
          stopPolling();
          setErrorMsg("Anchor reported an error during interaction.");
          setStep("error");
        }
      } catch (err) {
        console.warn("Polling error:", err);
      }
    }, 3000);
  };

  const stopPolling = () => {
    if (pollerRef.current) {
      clearInterval(pollerRef.current);
      pollerRef.current = null;
    }
  };

  const executeOnChainPayment = async (details: AnchorTransaction) => {
    if (!address || !secretKey) return;
    setStep("paying");
    try {
      const rawAmount = details.amount_in;
      const amount = typeof rawAmount === "object" ? rawAmount?.amount : rawAmount;
      const destination = details.destination_account || details.withdraw_anchor_account;

      if (!destination) {
        throw new Error(
          "Anchor did not provide a destination account for withdrawal."
        );
      }

      const account = await fetch(
        `${config.horizonUrl}/accounts/${address}`
      ).then((res) => res.json());

      const asset = new StellarSdk.Asset("USDC", usdcIssuer || undefined);

      const memoType = details.memo_type || details.withdraw_memo_type;
      const memoValue = details.memo || details.withdraw_memo;

      let memoObj;
      if (memoType && memoValue) {
        if (memoType === "id") {
          memoObj = StellarSdk.Memo.id(memoValue);
        } else if (memoType === "text") {
          memoObj = StellarSdk.Memo.text(memoValue);
        } else if (memoType === "hash") {
          memoObj = StellarSdk.Memo.hash(memoValue);
        }
      }

      const txBuilder = new StellarSdk.TransactionBuilder(
        new StellarSdk.Account(address, account.sequence),
        {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: config.networkPassphrase,
        }
      )
        .addOperation(
          StellarSdk.Operation.payment({
            destination: destination,
            asset: asset,
            amount: amount,
          })
        )
        .setTimeout(180);

      if (memoObj) {
        txBuilder.addMemo(memoObj);
      }

      const tx = txBuilder.build();
      tx.sign(StellarSdk.Keypair.fromSecret(secretKey));

      const signedXdr = tx.toXDR();

      const result = await submitClassicTransaction(signedXdr);
      setPaymentHash(result.hash);

      // Notify Anchor Platform of on-chain payment so status updates from pending_user_transfer_start -> pending_anchor
      try {
        await fetch(`${bankUrl}/api/bank/notify-onchain`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactionId: details.id,
            stellarTxHash: result.hash,
          }),
        });
      } catch (notifyErr) {
        console.warn("Failed to notify anchor of on-chain payment:", notifyErr);
      }

      setStep("success");
      await refreshBalances();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "USDC payment submission failed");
      setStep("error");
    }
  };

  const handleClose = () => {
    stopPolling();
    setStep("idle");
    onClose();
  };

  const getPayoutSummary = () => {
    if (payoutMethod === "upi") {
      return upiId.trim();
    }
    return `${bankDetails.bankName} •••• ${bankDetails.accountNumber.slice(-4)}`;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-[#132e22]/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-6 animate-[fadeIn_0.2s_ease]"
      onClick={handleClose}
    >
      <div
        className="bg-white border border-border-theme rounded-3xl w-full max-w-[500px] shadow-2xl flex flex-col overflow-hidden animate-[slideUp_0.3s_ease]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#113C2F]/10 text-[#113C2F] flex items-center justify-center shrink-0">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5,12 12,5 19,12" />
              </svg>
            </div>
            <div className="flex flex-col">
              <h2 className="text-xl font-extrabold text-[#113C2F] leading-tight">
                Withdraw to Bank
              </h2>
              <span className="text-[11px] text-text-muted">
                Send USDC to your bank account via Anchor
              </span>
            </div>
          </div>
          <button
            className="bg-[#f4f2ea] border-0 text-text-muted cursor-pointer w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#113C2F]/5 hover:text-text-primary transition-all duration-200 shrink-0"
            onClick={handleClose}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {step === "idle" && (
            <div className="flex flex-col gap-5">
              {/* Amount input */}
              <div className="w-full text-left">
                <label className="block mb-2 text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                  Withdrawal Amount (USDC)
                </label>
                <div className="relative flex items-center w-full bg-bg-secondary border border-border-theme focus-within:border-[#113C2F] focus-within:ring-4 focus-within:ring-[#113C2F]/10 rounded-2xl py-2 pl-3 pr-12 transition-all duration-300">
                  <div className="bg-[#f4f2ea] text-text-primary text-[10px] font-extrabold px-3 py-2 rounded-xl select-none mr-3 border border-border-theme">
                    USDC
                  </div>
                  <input
                    type="number"
                    className="w-full bg-transparent border-0 py-2.5 text-base font-extrabold outline-none text-text-primary"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    style={{ fontSize: "16px" }}
                  />
                  <div className="absolute right-4 text-text-muted flex items-center">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Payout Method Tabs */}
              <div className="w-full">
                <label className="block mb-2 text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                  Payout Method
                </label>
                <div className="flex bg-[#f4f2ea] rounded-2xl p-1 gap-1">
                  <button
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold border-0 cursor-pointer transition-all duration-300 ${
                      payoutMethod === "upi"
                        ? "bg-white text-[#113C2F] shadow-md shadow-[#113C2F]/5"
                        : "bg-transparent text-text-muted hover:text-text-secondary"
                    }`}
                    onClick={() => setPayoutMethod("upi")}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                    UPI ID
                  </button>
                  <button
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold border-0 cursor-pointer transition-all duration-300 ${
                      payoutMethod === "bank"
                        ? "bg-white text-[#113C2F] shadow-md shadow-[#113C2F]/5"
                        : "bg-transparent text-text-muted hover:text-text-secondary"
                    }`}
                    onClick={() => setPayoutMethod("bank")}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                    Bank Account
                  </button>
                </div>
              </div>

              {/* UPI Input */}
              {payoutMethod === "upi" && (
                <div className="w-full flex flex-col gap-3 animate-[fadeIn_0.2s_ease]">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                    UPI ID
                  </label>
                  <div className="relative flex items-center w-full bg-bg-secondary border border-border-theme focus-within:border-[#113C2F] focus-within:ring-4 focus-within:ring-[#113C2F]/10 rounded-2xl py-2 pl-3 pr-12 transition-all duration-300">
                    <div className="bg-[#113C2F]/5 text-[#113C2F] w-8 h-8 rounded-lg flex items-center justify-center mr-3 shrink-0">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      className="w-full bg-transparent border-0 py-2.5 text-sm font-semibold outline-none text-text-primary placeholder:text-text-muted/50"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="yourname@upi"
                    />
                  </div>
                  <div className="flex items-center gap-2 px-1">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-text-muted shrink-0"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span className="text-[10px] text-text-muted">
                      Enter UPI ID linked to your bank (e.g. name@okaxis,
                      phone@ybl)
                    </span>
                  </div>
                </div>
              )}

              {/* Bank Account Details */}
              {payoutMethod === "bank" && (
                <div className="w-full flex flex-col gap-3 animate-[fadeIn_0.2s_ease]">
                  {/* Account Holder Name */}
                  <div>
                    <label className="block mb-1.5 text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                      Account Holder Name
                    </label>
                    <div className="relative flex items-center w-full bg-bg-secondary border border-border-theme focus-within:border-[#113C2F] focus-within:ring-4 focus-within:ring-[#113C2F]/10 rounded-2xl py-2 pl-3 pr-4 transition-all duration-300">
                      <div className="bg-[#113C2F]/5 text-[#113C2F] w-8 h-8 rounded-lg flex items-center justify-center mr-3 shrink-0">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        className="w-full bg-transparent border-0 py-2 text-sm font-semibold outline-none text-text-primary placeholder:text-text-muted/50"
                        value={bankDetails.accountHolder}
                        onChange={(e) =>
                          setBankDetails({
                            ...bankDetails,
                            accountHolder: e.target.value,
                          })
                        }
                        placeholder="Full name as on bank account"
                      />
                    </div>
                  </div>

                  {/* Bank Name */}
                  <div>
                    <label className="block mb-1.5 text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                      Bank Name
                    </label>
                    <div className="relative flex items-center w-full bg-bg-secondary border border-border-theme focus-within:border-[#113C2F] focus-within:ring-4 focus-within:ring-[#113C2F]/10 rounded-2xl py-2 pl-3 pr-4 transition-all duration-300">
                      <div className="bg-[#113C2F]/5 text-[#113C2F] w-8 h-8 rounded-lg flex items-center justify-center mr-3 shrink-0">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M3 21h18" />
                          <path d="M3 10h18" />
                          <path d="M5 6l7-3 7 3" />
                          <line x1="4" y1="10" x2="4" y2="21" />
                          <line x1="20" y1="10" x2="20" y2="21" />
                          <line x1="8" y1="14" x2="8" y2="17" />
                          <line x1="12" y1="14" x2="12" y2="17" />
                          <line x1="16" y1="14" x2="16" y2="17" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        className="w-full bg-transparent border-0 py-2 text-sm font-semibold outline-none text-text-primary placeholder:text-text-muted/50"
                        value={bankDetails.bankName}
                        onChange={(e) =>
                          setBankDetails({
                            ...bankDetails,
                            bankName: e.target.value,
                          })
                        }
                        placeholder="e.g. State Bank of India"
                      />
                    </div>
                  </div>

                  {/* Account Number */}
                  <div>
                    <label className="block mb-1.5 text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                      Account Number
                    </label>
                    <div className="relative flex items-center w-full bg-bg-secondary border border-border-theme focus-within:border-[#113C2F] focus-within:ring-4 focus-within:ring-[#113C2F]/10 rounded-2xl py-2 pl-3 pr-4 transition-all duration-300">
                      <div className="bg-[#113C2F]/5 text-[#113C2F] w-8 h-8 rounded-lg flex items-center justify-center mr-3 shrink-0">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <rect x="2" y="5" width="20" height="14" rx="2" />
                          <line x1="2" y1="10" x2="22" y2="10" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        className="w-full bg-transparent border-0 py-2 text-sm font-semibold outline-none text-text-primary placeholder:text-text-muted/50"
                        value={bankDetails.accountNumber}
                        onChange={(e) =>
                          setBankDetails({
                            ...bankDetails,
                            accountNumber: e.target.value.replace(/\D/g, ""),
                          })
                        }
                        placeholder="Enter account number"
                        inputMode="numeric"
                      />
                    </div>
                  </div>

                  {/* Confirm Account Number */}
                  <div>
                    <label className="block mb-1.5 text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                      Confirm Account Number
                    </label>
                    <div
                      className={`relative flex items-center w-full bg-bg-secondary border rounded-2xl py-2 pl-3 pr-4 transition-all duration-300 ${
                        bankDetails.confirmAccountNumber.length > 0 &&
                        bankDetails.accountNumber !==
                          bankDetails.confirmAccountNumber
                          ? "border-red-400 focus-within:ring-4 focus-within:ring-red-400/10"
                          : "border-border-theme focus-within:border-[#113C2F] focus-within:ring-4 focus-within:ring-[#113C2F]/10"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 shrink-0 ${
                          bankDetails.confirmAccountNumber.length > 0 &&
                          bankDetails.accountNumber ===
                            bankDetails.confirmAccountNumber
                            ? "bg-green-500/10 text-green-600"
                            : "bg-[#113C2F]/5 text-[#113C2F]"
                        }`}
                      >
                        {bankDetails.confirmAccountNumber.length > 0 &&
                        bankDetails.accountNumber ===
                          bankDetails.confirmAccountNumber ? (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <rect
                              x="2"
                              y="5"
                              width="20"
                              height="14"
                              rx="2"
                            />
                            <line x1="2" y1="10" x2="22" y2="10" />
                          </svg>
                        )}
                      </div>
                      <input
                        type="text"
                        className="w-full bg-transparent border-0 py-2 text-sm font-semibold outline-none text-text-primary placeholder:text-text-muted/50"
                        value={bankDetails.confirmAccountNumber}
                        onChange={(e) =>
                          setBankDetails({
                            ...bankDetails,
                            confirmAccountNumber: e.target.value.replace(
                              /\D/g,
                              ""
                            ),
                          })
                        }
                        placeholder="Re-enter account number"
                        inputMode="numeric"
                      />
                    </div>
                    {bankDetails.confirmAccountNumber.length > 0 &&
                      bankDetails.accountNumber !==
                        bankDetails.confirmAccountNumber && (
                        <span className="text-[10px] text-red-500 font-semibold mt-1 ml-1">
                          Account numbers do not match
                        </span>
                      )}
                  </div>

                  {/* IFSC Code */}
                  <div>
                    <label className="block mb-1.5 text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                      IFSC Code
                    </label>
                    <div className="relative flex items-center w-full bg-bg-secondary border border-border-theme focus-within:border-[#113C2F] focus-within:ring-4 focus-within:ring-[#113C2F]/10 rounded-2xl py-2 pl-3 pr-4 transition-all duration-300">
                      <div className="bg-[#113C2F]/5 text-[#113C2F] w-8 h-8 rounded-lg flex items-center justify-center mr-3 shrink-0">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        className="w-full bg-transparent border-0 py-2 text-sm font-semibold outline-none text-text-primary placeholder:text-text-muted/50 uppercase"
                        value={bankDetails.ifscCode}
                        onChange={(e) =>
                          setBankDetails({
                            ...bankDetails,
                            ifscCode: e.target.value
                              .toUpperCase()
                              .replace(/[^A-Z0-9]/g, "")
                              .slice(0, 11),
                          })
                        }
                        placeholder="e.g. SBIN0001234"
                        maxLength={11}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Summary Card */}
              {parseFloat(amount) > 0 && isFormValid() && (
                <div className="w-full bg-[#fbfbfa] border border-[#113C2F]/10 rounded-2xl p-4 flex flex-col gap-3 text-xs animate-[fadeIn_0.2s_ease]">
                  <div className="flex items-center justify-between gap-2 w-full">
                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="w-7 h-7 rounded-full bg-emerald-600/5 text-emerald-600 flex items-center justify-center shrink-0">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="16" />
                          <line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                      </div>
                      <span className="text-[11px] text-text-secondary font-medium">
                        Amount
                      </span>
                    </div>
                    <div className="flex-grow border-b border-dashed border-border-theme mx-1 min-w-[20px] self-end mb-1" />
                    <span className="font-extrabold text-[#113C2F] shrink-0 text-[11px]">
                      {parseFloat(amount).toFixed(2)} USDC
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 w-full">
                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="w-7 h-7 rounded-full bg-emerald-600/5 text-emerald-600 flex items-center justify-center shrink-0">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path d="M12 2L2 7l10 5 10-5-10-5z" />
                          <path d="M2 17l10 5 10-5" />
                        </svg>
                      </div>
                      <span className="text-[11px] text-text-secondary font-medium">
                        Payout to
                      </span>
                    </div>
                    <div className="flex-grow border-b border-dashed border-border-theme mx-1 min-w-[20px] self-end mb-1" />
                    <span className="font-extrabold text-text-primary shrink-0 text-[11px]">
                      {getPayoutSummary()}
                    </span>
                  </div>

                  <div className="border-t border-[#113C2F]/10 my-0.5" />

                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#113C2F]/10 text-[#113C2F] flex items-center justify-center shrink-0">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <line x1="2" y1="10" x2="22" y2="10" />
                        </svg>
                      </div>
                      <span className="text-xs font-extrabold text-text-primary">
                        {payoutMethod === "upi"
                          ? "Via UPI"
                          : "Via Bank Transfer"}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 py-0.5 px-2 rounded-full bg-[#113C2F]/5 text-[9px] font-extrabold text-[#113C2F]">
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Verified
                    </span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                className="w-full py-4 px-6 rounded-2xl cursor-pointer bg-green-600 text-white flex flex-col items-center justify-center gap-0.5 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border-0 font-bold shadow-md shadow-[#113C2F]/10"
                onClick={startFlow}
                disabled={!isFormValid()}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg tracking-wide">Withdraw</span>
                </div>
                <span className="text-[10px] text-white/70 font-medium">
                  {payoutMethod === "upi"
                    ? "Send to your UPI-linked bank account"
                    : "Send via NEFT/IMPS to your bank"}
                </span>
              </button>

              {/* Footer badges */}
              <div className="flex items-center justify-between w-full mt-2 px-1 text-[9px] text-text-muted font-bold tracking-wider uppercase border-t border-border-theme/40 pt-4">
                <div className="flex items-center gap-1">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="text-[#113C2F] shrink-0"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <span>Secure & Encrypted</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="text-[#113C2F] shrink-0"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>Typically 1-5 mins</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="text-[#113C2F] shrink-0"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  <span>Bank-Grade</span>
                </div>
              </div>
            </div>
          )}

          {step === "initializing" && (
            <div className="flex flex-col items-center text-center py-8 gap-4">
              <div className="progress-spinner large-spinner" />
              <h3 className="text-lg font-bold mb-3 text-[#1b4332]">
                Connecting with Anchor Platform...
              </h3>
              <p className="text-xs text-[#4a534e] leading-relaxed">
                Authenticating secure withdrawal handshake via SEP-10 &
                SEP-24...
              </p>
              <div className="w-full bg-[#fbfbfa] border border-[#113C2F]/10 rounded-2xl p-4 flex items-center gap-3 mt-2">
                <div className="w-9 h-9 rounded-xl bg-[#113C2F]/10 text-[#113C2F] flex items-center justify-center shrink-0">
                  {payoutMethod === "upi" ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">
                    {payoutMethod === "upi" ? "UPI Payout" : "Bank Transfer"}
                  </span>
                  <span className="text-xs font-semibold text-text-primary">
                    {getPayoutSummary()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {step === "interactive" && (
            <div className="flex flex-col items-center text-center py-8 gap-4 animate-[fadeIn_0.2s_ease]">
              <div className="progress-spinner large-spinner" />
              <h3 className="text-lg font-bold text-text-primary">
                Authorizing Bank Settlement...
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Connecting to <strong>StellarBank</strong> and authorizing
                fiat payout to <strong>{getPayoutSummary()}</strong>...
              </p>
            </div>
          )}

          {step === "paying" && (
            <div className="flex flex-col items-center text-center py-8 gap-4">
              <div className="progress-spinner large-spinner" />
              <h3 className="text-lg font-bold text-text-primary">
                Submitting USDC Payment...
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Interactive registration complete! Transferring{" "}
                <strong>
                  {typeof withdrawDetails?.amount_in === "object"
                    ? withdrawDetails.amount_in.amount
                    : withdrawDetails?.amount_in}{" "}
                  USDC
                </strong>{" "}
                on-chain to Anchor for bank settlement...
              </p>
              <div className="w-full bg-[#fbfbfa] border border-[#113C2F]/10 rounded-2xl p-4 flex items-center gap-3 mt-2">
                <div className="w-9 h-9 rounded-xl bg-[#113C2F]/10 text-[#113C2F] flex items-center justify-center shrink-0">
                  {payoutMethod === "upi" ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                    </svg>
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">
                    Sending to
                  </span>
                  <span className="text-xs font-semibold text-text-primary">
                    {getPayoutSummary()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center text-center p-6 gap-4">
              <div className="w-16 h-16 rounded-full bg-[#113C2F]/5 flex items-center justify-center">
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="2"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22,4 12,14.01 9,11.01" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-text-primary">
                Withdrawal Initiated! 🎉
              </h3>
              <p className="text-xs text-text-secondary">
                USDC successfully transferred to Anchor. Your funds will arrive
                at <strong>{getPayoutSummary()}</strong> shortly.
              </p>
              {paymentHash && (
                <a
                  href={getExplorerTxUrl(paymentHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#113C2F] font-semibold hover:underline"
                >
                  View Payment Ledger →
                </a>
              )}
              <button
                className="w-full py-3.5 px-6 text-sm font-bold bg-[#113C2F] text-white rounded-2xl cursor-pointer hover:opacity-90 hover:shadow-lg transition-all duration-300 border-0 shadow-md shadow-[#113C2F]/10"
                onClick={handleClose}
              >
                Done
              </button>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center text-center p-6 gap-4">
              <div className="w-16 h-16 rounded-full bg-red-500/5 flex items-center justify-center">
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-text-primary">
                Withdrawal Failed
              </h3>
              <p className="text-xs text-text-secondary">{errorMsg}</p>
              <button
                className="w-full py-3.5 px-6 text-sm font-bold bg-[#113C2F] text-white rounded-2xl cursor-pointer hover:opacity-90 hover:shadow-lg transition-all duration-300 border-0 shadow-md shadow-[#113C2F]/10"
                onClick={() => {
                  setStep("idle");
                  setErrorMsg("");
                }}
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
