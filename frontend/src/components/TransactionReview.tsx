/**
 * Transaction Review Card Component
 *
 * Right panel of the Aegis interface.
 * Displays the transaction details and allows the user
 * to control the signing/broadcast flow.
 */

"use client";

import { useState } from "react";
import {
  ExternalLink,
  ArrowRight,
  Wallet,
  Network,
  GasPump,
  Shield,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn, shortenAddress } from "@/lib/utils";
import { useTransactionStore } from "@/store/transactionStore";
import { StatusBadge } from "./StatusBadge";
import { api } from "@/lib/api";

export function TransactionReview() {
  const [isSigning, setIsSigning] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const transaction = useTransactionStore((s) => s.transaction);
  const updateTransaction = useTransactionStore((s) => s.updateTransaction);
  const resetTransaction = useTransactionStore((s) => s.resetTransaction);
  const addMessage = useTransactionStore((s) => s.addMessage);
  const setError = useTransactionStore((s) => s.setError);
  const setLedgerStatus = useTransactionStore((s) => s.setLedgerStatus);

  const isPrepared = transaction.status !== "idle";
  const isAwaitingLedger = transaction.status === "awaiting_ledger";
  const isSigned = transaction.status === "signed";
  const canPrepare = transaction.status === "idle";
  const canSign = transaction.status === "preparing" || isPrepared;
  const canBroadcast = isSigned;
  const isTerminal =
    transaction.status === "confirmed" || transaction.status === "failed";

  const handlePrepare = async () => {
    if (!transaction.to || !transaction.amount) {
      addMessage(
        "agent",
        "No transaction to prepare. Use the chat to specify a transfer first."
      );
      return;
    }

    try {
      addMessage("agent", "Preparing transaction...");
      const response = await api.prepare(
        transaction.to,
        transaction.amount,
        transaction.network
      );
      updateTransaction({
        unsignedTxHex: response.data.unsignedTxHex,
        gasEstimate: response.data.summary.gasEstimate,
        nonce: response.data.summary.nonce,
        from: response.data.summary.from,
        status: "awaiting_ledger",
      });
      addMessage(
        "agent",
        `Transaction prepared. Review the details on the right and click "Request Ledger Signature" to approve.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Prepare failed";
      setError(msg);
      addMessage("agent", `Error preparing transaction: ${msg}`);
    }
  };

  const handleSign = async () => {
    if (!transaction.unsignedTxHex) {
      setError("No unsigned transaction to sign. Click Prepare first.");
      return;
    }

    setIsSigning(true);
    try {
      addMessage(
        "agent",
        "Requesting Ledger signature. Please approve the transaction on your Ledger device..."
      );
      updateTransaction({ status: "awaiting_ledger" });

      const response = await api.sign(
        transaction.unsignedTxHex,
        transaction.to,
        transaction.amount,
        transaction.network
      );
      updateTransaction({
        signedTxHex: response.data.signedTx,
        status: "signed",
      });
      addMessage(
        "agent",
        "Transaction signed by Ledger! Ready to broadcast."
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Signing failed";
      setError(msg);
      updateTransaction({ status: "failed" });
      addMessage(
        "agent",
        `Ledger signing failed: ${msg}. Ensure your device is connected.`
      );
    } finally {
      setIsSigning(false);
    }
  };

  const handleBroadcast = async () => {
    if (!transaction.signedTxHex) {
      setError("No signed transaction to broadcast.");
      return;
    }

    setIsBroadcasting(true);
    try {
      addMessage("agent", "Broadcasting transaction to the network...");
      const response = await api.broadcast(
        transaction.signedTxHex,
        transaction.network
      );
      updateTransaction({
        txHash: response.data.txHash,
        status: response.data.status as "broadcast" | "confirmed",
        explorerUrl: response.data.explorerUrl,
      });
      addMessage(
        "agent",
        `Transaction broadcast! View on explorer: ${response.data.explorerUrl}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Broadcast failed";
      setError(msg);
      updateTransaction({ status: "failed" });
      addMessage("agent", `Broadcast failed: ${msg}`);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleCheckStatus = async () => {
    try {
      const res = await api.status();
      setLedgerStatus(res.data.ledger.connected, res.data.ledger.type);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
            <Shield className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Transaction Review
            </h2>
            <p className="text-xs text-muted-foreground">
              {transaction.status === "idle"
                ? "No active transaction"
                : `${transaction.network} · ${transaction.status}`}
            </p>
          </div>
        </div>
        <button
          onClick={handleCheckStatus}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          title="Check connection status"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {transaction.status === "idle" ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-sm text-center">
              <ArrowRight className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
              <h3 className="mb-2 text-sm font-medium text-foreground">
                No Transaction
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Type a transfer instruction in the chat panel to create a
                transaction. You can use ENS names like{" "}
                <code className="text-foreground">vitalik.eth</code>.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-4 py-3">
              <span className="text-xs font-medium text-muted-foreground">
                Status
              </span>
              <StatusBadge status={transaction.status} />
            </div>

            {/* Network */}
            <DetailRow
              icon={<Network className="h-4 w-4" />}
              label="Network"
              value={
                transaction.network.charAt(0).toUpperCase() +
                transaction.network.slice(1)
              }
            />

            {/* From */}
            <DetailRow
              icon={<Wallet className="h-4 w-4" />}
              label="From"
              value={
                transaction.from
                  ? shortenAddress(transaction.from)
                  : "Connect Ledger"
              }
            />

            {/* To */}
            <DetailRow
              icon={<ArrowRight className="h-4 w-4" />}
              label="To"
              value={shortenAddress(transaction.to)}
              mono
            />

            {/* Amount */}
            <DetailRow
              icon={<Wallet className="h-4 w-4" />}
              label="Amount"
              value={`${transaction.amount} ETH`}
            />

            {/* Gas */}
            <DetailRow
              icon={<GasPump className="h-4 w-4" />}
              label="Gas Estimate"
              value={
                transaction.gasEstimate
                  ? `${transaction.gasEstimate} units`
                  : "Not estimated"
              }
            />

            {/* Nonce */}
            <DetailRow
              icon={<span className="text-xs font-mono">#</span>}
              label="Nonce"
              value={transaction.nonce?.toString() ?? "—"}
            />

            {/* Transaction Hash (after broadcast) */}
            {transaction.txHash && (
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="text-xs font-medium text-green-400">
                    Transaction Hash
                  </span>
                </div>
                <p className="mt-1 text-xs font-mono text-muted-foreground break-all">
                  {transaction.txHash}
                </p>
              </div>
            )}

            {/* Explorer Link */}
            {transaction.explorerUrl && (
              <a
                href={transaction.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View on Etherscan
              </a>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-border px-6 py-4">
        {!isTerminal && (
          <div className="space-y-2">
            <button
              onClick={handlePrepare}
              disabled={!canPrepare || isSigning || isBroadcasting}
              className={cn(
                "w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                canPrepare
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "bg-secondary text-muted-foreground cursor-not-allowed"
              )}
            >
              Prepare Transaction
            </button>

            <button
              onClick={handleSign}
              disabled={!canSign || isSigning || isBroadcasting}
              className={cn(
                "w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                canSign && !isSigned
                  ? "border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                  : isSigned
                    ? "bg-green-500/10 text-green-400 border border-green-500/20 cursor-not-allowed"
                    : "bg-secondary text-muted-foreground cursor-not-allowed"
              )}
            >
              {isSigning ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Waiting for Ledger...
                </span>
              ) : isSigned ? (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Signed by Ledger
                </span>
              ) : (
                "Request Ledger Signature"
              )}
            </button>

            <button
              onClick={handleBroadcast}
              disabled={!canBroadcast || isBroadcasting}
              className={cn(
                "w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                canBroadcast
                  ? "bg-green-500 text-white hover:bg-green-600"
                  : "bg-secondary text-muted-foreground cursor-not-allowed"
              )}
            >
              {isBroadcasting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Broadcasting...
                </span>
              ) : (
                "Broadcast Transaction"
              )}
            </button>
          </div>
        )}

        {isTerminal && (
          <div className="space-y-2">
            {transaction.status === "confirmed" && (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                Transaction Confirmed
              </div>
            )}
            {transaction.status === "failed" && (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <XCircle className="h-4 w-4" />
                Transaction Failed
              </div>
            )}
            <button
              onClick={resetTransaction}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-secondary/30 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span
        className={cn(
          "text-xs font-medium text-foreground",
          mono && "font-mono"
        )}
      >
        {value}
      </span>
    </div>
  );
}