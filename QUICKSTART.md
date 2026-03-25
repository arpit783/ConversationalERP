# ConversationalERP — Quick Start

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Python | 3.9+ | already installed (Xcode) |
| Node.js | 18+ | https://nodejs.org |
| Docker | any | https://www.docker.com/products/docker-desktop |

---

## Step 1 — Start Neo4j

```bash
docker run -d \
  --name neo4j-erp \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password123 \
  neo4j:5
```

Neo4j Browser (optional): http://localhost:7474

---

## Step 2 — Configure credentials

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password123
GEMINI_API_KEY=AIza...          ← from https://aistudio.google.com/apikey
DATA_DIR=../sap-o2c-data
```

Get a free Gemini API key at https://aistudio.google.com/apikey
(gemini-2.0-flash is free: 1,500 requests/day, no billing required)

---

## Step 3 — Make scripts executable

```bash
chmod +x start-backend.sh start-frontend.sh run-ingestion.sh
```

---

## Step 4 — Load data into Neo4j (first time only)

```bash
./run-ingestion.sh
```

This reads all JSONL files from `sap-o2c-data/` and builds the graph.
Takes ~30 seconds. You only need to run this once.

---

## Step 5 — Start backend

```bash
# Terminal 1
./start-backend.sh
```

First run installs all Python dependencies automatically.
Backend runs on http://localhost:8000

---

## Step 6 — Start frontend

```bash
# Terminal 2
./start-frontend.sh
```

First run installs all npm dependencies automatically.
Frontend runs on http://localhost:5173

---

## Using the app

Open http://localhost:5173

**Graph explorer (left panel)**
- The canvas loads a starter subgraph of sales orders automatically
- Click any node to inspect its properties in the right panel
- Click "Expand neighbors" to grow the graph from any node
- Use the search bar to find nodes by ID, name, or description
- "Fit" resets the zoom; "Clear highlight" removes the amber highlights

**Chat panel (right panel)**
- Type any natural language question about the O2C dataset
- The Cypher query is shown before results arrive
- Results update the graph canvas and the table below it
- "Clear" resets the conversation memory

**Example queries to try**
- Which products appear in the most billing documents?
- Trace the full flow of billing document 90504248
- Show sales orders that were delivered but never billed
- Show sales orders that were billed without a delivery
- Which customers have the most cancelled billing documents?
- List all plants and how many deliveries shipped from each
- Which customers have outstanding uncleared journal entries?

---

## Troubleshooting

**`GEMINI_API_KEY` error on startup**
→ Check `backend/.env` has a real key, not the placeholder text

**Neo4j connection refused**
→ Make sure Docker is running: `docker start neo4j-erp`

**Graph canvas is empty after ingest**
→ Refresh the browser. The initial graph loads on page load.

**"Query execution failed" in chat**
→ The system auto-retries once. If it fails again, try rephrasing.

**Frontend shows "Could not reach backend"**
→ Make sure `./start-backend.sh` is running in another terminal.
