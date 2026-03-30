#!/bin/bash
# ═══════════════════════════════════════════════════
#  Ano-Kamo? Dev Launcher
#  Starts FastAPI backend + backend tunnel + Expo Metro
#
#  Run from Windows Git Bash (not WSL terminal).
#  Usage:  bash run.sh        ← tunnel (default, works on any network)
#          bash run.sh --lan  ← LAN only (faster, needs AP isolation OFF on router)
#
#  ngrok auth token (prevents tunnel timeouts):
#    1. Sign up free at https://dashboard.ngrok.com
#    2. Copy your auth token
#    3. Save it to a file called  .ngrok_token  in this folder
#    Then run bash run.sh as normal — tunnels will be stable.
# ═══════════════════════════════════════════════════

MACHINE_IP="192.168.254.108"
BACKEND_PORT=8000
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"
WIN_PYTHON="$VENV_DIR/Scripts/python.exe"
LT_LOG="$SCRIPT_DIR/.lt_url.txt"
NGROK_TOKEN_FILE="$SCRIPT_DIR/.ngrok_token"

if [[ "$1" == "--lan" ]]; then
    EXPO_FLAGS=""
    MODE_LABEL="LAN (direct)"
    USE_BACKEND_TUNNEL=false
else
    EXPO_FLAGS="--tunnel"
    MODE_LABEL="tunnel"
    USE_BACKEND_TUNNEL=true
fi

# ── Load ngrok auth token if available ───────────
# Prevents "ngrok tunnel took too long" errors.
if [ -f "$NGROK_TOKEN_FILE" ]; then
    NGROK_TOKEN=$(cat "$NGROK_TOKEN_FILE" | tr -d '[:space:]')
    if [ -n "$NGROK_TOKEN" ]; then
        export NGROK_AUTHTOKEN="$NGROK_TOKEN"
        NGROK_STATUS="auth token loaded ✓"
    else
        NGROK_STATUS="anonymous (token file empty)"
    fi
elif [ -n "${NGROK_AUTHTOKEN:-}" ]; then
    NGROK_STATUS="auth token from env ✓"
else
    NGROK_STATUS="anonymous (may time out)"
fi

echo "╔══════════════════════════════════════════╗"
echo "║          Ano-Kamo? Dev Server            ║"
echo "╠══════════════════════════════════════════╣"
printf "║  WiFi IP  : %-30s║\n" "$MACHINE_IP"
printf "║  Backend  : http://%-24s║\n" "$MACHINE_IP:$BACKEND_PORT"
printf "║  Mode     : %-30s║\n" "$MODE_LABEL"
printf "║  ngrok    : %-30s║\n" "$NGROK_STATUS"
echo "╚══════════════════════════════════════════╝"
echo ""

# In tunnel mode, don't set PACKAGER_HOSTNAME — Expo uses the ngrok/exp.direct URL
if [[ "$1" == "--lan" ]]; then
    export REACT_NATIVE_PACKAGER_HOSTNAME="$MACHINE_IP"
fi

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

if ! "$WIN_PYTHON" -c "
import sqlalchemy, fastapi, uvicorn, pydantic
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

cd "$SCRIPT_DIR/backend"
"$WIN_PYTHON" -m alembic upgrade head 2>/dev/null || true

# ── 2. Start FastAPI backend ──────────────────────
echo "[1/3] Starting FastAPI backend..."
"$WIN_PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload &
BACKEND_PID=$!
echo "  Backend: http://$MACHINE_IP:$BACKEND_PORT  (PID: $BACKEND_PID)"
echo ""

LT_PID=""

# ── 3. Tunnel backend ────────────────────────────
if [ "$USE_BACKEND_TUNNEL" = true ]; then
    echo "[2/3] Tunneling backend (localtunnel)..."
    rm -f "$LT_LOG"
    sleep 1.5
    npx --yes localtunnel --port "$BACKEND_PORT" > "$LT_LOG" 2>&1 &
    LT_PID=$!

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
        ENV_FILE="$SCRIPT_DIR/frontend/.env"
        if grep -q "EXPO_PUBLIC_API_BASE_URL=" "$ENV_FILE" 2>/dev/null; then
            tmp_env=$(mktemp)
            sed "s|EXPO_PUBLIC_API_BASE_URL=.*|EXPO_PUBLIC_API_BASE_URL=$LT_URL|" "$ENV_FILE" > "$tmp_env"
            mv "$tmp_env" "$ENV_FILE"
        else
            echo "EXPO_PUBLIC_API_BASE_URL=$LT_URL" >> "$ENV_FILE"
        fi
        echo "  Updated .env  → EXPO_PUBLIC_API_BASE_URL=$LT_URL"
    else
        echo "  WARNING: Could not get tunnel URL (localtunnel may be down)."
        echo "  Backend calls will fail. Try again or use: bash run.sh --lan"
    fi
else
    echo "[2/3] LAN mode — skipping backend tunnel."
    echo "  Ensure router AP isolation is disabled so Samsung can reach $MACHINE_IP."
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
if [ "$MODE_LABEL" = "tunnel" ]; then
    echo "  Wait for the  exp://....exp.direct  URL to appear, THEN scan it."
    echo "  (Do NOT scan the 192.168.x.x URL — that won't reach your phone)"
else
    echo "  Scan the QR code that appears with Expo Go."
fi
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

# Retry Expo tunnel up to 5 times (ngrok anonymous connections are sometimes slow)
MAX_TRIES=5
for i in $(seq 1 $MAX_TRIES); do
    [ $i -gt 1 ] && echo "  Attempt $i/$MAX_TRIES..."
    "$EXPO_BIN" start $EXPO_FLAGS
    EXIT_CODE=$?
    # Exit code 0 = clean shutdown (Ctrl+C), 130 = SIGINT — stop retrying
    if [ $EXIT_CODE -eq 0 ] || [ $EXIT_CODE -eq 130 ]; then
        break
    fi
    if [ $i -lt $MAX_TRIES ]; then
        echo ""
        echo "  Tunnel timed out — retrying in 5s..."
        sleep 5
    else
        echo ""
        echo "╔══════════════════════════════════════════════════════════╗"
        echo "║  Tunnel failed after $MAX_TRIES attempts.                      ║"
        echo "║                                                          ║"
        echo "║  Permanent fix (free, 2 minutes):                        ║"
        echo "║  1. Sign up at https://dashboard.ngrok.com               ║"
        echo "║  2. Go to  Getting Started → Your Authtoken              ║"
        echo "║  3. Copy the token                                       ║"
        echo "║  4. Run this command in Git Bash:                        ║"
        echo "║       echo YOUR_TOKEN > .ngrok_token                     ║"
        echo "║  5. Run bash run.sh again                                ║"
        echo "╚══════════════════════════════════════════════════════════╝"
        kill "$BACKEND_PID" "$LT_PID" 2>/dev/null
    fi
done
