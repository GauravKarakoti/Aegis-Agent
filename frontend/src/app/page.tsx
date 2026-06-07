/**
 * Aegis - Main Page
 *
 * Two-panel layout:
 * - Left: Chat interface for natural language instructions
 * - Right: Transaction review card with Ledger signing controls
 */

"use client";

import { Cpu, ShieldCheck } from "lucide-react";
import { ChatPanel } from "@/components/ChatPanel";
import { TransactionReview } from "@/components/TransactionReview";
import { useTransactionStore } from "@/store/transactionStore";
import { cn } from "@/lib/utils";

export default function Home() {
  const ledgerConnected = useTransactionStore((s) => s.ledgerConnected);
  const ledgerType = useTransactionStore((s) => s.ledgerType);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="flex h-14 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10">
            <Cpu className="h-4 w-4 text-amber-400" />
          </div>
          <h1 className="text-base font-bold tracking-tight text-foreground">
            Aegis
          </h1>
          <span className="hidden text-[10px] font-medium uppercase tracking-widest text-muted-foreground sm:block">
            AI Wallet Agent
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Tagline */}
          <p className="hidden text-[10px] text-muted-foreground lg:block">
            LLMs provide intelligence &middot; Agents provide action &middot; Hardware provides control
          </p>

          {/* Ledger Status */}
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
              ledgerConnected
                ? "bg-green-500/10 text-green-400"
                : "bg-amber-500/10 text-amber-400"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                ledgerConnected ? "bg-green-400" : "bg-amber-400"
              )}
            />
            <span className="hidden sm:inline">
              {ledgerConnected
                ? `Ledger ${ledgerType === "speculos" ? "(Speculos)" : ""}`
                : "Ledger Disconnected"}
            </span>
            <span className="sm:hidden">
              {ledgerConnected ? "HW" : "No HW"}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left Panel - Chat */}
        <div className="w-full border-r border-border lg:w-1/2 xl:w-[45%]">
          <ChatPanel />
        </div>

        {/* Right Panel - Transaction Review */}
        <div className="hidden w-full lg:block lg:w-1/2 xl:w-[55%]">
          <TransactionReview />
        </div>
      </main>
    </div>
  );
}