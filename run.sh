#!/bin/bash
# ═══════════════════════════════════════════════════
#  Ano-Kamo? Dev Launcher
#  Starts FastAPI backend + backend tunnel + Expo Metro
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
LT_LOG="$SCRIPT_DIR/.lt_url.txt"

if [[ "$1" == "--lan" ]]; then
    EXPO_FLAGS=""
    MODE_LABEL="LAN (direct)"
    USE_TUNNEL=false
else
    EXPO_FLAGS="--tunnel"
    MODE_LABEL="tunnel"
    USE_TUNNEL=true
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
echo "[1/3] Starting FastAPI backend..."
"$WIN_PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload &
BACKEND_PID=$!
echo "  Backend: http://$MACHINE_IP:$BACKEND_PORT  (PID: $BACKEND_PID)"
echo ""

LT_PID=""

# ── 3. Tunnel backend so Samsung can reach it ────
if [ "$USE_TUNNEL" = true ]; then
    echo "[2/3] Tunneling backend (localtunnel)..."
    rm -f "$LT_LOG"
    # Give backend 1.5s to bind before tunnel connects
    sleep 1.5
    npx --yes localtunnel --port "$BACKEND_PORT" > "$LT_LOG" 2>&1 &
    LT_PID=$!

    # Wait up to 20 seconds for the URL
    LT_URL=""
    echo -n "  Waiting for tunnel URL"
    for i in $(seq 1 40); do
        if grep -q "your url is:" "$LT_LOG" 2>/dev/null; then
            LT_URL=$(grep "your url is:" "$LT_LOG" | sed 's/.*your url is: //' | tr -d '[:space:]')
            break
        fi
        echo -n "."
        sleep 0.5
    done
    echo ""

    if [ -n "$LT_URL" ]; then
        echo "  Tunnel URL: $LT_URL"

        # Update frontend/.env so Metro bakes the correct URL into the bundle
        ENV_FILE="$SCRIPT_DIR/frontend/.env"
        if grep -q "EXPO_PUBLIC_API_BASE_URL=" "$ENV_FILE" 2>/dev/null; then
            # Replace existing line (Windows Git Bash sed)
            tmp_env=$(mktemp)
            sed "s|EXPO_PUBLIC_API_BASE_URL=.*|EXPO_PUBLIC_API_BASE_URL=$LT_URL|" "$ENV_FILE" > "$tmp_env"
            mv "$tmp_env" "$ENV_FILE"
        else
            echo "EXPO_PUBLIC_API_BASE_URL=$LT_URL" >> "$ENV_FILE"
        fi
        echo "  Updated .env  → EXPO_PUBLIC_API_BASE_URL=$LT_URL"
    else
        echo "  WARNING: Could not get tunnel URL (localtunnel may be down)."
        echo "  Features that call the backend will not work on Samsung over AP isolation."
        echo "  Try again or disable AP isolation on your router and use: bash run.sh --lan"
    fi
else
    echo "[2/3] LAN mode — skipping backend tunnel."
    echo "  Ensure router AP isolation is disabled so Samsung can reach $MACHINE_IP."
    # Restore local IP in .env for LAN mode
    ENV_FILE="$SCRIPT_DIR/frontend/.env"
    if grep -q "EXPO_PUBLIC_API_BASE_URL=" "$ENV_FILE" 2>/dev/null; then
        tmp_env=$(mktemp)
        sed "s|EXPO_PUBLIC_API_BASE_URL=.*|EXPO_PUBLIC_API_BASE_URL=http://$MACHINE_IP:$BACKEND_PORT|" "$ENV_FILE" > "$tmp_env"
        mv "$tmp_env" "$ENV_FILE"
    fi
fi
echo ""

# ── 4. Start Expo Metro ───────────────────────────
echo "[3/3] Starting Expo Metro ($MODE_LABEL)..."
if [[ "$MODE_LABEL" == "tunnel" ]]; then
    echo "  Open Expo Go on Samsung → tap 'Scan QR Code' → point at the QR."
else
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
    kill "$BACKEND_PID" "$LT_PID" 2>/dev/null
    exit 1
fi

cleanup() {
    echo ""
    echo "Shutting down..."
    kill "$BACKEND_PID" "$LT_PID" 2>/dev/null
    exit 0
}
trap cleanup INT TERM

# Patch Expo CLI to auto-proceed anonymously (no blocking login prompt).
# Re-applied on every run so npm install doesn't break it.
EXPO_ACTIONS="$SCRIPT_DIR/frontend/node_modules/@expo/cli/build/src/api/user/actions.js"
node -e "
const f=process.argv[1];
const fs=require('fs');
let c=fs.readFileSync(f,'utf8');
if(c.includes('Proceed anonymously')){
  c=c.replace(/const choices\s*=\s*\[[\s\S]*?return null;/,'return null; \/\/ auto-proceed anonymously (patched by run.sh)');
  fs.writeFileSync(f,c);
  console.log('  Expo CLI patched: anonymous mode auto-selected.');
}
" "$EXPO_ACTIONS" 2>/dev/null || true

"$EXPO_BIN" start $EXPO_FLAGS
