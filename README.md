# ConversationalERP

Graph-based conversational interface for SAP Order-to-Cash data.

## Architecture

```
frontend/   React + Vite + Cytoscape.js  (port 5173)
backend/    FastAPI + Neo4j + Anthropic   (port 8000)
sap-o2c-data/   JSONL source files
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- Neo4j 5.x (Desktop or Docker)
- Anthropic API key

## Neo4j Setup

**Option A — Docker (recommended):**
```bash
docker run -d \
  --name neo4j-erp \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password123 \
  neo4j:5
```

**Option B — Neo4j Desktop:**
Download from https://neo4j.com/download/ and create a new database.

## Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env: set NEO4J_PASSWORD and ANTHROPIC_API_KEY

pip install -r requirements.txt

# Start the API server
uvicorn main:app --reload --port 8000
```

## Load Data into Neo4j

Once the backend is running, trigger ingestion via the UI "Ingest data" button,
or run directly:

```bash
cd backend
python -m app.ingestion
```

This creates all nodes and edges from the JSONL files. Takes ~2-5 minutes.

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Usage

1. Click **Ingest data** in the header (first time only)
2. The graph explorer loads a starter subgraph — click any node to inspect it
3. Click **Expand neighbors** to grow the graph from any node
4. Use the **search bar** to find specific nodes by ID or name
5. Type a natural language question in the chat panel

## Example Queries

- Which products appear in the most billing documents?
- Trace the full flow of billing document 90504248
- Show sales orders that were delivered but never billed
- Show sales orders billed without a delivery
- Which customers have the most cancelled billing documents?
- List all plants and how many deliveries shipped from each
- Which customers have outstanding (uncleared) journal entries?

## Project Structure

```
backend/
  main.py                  FastAPI app + all routes
  app/
    config.py              Environment variables
    db.py                  Neo4j driver singleton
    ingestion.py           JSONL → Neo4j graph builder
    schema_context.py      LLM schema annotation + guardrail prompt
    guardrails.py          Domain scope classifier
    cypher_generator.py    NL → Cypher (LLM + few-shot examples)
    result_formatter.py    Neo4j records → graph nodes/edges/table
    chat.py                SSE orchestrator (guardrail→query→execute→narrate)
    graph_api.py           Expand, search, overview, initial graph

frontend/
  src/
    App.jsx                Root layout
    api.js                 All fetch/SSE calls to backend
    constants.js           Node colors + example queries
    useGraph.js            Cytoscape.js hook (add, set, highlight, fit)
    components/
      Header.jsx           Stats bar + legend + ingest button
      GraphExplorer.jsx    Canvas + search + toolbar
      NodePanel.jsx        Node property inspector
      ChatPanel.jsx        Streaming chat interface
```
