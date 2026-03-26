# ConversationalERP

A graph-based conversational interface for SAP Order-to-Cash data analysis. Ask natural language questions about sales orders, deliveries, billing documents, customers, and trace the complete O2C flow visually.

## Features

- **Natural Language Queries**: Ask questions in plain English about your O2C data
- **Interactive Graph Visualization**: Explore relationships between entities using Cytoscape.js
- **Real-time Streaming**: Get responses streamed back with Server-Sent Events
- **Smart Query Generation**: LLM-powered Cypher generation with few-shot examples
- **Domain Guardrails**: Keeps conversations focused on O2C data

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React + Vite  │────▶│  FastAPI Server │────▶│   Neo4j Graph   │
│   (Frontend)    │◀────│   (Backend)     │◀────│   Database      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     Port 5173              Port 8000           Port 7474/7687
                                │
                                ▼
                        ┌─────────────────┐
                        │  Google Gemini  │
                        │   (LLM API)     │
                        └─────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18, Vite 5, Cytoscape.js |
| Backend | FastAPI, Python 3.11+ |
| Database | Neo4j 5.x |
| LLM | Google Gemini 2.5 Flash |
| Streaming | Server-Sent Events (SSE) |

## Prerequisites

- Python 3.11+
- Node.js 18+
- Neo4j 5.x (Docker or Desktop)
- Google Gemini API key ([Get one free](https://aistudio.google.com))

## Quick Start

### 1. Start Neo4j Database

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

### 2. Backend Setup

```bash
cd backend

# Create environment file
cp .env.example .env

# Edit .env with your credentials:
# NEO4J_URI=bolt://localhost:7687
# NEO4J_USER=neo4j
# NEO4J_PASSWORD=password123
# GEMINI_API_KEY=your_gemini_api_key

# Install dependencies
pip install -r requirements.txt

# Start the API server
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:5173

### 4. Load Data

Click the **"Ingest data"** button in the header (first time only), or run:

```bash
cd backend
python -m app.ingestion
```

## Usage

1. **Explore the Graph**: Click nodes to inspect properties, use "Expand neighbors" to grow the visualization
2. **Search**: Use the search bar to find specific nodes by ID or name
3. **Chat**: Type natural language questions in the chat panel

## Example Queries

Try these questions in the chat panel:

- Which products appear in the most billing documents?
- Trace the full flow of billing document 90504248
- Show sales orders that were delivered but never billed
- Show sales orders billed without a delivery
- Which customers have the most cancelled billing documents?
- List all plants and how many deliveries shipped from each
- Which customers have outstanding (uncleared) journal entries?

## Deployment

### Frontend (Vercel)

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Set the **Root Directory** to `frontend`
4. Add environment variable:
   - `VITE_API_URL`: Your deployed backend URL (e.g., `https://your-backend.railway.app`)
5. Deploy

### Backend (Railway / Render / Fly.io)

The backend requires a Python runtime with persistent Neo4j connection. Recommended platforms:

**Railway:**
1. Create a new project at [Railway](https://railway.app)
2. Add a Neo4j plugin or connect to external Neo4j (AuraDB)
3. Deploy from GitHub, set root directory to `backend`
4. Add environment variables: `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, `GEMINI_API_KEY`
5. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

**Neo4j AuraDB (Managed Cloud):**
For production, use [Neo4j AuraDB](https://neo4j.com/cloud/aura/) free tier for a managed graph database.

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEO4J_URI` | Neo4j connection URI | `bolt://localhost:7687` or `neo4j+s://xxx.databases.neo4j.io` |
| `NEO4J_USER` | Neo4j username | `neo4j` |
| `NEO4J_PASSWORD` | Neo4j password | `your_password` |
| `GEMINI_API_KEY` | Google Gemini API key | `AIza...` |
| `DATA_DIR` | Path to JSONL data files | `../sap-o2c-data` |
| `VITE_API_URL` | Backend URL (frontend only) | `https://your-backend.railway.app` |

## Project Structure

```
ConversationalERP/
├── backend/
│   ├── main.py                 # FastAPI app + routes
│   ├── requirements.txt        # Python dependencies
│   ├── .env.example           # Environment template
│   └── app/
│       ├── config.py          # Environment variables
│       ├── db.py              # Neo4j driver singleton
│       ├── ingestion.py       # JSONL → Neo4j graph builder
│       ├── schema_context.py  # LLM schema + guardrail prompt
│       ├── guardrails.py      # Domain scope classifier
│       ├── cypher_generator.py # NL → Cypher (LLM + few-shot)
│       ├── result_formatter.py # Neo4j → graph nodes/edges/table
│       ├── chat.py            # SSE orchestrator
│       └── graph_api.py       # Graph expansion, search, overview
│
├── frontend/
│   ├── package.json           # Node.js dependencies
│   ├── vite.config.js         # Vite config with proxy
│   ├── vercel.json            # Vercel deployment config
│   ├── .env.example           # Environment template
│   └── src/
│       ├── App.jsx            # Root layout
│       ├── api.js             # Fetch/SSE calls to backend
│       ├── constants.js       # Node colors + example queries
│       ├── useGraph.js        # Cytoscape.js hook
│       └── components/
│           ├── Header.jsx     # Stats bar + legend + ingest
│           ├── GraphExplorer.jsx # Canvas + search + toolbar
│           ├── NodePanel.jsx  # Node property inspector
│           └── ChatPanel.jsx  # Streaming chat interface
│
├── sap-o2c-data/              # JSONL source data files
├── start-backend.sh           # Backend startup script
├── start-frontend.sh          # Frontend startup script
└── run-ingestion.sh           # Data ingestion script
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/chat` | SSE chat endpoint (NL → Cypher → results) |
| DELETE | `/chat/session/{session_id}` | Clear chat session |
| POST | `/graph/expand` | Expand node neighborhood |
| POST | `/graph/search` | Full-text search nodes |
| GET | `/graph/overview` | Node/edge counts |
| GET | `/graph/initial` | Starter subgraph |
| POST | `/ingest` | Trigger data ingestion |

## Data Model

The O2C graph includes these entity types:

- **SalesOrder** / **SalesOrderItem** / **SalesScheduleLine**
- **OutboundDelivery** / **DeliveryItem**
- **BillingDocument** / **BillingItem**
- **JournalEntry** / **Payment**
- **BusinessPartner** / **Address**
- **Product** / **ProductDescription** / **ProductPlant** / **StorageLocation**
- **Plant** / **CustomerCompanyAssignment** / **CustomerSalesAreaAssignment**

## License

MIT
