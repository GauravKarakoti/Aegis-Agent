#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# Aegis — Speculos Emulator Launcher
#
# Launches the Speculos Ethereum app emulator for
# development and testing without physical hardware.
#
# Prerequisites:
#   pip install speculos
#   (or use the Docker image: ghcr.io/ledgerhq/speculos)
#
# Usage:
#   ./scripts/run-speculos.sh
#
# Options:
#   --docker        Use Docker instead of local install
#   --app PATH      Path to Ethereum app ELF (default: auto-detect)
#   --model nano_s  Device model (nano_s, nano_x, nano_sp, stax)
# ─────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ─── Config ────────────────────────────────────────────────
SPECULOS_MODEL="${SPECULOS_MODEL:-nanosp}"
SPECULOS_APDU_PORT="${SPECULOS_APDU_PORT:-9999}"
SPECULOS_HTTP_PORT="${SPECULOS_HTTP_PORT:-5000}"
SPECULOS_SEED="${SPECULOS_SEED:-"glory promote bridge obey wing month quote network discover swim drama supreme"}"

ETH_APP_PATH="${ETH_APP_PATH:-}"
USE_DOCKER=false

# ─── Parse arguments ───────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --docker) USE_DOCKER=true; shift ;;
    --app) ETH_APP_PATH="$2"; shift 2 ;;
    --model) SPECULOS_MODEL="$2"; shift 2 ;;
    --apdu-port) SPECULOS_APDU_PORT="$2"; shift 2 ;;
    --http-port) SPECULOS_HTTP_PORT="$2"; shift 2 ;;
    --seed) SPECULOS_SEED="$2"; shift 2 ;;
    --help)
      echo "Usage: $0 [--docker] [--app PATH] [--model MODEL] [--apdu-port PORT] [--http-port PORT] [--seed SEED]"
      echo ""
      echo "Launches Speculos emulator for the Ethereum app."
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# ─── Find Ethereum app ─────────────────────────────────────
if [[ -z "$ETH_APP_PATH" ]]; then
  # Common locations
  POSSIBLE_PATHS=(
    "./ethereum/app/build/ethereum.elf"
    "./build/ethereum.elf"
    "/opt/ledger/ethereum/app.elf"
    "$HOME/.speculos/apps/ethereum.elf"
  )
  for p in "${POSSIBLE_PATHS[@]}"; do
    if [[ -f "$p" ]]; then
      ETH_APP_PATH="$p"
      echo "[Speculos] Found Ethereum app at: $p"
      break
    fi
  done

  if [[ -z "$ETH_APP_PATH" ]]; then
    echo "[Speculos] WARNING: No Ethereum app ELF found at common paths."
    echo "[Speculos] You can download it or build from: https://github.com/LedgerHQ/app-ethereum"
    echo "[Speculos] Use --app PATH to specify the ELF location."
    echo ""

    # Use Docker default if available
    if command -v docker &>/dev/null; then
      echo "[Speculos] Falling back to Docker with default Ethereum app..."
      USE_DOCKER=true
    else
      echo "[Speculos] ERROR: Cannot start without an Ethereum app ELF."
      echo "[Speculos] Provide one via --app PATH or install Docker for the automatic fallback."
      exit 1
    fi
  fi
fi

# ─── Launch ────────────────────────────────────────────────
echo ""
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║        Aegis — Speculos Emulator          ║"
echo "  ║  Model: $SPECULOS_MODEL"
echo "  ║  APDU:  localhost:$SPECULOS_APDU_PORT"
echo "  ║  HTTP:  localhost:$SPECULOS_HTTP_PORT"
echo "  ╚═══════════════════════════════════════════╝"
echo ""

if [[ "$USE_DOCKER" == true ]]; then
  # ─── Docker launch ───────────────────────────
  # Ensure an app path was found or provided
  if [[ -z "$ETH_APP_PATH" ]]; then
    echo "[Speculos] ERROR: No Ethereum app ELF found!"
    echo "[Speculos] Please download it and place it in the ./build/ethereum.elf directory."
    exit 1
  fi

  # Get the absolute path so Docker can mount it correctly
  ABS_APP_PATH="$(cd "$(dirname "$ETH_APP_PATH")" && pwd)/$(basename "$ETH_APP_PATH")"
  
  echo "[Speculos] Launching via Docker..."
  echo "[Speculos] Mounting app: $ABS_APP_PATH"

  MSYS_NO_PATHCONV=1 docker run --rm -it \
    -v "$ABS_APP_PATH:/app.elf" \
    -p "9999:9999" \
    -p "5000:5000" \
    -e SPECULOS_SEED="$SPECULOS_SEED" \
    ghcr.io/ledgerhq/speculos \
    --model "$SPECULOS_MODEL" \
    --display headless \
    --apdu-port 9999 \
    --api-port 5000 \
    --seed "$SPECULOS_SEED" \
    /app.elf
else
  # ─── Local launch ────────────────────────────
  echo "[Speculos] Launching locally..."
  echo "[Speculos] Seed: ${SPECULOS_SEED:0:20}..."

  if [[ -z "$ETH_APP_PATH" ]]; then
    echo "[Speculos] ERROR: No Ethereum app ELF found!"
    exit 1
  fi

  speculos \
    --model "$SPECULOS_MODEL" \
    --apdu-port "$SPECULOS_APDU_PORT" \
    --api-port "$SPECULOS_HTTP_PORT" \
    --seed "$SPECULOS_SEED" \
    "$ETH_APP_PATH"
fi

echo "[Speculos] Stopped."