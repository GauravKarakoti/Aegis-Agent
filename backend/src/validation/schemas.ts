import { z } from "zod";

export const ChatRequestSchema = z.object({
  message: z.string().min(1, "Message is required").max(2000),
  sessionId: z.string().optional(),
});

export const PrepareRequestSchema = z.object({
  recipient: z.string().min(1, "Recipient address or ENS is required"),
  amount: z.string().min(1, "Amount is required"),
  network: z.enum(["sepolia", "mainnet", "holesky"]).default("sepolia"),
});

export const SignRequestSchema = z.object({
  txHash: z.string().min(1, "Transaction hash is required"),
  recipient: z.string().min(1),
  amount: z.string().min(1),
  network: z.enum(["sepolia", "mainnet", "holesky"]).default("sepolia"),
  data: z.string().optional(),
});

export const BroadcastRequestSchema = z.object({
  signedTx: z.string().min(1, "Signed transaction hex is required"),
  network: z.enum(["sepolia", "mainnet", "holesky"]).default("sepolia"),
});

export const AddressRequestSchema = z.object({
  network: z.enum(["sepolia", "mainnet", "holesky"]).default("sepolia"),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type PrepareRequest = z.infer<typeof PrepareRequestSchema>;
export type SignRequest = z.infer<typeof SignRequestSchema>;
export type BroadcastRequest = z.infer<typeof BroadcastRequestSchema>;
export type AddressRequest = z.infer<typeof AddressRequestSchema>;

export interface TransactionSummary {
  recipient: string;
  amount: string;
  amountWei: string;
  network: string;
  gasEstimate: string | null;
  nonce: number | null;
  data: string;
  status: "preparing" | "awaiting_ledger" | "signed" | "broadcast" | "confirmed" | "failed";
  txHash?: string;
  signedTx?: string;
}