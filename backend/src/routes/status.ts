/**
 * GET /api/status
 *
 * Returns the current transaction and device status.
 */

import { Router, Request, Response } from "express";
import { getConnectedDevices } from "../../../lib/ledger/cli.js";
import { connectDevice } from "../../../lib/ledger/dmk.js";

export const statusRouter = Router();

statusRouter.get("/status", async (_req: Request, res: Response) => {
  try {
    let ledgerConnected = false;
    let ledgerType = "none";
    let dmk: any = null; // Hold reference

    try {
      dmk = await connectDevice();
      ledgerConnected = true;
      ledgerType = process.env.SPECULOS_HOST ? "speculos" : "hardware";
    } catch {
      // DMK not connected, try CLI as fallback
      const devices = await getConnectedDevices();
      if (devices.length > 0) {
        ledgerConnected = true;
        ledgerType = devices[0].type;
      }
    } finally {
      // CRITICAL: Close the transport so the device isn't locked!
      if (dmk && dmk.eth && dmk.eth.transport) {
        await dmk.eth.transport.close();
      }
    }

    res.json({
      success: true,
      data: {
        server: "running",
        network: process.env.DEFAULT_NETWORK || "sepolia",
        ledger: {
          connected: ledgerConnected,
          type: ledgerType,
        },
        mode: process.env.SPECULOS_HOST ? "speculos" : "hardware",
        maxDailyEth: process.env.MAX_DAILY_ETH || "0.01",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[Status] Error:", error);
    res.json({
      success: true,
      data: {
        server: "running",
        network: process.env.DEFAULT_NETWORK || "sepolia",
        ledger: {
          connected: false,
          type: "none",
        },
        mode: process.env.SPECULOS_HOST ? "speculos" : "hardware",
        maxDailyEth: process.env.MAX_DAILY_ETH || "0.01",
        timestamp: new Date().toISOString(),
      },
    });
  }
});