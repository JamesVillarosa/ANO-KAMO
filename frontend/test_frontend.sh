#!/bin/bash

# Test script for Ano-Kamo frontend
echo "📱 Testing Ano-Kamo Frontend Setup"

# Check Node.js version
echo "1. Checking Node.js version..."
node --version

# Check npm version
echo "2. Checking npm version..."
npm --version

# Check if dependencies are installed
echo "3. Checking dependencies..."
if [ -d "node_modules" ]; then
    echo "   ✅ node_modules directory exists"
    echo "   Checking key packages..."
    
    if [ -d "node_modules/expo" ]; then
        echo "   ✅ Expo installed"
    else
        echo "   ❌ Expo not installed. Run: npm install"
    fi
    
    if [ -d "node_modules/expo-router" ]; then
        echo "   ✅ Expo Router installed"
    else
        echo "   ❌ Expo Router not installed. Run: npm install"
    fi
    
    if [ -d "node_modules/react" ]; then
        echo "   ✅ React installed"
    else
        echo "   ❌ React not installed. Run: npm install"
    fi
    
    if [ -d "node_modules/axios" ]; then
        echo "   ✅ Axios installed"
    else
        echo "   ❌ Axios not installed. Run: npm install"
    fi
else
    echo "   ⚠️  node_modules not found. Run: npm install"
    echo "   If you get dependency errors, try: npm install --legacy-peer-deps"
fi

# Check environment configuration
echo "4. Checking environment configuration..."
if [ -f ".env" ]; then
    echo "   ✅ .env file exists"
    echo "   Current API_BASE_URL:"
    grep EXPO_PUBLIC_API_BASE_URL .env || echo "   ⚠️  EXPO_PUBLIC_API_BASE_URL not found in .env"
else
    echo "   ⚠️  .env file not found. Creating from example..."
    cp .env.example .env 2>/dev/null || echo "   ❌ .env.example not found either"
fi

# Check if Expo is running
echo "5. Checking if Expo is running..."
if pgrep -f "expo start" > /dev/null; then
    echo "   ✅ Expo is running"
    echo "   You can access the app via:"
    echo "   - QR code in terminal"
    echo "   - http://localhost:8082 (DevTools)"
else
    echo "   ⚠️  Expo not running"
    echo "   Start it with: npx expo start"
fi

echo ""
echo "📋 Quick Start Commands:"
echo "   npm install                         # Install dependencies"
echo "   npx expo start                      # Start Expo dev server"
echo "   Press 'i' for iOS simulator (macOS)"
echo "   Press 'a' for Android emulator"
echo "   Scan QR code with Expo Go app"
echo ""
echo "🌐 Important URLs:"
echo "   http://localhost:8082               # Expo DevTools"
echo "   http://localhost:19000              # Metro bundler"
echo ""
echo "📱 Testing on Expo Go:"
echo "   1. Install Expo Go on your phone"
echo "   2. Scan QR code from terminal"
echo "   3. Test connection with the test screen"
echo "   4. If connection fails, check .env API_BASE_URL"
