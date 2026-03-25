"""
Chat orchestrator: guardrail → cypher generation → execution → LLM narrative → SSE stream.
"""
import json
from google import genai
from google.genai import types
from app.config import GEMINI_API_KEY
from app.guardrails import check_scope
from app.cypher_generator import generate_cypher
from app.db import run_query, run_query_graph
from app.result_formatter import format_results
from app.schema_context import SCHEMA_CONTEXT

_client = None

OUT_OF_SCOPE_MSG = (
    "This system is designed to answer questions related to the provided "
    "SAP Order-to-Cash dataset only. Your question appears to be outside "
    "that scope. Please ask about sales orders, deliveries, billing documents, "
    "customers, products, plants, journal entries, or payments."
)

NARRATIVE_SYSTEM = f"""
{SCHEMA_CONTEXT}

You are a helpful assistant explaining query results from an SAP Order-to-Cash graph database.
Given a user question and the structured query results (as JSON), write a clear, concise natural-language response.

Rules:
- Be specific: reference actual IDs, amounts, dates from the data.
- For trace/flow results, describe the O2C journey step by step.
- For broken-flow results, clearly explain what is missing in the flow.
- For aggregations, highlight top items and notable patterns.
- Keep responses under 300 words unless the data warrants more detail.
- Do NOT invent data not present in the results.
- If results are empty, say so clearly and suggest why.
- Format amounts as INR with 2 decimal places.
- Do not repeat the user's question back to them.
"""


def get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


def handle_chat(user_message: str, conversation_history: list):
    """
    Generator that yields SSE-formatted strings.
    Yields structured events: data, graph_data, error.
    """

    # ── Step 1: Guardrail ────────────────────────────────────────────────────
    scope = check_scope(user_message)
    if not scope.get("in_scope", True):
        yield _sse("text", OUT_OF_SCOPE_MSG)
        yield _sse("done", {})
        return

    # ── Step 2: Generate Cypher ──────────────────────────────────────────────
    try:
        plan = generate_cypher(user_message, conversation_history)
    except Exception as e:
        yield _sse("error", f"Failed to generate query: {str(e)}")
        yield _sse("done", {})
        return

    cypher = plan.get("cypher", "")
    intent = plan.get("intent", "lookup")
    summary = plan.get("summary", "")

    yield _sse("status", {"message": f"Running: {summary}", "cypher": cypher})

    # ── Step 3: Execute Cypher (with one retry on syntax error) ─────────────
    # Use run_query_graph for traversal intents (preserves Node/Relationship objects)
    # Use run_query for aggregations (returns plain scalars — faster, lighter)
    graph_intents = {"trace_flow", "broken_flow", "explore"}
    executor = run_query_graph if intent in graph_intents else run_query

    raw_records = None
    for attempt in range(2):
        try:
            raw_records = executor(cypher)
            break
        except Exception as e:
            if attempt == 0:
                try:
                    fix_prompt = (
                        f"The following Cypher query failed with this error:\n"
                        f"Error: {str(e)}\n\n"
                        f"Failed query:\n{cypher}\n\n"
                        f"Original question: {user_message}\n\n"
                        f"Return a corrected JSON with keys: cypher, intent, summary."
                    )
                    fixed = generate_cypher(fix_prompt, conversation_history)
                    cypher = fixed.get("cypher", cypher)
                    intent = fixed.get("intent", intent)
                    executor = run_query_graph if intent in graph_intents else run_query
                    yield _sse("status", {"message": f"Retrying: {fixed.get('summary', summary)}", "cypher": cypher})
                except Exception:
                    pass
            else:
                yield _sse("error", f"Query execution failed: {str(e)}\n\nGenerated Cypher:\n{cypher}")
                yield _sse("done", {})
                return

    # ── Step 4: Format results ───────────────────────────────────────────────
    formatted = format_results(raw_records, intent)
    yield _sse("graph_data", formatted)

    # ── Step 5: Narrative response (streaming) ───────────────────────────────
    result_summary = {
        "count": formatted["count"],
        "intent": intent,
        "table_preview": formatted["table"][:20],  # first 20 rows for narrative
    }

    narrative_prompt = (
        f"User question: {user_message}\n\n"
        f"Query intent: {intent}\n"
        f"Query summary: {summary}\n\n"
        f"Results ({formatted['count']} records):\n"
        f"{json.dumps(result_summary['table_preview'], indent=2, default=str)}"
    )

    client = get_client()
    try:
        stream = client.models.generate_content_stream(
            model="gemini-2.5-flash",
            contents=narrative_prompt,
            config=types.GenerateContentConfig(
                system_instruction=NARRATIVE_SYSTEM,
                max_output_tokens=600,
            ),
        )
        for chunk in stream:
            if chunk.text:
                yield _sse("text", chunk.text)
    except Exception as e:
        yield _sse("error", f"Failed to generate narrative: {str(e)}")

    yield _sse("done", {"cypher": cypher, "node_count": len(formatted["nodes"])})


def _sse(event: str, data) -> str:
    if isinstance(data, str):
        payload = data
    else:
        payload = json.dumps(data, default=str)
    return f"event: {event}\ndata: {payload}\n\n"
