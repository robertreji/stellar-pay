import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "StellarPay — Stellar Testnet Wallet",
  description:
    "A premium wallet app for sending payments on the Stellar testnet using Freighter wallet. Transfer XLM and USDC with ease.",
  keywords: ["Stellar", "wallet", "XLM", "USDC", "testnet", "Freighter", "crypto"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
