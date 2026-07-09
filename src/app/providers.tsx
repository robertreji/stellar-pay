"use client";

import { WalletProvider } from "@/context/WalletContext";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>;
}
