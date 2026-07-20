"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useWallet } from "@/context/WalletContext";
import { buildPaymentTx, submitClassicTransaction } from "@/lib/transactions";
import { Recipient } from "@/lib/services/recipientService";

interface SendMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  recipientName?: string;
  recipientUpi?: string;
}

type RemitStep =
  | "idle"
  | "validating"
  | "initiating"
  | "signing"
  | "submitting"
  | "success"
  | "error";

export default function SendMoneyModal({
  isOpen,
  onClose,
  onSuccess,
  recipientName: initialName = "",
  recipientUpi: initialUpi = "",
}: SendMoneyModalProps) {
  const { address, sign, refreshBalances, username, balances } = useWallet();
  const [recipientName, setRecipientName] = useState(initialName);
  const [recipientUpi, setRecipientUpi] = useState(initialUpi);
  const [inputCurrency, setInputCurrency] = useState<"USDC" | "INR">("USDC");
  const [inputValue, setInputValue] = useState("");
  const [saveContact, setSaveContact] = useState(false);
  const [nickname, setNickname] = useState("");
  
  const [subStep, setSubStep] = useState<"recipient" | "amount">("recipient");
  const [isValidatingUpi, setIsValidatingUpi] = useState(false);

  // Synchronize prefill inputs when they change or modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialName) {
        setRecipientName(initialName);
        setSubStep("amount");
      } else {
        setSubStep("recipient");
      }
      if (initialUpi) setRecipientUpi(initialUpi);
    }
  }, [initialName, initialUpi, isOpen]);
  
  const [step, setStep] = useState<RemitStep>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [txHash, setTxHash] = useState("");
  
  // Rates & config state
  const [usdToInr, setUsdToInr] = useState(82.87); // fallback offered rate
  const [aedToInr, setAedToInr] = useState(22.56); // fallback offered rate
  const [anchorAddress, setAnchorAddress] = useState("");
  const [usdcIssuer, setUsdcIssuer] = useState("");
  
  // Quote timing states
  const [timeLeft, setTimeLeft] = useState(30);
  const [isFetchingRates, setIsFetchingRates] = useState(false);

  // Saved contacts state
  const [contacts, setContacts] = useState<Recipient[]>([]);
  const [showContactsDropdown, setShowContactsDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const usdcBalance = balances.find((b) => b.asset === "USDC")?.balance || "0";

  // Re-usable rate fetching function
  const fetchRates = useCallback(async () => {
    setIsFetchingRates(true);
    try {
      const ratesRes = await fetch("/api/exchange-rate");
      if (ratesRes.ok) {
        const ratesData = await ratesRes.json();
        if (ratesData.rates) {
          setUsdToInr(ratesData.rates.usdToInrWithSpread);
          setAedToInr(ratesData.rates.aedToInrWithSpread);
        }
      }
      setTimeLeft(30); // Reset countdown timer
    } catch (err) {
      console.error("Failed to load exchange rates:", err);
    } finally {
      setIsFetchingRates(false);
    }
  }, []);

  // Load config & contacts on mount
  useEffect(() => {
    if (!isOpen) return;
    
    async function loadConfig() {
      try {
        const configRes = await fetch("/api/config");
        if (configRes.ok) {
          const configData = await configRes.json();
          if (configData.anchorAddress) setAnchorAddress(configData.anchorAddress);
          if (configData.usdcIssuer) setUsdcIssuer(configData.usdcIssuer);
        }
      } catch (err) {
        console.error("Failed to load config details:", err);
      }
    }

    async function loadContacts() {
      if (!username) return;
      try {
        const res = await fetch(`/api/recipients?username=${encodeURIComponent(username)}`);
        if (res.ok) {
          const data = await res.json();
          setContacts(data.recipients || []);
        }
      } catch (err) {
        console.warn("Failed to load recipients contacts:", err);
      }
    }

    loadConfig();
    loadContacts();
    fetchRates(); // Initial load of rates
  }, [isOpen, username, fetchRates]);

  // Countdown timer effect for rate quote
  useEffect(() => {
    if (!isOpen || step !== "idle") return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          fetchRates(); // Auto-refresh rates when timer expires
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, step, fetchRates]);

  // Handle click outside contacts dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowContactsDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelectContact = (contact: Recipient) => {
    setRecipientName(contact.name);
    setRecipientUpi(contact.upi_id);
    setNickname(contact.nickname || "");
    setShowContactsDropdown(false);
    setSubStep("amount"); // Advance to amount step immediately upon selection
  };

  const handleContinueRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim()) {
      setErrorMsg("Recipient name is required.");
      return;
    }
    if (!recipientUpi.trim()) {
      setErrorMsg("Recipient UPI ID is required.");
      return;
    }

    setIsValidatingUpi(true);
    setErrorMsg("");

    try {
      // Validate UPI ID format and existence in bank simulator
      const validationRes = await fetch("/api/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          name: recipientName,
          upi_id: recipientUpi,
          nickname: "TEMP_VALIDATION_ONLY",
        }),
      });

      const valData = await validationRes.json();

      if (!validationRes.ok) {
        throw new Error(valData.error || "UPI ID validation failed.");
      }

      // Clean up the temporary validation contact if it was created
      if (valData.recipient?.id) {
        await fetch(`/api/recipients?id=${valData.recipient.id}`, { method: "DELETE" });
      }

      setSubStep("amount");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to validate UPI ID.");
    } finally {
      setIsValidatingUpi(false);
    }
  };

  const resetForm = () => {
    setRecipientName("");
    setRecipientUpi("");
    setInputValue("");
    setInputCurrency("USDC");
    setSaveContact(false);
    setNickname("");
    setStep("idle");
    setSubStep("recipient");
    setErrorMsg("");
    setTxHash("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !username) return;

    if (!recipientName.trim()) {
      setErrorMsg("Recipient name is required.");
      setStep("error");
      return;
    }

    if (!recipientUpi.trim()) {
      setErrorMsg("Recipient UPI ID is required.");
      setStep("error");
      return;
    }

    const parsedValue = parseFloat(inputValue);
    if (isNaN(parsedValue) || parsedValue <= 0) {
      setErrorMsg(`Please enter a valid amount of ${inputCurrency}.`);
      setStep("error");
      return;
    }

    const usdcAmountNum = inputCurrency === "USDC" ? parsedValue : parsedValue / usdToInr;
    if (usdcAmountNum > parseFloat(usdcBalance)) {
      setErrorMsg("Insufficient USDC balance in your Stellar wallet.");
      setStep("error");
      return;
    }

    setStep("validating");
    setErrorMsg("");

    try {
      // 1. Save contact if requested (handles UPI validation inside POST API)
      if (saveContact) {
        const contactRes = await fetch("/api/recipients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            name: recipientName,
            upi_id: recipientUpi,
            nickname: nickname || undefined,
          }),
        });

        if (!contactRes.ok) {
          const contactData = await contactRes.json();
          throw new Error(contactData.error || "Failed to validate/save contact.");
        }
      } else {
        // If not saving, still validate UPI against the bank simulator
        const validationRes = await fetch("/api/recipients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            name: recipientName,
            upi_id: recipientUpi,
            nickname: "TEMP_VALIDATION_ONLY",
          }),
        });

        if (!validationRes.ok) {
          const validationData = await validationRes.json();
          throw new Error(validationData.error || "UPI ID validation failed.");
        }

        // Clean up the temporary validation contact
        const valData = await validationRes.json();
        if (valData.recipient?.id) {
          await fetch(`/api/recipients?id=${valData.recipient.id}`, { method: "DELETE" });
        }
      }

      // 2. Initiate Remittance on Backend
      setStep("initiating");
      const initiateRes = await fetch("/api/remittance/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_wallet: address,
          sender_username: username,
          recipient_name: recipientName,
          recipient_upi: recipientUpi,
          amount_usdc: parseFloat(usdcAmountNum.toFixed(4)),
        }),
      });

      if (!initiateRes.ok) {
        const initData = await initiateRes.json();
        throw new Error(initData.error || "Failed to initiate remittance.");
      }

      const { remittance } = await initiateRes.json();
      const referenceId = remittance.reference_id;

      // 3. Build Stellar Transaction (locally on client)
      setStep("signing");
      const xdr = await buildPaymentTx(
        address,
        anchorAddress,
        usdcAmountNum.toFixed(4),
        "USDC",
        usdcIssuer || undefined,
        referenceId
      );

      // 4. Sign Transaction
      const signedXdr = await sign(xdr);

      // 5. Submit Transaction
      setStep("submitting");
      const submitResult = await submitClassicTransaction(signedXdr);

      // 6. Confirm transaction immediately to execute real-time bank payout
      try {
        await fetch("/api/remittance/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reference_id: referenceId,
            stellar_tx_hash: submitResult.hash,
          }),
        });
      } catch (confirmErr) {
        console.warn("Real-time confirmation request failed. The background indexer cron will process it.", confirmErr);
      }

      setTxHash(submitResult.hash);
      setStep("success");
      await refreshBalances();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to complete remittance transaction.");
      setStep("error");
    }
  };

  const parsedValue = parseFloat(inputValue) || 0;
  const usdcAmount = inputCurrency === "USDC" ? parsedValue : parsedValue / usdToInr;
  const inrAmount = inputCurrency === "INR" ? parsedValue : parsedValue * usdToInr;

  const calculatedPayout = inrAmount ? inrAmount.toFixed(2) : "0.00";
  const calculatedDeduction = usdcAmount ? usdcAmount.toFixed(2) : "0.00";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#132e22]/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-6 animate-[fadeIn_0.2s_ease]" onClick={handleClose}>
      <div className="bg-bg-card border border-border-theme rounded-3xl w-full max-w-[480px] shadow-2xl flex flex-col overflow-hidden animate-[slideUp_0.3s_ease]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 pt-6">
          <h2 className="text-lg font-bold text-text-primary">Send Money Home (INR)</h2>
          <button className="bg-transparent border-0 text-text-muted cursor-pointer p-1 flex items-center justify-center rounded-full hover:bg-bg-hover hover:text-text-primary transition-all duration-200" onClick={handleClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {step === "success" ? (
          <div className="p-6 flex flex-col items-center text-center gap-4 animate-[fadeIn_0.3s_ease]">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22,4 12,14.01 9,11.01" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-text-primary">Remittance Initiated! 🚀</h3>
            <p className="text-sm text-text-secondary">
              Sent <strong>{parseFloat(calculatedDeduction).toLocaleString()} USDC</strong> to Anchor.
            </p>
            <div className="bg-bg-secondary border border-border-theme rounded-xl p-4 w-full text-left flex flex-col gap-2">
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Recipient:</span>
                <span className="font-semibold text-text-primary">{recipientName}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">UPI ID:</span>
                <span className="font-semibold text-text-primary">{recipientUpi}</span>
              </div>
              <div className="flex justify-between text-xs text-success">
                <span>Estimated Payout:</span>
                <span className="font-bold">₹{parseFloat(calculatedPayout).toLocaleString()} INR</span>
              </div>
            </div>
            {txHash && (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent-purple hover:underline"
              >
                View on Stellar Expert →
              </a>
            )}
            <button className="w-full py-4 px-6 text-sm font-bold bg-gradient-to-r from-accent-purple to-accent-indigo text-white rounded-xl cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300" onClick={handleClose}>
              Done
            </button>
          </div>
        ) : (
          <div className="p-6 flex flex-col gap-4">
            {subStep === "recipient" ? (
              <form onSubmit={handleContinueRecipient} className="flex flex-col gap-4">
                {/* Quick Select Contacts */}
                {contacts.length > 0 && (
                  <div className="relative w-full" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowContactsDropdown(!showContactsDropdown)}
                      className="w-full py-2.5 px-3.5 text-xs bg-bg-secondary border border-border-theme text-text-primary rounded-xl flex items-center justify-between hover:bg-bg-hover transition-all"
                    >
                      <span className="flex items-center gap-1.5 font-semibold text-text-secondary">
                        👤 Quick Select Saved Recipient ({contacts.length})
                      </span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    {showContactsDropdown && (
                      <div className="absolute top-[calc(100%_+_4px)] left-0 right-0 bg-bg-card border border-border-theme rounded-xl shadow-lg z-[1100] max-h-[180px] overflow-y-auto flex flex-col p-1.5 gap-1 animate-[fadeIn_0.15s_ease]">
                        {contacts.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full flex items-center justify-between p-2 rounded-lg cursor-pointer bg-transparent border-0 hover:bg-bg-hover text-left"
                            onClick={() => handleSelectContact(c)}
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold text-text-primary">
                                {c.name} {c.nickname ? `(${c.nickname})` : ""}
                              </span>
                              <span className="text-[10px] text-text-muted truncate">{c.upi_id}</span>
                            </div>
                            {c.is_favorite && <span className="text-xs">⭐</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Recipient Name */}
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="text-xs font-semibold text-text-secondary">Recipient's Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Robert Reji"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    disabled={isValidatingUpi}
                    className="w-full bg-bg-secondary border border-border-theme rounded-xl py-3.5 px-4 text-sm outline-none focus:border-accent-purple/50 text-text-primary focus:bg-bg-card"
                    required
                  />
                </div>

                {/* Recipient UPI ID */}
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="text-xs font-semibold text-text-secondary">Recipient's UPI ID (VPA)</label>
                  <input
                    type="text"
                    placeholder="username@stellarbank"
                    value={recipientUpi}
                    onChange={(e) => setRecipientUpi(e.target.value)}
                    disabled={isValidatingUpi}
                    className="w-full bg-bg-secondary border border-border-theme rounded-xl py-3.5 px-4 text-sm outline-none focus:border-accent-purple/50 text-text-primary focus:bg-bg-card"
                    required
                  />
                </div>

                {/* Error Message */}
                {errorMsg && (
                  <div className="text-xs text-error bg-error/8 border border-error/15 rounded-xl p-3 flex items-center gap-2 animate-[fadeIn_0.2s_ease]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {errorMsg}
                  </div>
                )}

                {/* Action Button */}
                <button
                  type="submit"
                  className="w-full py-4 px-6 text-sm font-bold bg-[#113C2F] text-white rounded-xl cursor-pointer hover:opacity-95 hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 border-0"
                  disabled={isValidatingUpi || !recipientName.trim() || !recipientUpi.trim()}
                >
                  {isValidatingUpi ? (
                    <>
                      <div className="progress-spinner" style={{ width: 16, height: 16, borderTopColor: '#ffffff' }} />
                      <span>Validating recipient UPI...</span>
                    </>
                  ) : (
                    <span>Continue</span>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Recipient info summary header */}
                <div className="bg-[#164A3A]/5 border border-[#164A3A]/10 rounded-2xl p-3.5 flex justify-between items-center text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-[#164A3A] truncate">{recipientName}</p>
                    <p className="text-text-secondary text-[10px] truncate">{recipientUpi}</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => {
                      setSubStep("recipient");
                      setErrorMsg("");
                    }}
                    className="text-[#164A3A] hover:underline bg-transparent border-0 font-extrabold cursor-pointer text-xs flex-shrink-0"
                  >
                    Change
                  </button>
                </div>

                {/* Amount and Estimation */}
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex justify-between items-center text-xs font-semibold text-text-secondary">
                    <div className="flex bg-bg-secondary p-1 border border-border-theme rounded-lg gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setInputCurrency("USDC");
                          setInputValue("");
                        }}
                        disabled={step !== "idle" && step !== "error"}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                          inputCurrency === "USDC"
                            ? "bg-[#164A3A] text-white shadow-sm"
                            : "bg-transparent text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        USDC
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setInputCurrency("INR");
                          setInputValue("");
                        }}
                        disabled={step !== "idle" && step !== "error"}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                          inputCurrency === "INR"
                            ? "bg-[#164A3A] text-white shadow-sm"
                            : "bg-transparent text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        INR
                      </button>
                    </div>
                    <span>Available: {parseFloat(usdcBalance).toFixed(2)} USDC</span>
                  </div>
                  <div className="relative flex items-center w-full">
                    <input
                      type="number"
                      placeholder="0.00"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      disabled={step !== "idle" && step !== "error"}
                      className="w-full bg-bg-secondary border border-border-theme rounded-xl py-3.5 pl-4 pr-16 text-sm outline-none focus:border-accent-purple/50 text-text-primary focus:bg-bg-card"
                      step="any"
                      min="0.01"
                      required
                    />
                    <span className="absolute right-4 text-xs font-bold text-text-muted">{inputCurrency}</span>
                  </div>
                </div>

                {/* Live Exchange Rate Box */}
                <div className="bg-bg-secondary border border-border-theme rounded-xl p-3.5 flex flex-col gap-2">
                  <div className="flex justify-between text-xs text-text-secondary items-center">
                    <span>USDC → INR Rate:</span>
                    <div className="flex items-center gap-2">
                      {isFetchingRates && <div className="progress-spinner" style={{ width: 12, height: 12 }} />}
                      <span className="font-bold text-text-primary">1 USDC = ₹{usdToInr.toFixed(2)} INR</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-text-secondary items-center">
                    <span>Platform Fee:</span>
                    <span className="font-bold text-text-primary">0 USDC</span>
                  </div>
                  <div className="flex justify-between text-xs text-text-secondary items-center">
                    <span>Total USDC Deducted:</span>
                    <span className="font-extrabold text-accent-indigo">{calculatedDeduction} USDC</span>
                  </div>
                  <div className="h-px bg-border-theme my-1" />
                  <div className="flex justify-between text-xs items-center">
                    <span className="text-text-muted">Recipient Receives:</span>
                    <span className="text-base font-extrabold text-[#164A3A]">₹{parseFloat(calculatedPayout).toLocaleString()} INR</span>
                  </div>
                </div>

                {/* Quote Expiration Info Alert */}
                {step === "idle" && (
                  <div className="flex items-center gap-2.5 px-3.5 py-3 bg-[#164A3A]/5 border border-[#164A3A]/10 rounded-2xl text-[11px] text-text-secondary animate-[fadeIn_0.2s_ease]">
                    <span className="text-base flex-shrink-0">ℹ️</span>
                    <span className="leading-relaxed">
                      This exchange rate quote is locked for another{" "}
                      <strong className={timeLeft <= 5 ? "text-error animate-pulse font-black" : "text-text-primary font-bold"}>
                        {timeLeft}s
                      </strong>{" "}
                      before automatically refreshing to match live market rates.
                    </span>
                  </div>
                )}

                {/* Save to contacts checkbox */}
                {step === "idle" && (
                  <div className="flex flex-col gap-2 p-1">
                    <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer font-semibold">
                      <input
                        type="checkbox"
                        checked={saveContact}
                        onChange={(e) => setSaveContact(e.target.checked)}
                        className="rounded border-border-theme accent-[#164A3A] cursor-pointer"
                      />
                      Save recipient to contacts
                    </label>
                    {saveContact && (
                      <input
                        type="text"
                        placeholder="Nickname (e.g. Mom, Brother)"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        className="w-full mt-1 bg-bg-secondary border border-border-theme rounded-xl py-3 px-4 text-xs outline-none focus:border-accent-purple/50 text-text-primary"
                      />
                    )}
                  </div>
                )}

                {/* Error Message */}
                {step === "error" && (
                  <div className="text-xs text-error bg-error/8 border border-error/15 rounded-xl p-3 flex items-center gap-2 animate-[fadeIn_0.2s_ease]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {errorMsg}
                  </div>
                )}

                {/* Action Button / Progress */}
                <button
                  type="submit"
                  className="w-full py-4 px-6 text-sm font-bold bg-[#113C2F] text-white rounded-xl cursor-pointer hover:opacity-95 hover:shadow-lg transition-all duration-300 disabled:opacity-50 border-0"
                  disabled={(step !== "idle" && step !== "error") || isFetchingRates}
                >
                  {step === "validating" && "Validating UPI..."}
                  {step === "initiating" && "Initiating Remittance..."}
                  {step === "signing" && "Signing locally..."}
                  {step === "submitting" && "Submitting transaction..."}
                  {(step === "idle" || step === "error") && `Send ₹${parseFloat(calculatedPayout).toLocaleString()} INR`}
                </button>

                {/* Progress indicator */}
                {["validating", "initiating", "signing", "submitting"].includes(step) && (
                  <div className="flex items-center gap-3 bg-bg-card border border-border-theme rounded-xl p-4 text-xs text-text-secondary animate-[fadeIn_0.2s_ease]">
                    <div className="progress-spinner" />
                    <span>
                      {step === "validating" && "Validating recipient UPI ID against bank simulator..."}
                      {step === "initiating" && "Generating reference memo & locks..."}
                      {step === "signing" && "Signing payment transaction securely locally..."}
                      {step === "submitting" && "Submitting on-chain USDC payment to Anchor..."}
                    </span>
                  </div>
                )}
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
