/**
 * Aegis - Ledger Wallet CLI Wrapper
 *
 * Provides a fallback / alternative integration using the Ledger Wallet CLI
 * via child_process. Used when DMK is unavailable or as a parallel signing path.
 *
 * SECURITY: Only invokes the CLI binary. Never handles private keys.
 */

import { execSync, exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const CLI_BINARY = process.env.LEDGER_CLI_PATH || "ledger-wallet";
const CLI_TIMEOUT = parseInt(process.env.LEDGER_CLI_TIMEOUT || "120000", 10);

interface CliDeviceInfo {
  id: string;
  name: string;
  type: "nano_s" | "nano_x" | "nano_sp" | "stax" | "speculos";
}

/**
 * Get list of connected Ledger devices
 */
export async function getConnectedDevices(): Promise<CliDeviceInfo[]> {
  try {
    const { stdout } = await execAsync(`${CLI_BINARY} list`, { timeout: 10000 });
    const devices: CliDeviceInfo[] = [];

    for (const line of stdout.trim().split("\n")) {
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        devices.push({
          id: parts[0],
          name: parts.slice(1).join(" "),
          type: inferDeviceType(parts[0], parts[1]),
        });
      }
    }

    return devices;
  } catch (error) {
    console.warn("[CLI] Failed to list devices:", error);
    return [];
  }
}

function inferDeviceType(id: string, name: string): CliDeviceInfo["type"] {
  const lower = `${id} ${name}`.toLowerCase();
  if (lower.includes("speculos")) return "speculos";
  if (lower.includes("stax")) return "stax";
  if (lower.includes("nano x")) return "nano_x";
  if (lower.includes("nano sp") || lower.includes("nano s plus")) return "nano_sp";
  return "nano_s";
}

/**
 * Sign a transaction via the Ledger Wallet CLI
 * Pushes the unsigned transaction to the Ledger for user approval
 *
 * @param txHex - Unsigned RLP-encoded transaction hex
 * @param derivationPath - BIP32 derivation path
 * @returns Signed transaction hex
 */
export async function signTxViaCLI(
  txHex: string,
  derivationPath: string = "m/44'/60'/0'/0/0"
): Promise<{ signedTx: string }> {
  const command = `${CLI_BINARY} sign --path "${derivationPath}" --tx "${txHex}"`;

  console.log("[CLI] Requesting signature via Ledger Wallet CLI...");
  console.log("[CLI] Awaiting user approval on Ledger device...");

  try {
    const { stdout } = await execAsync(command, { timeout: CLI_TIMEOUT });

    const signedTx = stdout.trim();
    if (!signedTx.startsWith("0x")) {
      throw new Error("CLI did not return a valid signed transaction");
    }

    console.log("[CLI] Transaction signed successfully.");
    return { signedTx };
  } catch (error) {
    // Re-throw with a clearer message
    throw new Error(
      `Ledger CLI signing failed: ${error instanceof Error ? error.message : "Unknown error"}. ` +
      "Ensure your Ledger device is connected and the Ethereum app is open."
    );
  }
}

/**
 * Broadcast a signed transaction via the CLI
 * @param signedTx - The fully signed transaction hex
 * @returns Transaction hash
 */
export async function broadcastSignedTx(signedTx: string): Promise<{ txHash: string }> {
  const command = `${CLI_BINARY} broadcast --tx "${signedTx}"`;

  console.log("[CLI] Broadcasting signed transaction...");

  try {
    const { stdout } = await execAsync(command, { timeout: 30000 });
    const txHash = stdout.trim();

    if (!txHash.startsWith("0x")) {
      throw new Error("CLI did not return a valid transaction hash");
    }

    console.log(`[CLI] Transaction broadcast: ${txHash}`);
    return { txHash };
  } catch (error) {
    throw new Error(
      `Broadcast failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Execute a sync CLI command (blocking)
 * Used for simple queries that need immediate results
 */
export function cliQuery(command: string): string {
  try {
    return execSync(`${CLI_BINARY} ${command}`, {
      timeout: 15000,
      encoding: "utf-8",
    }).trim();
  } catch (error) {
    throw new Error(
      `CLI query failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}