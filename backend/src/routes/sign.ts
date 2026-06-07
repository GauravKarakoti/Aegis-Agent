/**
 * POST /api/sign
 *
 * Signs a transaction using the connected Ledger device.
 * The user MUST approve the transaction on their Ledger.
 *
 * SECURITY: The server never has access to private keys.
 * Signing is performed entirely on the Ledger device.
 */

import { Router, Request, Response } from "express";
import { SignRequestSchema } from "../validation/schemas.js";
import { connectDevice, signTransaction } from "../../../lib/ledger/dmk.js";

export const signRouter = Router();

signRouter.post("/sign", async (req: Request, res: Response) => {
  let ethApp: any = null;

  try {
    const parsed = SignRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: "Invalid request",
        details: parsed.error.issues,
      });
      return;
    }

    const unsignedTxHex = parsed.data.txHash;
    const derivationPathStr = "m/44'/60'/0'/0/0";

    console.log("[Sign] Requesting Ledger signature...");
    console.log("[Sign] User MUST review and approve on Ledger device.");
    console.log(`[Sign] Unsigned tx: ${unsignedTxHex.substring(0, 20)}...`);

    const { eth } = await connectDevice();
    ethApp = eth; // Save reference
    
    const { signedTx } = await signTransaction(unsignedTxHex, derivationPathStr, eth);

    res.json({
      success: true,
      data: {
        signedTx,
        status: "signed",
        message: "Transaction signed by Ledger. Ready to broadcast.",
        warning: "Verify the signed transaction details match your intent before broadcasting.",
      },
    });
  } catch (error) {
    console.error("[Sign] Error:", error);
    res.status(500).json({
      success: false,
      error: "Ledger signing failed. Is your device connected and the Ethereum app open?",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    // CRITICAL: Always close the transport after signing is complete or fails
    if (ethApp && ethApp.transport) {
      await ethApp.transport.close();
    }
  }
});