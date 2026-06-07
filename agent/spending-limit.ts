/**
 * Aegis — Daily Spending Allowance
 *
 * BONUS FEATURE 1
 *
 * Tracks daily ETH spending and enforces a configurable limit.
 * The agent can prepare transactions below the allowance automatically,
 * but Ledger signature is ALWAYS required regardless of amount.
 *
 * This prevents catastrophic loss while maintaining hardware security.
 */

import { ethers } from "ethers";

interface SpendingRecord {
  date: string; // YYYY-MM-DD
  totalSpentWei: bigint;
  transactions: Array<{
    to: string;
    amountWei: string;
    timestamp: number;
    txHash: string;
  }>;
}

const MAX_DAILY_ETH = process.env.MAX_DAILY_ETH || "0.01";

// In-memory spending records. In production, persist to a database.
const spendingRecords = new Map<string, SpendingRecord>();

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Get the max daily ETH allowance in wei
 */
export function getMaxDailyWei(): bigint {
  return ethers.parseEther(MAX_DAILY_ETH);
}

/**
 * Get today's spending record
 */
export function getTodayRecord(): SpendingRecord {
  const today = getTodayKey();
  if (!spendingRecords.has(today)) {
    spendingRecords.set(today, {
      date: today,
      totalSpentWei: BigInt(0),
      transactions: [],
    });
  }
  return spendingRecords.get(today)!;
}

/**
 * Check if a proposed transaction amount is within the daily allowance
 *
 * @param amountWei - The proposed transaction amount in wei
 * @returns Object indicating if within limit and remaining allowance
 */
export function checkSpendingAllowance(
  amountWei: bigint
): { allowed: boolean; remainingWei: bigint; maxWei: bigint; message: string } {
  const maxWei = getMaxDailyWei();
  const today = getTodayRecord();
  const totalAfter = today.totalSpentWei + amountWei;
  const remaining = maxWei - totalAfter;

  if (totalAfter > maxWei) {
    const remainingMax = maxWei - today.totalSpentWei;
    return {
      allowed: false,
      remainingWei: remainingMax > BigInt(0) ? remainingMax : BigInt(0),
      maxWei,
      message: `Daily spending limit of ${MAX_DAILY_ETH} ETH exceeded. Remaining allowance: ${ethers.formatEther(remainingMax > BigInt(0) ? remainingMax : BigInt(0))} ETH. Ledger approval required regardless.`,
    };
  }

  return {
    allowed: true,
    remainingWei: remaining,
    maxWei,
    message: `Transaction within daily allowance. Remaining today: ${ethers.formatEther(remaining)} ETH.`,
  };
}

/**
 * Record a transaction for daily spending tracking
 */
export function recordTransaction(
  to: string,
  amountWei: string,
  txHash: string
): void {
  const today = getTodayRecord();
  today.totalSpentWei += BigInt(amountWei);
  today.transactions.push({
    to,
    amountWei,
    timestamp: Date.now(),
    txHash,
  });
  spendingRecords.set(today.date, today);
}

/**
 * Get spending history for the last N days
 */
export function getSpendingHistory(days: number = 7): SpendingRecord[] {
  const records: SpendingRecord[] = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    records.push(
      spendingRecords.get(key) || {
        date: key,
        totalSpentWei: BigInt(0),
        transactions: [],
      }
    );
  }

  return records;
}