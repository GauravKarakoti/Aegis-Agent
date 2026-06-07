import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aegis — AI Wallet Agent",
  description:
    "Personal AI wallet agent with Ledger hardware security. AI proposes, human reviews, Ledger signs.",
  openGraph: {
    title: "Aegis — AI Wallet Agent",
    description:
      "Personal AI wallet agent with hardware-enforced security via Ledger.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}