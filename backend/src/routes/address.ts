/**
 * GET /api/address
 *
 * Returns the Ethereum address from the connected Ledger device.
 */

import { Router, Request, Response } from "express";
import { connectDevice, getAddress } from "../../../lib/ledger/dmk.js";

export const addressRouter = Router();

addressRouter.get("/address", async (req: Request, res: Response) => {
  try {
    const derivationPath =
      (req.query.derivationPath as string) || "m/44'/60'/0'/0/0";

    const { eth } = await connectDevice();
    const result = await getAddress(eth, derivationPath);

    res.json({
      success: true,
      data: {
        address: result.address,
        derivationPath: result.derivationPath,
        source: "ledger",
      },
    });
  } catch (error) {
    console.error("[Address] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get Ledger address. Ensure device is connected and Ethereum app is open.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});