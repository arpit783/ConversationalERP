#!/bin/bash
set -e

cd "$(dirname "$0")/backend"

# ── Pre-flight checks ──────────────────────────────────────────────────────

if [ ! -f ".env" ]; then
  echo "ERROR: backend/.env not found."
  echo "  cp backend/.env.example backend/.env"
  echo "  Then fill in NEO4J_PASSWORD and GEMINI_API_KEY."
  exit 1
fi

# Check for unfilled placeholder values
if grep -q "your_gemini_key_here\|your_password_here" .env; then
  echo "ERROR: backend/.env still contains placeholder values."
  echo "  Edit backend/.env and replace:"
  echo "    GEMINI_API_KEY=your_gemini_key_here  →  your actual key from https://aistudio.google.com/apikey"
  echo "    NEO4J_PASSWORD=your_password_here    →  the password you set when starting Neo4j"
  exit 1
fi

if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 not found. Install Python 3.9+ first."
  exit 1
fi

# ── Virtual environment ────────────────────────────────────────────────────

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

# ── Dependencies ───────────────────────────────────────────────────────────

REQ_HASH=$(md5sum requirements.txt 2>/dev/null || md5 -q requirements.txt 2>/dev/null || echo "")
HASH_FILE=".venv/.req_hash"
if [ ! -f "$HASH_FILE" ] || [ "$(cat "$HASH_FILE")" != "$REQ_HASH" ]; then
  echo "Installing / updating dependencies..."
  pip install -q -r requirements.txt
  echo "$REQ_HASH" > "$HASH_FILE"
  echo "Dependencies installed."
else
  echo "Dependencies up to date."
fi

# ── Start ──────────────────────────────────────────────────────────────────

echo ""
echo "  ConversationalERP backend"
echo "  API:     http://localhost:8000"
echo "  Docs:    http://localhost:8000/docs"
echo "  Neo4j:   http://localhost:7474"
echo ""
uvicorn main:app --reload --host 0.0.0.0 --port 8000
