"use client";

interface BottomNavProps {
  activeTab: string;
  onChangeTab: (tab: string) => void;
  onSendClick: () => void;
}

export default function BottomNav({ activeTab, onChangeTab }: BottomNavProps) {
  return (
    <nav className="flex md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-xl border border-[#164A3A]/8 py-2.5 px-3 rounded-[32px] shadow-[0_16px_40px_rgba(22,74,58,0.12)] justify-center items-center gap-4 z-[100] max-w-[320px] w-[90%]">
      {/* Home */}
      <button 
        type="button"
        onClick={() => onChangeTab("home")}
        className={`flex items-center gap-2.5 py-2.5 px-5 rounded-2xl border-0 text-xs font-bold transition-all duration-300 cursor-pointer ${
          activeTab === "home" 
            ? "bg-[#164A3A] text-white shadow-md shadow-[#164A3A]/10 scale-[1.03]" 
            : "bg-transparent text-[#4E6B4A] hover:bg-[#164A3A]/5"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9,22 9,12 15,12 15,22" />
        </svg>
        <span>Home</span>
      </button>

      {/* Wallet */}
      <button 
        type="button"
        onClick={() => onChangeTab("wallet")}
        className={`flex items-center gap-2.5 py-2.5 px-5 rounded-2xl border-0 text-xs font-bold transition-all duration-300 cursor-pointer ${
          activeTab === "wallet" 
            ? "bg-[#164A3A] text-white shadow-md shadow-[#164A3A]/10 scale-[1.03]" 
            : "bg-transparent text-[#4E6B4A] hover:bg-[#164A3A]/5"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M12 4v16M2 10h20" />
        </svg>
        <span>Wallet</span>
      </button>
    </nav>
  );
}
