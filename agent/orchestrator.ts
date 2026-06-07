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
    this.model = config.model || "openai/gpt-oss-120b";
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

  async processMessage(
    message: string,
    sessionId?: string
  ): Promise<{
    reply: string;
    transactionState: TransactionState;
  }> {
    this.messages.push({ role: "user", content: message });

    // UPDATE 1: Redefine the system prompt for strict UI handoff
    const systemPrompt = `You are Aegis, a personal AI wallet agent. You help users send Ethereum transactions safely.

CRITICAL RULE: You MUST use the native JSON tool calling API to execute actions. NEVER output raw text tags like <function=name> or <tool_call> in your chat responses. Execute your tools silently in the background.

STRICT WORKFLOW:

PHASE 1: EXTRACTION & PREPARATION
When a user asks to send funds, do not ask for permission to prepare. Immediately and silently use your available tools to:
1. Resolve the recipient's ENS name (if applicable).
2. Fetch the connected hardware wallet sender address.
3. Always make sure if the network is specified, if not default to sepolia. NEVER assume mainnet.
4. Prepare the transaction using buildTransaction to calculate the gas fees and payload.

PHASE 2: UI HANDOFF (CRITICAL)
Once the transaction is successfully prepared via buildTransaction, YOUR JOB IS DONE. 
Present a clean summary to the user (Sender, Receiver, Amount, Gas) and explicitly instruct them: "Please use the Transaction Review panel on the right to sign this transaction with your Ledger device and broadcast it."

DO NOT call the requestLedgerSignature or broadcastTransaction tools yourself. DO NOT ask the user to type "yes" in the chat. The user MUST click the UI buttons for physical security reasons.`;

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
      parallel_tool_calls: false
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
        tools: getToolDefinitions() as any,
        tool_choice: "auto",
        parallel_tool_calls: false,
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
    amount?: string;
    value?: string;
    network?: string;
    data?: string;
  }): Promise<ToolResult> {
    try {
      const network = args.network || "sepolia";
      const provider = getProvider(network);
      const fromAddress = this.txState.fromAddress;
      
      if (!fromAddress) {
        return { success: false, data: {}, error: "No Ledger address found. Call getLedgerAddress first." };
      }

      // Normalize input: handle both 'amount' (ETH) and 'value' (Wei)
      let amountETH = args.amount;
      let amountWei: bigint;

      if (amountETH) {
        amountWei = ethers.parseEther(amountETH);
      } else if (args.value) {
        amountWei = BigInt(args.value);
        amountETH = ethers.formatEther(amountWei);
      } else {
        return { success: false, data: {}, error: "Validation failed: Either 'amount' or 'value' must be provided." };
      }

      const nonce = await provider.getTransactionCount(fromAddress);
      const feeData = await provider.getFeeData();
      
      let gasLimit = BigInt(21000);
      if (this.txState.gasEstimate) {
        gasLimit = BigInt(this.txState.gasEstimate);
      } else {
        gasLimit = await provider.estimateGas({
          from: fromAddress,
          to: args.recipient,
          value: amountWei,
          data: args.data || "0x",
        });
        this.txState.gasEstimate = gasLimit.toString();
      }

      const tx = {
        from: fromAddress,
        to: args.recipient,
        value: amountWei,
        nonce,
        gasLimit,
        maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits("20", "gwei"),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits("1", "gwei"),
        chainId: network === "mainnet" ? 1 : 11155111,
        data: args.data || "0x",
        type: 2,
      };

      const unsignedTx = ethers.Transaction.from(tx);
      this.txState.unsignedTxHex = unsignedTx.unsignedSerialized;
      this.txState.recipient = args.recipient;
      this.txState.amount = amountETH;
      this.txState.amountWei = amountWei.toString();
      this.txState.network = network;
      this.txState.nonce = nonce;
      
      // UPDATE 2: Change status from "preparing" to "awaiting_ledger" 
      // so the UI immediately knows it's ready for the physical sign button
      this.txState.status = "awaiting_ledger";

      return {
        success: true,
        data: {
          from: tx.from,
          to: tx.to,
          value: amountWei.toString(),
          gasLimit: gasLimit.toString(),
          network,
          message: "Transaction prepared. Instruct user to sign via the UI.",
        },
      };
    } catch (error: any) {
      return { success: false, data: {}, error: error.message };
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
    derivationPath?: string;
  }): Promise<ToolResult> {
    try {
      const unsignedTxHex = this.txState.unsignedTxHex;
      
      if (!unsignedTxHex) {
          return { success: false, data: {}, error: "No unsigned transaction found. Call buildTransaction first." };
      }

      this.txState.status = "awaiting_ledger";

      const { eth } = await connectDevice();
      const result = await signTransaction(unsignedTxHex, args.derivationPath, eth);

      this.txState.signedTxHex = result.signedTx;
      this.txState.status = "signed";

      return {
        success: true,
        data: {
          status: "signed",
          message: "Transaction signed by Ledger device. You may now call broadcastTransaction.",
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