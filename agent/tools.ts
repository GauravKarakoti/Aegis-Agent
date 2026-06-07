/**
 * Aegis - AI Agent Tools
 *
 * Defines the tool repertoire for the Aegis AI agent.
 * Each tool maps to a specific capability used by the LLM function-calling layer.
 *
 * The agent uses these tools autonomously to build transactions,
 * but NEVER has access to signing keys.
 */

import { z } from "zod";

// ─── Tool Parameter Schemas ───────────────────────────────────────────

export const GetLedgerAddressParams = z.object({
  derivationPath: z.string().default("m/44'/60'/0'/0/0"),
});

export const ResolveENSParams = z.object({
  ensName: z.string().describe("ENS name to resolve (e.g., 'vitalik.eth')"),
});

export const BuildTransactionParams = z.object({
  recipient: z.string().describe("Recipient address (0x-prefixed hex)"),
  amount: z.string().describe("Amount in ETH (e.g., '0.005')"),
  network: z.enum(["sepolia", "mainnet", "holesky"]).default("sepolia"),
  data: z.string().optional().describe("Optional calldata hex"),
});

export const EstimateGasParams = z.object({
  from: z.string().describe("Sender address"),
  to: z.string().describe("Recipient address"),
  value: z.string().describe("Value in wei"),
  data: z.string().optional().describe("Calldata hex"),
  network: z.enum(["sepolia", "mainnet", "holesky"]).default("sepolia"),
});

export const RequestLedgerSignatureParams = z.object({
  unsignedTxHex: z.string().describe("Unsigned RLP-encoded transaction hex"),
  derivationPath: z.string().default("m/44'/60'/0'/0/0"),
});

export const BroadcastTransactionParams = z.object({
  signedTxHex: z.string().describe("Signed transaction hex from Ledger"),
  network: z.enum(["sepolia", "mainnet", "holesky"]).default("sepolia"),
});

// ─── Groq Tool Definitions ──────────────────────────────────────────

/**
 * Returns the Groq-compatible tool definitions
 * These are passed to the LLM as function/tool definitions
 */
export function getToolDefinitions() {
  return [
    {
      type: "function" as const,
      function: {
        name: "getLedgerAddress",
        description: "Get the Ethereum address from the connected Ledger device",
        parameters: {
          type: "object",
          properties: {
            derivationPath: {
              type: "string",
              description: "BIP32 derivation path (default: m/44'/60'/0'/0/0)",
              default: "m/44'/60'/0'/0/0",
            },
          },
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "resolveENS",
        description: "Resolve an ENS name to an Ethereum address",
        parameters: {
          type: "object",
          properties: {
            ensName: {
              type: "string",
              description: "ENS name to resolve (e.g., 'vitalik.eth')",
            },
          },
          required: ["ensName"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "buildTransaction",
        description: "Build an unsigned Ethereum transaction",
        parameters: {
          type: "object",
          properties: {
            recipient: {
              type: "string",
              description: "Recipient address (0x-prefixed hex)",
            },
            amount: {
              type: "string",
              description: "Amount in ETH (e.g., '0.005')",
            },
            network: {
              type: "string",
              enum: ["sepolia", "mainnet", "holesky"],
              description: "Network to use",
              default: "sepolia",
            },
            data: {
              type: "string",
              description: "Optional calldata hex",
            },
          },
          required: ["recipient", "amount"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "estimateGas",
        description: "Estimate gas for a transaction",
        parameters: {
          type: "object",
          properties: {
            from: { type: "string" },
            to: { type: "string" },
            value: { type: "string", description: "Value in wei" },
            data: { type: "string" },
            network: {
              type: "string",
              enum: ["sepolia", "mainnet", "holesky"],
              default: "sepolia",
            },
          },
          required: ["from", "to", "value"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "requestLedgerSignature",
        description: "Request transaction signature from Ledger device. User MUST approve on their device.",
        parameters: {
          type: "object",
          properties: {
            unsignedTxHex: {
              type: "string",
              description: "Unsigned RLP-encoded transaction hex",
            },
            derivationPath: {
              type: "string",
              description: "BIP32 derivation path",
              default: "m/44'/60'/0'/0/0",
            },
          },
          required: ["unsignedTxHex"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "broadcastTransaction",
        description: "Broadcast a signed transaction to the network",
        parameters: {
          type: "object",
          properties: {
            signedTxHex: {
              type: "string",
              description: "Signed transaction hex from Ledger",
            },
            network: {
              type: "string",
              enum: ["sepolia", "mainnet", "holesky"],
              default: "sepolia",
            },
          },
          required: ["signedTxHex"],
        },
      },
    },
  ];
}

// ─── Type Exports ─────────────────────────────────────────────────────

export type ToolName =
  | "getLedgerAddress"
  | "resolveENS"
  | "buildTransaction"
  | "estimateGas"
  | "requestLedgerSignature"
  | "broadcastTransaction";

export interface ToolResult {
  success: boolean;
  data: Record<string, unknown>;
  error?: string;
}