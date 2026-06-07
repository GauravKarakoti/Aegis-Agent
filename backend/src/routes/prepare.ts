/**
 * POST /api/prepare
 *
 * Direct transaction preparation endpoint (bypasses AI agent).
 * Builds an unsigned transaction from explicit parameters.
 * Ledger address must be connected first.
 */

import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import { PrepareRequestSchema } from "../validation/schemas.js";
import { connectDevice, getAddress } from "../../../lib/ledger/dmk.js";
import { getProvider, resolveENS } from "../../../lib/ethers/provider.js";

export const prepareRouter = Router();

prepareRouter.post("/prepare", async (req: Request, res: Response) => {
  try {
    const parsed = PrepareRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: "Invalid request",
        details: parsed.error.issues,
      });
      return;
    }

    const { recipient: rawRecipient, amount, network } = parsed.data;

    // Resolve ENS if needed
    let recipient = rawRecipient;
    if (rawRecipient.endsWith(".eth")) {
      const resolved = await resolveENS(rawRecipient);
      if (!resolved) {
        res.status(400).json({
          success: false,
          error: `Could not resolve ENS name: ${rawRecipient}`,
        });
        return;
      }
      recipient = resolved;
    }

    // Validate address
    if (!ethers.isAddress(recipient)) {
      res.status(400).json({
        success: false,
        error: `Invalid recipient address: ${recipient}`,
      });
      return;
    }

    // Get Ledger address
    const { eth } = await connectDevice();
    const fromResult = await getAddress(eth);
    const fromAddress = fromResult.address;

    // Build transaction
    const provider = getProvider(network);
    const amountWei = ethers.parseEther(amount);
    const nonce = await provider.getTransactionCount(fromAddress);
    const feeData = await provider.getFeeData();

    // Estimate gas
    let gasEstimate: bigint;
    try {
      gasEstimate = await provider.estimateGas({
        from: fromAddress,
        to: recipient,
        value: amountWei,
      });
    } catch {
      gasEstimate = BigInt(21000); // fallback for simple ETH transfer
    }

    const tx = {
      to: recipient,
      value: amountWei,
      nonce,
      gasLimit: gasEstimate,
      maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits("20", "gwei"),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits("1", "gwei"),
      chainId: network === "mainnet" ? 1 : network === "holesky" ? 17000 : 11155111,
      data: "0x",
      type: 2 as const, // EIP-1559
    };

    // Serialize unsigned tx
    const unsignedTx = ethers.Transaction.from(tx);
    const unsignedTxHex = unsignedTx.unsignedSerialized;

    res.json({
      success: true,
      data: {
        unsignedTxHex,
        summary: {
          network,
          from: fromAddress,
          to: recipient,
          amount: `${amount} ETH`,
          amountWei: amountWei.toString(),
          gasEstimate: gasEstimate.toString(),
          nonce,
          maxFeePerGas: tx.maxFeePerGas.toString(),
          maxPriorityFeePerGas: tx.maxPriorityFeePerGas.toString(),
          chainId: tx.chainId,
        },
        status: "awaiting_ledger",
      },
    });
  } catch (error) {
    console.error("[Prepare] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to prepare transaction",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});