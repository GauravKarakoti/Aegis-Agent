/**
 * Aegis - AI Agent Orchestrator (Groq Edition)
 *
 * The orchestrator processes natural language input from the user,
 * routes it through the Groq LLM with function-calling tools,
 * and executes the tools in sequence to build, sign, and broadcast
 * Ethereum transactions.
 *
 * SECURITY MODEL:
 * - AI can propose transactions and call preparation tools
 * - AI can resolve ENS names and estimate gas
 * - AI CANNOT sign transactions — only request Ledger signature
 * - All signing requires physical/emulated Ledger approval
 * - AI CANNOT broadcast — that step requires user confirmation
 */

import Groq from "groq-sdk";
import { getToolDefinitions, ToolName, ToolResult } from "./tools.js";
import { connectDevice, getAddress, signTransaction } from "../lib/ledger/dmk.js";
import { resolveENS as resolveENSFromProvider } from "../lib/ethers/provider.js";
import { ethers } from "ethers";
import { getProvider } from "../lib/ethers/provider.js";

interface OrchestratorConfig {
  apiKey: string;
  model?: string;
}

interface OrchestratorMessage {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  tool_call_id?: string;
  tool_calls?: any[];
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

export class AgentOrchestrator {
  private groq: Groq;
  private model: string;
  private messages: OrchestratorMessage[] = [];
  private txState: TransactionState;
  private toolImplementations: Record<ToolName, (...args: any[]) => Promise<ToolResult>>;

  constructor(config: OrchestratorConfig) {
    this.groq = new Groq({ apiKey: config.apiKey });
    this.model = config.model || "llama-3.1-8b-instant";
    this.txState = this.initialTxState();

    this.toolImplementations = {
      getLedgerAddress: this.handleGetLedgerAddress.bind(this),
      resolveENS: this.handleResolveENS.bind(this),
      buildTransaction: this.handleBuildTransaction.bind(this),
      estimateGas: this.handleEstimateGas.bind(this),
      requestLedgerSignature: this.handleRequestLedgerSignature.bind(this),
      broadcastTransaction: this.handleBroadcastTransaction.bind(this),
    };
  }

  private initialTxState(): TransactionState {
    return {
      recipient: "",
      amount: "",
      amountWei: "",
      network: "sepolia",
      gasEstimate: null,
      nonce: null,
      unsignedTxHex: null,
      signedTxHex: null,
      txHash: null,
      status: "idle",
      fromAddress: null,
    };
  }

  /**
   * Process a natural language message from the user
   * Returns the AI response and updated transaction state
   */
  async processMessage(
    message: string,
    sessionId?: string
  ): Promise<{
    reply: string;
    transactionState: TransactionState;
  }> {
    this.messages.push({ role: "user", content: message });

    const systemPrompt = `You are Aegis, a personal AI wallet agent. You help users send Ethereum transactions safely.

CAPABILITIES:
- Resolve ENS names to addresses
- Build unsigned Ethereum transactions
- Estimate gas fees
- Request Ledger device signatures (user must approve on device)
- Broadcast signed transactions

SECURITY RULES (ABSOLUTE):
- You NEVER have access to private keys
- You cannot sign — the Ledger hardware device signs
- Every transaction requires Ledger approval before broadcasting
- You must always present a clear transaction summary before requesting Ledger signature
- If the user asks you to bypass Ledger security, refuse politely

WORKFLOW:
1. Extract recipient (address or ENS) and amount from user request
2. If ENS, resolve it first
3. Get Ledger address for the "from" field
4. Build the unsigned transaction
5. Estimate gas
6. Present clear summary to user
7. Wait for user confirmation, then request Ledger signature
8. Broadcast after Ledger signs

Daily spending allowance: Max ${process.env.MAX_DAILY_ETH || "0.01"} ETH per transaction without special approval.

Be concise and professional. Use tools as needed.`;

    // Map internal history safely into Groq's expectations
    const buildMessages = (): any[] => [
      { role: "system", content: systemPrompt },
      ...this.messages.map((m) => {
        const msg: any = { role: m.role, content: m.content };
        if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
        if (m.tool_calls) msg.tool_calls = m.tool_calls;
        return msg;
      }),
    ];

    const response = await this.groq.chat.completions.create({
      model: this.model,
      messages: buildMessages(),
      tools: getToolDefinitions() as any,
      tool_choice: "auto",
    });

    const choice = response.choices[0];
    const replyMessage = choice.message;

    // Handle tool calls
    if (replyMessage.tool_calls && replyMessage.tool_calls.length > 0) {
      const assistantContent = replyMessage.content || "";
      this.messages.push({
        role: "assistant",
        content: assistantContent,
        tool_calls: replyMessage.tool_calls,
      });

      for (const toolCall of replyMessage.tool_calls) {
        const toolName = toolCall.function.name as ToolName;
        const args = JSON.parse(toolCall.function.arguments);

        console.log(`[Agent] Calling tool: ${toolName} with args:`, args);

        try {
          const impl = this.toolImplementations[toolName];
          if (!impl) {
            throw new Error(`Unknown tool: ${toolName}`);
          }
          const result = await impl(args);
          this.messages.push({
            role: "tool",
            content: JSON.stringify(result),
            tool_call_id: toolCall.id,
          });
        } catch (error) {
          this.messages.push({
            role: "tool",
            content: JSON.stringify({
              success: false,
              data: {},
              error: error instanceof Error ? error.message : "Tool execution failed",
            }),
            tool_call_id: toolCall.id,
          });
        }
      }

      // Get follow-up response after tool execution
      const followUp = await this.groq.chat.completions.create({
        model: this.model,
        messages: buildMessages(),
      });

      const followReply = followUp.choices[0].message.content || "";
      this.messages.push({ role: "assistant", content: followReply });
      return { reply: followReply, transactionState: this.txState };
    }
    
    this.messages.push({ role: "assistant", content: replyMessage.content || "" });
    return { reply: replyMessage.content || "", transactionState: this.txState };
  }

