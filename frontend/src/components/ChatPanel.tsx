/**
 * Chat Panel Component
 *
 * Left panel of the Aegis interface.
 * Displays the agent chat conversation with
 * natural language input.
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTransactionStore, type ChatMessage } from "@/store/transactionStore";
import { api } from "@/lib/api";
import ReactMarkdown from "react-markdown";

export function ChatPanel() {
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = useTransactionStore((s) => s.messages);
  const addMessage = useTransactionStore((s) => s.addMessage);
  const updateTransaction = useTransactionStore((s) => s.updateTransaction);
  const setLedgerStatus = useTransactionStore((s) => s.setLedgerStatus);
  const setError = useTransactionStore((s) => s.setError);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    api.status().then((res) => {
      if (res.success) {
        setLedgerStatus(res.data.ledger.connected, res.data.ledger.type);
      }
    }).catch(() => {
      // Backend may not be running yet
    });
  }, [setLedgerStatus]);

  const handleSend = async () => {
    const message = input.trim();
    if (!message || isProcessing) return;

    setInput("");
    addMessage("user", message);
    setIsProcessing(true);

    try {
      const response = await api.chat(message);
      addMessage("agent", response.data.reply);

      const txState = response.data.transactionState;
      updateTransaction({
        network: txState.network,
        from: txState.fromAddress || "",
        to: txState.recipient,
        amount: txState.amount,
        gasEstimate: txState.gasEstimate || "",
        nonce: txState.nonce,
        txHash: txState.txHash,
        status: txState.status,
        explorerUrl: txState.txHash
          ? `https://${txState.network === "mainnet" ? "" : txState.network + "."}etherscan.io/tx/${txState.txHash}`
          : null,
        unsignedTxHex: txState.unsignedTxHex,
        signedTxHex: txState.signedTxHex,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to process message";
      addMessage("agent", `Error: ${errorMsg}`);
      setError(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Cpu className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Agent Chat</h2>
          <p className="text-xs text-muted-foreground">
            AI-powered wallet agent
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-sm text-center">
              <Bot className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
              <h3 className="mb-2 text-sm font-medium text-foreground">
                Aegis Wallet Agent
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Send a natural language instruction like:
              </p>
              <div className="mt-3 space-y-1.5">
                <code className="block rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                  Send 0.005 ETH to vitalik.eth
                </code>
                <code className="block rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                  Transfer 0.01 ETH to 0xd8dA6BF...
                </code>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}

        {isProcessing && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your instruction..."
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none ring-0 transition-colors focus:border-primary/50 focus:bg-secondary"
              disabled={isProcessing}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "mb-3 flex animate-fade-in",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "flex max-w-[85%] gap-2",
          isUser ? "flex-row-reverse" : "flex-row"
        )}
      >
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
            isUser ? "bg-blue-500/20" : "bg-primary/10"
          )}
        >
          {isUser ? (
            <User className="h-3.5 w-3.5 text-blue-400" />
          ) : (
            <Bot className="h-3.5 w-3.5 text-primary" />
          )}
        </div>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-blue-500/10 text-foreground"
              : "glass text-foreground",
            // Add the "prose" class here if you installed @tailwindcss/typography
            "prose prose-sm dark:prose-invert max-w-none" 
          )}
        >
          {/* Replace plain text rendering with ReactMarkdown */}
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="mb-3 flex animate-fade-in justify-start">
      <div className="flex gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="glass flex items-center gap-1 rounded-2xl px-4 py-3">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </div>
  );
}