/**
 * Aegis - Ethers Provider Utilities
 *
 * Provides RPC providers and utility functions for interacting
 * with Ethereum networks (Sepolia, Holesky, Mainnet).
 */

import { ethers } from "ethers";

const RPC_URLS: Record<string, string> = {
  sepolia: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
  holesky: process.env.HOLESKY_RPC_URL || "https://ethereum-holesky-rpc.publicnode.com",
  mainnet: process.env.MAINNET_RPC_URL || "https://eth.llamarpc.com",
};

const providerCache = new Map<string, ethers.JsonRpcProvider>();

/**
 * Get an RPC provider for the specified network
 */
export function getProvider(network: string = "sepolia"): ethers.JsonRpcProvider {
  if (providerCache.has(network)) {
    return providerCache.get(network)!;
  }

  const url = RPC_URLS[network] || RPC_URLS.sepolia;
  const provider = new ethers.JsonRpcProvider(url);
  providerCache.set(network, provider);
  return provider;
}

/**
 * Resolve an ENS name to an Ethereum address
 */
export async function resolveENS(ensName: string): Promise<string | null> {
  try {
    const provider = getProvider("mainnet"); // ENS resolution requires mainnet
    const address = await provider.resolveName(ensName);
    return address;
  } catch (error) {
    console.error(`[ENS] Failed to resolve ${ensName}:`, error);
    return null;
  }
}

/**
 * Lookup ENS name for an address (reverse resolution)
 */
export async function lookupENS(address: string): Promise<string | null> {
  try {
    const provider = getProvider("mainnet");
    const ensName = await provider.lookupAddress(address);
    return ensName;
  } catch {
    return null;
  }
}

/**
 * Get network name from chain ID
 */
export function getNetworkName(chainId: number): string {
  const names: Record<number, string> = {
    1: "mainnet",
    11155111: "sepolia",
    17000: "holesky",
  };
  return names[chainId] || `unknown(${chainId})`;
}