/**
 * Aegis - API Client
 *
 * Client-side functions for communicating with the Aegis backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

interface TransactionState {
  recipient: string;
  amount: string;
  amountWei: string;
  network: string;
  gasEstimate: string | null;
  nonce: number | null;
  unsignedTxHex: string | null;
  signedTxHex: string | null;
  txHash: string | null;
  status: "idle" | "preparing" | "awaiting_ledger" | "signed" | "broadcast" | "confirmed" | "failed";
  fromAddress: string | null;
}

interface ChatResponse {
  reply: string;
  transactionState: TransactionState;
  sessionId: string;
}

interface PrepareResponse {
  unsignedTxHex: string;
  summary: {
    network: string;
    from: string;
    to: string;
    amount: string;
    amountWei: string;
    gasEstimate: string;
    nonce: number;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    chainId: number;
  };
  status: string;
}

interface SignResponse {
  signedTx: string;
  status: string;
  message: string;
}

interface BroadcastResponse {
  txHash: string;
  blockNumber: string | null;
  from: string;
  to: string;
  explorerUrl: string;
  status: string;
}

interface StatusResponse {
  server: string;
  network: string;
  ledger: {
    connected: boolean;
    type: string;
  };
  mode: string;
  maxDailyEth: string;
}

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.error || `HTTP ${response.status}: Request failed`
    );
  }

  return response.json();
}

export const api = {
  chat: (message: string, sessionId?: string) =>
    request<ChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify({ message, sessionId }),
    }),

  prepare: (recipient: string, amount: string, network: string = "sepolia") =>
    request<PrepareResponse>("/prepare", {
      method: "POST",
      body: JSON.stringify({ recipient, amount, network }),
    }),

  sign: (
    txHash: string,
    recipient: string,
    amount: string,
    network: string = "sepolia",
    data?: string
  ) =>
    request<SignResponse>("/sign", {
      method: "POST",
      body: JSON.stringify({ txHash, recipient, amount, network, data }),
    }),

  broadcast: (signedTx: string, network: string = "sepolia") =>
    request<BroadcastResponse>("/broadcast", {
      method: "POST",
      body: JSON.stringify({ signedTx, network }),
    }),

  address: (derivationPath?: string) =>
    request<{ address: string; derivationPath: string; source: string }>(
      `/address${derivationPath ? `?derivationPath=${encodeURIComponent(derivationPath)}` : ""}`
    ),

  status: () => request<StatusResponse>("/status"),

  health: () =>
    request<{ status: string; service: string; version: string }>("/health"),
};

export type {
  TransactionState,
  ChatResponse,
  PrepareResponse,
  SignResponse,
  BroadcastResponse,
  StatusResponse,
};