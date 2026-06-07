# Aegis — Personal AI Wallet Agent with Hardware-in-the-Loop Review

> **"LLMs provide intelligence. Agents provide action. Hardware provides control."**

Aegis is a production-quality proof-of-concept that demonstrates how AI agents can safely manage Ethereum transactions with hardware-enforced security. The AI proposes transactions, the human reviews them, the Ledger device signs them, and the network broadcasts them — each step is a distinct, auditable layer.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface (Next.js)                │
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │    Agent Chat Panel  │  │    Transaction Review Card   │ │
│  │  "Send 0.005 ETH    │  │  Network │ From │ To │ Amount │ │
│  │   to vitalik.eth"   │  │  Gas     │ Nonce │ Status    │ │
│  └──────────┬───────────┘  └──────────────┬───────────────┘ │
└─────────────┼──────────────────────────────┼─────────────────┘
              │ HTTP REST                    │ HTTP REST
              ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (Express API)                      │
│  /api/chat  /api/prepare  /api/sign  /api/broadcast         │
│  /api/address  /api/status                                  │
│                                                             │
│  ┌─────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  AI     │  │  Ledger DMK  │  │  Ethers Provider     │  │
│  │  Agent  │──│  Integration │  │  (Sepolia RPC)        │  │
│  │(OpenAI) │  │              │  │                       │  │
│  └─────────┘  └──────┬───────┘  └───────────────────────┘  │
└───────────────────────┼─────────────────────────────────────┘
                        │
              ┌─────────▼─────────┐
              │  Ledger Device     │
              │  (Hardware /       │
              │   Speculos)        │
              │                   │
              │  ┌─────────────┐  │
              │  │ Ethereum App│  │
              │  └─────────────┘  │
              └───────────────────┘
```

**Key architectural principle**: The AI agent orchestrates the workflow and builds unsigned transactions, but the *actual signing* happens exclusively on the Ledger device. The AI never touches private keys.

---

## Security Model

```
┌──────────────────────────────────────────────────────────────────┐
│                      SECURITY BOUNDARIES                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────┐    ┌──────────────────────────────┐    │
│  │    AI Agent (LLM)   │    │      Express Backend          │    │
│  │                     │    │                              │    │
│  │  ✓ Parse intent     │    │  ✓ Validate requests         │    │
│  │  ✓ Resolve ENS      │    │  ✓ Build unsigned txs        │    │
│  │  ✓ Build tx params  │    │  ✓ Estimate gas              │    │
│  │  ❌ CANNOT sign     │    │  ❌ CANNOT sign              │    │
│  │  ❌ CANNOT store pk │    │  ❌ CANNOT access keys       │    │
│  └─────────────────────┘    └──────────────────────────────┘    │
│                                      │                          │
│                                      ▼                          │
│                        ┌──────────────────────┐                 │
│                        │   Ledger Device       │                 │
│                        │                      │                 │
│                        │  ✓ Holds private key │                 │
│                        │  ✓ Signs transactions│                 │
│                        │  ✓ Requires human tap │                 │
│                        └──────────────────────┘                 │
│                                                                  │
│  Rule: ALL signing flows through Ledger. No exceptions.          │
│  The AI cannot auto-broadcast unsigned data.                     │
│  The AI cannot skip Ledger approval.                             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Security Rules

1. **The AI never possesses private keys.** Keys live exclusively on the Ledger hardware.
2. **Every transaction requires Ledger approval.** The user must physically confirm on device.
3. **The AI cannot auto-broadcast.** Broadcasting requires user-initiated action through the UI.
4. **Signing occurs on-device.** The unsigned transaction is sent to Ledger; the signed result comes back.
5. **All layers are auditable.** Each step produces clear output that can be verified independently.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui |
| **Backend** | Node.js, TypeScript, Express |
| **Blockchain** | ethers v6, Sepolia testnet |
| **Ledger** | @ledgerhq/dmk, Ledger Wallet CLI, Speculos |
| **AI** | OpenAI SDK (GPT-4o-mini), Function Calling |
| **State** | Zustand |
| **Validation** | Zod |

---

## Repository Structure

