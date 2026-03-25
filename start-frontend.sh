#!/bin/bash
set -e

cd "$(dirname "$0")/frontend"

if ! command -v node &>/dev/null; then
  echo "ERROR: node not found. Install Node.js 18+."
  exit 1
fi

# Install if node_modules is missing or empty (handles wiped directories)
if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
  echo "Installing npm dependencies..."
  npm install
else
  echo "node_modules present."
fi

echo ""
echo "  ConversationalERP frontend"
echo "  UI:  http://localhost:5173"
echo "  (proxies /chat /graph /ingest to backend on port 8000)"
echo ""
npm run dev
