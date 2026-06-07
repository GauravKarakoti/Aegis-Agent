import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortenAddress(address: string, chars = 6): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-4)}`;
}

export function formatExplorerUrl(
  network: string,
  hash: string,
  type: "tx" | "address" = "tx"
): string {
  const base =
    network === "mainnet"
      ? "https://etherscan.io"
      : "https://sepolia.etherscan.io";
  return `${base}/${type}/${hash}`;
}