```
aegis-agent/
├── README.md                         # This file
├── .env.example                      # Root environment template
├── .env.backend.example              # Backend-specific env template
├── .env.frontend.example             # Frontend-specific env template
├── .gitignore
│
├── backend/                          # Express API server
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                  # Server entry point
│       ├── routes/
│       │   ├── chat.ts               # POST /api/chat
│       │   ├── prepare.ts            # POST /api/prepare
│       │   ├── sign.ts               # POST /api/sign
│       │   ├── broadcast.ts          # POST /api/broadcast
│       │   ├── address.ts            # GET /api/address
│       │   └── status.ts             # GET /api/status
│       └── validation/
│           └── schemas.ts            # Zod validation schemas
│
├── frontend/                         # Next.js 15 app
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx              # Main two-panel layout
│       │   └── globals.css           # Dark theme styles
│       ├── components/
│       │   ├── ChatPanel.tsx         # Left panel - chat interface
│       │   ├── TransactionReview.tsx # Right panel - tx controls
│       │   └── StatusBadge.tsx       # Transaction status indicator
│       ├── store/
│       │   └── transactionStore.ts   # Zustand state management
│       └── lib/
│           ├── api.ts                # API client
│           └── utils.ts              # Utility functions
│
├── lib/                              # Shared libraries
│   ├── ledger/
│   │   ├── dmk.ts                    # @ledgerhq/dmk integration
│   │   └── cli.ts                    # Ledger Wallet CLI wrapper
│   └── ethers/
│       └── provider.ts               # Ethers RPC provider + ENS
│
├── agent/                            # AI agent layer
│   ├── tools.ts                      # Tool definitions + schemas
│   ├── orchestrator.ts               # AI agent orchestrator
│   ├── spending-limit.ts             # Bonus: Daily spending allowance
│   ├── safe-integration.ts           # Bonus: Safe multisig stub
│   └── fido2-demo.ts                 # Bonus: FIDO2 auth stub
│
├── scripts/
│   └── run-speculos.sh               # Speculos emulator launcher
│
└── demo/
    ├── screenshots/                  # Screenshot placeholders
    └── demo.gif                      # Demo GIF placeholder
```

---

## Installation

### Prerequisites

- **Node.js** 18+ (recommended: 20 LTS)
- **pnpm**, **npm**, or **yarn**
- **A Ledger device** (Nano S, Nano X, Nano S+, Stax) **or** Speculos emulator
- **OpenAI API key** (for the AI agent)
- **Ledger Wallet CLI** (optional, for CLI signing path)

### 1. Clone and Install Dependencies

```bash
# Navigate to the project
cd aegis-agent

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Configure Environment

```bash
# Backend configuration
cp .env.backend.example backend/.env
# Edit backend/.env with your API keys and RPC URLs

# Frontend configuration
cp .env.frontend.example frontend/.env.local
```

### 3. Set Your OpenAI API Key

Edit `backend/.env`:

```
OPENAI_API_KEY=sk-your-actual-openai-api-key
```

> **Get a key**: https://platform.openai.com/api-keys

---

## Running Speculos

Speculos emulates a Ledger device in software for development.

### Prerequisites

```bash
# Install Speculos (Python package)
pip install speculos

# OR use Docker
docker pull ghcr.io/ledgerhq/speculos
```

### Launch Speculos

```bash
# With Docker (recommended for quick start)
./scripts/run-speculos.sh --docker

# With a specific Ethereum app ELF
./scripts/run-speculos.sh --app ./path/to/ethereum.elf

# Custom model and ports
./scripts/run-speculos.sh --model stax --apdu-port 9999 --http-port 5000
```

### Speculos Seed

Default seed: `glory promote bridge obey wing month quote network discover swim drama supreme`

This gives you a deterministic address for testing. Change it via the `SPECULOS_SEED` env var or the `--seed` flag.

### Verify Speculos is Running

```bash
# Check the HTTP API
curl http://localhost:5000/

# The APDU port should accept connections on 9999
```

---

## Running the Backend

```bash
cd backend

# Development mode (with hot reload)
npm run dev

# Production build
npm run build
npm start
```

The backend starts on `http://localhost:3001` by default.

### Verify Backend

```bash
curl http://localhost:3001/api/health
# {"status":"ok","service":"aegis-agent","version":"1.0.0",...}

curl http://localhost:3001/api/status
# {"success":true,"data":{"server":"running","network":"sepolia",...}}
```

---

## Running the Frontend

```bash
cd frontend

# Development mode
npm run dev

# Production build
npm run build
npm start
```

The frontend starts on `http://localhost:3000` by default. Open it in your browser.

---

## Demo Commands

### 1. Basic ETH Transfer via Chat

Open the frontend at `http://localhost:3000` and type:

```
Send 0.005 ETH to vitalik.eth
```

