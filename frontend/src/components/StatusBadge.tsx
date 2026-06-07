/**
 * Status Badge Component
 *
 * Displays the current transaction status with
 * appropriate color coding.
 */

import { cn } from "@/lib/utils";
import type { TransactionStatus } from "@/store/transactionStore";

interface StatusBadgeProps {
  status: TransactionStatus;
  className?: string;
}

const statusConfig: Record<
  TransactionStatus,
  { label: string; color: string; dotColor: string }
> = {
  idle: {
    label: "Idle",
    color: "bg-muted text-muted-foreground border-muted",
    dotColor: "bg-muted-foreground",
  },
  preparing: {
    label: "Preparing",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    dotColor: "bg-blue-400",
  },
  awaiting_ledger: {
    label: "Awaiting Ledger",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    dotColor: "bg-amber-400",
  },
  signed: {
    label: "Signed",
    color: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    dotColor: "bg-violet-400",
  },
  broadcast: {
    label: "Broadcast",
    color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    dotColor: "bg-cyan-400",
  },
  confirmed: {
    label: "Confirmed",
    color: "bg-green-500/10 text-green-400 border-green-500/20",
    dotColor: "bg-green-400",
  },
  failed: {
    label: "Failed",
    color: "bg-red-500/10 text-red-400 border-red-500/20",
    dotColor: "bg-red-400",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
        config.color,
        className
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", config.dotColor)}
      />
      {config.label}
    </div>
  );
}