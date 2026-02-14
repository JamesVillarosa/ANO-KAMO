#!/bin/bash

# Test script for Ano-Kamo backend
echo "🔧 Testing Ano-Kamo Backend Setup"

# Check Python version
echo "1. Checking Python version..."
python3 --version

# Check if in virtual environment
echo "2. Checking virtual environment..."
if [ -z "$VIRTUAL_ENV" ]; then
    echo "   ⚠️  Not in a virtual environment. Please activate it first."
    echo "   Run: source .venv/bin/activate"
else
    echo "   ✅ In virtual environment: $VIRTUAL_ENV"
fi

# Check dependencies
echo "3. Checking dependencies..."
if pip list | grep -q "fastapi"; then
    echo "   ✅ FastAPI installed"
else
    echo "   ❌ FastAPI not installed. Run: pip install -e ."
fi

# Check environment file
echo "4. Checking environment configuration..."
if [ -f ".env" ]; then
    echo "   ✅ .env file exists"
elif [ -f ".env.example" ]; then
    echo "   ⚠️  .env not found, but .env.example exists"
    echo "   Run: cp .env.example .env"
else
    echo "   ❌ Neither .env nor .env.example found"
fi

# Check if database exists
echo "5. Checking database..."
if [ -f "app.db" ]; then
    echo "   ✅ Database file exists"
else
    echo "   ⚠️  Database file not found. Run: alembic upgrade head"
fi

# Test health endpoint
echo "6. Testing health endpoint (if server is running)..."
if curl -s http://localhost:8000/api/v1/health > /dev/null; then
    echo "   ✅ Backend is running"
    curl -s http://localhost:8000/api/v1/health | python3 -m json.tool
else
    echo "   ⚠️  Backend not running on localhost:8000"
    echo "   Start it with: uvicorn app.main:app --reload --port 8000"
fi

# Test alembic migration
echo "7. Testing alembic migration..."
if alembic current > /dev/null 2>&1; then
    echo "   ✅ Alembic is configured correctly"
    echo "   Current migration:"
    alembic current
else
    echo "   ⚠️  Alembic not configured or database not migrated"
    echo "   Run: alembic upgrade head"
fi

echo ""
echo "📋 Quick Start Commands:"
echo "   source .venv/bin/activate          # Activate virtual env"
echo "   pip install -e .                   # Install dependencies"
echo "   alembic upgrade head               # Setup database"
echo "   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000  # Start server (accessible from network)"
echo ""
echo "🌐 API Endpoints:"
echo "   http://localhost:8000/docs         # Swagger UI"
echo "   http://localhost:8000/redoc        # ReDoc"
echo "   http://localhost:8000/api/v1/health # Health check"
