#!/bin/bash

# Configuration
BACKEND_DIR="backend"
FRONTEND_DIR="frontend"
API_PORT=8000
LOG_DIR="logs"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Cleanup existing processes
cleanup() {
    echo "Stopping existing services..."
    # Kill backend
    fuser -k $API_PORT/tcp > /dev/null 2>&1
    
    # Kill ngrok (more aggressively)
    pkill -9 -f "ngrok http $API_PORT" > /dev/null 2>&1
    
    # Kill expo
    pkill -f "expo start" > /dev/null 2>&1
    
    # Clean up zombie processes
    local zombies=$(ps aux | grep -e "uvicorn" -e "ngrok" -e "expo" | grep "Z" | awk '{print $2}')
    if [ ! -z "$zombies" ]; then
        kill -9 $zombies > /dev/null 2>&1
    fi
    
    sleep 2
}

# Start Backend
start_backend() {
    echo "Starting Backend on port $API_PORT..."
    cd "$BACKEND_DIR" || exit
    if [ -d "venv" ]; then
        source venv/bin/activate
    fi
    nohup uvicorn app.main:app --host 0.0.0.0 --port $API_PORT --reload > "../$LOG_DIR/backend.log" 2>&1 &
    cd ..
}

# Start Ngrok and update environment
start_ngrok() {
    echo "Starting Ngrok tunnel..."
    
    # Wipe old log to ensure we catch new errors
    rm -f "$LOG_DIR/ngrok.log"
    
    # Start ngrok
    nohup ngrok http $API_PORT --log=stdout > "$LOG_DIR/ngrok.log" 2>&1 &
    
    echo "Waiting for Ngrok public URL..."
    local public_url=""
    local max_attempts=20
    local attempt=0
    
    while [ -z "$public_url" ] && [ $attempt -lt $max_attempts ]; do
        sleep 2
        echo -n "."
        public_url=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*"' | head -n 1 | cut -d'"' -f4)
        ((attempt++))
    done
    echo "" # Newline after dots
    
    if [ -z "$public_url" ]; then
        echo "Error: Failed to obtain Ngrok URL."
        echo "Last 10 lines of $LOG_DIR/ngrok.log:"
        tail -n 10 "$LOG_DIR/ngrok.log"
        exit 1
    fi
    
    echo "Tunnel established: $public_url"
    
    # Update Frontend environment configuration
    if [ -f "$FRONTEND_DIR/.env" ]; then
        echo "Updating $FRONTEND_DIR/.env with new Ngrok URL..."
        if grep -q "EXPO_PUBLIC_API_BASE_URL=" "$FRONTEND_DIR/.env"; then
            sed -i "s|EXPO_PUBLIC_API_BASE_URL=.*|EXPO_PUBLIC_API_BASE_URL=$public_url|" "$FRONTEND_DIR/.env"
        else
            echo "EXPO_PUBLIC_API_BASE_URL=$public_url" >> "$FRONTEND_DIR/.env"
        fi
    else
        echo "Warning: $FRONTEND_DIR/.env not found. Creating a new one."
        echo "EXPO_PUBLIC_API_BASE_URL=$public_url" > "$FRONTEND_DIR/.env"
    fi
}

# Start Frontend
start_frontend() {
    echo "Starting Frontend..."
    cd "$FRONTEND_DIR" || exit
    # Use tunnel mode for different Wi-Fi networks
    # Add --max-workers 1 to reduce connection issues
    npx expo start --tunnel --max-workers 1
}

# Execution
cleanup
start_backend
start_ngrok
start_frontend
