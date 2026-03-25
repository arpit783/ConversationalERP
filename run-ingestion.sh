#!/bin/bash
set -e

cd "$(dirname "$0")/backend"

if [ ! -f ".env" ]; then
  echo "ERROR: backend/.env not found."
  echo "  cp backend/.env.example backend/.env"
  exit 1
fi

if grep -q "your_gemini_key_here\|your_password_here" .env; then
  echo "ERROR: backend/.env still contains placeholder values. Fill in NEO4J_PASSWORD at minimum."
  exit 1
fi

# Activate venv (create + install if needed)
if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi

if [ -f ".venv/bin/activate" ]; then
  source .venv/bin/activate
elif [ -f ".venv/Scripts/activate" ]; then
  source .venv/Scripts/activate
else
  echo "ERROR: Could not activate virtual environment."
  exit 1
fi

# Install packages if site-packages is empty or hash changed
SITE_PKG=".venv/lib/python*/site-packages"
REQ_HASH=$(md5sum requirements.txt 2>/dev/null || md5 -q requirements.txt 2>/dev/null || echo "")
HASH_FILE=".venv/.req_hash"
if [ ! -f "$HASH_FILE" ] || [ "$(cat "$HASH_FILE")" != "$REQ_HASH" ]; then
  echo "Installing dependencies..."
  pip install -q -r requirements.txt
  echo "$REQ_HASH" > "$HASH_FILE"
fi

echo ""
echo "Running ingestion pipeline..."
echo "Loading all JSONL files from sap-o2c-data/ into Neo4j..."
echo ""
python -m app.ingestion
echo ""
echo "Ingestion complete. Run ./start-backend.sh and ./start-frontend.sh to launch the app."
