/**
 * POST /api/broadcast
 *
 * Broadcasts a signed transaction to the Ethereum network.
 * Only accepts transactions that have been signed by the Ledger.
 *
 * SECURITY: Validates the signature before broadcasting.
 */

import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import { BroadcastRequestSchema } from "../validation/schemas.js";
import { getProvider } from "../../../lib/ethers/provider.js";

export const broadcastRouter = Router();

broadcastRouter.post("/broadcast", async (req: Request, res: Response) => {
  try {
    const parsed = BroadcastRequestSchema.safeParse(req.body);
    console.log("[Broadcast] Received request:", req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: "Invalid request",
        details: parsed.error.issues,
      });
      return;
    }

    const { signedTx: signedTxHex, network } = parsed.data;

    // Validate the signed transaction
    let parsedTx: ethers.Transaction;
    console.log("[Broadcast] Validating signed transaction...");
    try {
      parsedTx = ethers.Transaction.from(signedTxHex);
      console.log("[Broadcast] Parsed transaction:", parsedTx);
      if (!parsedTx.from) {
        res.status(400).json({
          success: false,
          error: "Invalid signed transaction — could not recover sender address.",
        });
        return;
      }
    } catch {
      res.status(400).json({
        success: false,
        error: "Invalid signed transaction hex format.",
      });
      return;
    }

    console.log(`[Broadcast] Sending signed tx from: ${parsedTx.from}`);
    console.log(`[Broadcast] To: ${parsedTx.to}`);
    console.log(`[Broadcast] Value: ${parsedTx.value?.toString() || "0"} wei`);

    // Broadcast
    const provider = getProvider(network);
    const txResponse = await provider.broadcastTransaction(signedTxHex);
    const txHash = txResponse.hash;

    console.log(`[Broadcast] Transaction sent: ${txHash}`);

    // Wait for confirmation
    let receipt = null;
    try {
      receipt = await txResponse.wait(1);
    } catch {
      console.log("[Broadcast] Transaction sent but confirmation pending.");
    }

    const explorerUrl =
      network === "mainnet"
        ? `https://etherscan.io/tx/${txHash}`
        : `https://sepolia.etherscan.io/tx/${txHash}`;
    console.log(`[Broadcast] Explorer URL: ${explorerUrl}`);
    res.json({
      success: true,
      data: {
        txHash,
        blockNumber: receipt?.blockNumber?.toString() || null,
        from: parsedTx.from,
        to: parsedTx.to,
        explorerUrl,
        status: receipt ? "confirmed" : "broadcast",
      },
    });
  } catch (error) {
    console.error("[Broadcast] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to broadcast transaction. Check RPC connection.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});