The AI agent will:
1. Resolve `vitalik.eth` → `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`
2. Get your Ledger address
3. Build the unsigned transaction
4. Estimate gas
5. Present a summary in the transaction review panel
6. Wait for you to click "Request Ledger Signature"

### 2. Direct Transaction via API

```bash
# Prepare a transaction
curl -X POST http://localhost:3001/api/prepare \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "amount": "0.005",
    "network": "sepolia"
  }'

# Sign (requires Ledger connected and Ethereum app open)
curl -X POST http://localhost:3001/api/sign \
  -H "Content-Type: application/json" \
  -d '{
    "txHash": "0x... (unsignedTxHex from prepare)",
    "recipient": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "amount": "0.005",
    "network": "sepolia"
  }'

# Broadcast
curl -X POST http://localhost:3001/api/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "signedTx": "0x... (signedTx from sign)",
    "network": "sepolia"
  }'
```

### 3. Get Ledger Address

```bash
curl http://localhost:3001/api/address
# {"success":true,"data":{"address":"0x...","derivationPath":"m/44'/60'/0'/0/0",...}}
```

---

## DMK Integration Proof

`lib/ledger/dmk.ts` demonstrates direct usage of `@ledgerhq/dmk` (Device Management Kit):

```typescript
import { Dmk, DeviceManagementKit } from "@ledgerhq/dmk";

// Initialize
const dmk = await Dmk();

// Open Ethereum app on device
const ethApp = await dmk.openApp("Ethereum");

// Get address
const { address } = await ethApp.getAddress("m/44'/60'/0'/0/0");

// Sign transaction (user must approve on device)
const { signedTransaction } = await ethApp.signTransaction(
  "m/44'/60'/0'/0/0",
  unsignedTxHex
);
```

**Key integration points:**
- `connectDevice()` — Initializes DMK, supports both hardware and Speculos
- `getAddress()` — Derives Ethereum address from the Ledger
- `signTransaction()` — Signs via Ledger, requires physical user approval
- `disconnect()` — Cleanly shuts down the DMK connection

---

## Wallet CLI Integration Proof

`lib/ledger/cli.ts` demonstrates the Ledger Wallet CLI integration as a fallback signing path:

```typescript
import { signTxViaCLI, getConnectedDevices, broadcastSignedTx } from "./cli";

// List connected devices
const devices = await getConnectedDevices();

// Sign via CLI
const { signedTx } = await signTxViaCLI(unsignedTxHex);

// Broadcast via CLI
const { txHash } = await broadcastSignedTx(signedTx);
```

**Key integration points:**
- `getConnectedDevices()` — Queries connected Ledger devices
- `signTxViaCLI()` — Signs via the `ledger-wallet` CLI binary
- `broadcastSignedTx()` — Broadcasts via the CLI
- All operations include error handling and timeouts

---

## AI Agent Tool Architecture

The AI agent uses OpenAI function calling with six tools:

| Tool | Purpose | AI Can Call? |
|------|---------|:---:|
| `getLedgerAddress` | Get address from Ledger | ✓ |
| `resolveENS` | Resolve ENS name to address | ✓ |
| `buildTransaction` | Create unsigned tx params | ✓ |
| `estimateGas` | Estimate transaction gas | ✓ |
| `requestLedgerSignature` | Request signing on Ledger | ✓ (requires user approval) |
| `broadcastTransaction` | Broadcast signed tx | ✓ |

The agent chooses tools autonomously based on user intent. The orchestrator (`agent/orchestrator.ts`) handles the full flow.

```
User: "Send 0.005 ETH to vitalik.eth"

Agent flow:
  1. resolveENS("vitalik.eth") → 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
  2. getLedgerAddress() → 0xYourAddress
  3. buildTransaction(recipient, amount) → unsigned tx params
  4. estimateGas(from, to, value) → gas estimate
  5. Present summary to user
  6. requestLedgerSignature(unsignedTxHex) → signed tx (user approves on device)
  7. broadcastTransaction(signedTx) → tx hash
```

---

## API Reference

### `POST /api/chat`
Process a natural language message through the AI agent.

```json
{ "message": "Send 0.005 ETH to vitalik.eth", "sessionId": "optional" }
```

### `POST /api/prepare`
Directly prepare a transaction (bypasses AI).

```json
{ "recipient": "0x...", "amount": "0.005", "network": "sepolia" }
```

### `POST /api/sign`
Sign a transaction via Ledger.

```json
{ "txHash": "0x...", "recipient": "0x...", "amount": "0.005", "network": "sepolia" }
```

