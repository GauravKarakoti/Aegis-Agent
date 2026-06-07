/**
 * Aegis - Zustand Transaction Store
 *
 * Manages the global UI state for the Aegis wallet agent.
 * Tracks messages, transaction state, and connection status.
 */

import { create } from "zustand";

export type TransactionStatus =
  | "idle"
  | "preparing"
  | "awaiting_ledger"
  | "signed"
  | "broadcast"
  | "confirmed"
  | "failed";

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
}

export interface TransactionSummary {
  network: string;
  from: string;
  to: string;
  amount: string;
  gasEstimate: string;
  nonce: number | null;
  txHash: string | null;
  status: TransactionStatus;
  explorerUrl: string | null;
  unsignedTxHex: string | null;
  signedTxHex: string | null;
}

interface TransactionStore {
  messages: ChatMessage[];
  transaction: TransactionSummary;
  ledgerConnected: boolean;
  ledgerType: string;
  isProcessing: boolean;
  error: string | null;

  // Actions
  addMessage: (role: "user" | "agent", content: string) => void;
  updateTransaction: (partial: Partial<TransactionSummary>) => void;
  setLedgerStatus: (connected: boolean, type?: string) => void;
  setProcessing: (processing: boolean) => void;
  setError: (error: string | null) => void;
  resetTransaction: () => void;
  resetAll: () => void;
}

const initialTransaction: TransactionSummary = {
  network: "sepolia",
  from: "",
  to: "",
  amount: "",
  gasEstimate: "",
  nonce: null,
  txHash: null,
  status: "idle",
  explorerUrl: null,
  unsignedTxHex: null,
  signedTxHex: null,
};

export const useTransactionStore = create<TransactionStore>((set) => ({
  messages: [],
  transaction: { ...initialTransaction },
  ledgerConnected: false,
  ledgerType: "none",
  isProcessing: false,
  error: null,

  addMessage: (role, content) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: crypto.randomUUID(),
          role,
          content,
          timestamp: new Date(),
        },
      ],
    })),

  updateTransaction: (partial) =>
    set((state) => ({
      transaction: { ...state.transaction, ...partial },
    })),

  setLedgerStatus: (connected, type = "none") =>
    set({ ledgerConnected: connected, ledgerType: type }),

  setProcessing: (isProcessing) => set({ isProcessing }),

  setError: (error) => set({ error }),

  resetTransaction: () =>
    set({ transaction: { ...initialTransaction }, error: null }),

  resetAll: () =>
    set({
      messages: [],
      transaction: { ...initialTransaction },
      ledgerConnected: false,
      ledgerType: "none",
      isProcessing: false,
      error: null,
    }),
}));