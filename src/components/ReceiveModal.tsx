"use client";

import { useWallet } from "@/context/WalletContext";
import { useState, useEffect } from "react";

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReceiveModal({ isOpen, onClose }: ReceiveModalProps) {
  const { address, username } = useWallet();
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const [preloadedQr, setPreloadedQr] = useState<HTMLImageElement | null>(null);
  const [preloadedLogo, setPreloadedLogo] = useState<HTMLImageElement | null>(null);
  const [preloadedBg, setPreloadedBg] = useState<HTMLImageElement | null>(null);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&ecc=H&data=${encodeURIComponent(address || "")}`;

  // Sync profile image from localStorage
  useEffect(() => {
    if (address && isOpen) {
      const stored = localStorage.getItem(`stellarpay_profile_image_${address}`);
      if (stored) {
        setProfileImage(stored);
      }
    }
  }, [address, isOpen]);

  // Preload template assets concurrently when modal opens
  useEffect(() => {
    if (isOpen && address) {
      // 1. Preload QR Code
      const qr = new Image();
      qr.crossOrigin = "anonymous";
      qr.src = qrUrl;
      qr.onload = () => setPreloadedQr(qr);

      // 2. Preload logo.png
      const logo = new Image();
      logo.crossOrigin = "anonymous";
      logo.src = "/logo.png";
      logo.onload = () => setPreloadedLogo(logo);

      // 3. Preload kerala-bg.png
      const bg = new Image();
      bg.crossOrigin = "anonymous";
      bg.src = "/kerala-bg.png";
      bg.onload = () => setPreloadedBg(bg);
    } else {
      setPreloadedQr(null);
      setPreloadedLogo(null);
      setPreloadedBg(null);
    }
  }, [isOpen, address, qrUrl]);

  if (!isOpen || !address) return null;

  const getInitials = (nameOrAddr: string) => {
    const clean = nameOrAddr.replace("@", "");
    return clean.slice(0, 2).toUpperCase();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateTemplateBlob = async (): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
      try {
        // Resolve QR Image from preloaded state or load on-demand as fallback
        let img = preloadedQr;
        if (!img) {
          img = new Image();
          img.crossOrigin = "anonymous";
          img.src = qrUrl;
          await new Promise((res, rej) => {
            img!.onload = res;
            img!.onerror = rej;
          });
        }

        // Load avatar image if base64 is set
        let avatarImg: HTMLImageElement | null = null;
        if (profileImage) {
          avatarImg = new Image();
          avatarImg.src = profileImage;
          await new Promise((res) => {
            avatarImg!.onload = res;
            avatarImg!.onerror = res; // resolve anyway
          });
        }

        // Resolve Logo from preloaded state or load on-demand as fallback
        let logoImg = preloadedLogo;
        if (!logoImg) {
          logoImg = new Image();
          logoImg.crossOrigin = "anonymous";
          logoImg.src = "/logo.png";
          await new Promise((res) => {
            logoImg!.onload = res;
            logoImg!.onerror = res; // resolve anyway
          });
        }

        // Resolve Background from preloaded state or load on-demand as fallback
        let bgImg = preloadedBg;
        if (!bgImg) {
          bgImg = new Image();
          bgImg.crossOrigin = "anonymous";
          bgImg.src = "/kerala-bg.png";
          await new Promise((res) => {
            bgImg!.onload = res;
            bgImg!.onerror = res; // resolve anyway
          });
        }

        const scale = 4;
        const canvas = document.createElement("canvas");
        canvas.width = 320 * scale;
        canvas.height = 420 * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Could not get canvas context");
        }

        // Draw background
        ctx.fillStyle = "#faf9f5";
        ctx.fillRect(0, 0, 320 * scale, 420 * scale);

        // Draw Kerala background image (25% opacity)
        if (bgImg.width > 0) {
          ctx.save();
          ctx.globalAlpha = 0.25;
          ctx.drawImage(bgImg, 0, 0, 320 * scale, 420 * scale);
          ctx.restore();
        }

        // Draw Kerala Kasavu Gold Borders
        ctx.fillStyle = "#c29d58";
        // Left thick
        ctx.fillRect(0, 0, 10 * scale, 420 * scale);
        // Right thick
        ctx.fillRect(310 * scale, 0, 10 * scale, 420 * scale);
        // Left thin
        ctx.fillStyle = "rgba(194, 157, 88, 0.4)";
        ctx.fillRect(14 * scale, 0, 2 * scale, 420 * scale);
        // Right thin
        ctx.fillRect(304 * scale, 0, 2 * scale, 420 * scale);

        // Draw waves at the bottom
        ctx.fillStyle = "rgba(27, 67, 50, 0.08)";
        ctx.beginPath();
        ctx.moveTo(0, 420 * scale);
        ctx.lineTo(0, 395 * scale);
        ctx.quadraticCurveTo(80 * scale, 380 * scale, 160 * scale, 400 * scale);
        ctx.quadraticCurveTo(240 * scale, 420 * scale, 320 * scale, 395 * scale);
        ctx.lineTo(320 * scale, 420 * scale);
        ctx.closePath();
        ctx.fill();

        // 1. Draw Centred Avatar at the top (center avX = 160, avY = 40)
        const avX = 160 * scale, avY = 40 * scale, avR = 20 * scale;
        ctx.save();
        ctx.beginPath();
        ctx.arc(avX, avY, avR, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        if (avatarImg) {
          ctx.drawImage(avatarImg, avX - avR, avY - avR, avR * 2, avR * 2);
        } else {
          const grad = ctx.createLinearGradient(avX - avR, avY - avR, avX + avR, avY + avR);
          grad.addColorStop(0, "#1b4332");
          grad.addColorStop(1, "#c29d58");
          ctx.fillStyle = grad;
          ctx.fill();

          ctx.fillStyle = "#ffffff";
          ctx.font = `bold ${12 * scale}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(getInitials(username || address), avX, avY);
        }
        ctx.restore();

        // White border around avatar
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.arc(avX, avY, avR, 0, Math.PI * 2);
        ctx.stroke();

        // 2. Draw white QR wrapper card: x = 40, y = 80, w = 240, h = 250
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "rgba(27, 67, 50, 0.04)";
        ctx.shadowBlur = 8 * scale;
        ctx.shadowOffsetY = 2 * scale;
        
        // draw rounded card
        const cardX = 40 * scale, cardY = 80 * scale, cardW = 240 * scale, cardH = 250 * scale, cardR = 16 * scale;
        ctx.beginPath();
        ctx.moveTo(cardX + cardR, cardY);
        ctx.lineTo(cardX + cardW - cardR, cardY);
        ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + cardR);
        ctx.lineTo(cardX + cardW, cardY + cardH - cardR);
        ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - cardR, cardY + cardH);
        ctx.lineTo(cardX + cardR, cardY + cardH);
        ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - cardR);
        ctx.lineTo(cardX, cardY + cardR);
        ctx.quadraticCurveTo(cardX, cardY, cardX + cardR, cardY);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(27, 67, 50, 0.06)";
        ctx.lineWidth = 1 * scale;
        ctx.stroke();
        
        ctx.shadowColor = "transparent";

        // Draw QR code inside card: x = 70, y = 100, w = 180, h = 180
        ctx.drawImage(img, 70 * scale, 100 * scale, 180 * scale, 180 * scale);

        // Draw Logo Badge in the center of QR code: cx = 160, cy = 190
        const cx = 160 * scale, cy = 190 * scale, logoR = 18 * scale;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(cx, cy, logoR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(27, 67, 50, 0.08)";
        ctx.lineWidth = 1 * scale;
        ctx.stroke();

        if (logoImg.width > 0) {
          ctx.drawImage(logoImg, cx - 12 * scale, cy - 12 * scale, 24 * scale, 24 * scale);
        }

        // Draw username/ID inside card below QR code: y = 305
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#4a534e";
        ctx.font = `bold ${11 * scale}px sans-serif`;
        ctx.fillText(`Username: @${username || address.slice(0, 8)}`, 160 * scale, 305 * scale);

        // 3. Draw bottom caption outside card: y = 365
        ctx.fillStyle = "#4a534e";
        ctx.font = `600 ${11 * scale}px sans-serif`;
        ctx.fillText("Scan to pay using Ente Veed app", 160 * scale, 365 * scale);

        canvas.toBlob((b) => {
          if (b) {
            resolve(b);
          } else {
            reject(new Error("Canvas toBlob returned null"));
          }
        }, "image/png");
      } catch (err) {
        reject(err);
      }
    });
  };

  const handleDownload = async () => {
    try {
      const blob = await generateTemplateBlob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `enteveed-qr-${username || address.slice(0, 8)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert("Failed to generate and download the QR code template.");
    }
  };

  const handleShare = async () => {
    if (navigator.share && navigator.canShare) {
      setIsSharing(true);
      try {
        const blob = await generateTemplateBlob();
        const file = new File([blob], "enteveed-qr.png", { type: "image/png" });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "enteveed QR Code",
            text: `Send me a payment on enteVeed!\n`,
          });
          return;
        }
      } catch (error) {
        console.error("Web Share failed, falling back to download:", error);
      } finally {
        setIsSharing(false);
      }
    }

    // Fallback: Trigger download
    handleDownload();
  };

  return (
    <div className="fixed inset-0 bg-[#132e22]/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-6 animate-[fadeIn_0.2s_ease]" onClick={onClose}>
      <div className="bg-bg-card border border-border-theme rounded-3xl w-full max-w-[440px] shadow-2xl flex flex-col overflow-hidden animate-[slideUp_0.3s_ease]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 pt-6">
          <h2 className="text-lg font-bold text-text-primary">Receive Funds</h2>
          <button className="bg-transparent border-0 text-text-muted cursor-pointer p-1 flex items-center justify-center rounded-full hover:bg-bg-hover hover:text-text-primary transition-all duration-200" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6 flex flex-col items-center gap-5">
          <p className="text-text-secondary text-sm text-center leading-relaxed">
            share this QR code to receive Stellar payments.
          </p>

          {/* Kerala Themed Digital Card */}
          <div className="relative bg-[#faf9f5] border border-border-theme rounded-2xl w-full max-w-[320px] p-6 py-8 flex flex-col items-center shadow-md overflow-hidden">
            {/* Kerala Kasavu Gold Borders */}
            <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-[#c29d58]" />
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-[#c29d58]/40" />
            <div className="absolute right-0 top-0 bottom-0 w-2.5 bg-[#c29d58]" />
            <div className="absolute right-3 top-0 bottom-0 w-0.5 bg-[#c29d58]/40" />

            {/* Kerala background image overlay */}
            <div className="absolute inset-0 bg-cover bg-center opacity-25 pointer-events-none z-0" style={{ backgroundImage: "url('/kerala-bg.png')" }} />

            {/* Header (Centred Avatar only) */}
            <div className="flex justify-center mb-6 z-10 w-full">
              <div className="w-14 h-14 rounded-full border-2 border-white shadow-md flex items-center justify-center overflow-hidden bg-gradient-to-r from-accent-purple to-accent-indigo text-white font-bold text-sm flex-shrink-0">
                {profileImage ? (
                  <img src={profileImage} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  getInitials(username || address)
                )}
              </div>
            </div>

            {/* QR Wrapper Card */}
            <div className="bg-white px-5 py-6 rounded-2xl shadow-sm border border-border-theme flex flex-col items-center mb-5 z-10 w-full">
              {/* QR Image with centered Logo */}
              <div className="relative w-[180px] h-[180px] flex items-center justify-center mb-4">
                <img src={qrUrl} alt="Stellar QR Code" className="w-full h-full object-contain" />
                {/* Centered Logo Badge */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white border border-border-theme flex items-center justify-center shadow-md p-1">
                  <img src="/logo.png" alt="logo" className="w-6 h-6 object-contain" />
                </div>
              </div>
              {/* UPI ID style label */}
              <span className="text-xs font-semibold text-text-secondary tracking-tight">
                Username: @{username || address.slice(0, 8)}
              </span>
            </div>

            {/* Bottom Caption */}
            <span className="text-xs font-semibold text-[#4a534e] z-10 mb-2">
              Scan to pay using any Stellar app
            </span>

            {/* Kerala Backwaters Silhouette / Waves in SVG at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-10 opacity-25 pointer-events-none z-0">
              <svg viewBox="0 0 120 28" className="w-full h-full fill-[#1b4332]">
                <path d="M0,15 C30,5 60,25 90,15 C105,10 115,15 120,18 L120,28 L0,28 Z" />
              </svg>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full mt-2">
            <button
              onClick={handleDownload}
              className="w-full py-3.5 px-6 text-sm font-bold bg-bg-secondary border border-border-theme text-text-primary rounded-xl cursor-pointer hover:bg-bg-hover hover:border-border-theme-hover transition-all duration-300 flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download QR Code
            </button>

            <button
              onClick={handleShare}
              disabled={isSharing}
              className="w-full py-3.5 px-6 text-sm font-bold bg-[#25D366] text-white rounded-xl cursor-pointer hover:bg-[#20ba5a] shadow-[0_4px_14px_rgba(37,211,102,0.35)] transition-all duration-300 flex items-center justify-center gap-2 no-underline hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              {isSharing ? "Preparing..." : "Share QR Code"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
