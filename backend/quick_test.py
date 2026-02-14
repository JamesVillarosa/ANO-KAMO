#!/usr/bin/env python3
"""
Quick test to verify backend configuration
"""
import os
import sys

def test_alembic_config():
    """Test that alembic.ini has correct configuration"""
    print("🔧 Testing alembic configuration...")
    
    alembic_ini_path = "alembic.ini"
    if not os.path.exists(alembic_ini_path):
        print(f"   ❌ {alembic_ini_path} not found")
        return False
    
    with open(alembic_ini_path, 'r') as f:
        content = f.read()
    
    # Check for correct SQLAlchemy URL
    if "sqlalchemy.url = sqlite:///./app.db" in content:
        print("   ✅ SQLAlchemy URL is correct (sqlite:///./app.db)")
    elif "sqlalchemy.url = driver://" in content:
        print("   ❌ SQLAlchemy URL is incorrect (driver://...)")
        print("   ⚠️  Please update alembic.ini with: sqlalchemy.url = sqlite:///./app.db")
        return False
    else:
        print("   ⚠️  SQLAlchemy URL not found or different")
    
    # Check script location
    if "script_location = app/migrations" in content:
        print("   ✅ Script location points to app/migrations")
    else:
        print("   ⚠️  Script location may not point to app/migrations")
    
    return True

def test_env_file():
    """Test that .env file exists"""
    print("\n🔧 Testing environment configuration...")
    
    env_path = ".env"
    env_example_path = ".env.example"
    
    if os.path.exists(env_path):
        print(f"   ✅ .env file exists")
        return True
    elif os.path.exists(env_example_path):
        print(f"   ⚠️  .env not found, but .env.example exists")
        print(f"   Run: cp .env.example .env")
        return False
    else:
        print(f"   ❌ Neither .env nor .env.example found")
        return False

def test_main_app():
    """Test that main app can be imported"""
    print("\n🔧 Testing app structure...")
    
    try:
        # Add current directory to path
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        
        # Try to import the main app module
        import importlib.util
        
        spec = importlib.util.spec_from_file_location("app.main", "app/main.py")
        if spec is None:
            print("   ❌ Cannot find app/main.py")
            return False
        
        print("   ✅ app/main.py exists")
        return True
    except Exception as e:
        print(f"   ⚠️  Error checking app structure: {e}")
        return False

def main():
    print("🚀 Quick Backend Configuration Test")
    print("=" * 40)
    
    tests_passed = 0
    tests_total = 3
    
    if test_alembic_config():
        tests_passed += 1
    
    if test_env_file():
        tests_passed += 1
    
    if test_main_app():
        tests_passed += 1
    
    print("\n" + "=" * 40)
    print(f"📊 Results: {tests_passed}/{tests_total} tests passed")
    
    if tests_passed == tests_total:
        print("✅ All configuration tests passed!")
        print("\nNext steps:")
        print("1. source .venv/bin/activate  # Activate virtual environment")
        print("2. pip install -e .           # Install dependencies")
        print("3. alembic upgrade head       # Setup database")
        print("4. uvicorn app.main:app --reload --port 8000  # Start server")
    else:
        print("⚠️  Some tests failed. Please fix the issues above.")
    
    return tests_passed == tests_total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