### `POST /api/broadcast`
Broadcast a signed transaction.

```json
{ "signedTx": "0x...", "network": "sepolia" }
```

### `GET /api/address`
Get Ledger device address.

### `GET /api/status`
Get server and device status.

### `GET /api/health`
Health check.

---

## Bonus Features

### 1. Daily Spending Allowance (`agent/spending-limit.ts`)

Configurable per-transaction limit (`MAX_DAILY_ETH=0.01` in `.env`). The agent tracks daily spending and alerts the user if a proposed transaction would exceed the allowance. Ledger signature is still required regardless of amount.

### 2. Safe Multisig Support (`agent/safe-integration.ts`)

Architecture blueprint for Safe (Gnosis Safe) integration. When implemented, Aegis will support multi-signer transactions where multiple Ledger devices must approve before execution.

### 3. FIDO2 Demo Stub (`agent/fido2-demo.ts`)

Proof-of-concept showing how Ledger FIDO2 authentication could gate agent operations. Demonstrates hardware-backed user verification beyond transaction signing.

---

## Ledger Integration Details

### DMK (Device Management Kit)

The DMK provides a unified API for all Ledger devices. Aegis uses it for:

| Operation | DMK Method | Description |
|-----------|-----------|-------------|
| Connection | `Dmk()` | Initialize the DMK |
| Address | `ethApp.getAddress(path)` | Get address at BIP32 path |
| Signing | `ethApp.signTransaction(path, tx)` | Sign via Ledger (user approves) |
| App Switch | `dmk.openApp("Ethereum") | Open the Ethereum app |

DMK supports both physical Ledger devices and Speculos emulator seamlessly. The backend detects Speculos mode via the `SPECULOS_HOST` environment variable.

### Wallet CLI

The Ledger Wallet CLI provides an alternative signing path:

```
ledger-wallet list                         # List devices
ledger-wallet sign --path "m/44'/60'/0'/0/0" --tx "0x..."
ledger-wallet broadcast --tx "0x..."
```

---

## Development

### Type Checking

```bash
cd backend
npm run typecheck
```

### Testing the Full Flow

1. Start Speculos
2. Start the backend: `cd backend && npm run dev`
3. Start the frontend: `cd frontend && npm run dev`
4. Open `http://localhost:3000`
5. Type a transfer instruction in the chat panel
6. Review the transaction details
7. Click "Request Ledger Signature"
8. Approve on your Ledger device
9. Click "Broadcast Transaction"

---

## Hackathon Justification

### Why Aegis Matters

Current AI wallet agents operate insecurely:
- **Crypto GPT Wrappers** — Store private keys in environment variables or databases
- **Agent Frameworks** — Give LLMs direct key access, creating single points of failure
- **No Hardware Enforcement** — A compromised LLM can drain wallets

Aegis solves this with a **hardware-enforced security boundary**:

| Risk | Traditional Approach | Aegis Approach |
|------|---------------------|----------------|
| LLM prompt injection | Attacker can drain wallet | AI can only propose, not sign |
| Key compromise | Keys in env/config | Keys on Ledger, never exposed |
| Phishing approvals | Blind signing | Review in UI + confirm on Ledger |
| Unauthorized access | No 2FA | FIDO2 hardware auth (bonus) |

### The Demo

Aegis demonstrates:
1. Natural language → transaction pipeline with AI
2. Real-time transaction review in a beautiful UI
3. Hardware signing via Ledger (or Speculos)
4. Complete "propose → review → sign → broadcast" flow
5. Three bonus features extending the security model

---

## Screenshots

> *Screenshots go in `demo/screenshots/`*

| Panel | Description |
|-------|-------------|
| Chat Panel | AI agent chat with example instructions |
| Transaction Review | Transaction details with Ledger signing controls |
| Status | Ledger connection status and network info |

---

## Demo GIF

> *`demo/demo.gif` — Animated walkthrough of the full flow:*
> 1. Type "Send 0.005 ETH to vitalik.eth"
> 2. AI resolves ENS and builds tx
> 3. Review transaction details
> 4. Sign on Ledger
> 5. Broadcast to Sepolia
> 6. View on Etherscan

---

## License

MIT — For educational and hackathon demonstration purposes.

---

## Acknowledgments

- [Ledger](https://www.ledger.com/) — Hardware security and DMK
- [OpenAI](https://openai.com/) — AI agent capabilities
- [ethers.js](https://docs.ethers.org/) — Ethereum interaction library
- [Safe](https://safe.global/) — Multisig architecture inspiration