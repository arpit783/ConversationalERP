"""
FastAPI application entry point.
Mounts all routes: chat (SSE), graph exploration, ingestion trigger.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

from app.chat import handle_chat
from app.graph_api import get_neighborhood, search_nodes, get_overview_stats, get_initial_graph
from app.memory import get_history, add_turn, clear as clear_session
from app.db import close_driver


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    close_driver()


app = FastAPI(title="ConversationalERP", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic models ────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []
    session_id: Optional[str] = "default"


class ExpandRequest(BaseModel):
    node_id: str


class SearchRequest(BaseModel):
    query: str
    limit: Optional[int] = 30


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/chat")
async def chat(req: ChatRequest):
    """
    SSE endpoint: streams chat response events.
    Events: status | text | graph_data | error | done
    Uses server-side memory when session_id is provided.
    """
    session_id = req.session_id or "default"
    # Merge server-side history with any client-supplied history
    server_history = get_history(session_id)
    history = server_history if server_history else [
        {"role": m.role, "content": m.content} for m in req.history
    ]

    collected_text = []

    def event_generator():
        for chunk in handle_chat(req.message, history):
            # Collect assistant text for memory storage
            if chunk.startswith("event: text\n"):
                data = chunk.split("data: ", 1)[-1].strip()
                collected_text.append(data)
            yield chunk
        # Persist turn after stream completes
        assistant_response = "".join(collected_text) or "(graph result)"
        add_turn(session_id, req.message, assistant_response)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.delete("/chat/session/{session_id}")
def clear_chat_session(session_id: str):
    """Clears conversation memory for a session."""
    clear_session(session_id)
    return {"status": "cleared", "session_id": session_id}


@app.post("/graph/expand")
def expand_node(req: ExpandRequest):
    """Returns the immediate neighborhood of a node for explorer expansion."""
    try:
        return get_neighborhood(req.node_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/graph/search")
def search(req: SearchRequest):
    """Full-text search over node labels and key fields."""
    try:
        return search_nodes(req.query, req.limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/graph/overview")
def overview():
    """Node and edge counts for the dashboard header."""
    try:
        return get_overview_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/graph/initial")
def initial_graph():
    """Starter subgraph for the explorer canvas."""
    try:
        return get_initial_graph()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ingest")
def trigger_ingestion():
    """Triggers the full ingestion pipeline (run once after Neo4j is ready)."""
    try:
        from app.ingestion import run_ingestion
        run_ingestion()
        return {"status": "ingestion complete"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
