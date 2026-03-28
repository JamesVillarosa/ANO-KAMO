#!/bin/bash
# ═══════════════════════════════════════════════════
#  Ano-Kamo? Dev Launcher
#  Starts FastAPI backend + Expo Metro
#
#  Run from Windows Git Bash (not WSL terminal).
#  Usage:  bash run.sh        ← tunnel (default, works on any network)
#          bash run.sh --lan  ← LAN only (faster, needs AP isolation OFF on router)
# ═══════════════════════════════════════════════════

MACHINE_IP="192.168.254.108"
BACKEND_PORT=8000
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"
WIN_PYTHON="$VENV_DIR/Scripts/python.exe"

if [[ "$1" == "--lan" ]]; then
    EXPO_FLAGS=""
    MODE_LABEL="LAN (direct)"
else
    EXPO_FLAGS="--tunnel"
    MODE_LABEL="tunnel"
fi

echo "╔══════════════════════════════════════════╗"
echo "║          Ano-Kamo? Dev Server            ║"
echo "╠══════════════════════════════════════════╣"
printf "║  WiFi IP  : %-30s║\n" "$MACHINE_IP"
printf "║  Backend  : http://%-24s║\n" "$MACHINE_IP:$BACKEND_PORT"
printf "║  Mode     : %-30s║\n" "$MODE_LABEL"
echo "╚══════════════════════════════════════════╝"
echo ""

export REACT_NATIVE_PACKAGER_HOSTNAME="$MACHINE_IP"

# ── 1. Python venv / package setup ───────────────
if [ ! -f "$WIN_PYTHON" ]; then
    echo "[setup] Creating Windows Python venv..."
    python -m venv "$VENV_DIR" --clear
    if [ ! -f "$WIN_PYTHON" ]; then
        echo "  ERROR: 'python' not found in PATH."
        echo "  Install Python from python.org and retry."
        exit 1
    fi
fi

# Install / upgrade backend packages when any core package is missing or broken
if ! "$WIN_PYTHON" -c "
import sqlalchemy, fastapi, uvicorn, pydantic
# Verify sqlalchemy actually works on Python 3.13+
from sqlalchemy.orm import Session
" 2>/dev/null; then
    echo "[setup] Installing/upgrading backend packages..."
    "$WIN_PYTHON" -m pip install --upgrade pip --quiet
    if ! "$WIN_PYTHON" -m pip install -e "$SCRIPT_DIR/backend"; then
        echo "  ERROR: pip install failed. Fix the error above, then run again."
        exit 1
    fi
    echo "[setup] Done."
    echo ""
fi

# Run DB migrations (safe to run every time — no-op if already up to date)
cd "$SCRIPT_DIR/backend"
"$WIN_PYTHON" -m alembic upgrade head 2>/dev/null || true

# ── 2. Start FastAPI backend ──────────────────────
echo "[1/2] Starting FastAPI backend..."
"$WIN_PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload &
BACKEND_PID=$!
echo "  Backend: http://$MACHINE_IP:$BACKEND_PORT  (PID: $BACKEND_PID)"
echo ""

# ── 3. Start Expo Metro ───────────────────────────
echo "[2/2] Starting Expo Metro ($MODE_LABEL)..."
if [[ "$MODE_LABEL" == "tunnel" ]]; then
    echo "  Open Expo Go on Samsung → tap 'Scan QR Code' → point at the QR."
else
    echo "  LAN mode: ensure router AP isolation is disabled."
    echo "  Open Expo Go on Samsung → tap 'Scan QR Code' → point at the QR."
fi
echo "  Code changes hot-reload automatically."
echo ""

cd "$SCRIPT_DIR/frontend"

if [ ! -d "node_modules" ]; then
    echo "[setup] Installing frontend dependencies..."
    npm install
    echo ""
fi

EXPO_BIN="$SCRIPT_DIR/frontend/node_modules/.bin/expo"
if [ ! -f "$EXPO_BIN" ]; then
    echo "  ERROR: Local expo not found. Run 'npm install' in frontend/ first."
    kill "$BACKEND_PID" 2>/dev/null
    exit 1
fi

cleanup() {
    echo ""
    echo "Shutting down..."
    kill "$BACKEND_PID" 2>/dev/null
    exit 0
}
trap cleanup INT TERM

"$EXPO_BIN" start $EXPO_FLAGS
