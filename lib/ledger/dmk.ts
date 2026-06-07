/**
 * Aegis - Ledger Hardware Integration Layer
 *
 * Integrates with Ledger devices using the public Ledger JavaScript libraries:
 * - @ledgerhq/hw-app-eth: Ethereum app bindings (address, signing)
 * - @ledgerhq/hw-transport-node-hid: USB HID transport for physical devices
 * - @ledgerhq/hw-transport-http: TCP transport for Speculos emulator
 *
 * SECURITY: The AI agent NEVER has access to private keys.
 * All signing operations require human approval on the Ledger device.
 *
 * This module provides a DMK-style unified interface over these standard
 * packages so the rest of the application uses a consistent API.
 */

import Eth from "@ledgerhq/hw-app-eth";
import Transport from "@ledgerhq/hw-transport-node-hid";
import SpeculosTransport from "@ledgerhq/hw-transport-node-speculos";

const LEDGER_OPTIONS = {
  useSpeculos: !!process.env.SPECULOS_HOST,
  speculosHost: process.env.SPECULOS_HOST || "127.0.0.1",
  speculosApduPort: parseInt(process.env.SPECULOS_APDU_PORT || "9999", 10),
  timeout: parseInt(process.env.LEDGER_TIMEOUT || "60000", 10),
};

let transportInstance: any = null;
let ethAppInstance: Eth | null = null;
let cachedAddresses: Record<string, string> = {};

/**
 * Initialize and connect to the Ledger device
 * Connects to either a real Ledger device (USB HID) or Speculos emulator (TCP)
 */
export async function connectDevice(): Promise<{ transport: any; eth: Eth }> {
  if (transportInstance && ethAppInstance) {
    return { transport: transportInstance, eth: ethAppInstance };
  }

  let transport;

  if (LEDGER_OPTIONS.useSpeculos) {
    console.log(`[Ledger] Connecting to Speculos TCP on port ${LEDGER_OPTIONS.speculosApduPort}`);
    transport = await SpeculosTransport.open({
      apduPort: LEDGER_OPTIONS.speculosApduPort,
      host: LEDGER_OPTIONS.speculosHost
    });
  } else {
    console.log("[Ledger] Waiting for hardware Ledger device (USB HID)...");
    console.log("[Ledger] Make sure your device is connected and unlocked.");
    transport = await Transport.create();
  }

  const eth = new Eth(transport);

  transportInstance = transport;
  ethAppInstance = eth;

  return { transport, eth };
}

export async function getAddress(
  eth?: Eth,
  derivationPath: string = "m/44'/60'/0'/0/0"
): Promise<{ address: string; derivationPath: string }> {
  
  // 2. Return cached address immediately if it exists (prevents TransportLocked)
  if (cachedAddresses[derivationPath]) {
    return {
      address: cachedAddresses[derivationPath],
      derivationPath,
    };
  }

  const app = eth || (await connectDevice()).eth;
  
  // 3. Pass `false` as the second argument to explicitly bypass the device confirmation prompt.
  // The signature is: getAddress(path, boolDisplay, boolChaincode)
  const result = await app.getAddress(derivationPath, false, false);

  // 4. Save the fetched address to the cache
  cachedAddresses[derivationPath] = result.address;

  return {
    address: result.address,
    derivationPath,
  };
}

/**
 * Sign a transaction using the Ledger device
 * The user MUST review and approve on their Ledger
 *
 * @param unsignedTxHex - Unsigned transaction hex to sign
 * @param derivationPath - BIP32 derivation path
 * @returns Signed transaction hex
 */
export async function signTransaction(
  unsignedTxHex: string,
  derivationPath: string = "m/44'/60'/0'/0/0",
  eth?: Eth
): Promise<{ signedTx: string }> {
  const app = eth || (await connectDevice()).eth;

  console.log("[Ledger] Requesting signature — awaiting Ledger approval...");
  console.log("[Ledger] User MUST review and confirm on their Ledger device.");

  // Strip 0x prefix for signing
  const txHex = unsignedTxHex.startsWith("0x") ? unsignedTxHex.slice(2) : unsignedTxHex;

  const result = await app.signTransaction(
    derivationPath,
    txHex
  );

  const signedTx = "0x" + result.v + result.r + result.s;
  console.log("[Ledger] Transaction signed successfully.");
  return { signedTx };
}

/**
 * Disconnect from the Ledger device
 */
export async function disconnect(): Promise<void> {
  if (transportInstance) {
    try {
      await transportInstance.close();
    } catch (err) {
      console.warn("[Ledger] Error closing transport:", err);
    }
  }
  transportInstance = null;
  ethAppInstance = null;
  console.log("[Ledger] Disconnected.");
}

export { LEDGER_OPTIONS };