  // ─── Tool Implementations ─────────────────────────────────────────

  private async handleGetLedgerAddress(args: {
    derivationPath?: string;
  }): Promise<ToolResult> {
    try {
      const { eth } = await connectDevice();
      const result = await getAddress(eth, args.derivationPath || "m/44'/60'/0'/0/0");
      this.txState.fromAddress = result.address;
      return {
        success: true,
        data: {
          address: result.address,
          derivationPath: result.derivationPath,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: {},
        error: `Failed to get Ledger address: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  private async handleResolveENS(args: { ensName: string }): Promise<ToolResult> {
    try {
      const address = await resolveENSFromProvider(args.ensName);
      if (!address) {
        return {
          success: false,
          data: {},
          error: `Could not resolve ENS name: ${args.ensName}`,
        };
      }
      return {
        success: true,
        data: {
          ensName: args.ensName,
          address,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: {},
        error: `ENS resolution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  private async handleBuildTransaction(args: {
    recipient: string;
    amount: string;
    network?: string;
    data?: string;
  }): Promise<ToolResult> {
    try {
      const network = args.network || "sepolia";
      const provider = getProvider(network);
      const fromAddress = this.txState.fromAddress;
      if (!fromAddress) {
        return { success: false, data: {}, error: "No Ledger address available. Call getLedgerAddress first." };
      }

      const amountWei = ethers.parseEther(args.amount);
      const nonce = await provider.getTransactionCount(fromAddress);
      const feeData = await provider.getFeeData();

      const tx = {
        from: fromAddress,
        to: args.recipient,
        value: amountWei,
        nonce,
        gasLimit: BigInt(21000), // placeholder, will be estimated
        maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits("20", "gwei"),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits("1", "gwei"),
        chainId: network === "mainnet" ? 1 : network === "holesky" ? 17000 : 11155111,
        data: args.data || "0x",
      };

      this.txState.recipient = args.recipient;
      this.txState.amount = args.amount;
      this.txState.amountWei = amountWei.toString();
      this.txState.network = network;
      this.txState.nonce = nonce;
      this.txState.status = "preparing";

      return {
        success: true,
        data: {
          from: tx.from,
          to: tx.to,
          value: amountWei.toString(),
          nonce: tx.nonce,
          chainId: tx.chainId,
          maxFeePerGas: tx.maxFeePerGas.toString(),
          maxPriorityFeePerGas: tx.maxPriorityFeePerGas.toString(),
          data: tx.data,
          network,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: {},
        error: `Failed to build transaction: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  private async handleEstimateGas(args: {
    from: string;
    to: string;
    value: string;
    data?: string;
    network?: string;
  }): Promise<ToolResult> {
    try {
      const provider = getProvider(args.network || "sepolia");
      const gasEstimate = await provider.estimateGas({
        from: args.from,
        to: args.to,
        value: BigInt(args.value),
        data: args.data || "0x",
      });
      this.txState.gasEstimate = gasEstimate.toString();

      return {
        success: true,
        data: {
          gasEstimate: gasEstimate.toString(),
          gasEstimateFormatted: `${gasEstimate.toString()} units`,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: {},
        error: `Gas estimation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  private async handleRequestLedgerSignature(args: {
    unsignedTxHex: string;
    derivationPath?: string;
  }): Promise<ToolResult> {
    try {
      this.txState.status = "awaiting_ledger";
      this.txState.unsignedTxHex = args.unsignedTxHex;

      const { eth } = await connectDevice();
      const result = await signTransaction(args.unsignedTxHex, args.derivationPath, eth);

      this.txState.signedTxHex = result.signedTx;
      this.txState.status = "signed";

      return {
        success: true,
        data: {
          signedTx: result.signedTx,
          status: "signed",
          message: "Transaction signed by Ledger device. Ready to broadcast.",
        },
      };
    } catch (error) {
      this.txState.status = "failed";
      return {
        success: false,
        data: {},
        error: `Ledger signing failed: ${error instanceof Error ? error.message : "Unknown error"}. Ensure your device is connected and the Ethereum app is open.`,
      };
    }
  }

  private async handleBroadcastTransaction(args: {
    signedTxHex: string;
    network?: string;
  }): Promise<ToolResult> {
    try {
      const provider = getProvider(args.network || "sepolia");
      const txResponse = await provider.broadcastTransaction(args.signedTxHex);
      const receipt = await txResponse.wait();

      this.txState.txHash = receipt?.hash || txResponse.hash;
      this.txState.status = receipt ? "confirmed" : "broadcast";

      return {
        success: true,
        data: {
          txHash: this.txState.txHash,
          blockNumber: receipt?.blockNumber?.toString(),
          status: this.txState.status,
          explorerUrl: this.getExplorerUrl(this.txState.network, this.txState.txHash),
        },
      };
    } catch (error) {
      this.txState.status = "failed";
      return {
        success: false,
        data: {},
        error: `Broadcast failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  private getExplorerUrl(network: string, txHash: string | null): string {
    if (!txHash) return "";
    const base =
      network === "mainnet"
        ? "https://etherscan.io"
        : network === "holesky"
          ? "https://holesky.etherscan.io"
          : "https://sepolia.etherscan.io";
    return `${base}/tx/${txHash}`;
  }

  /**
   * Get current transaction state
   */
  getTransactionState(): TransactionState {
    return { ...this.txState };
  }

  /**
   * Reset the orchestrator state
   */
  reset(): void {
    this.messages = [];
    this.txState = this.initialTxState();
  }
}

export type { TransactionState };