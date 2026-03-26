"""
Chat orchestrator: guardrail → cypher generation → execution → LLM narrative → SSE stream.
"""
import json
import re
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

You are a precise data analyst explaining query results from an SAP Order-to-Cash graph database.
Given a user question and the structured query results (as JSON), write a complete, accurate natural-language response.

Rules:
- COMPLETENESS: Include ALL significant records from the data. Do not silently drop records.
- SPECIFICITY: Always reference actual IDs, amounts, dates, and names from the data — never use vague placeholders.
- NUMBERS: Report exact counts, totals, and values. Format currency as INR with 2 decimal places.
- TRACE / FLOW queries: Walk through every step of the O2C journey in order — Sales Order → Delivery → Billing → Journal Entry → Payment. State clearly which steps exist and which are missing.
- BROKEN FLOW queries: For each record, explicitly name the document and state which downstream step is absent.
- AGGREGATION queries: List all returned rows with their values. Call out the top entry AND any notable outliers.
- LOOKUP queries: List every returned record with its key fields — ID, amount, date, status. If there are more than 15 records, summarise the first 10 in detail then state the remaining count.
- EMPTY results: State clearly that no records were found and explain the most likely reason (wrong ID format, data gap, filter too narrow).
- DO NOT invent, estimate, or extrapolate data not present in the results.
- DO NOT repeat the user's question.
- DO NOT truncate or abbreviate the answer just to keep it short — accuracy and completeness take priority.

FORMATTING RULES (strictly follow these):
- Write product names, IDs, and document numbers in plain text — do NOT wrap them in markdown bold (**) or any other markdown inside a running sentence, as it breaks rendering.
- When listing multiple items, use a clean numbered or bulleted list with one item per line: the product name first, then its ID in parentheses, then the count. Example:
  1. SUNSCREEN GEL SPF50-PA+++ 50ML (S8907367008620) — 22 billing documents
  2. FACESERUM 30ML VIT C (S8907367008621) — 22 billing documents
- Never split a product name or ID across multiple lines or sentence fragments.
- Use plain dashes (—) or colons to separate label from value. Do not use markdown bold for emphasis within list items.
"""


def _strip_markdown(text: str) -> str:
    """
    Removes markdown syntax from the fully-collected LLM response.
    Called once on the complete text so cross-token patterns (e.g. **bold**
    split across streaming chunks) are always resolved correctly.
    """
    # Bold/italic (order matters: *** before ** before *)
    text = re.sub(r'\*{3}(.+?)\*{3}', r'\1', text, flags=re.DOTALL)
    text = re.sub(r'\*{2}(.+?)\*{2}', r'\1', text, flags=re.DOTALL)
    # Italic — only match when surrounded by word chars to avoid eating bullet dashes
    text = re.sub(r'(?<!\*)\*(?!\s)([^*\n]+?)(?<!\s)\*(?!\*)', r'\1', text)
    # Inline code
    text = re.sub(r'`([^`]+)`', r'\1', text)
    # Headings
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    # Horizontal rules
    text = re.sub(r'^[-*_]{3,}\s*$', '', text, flags=re.MULTILINE)
    # Links [text](url) → text
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # Collapse 3+ blank lines to 2
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


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
    all_rows = formatted["table"]  # send ALL rows, not just first 20
    result_summary = {
        "count": formatted["count"],
        "intent": intent,
        "rows": all_rows,
    }

    narrative_prompt = (
        f"User question: {user_message}\n\n"
        f"Query intent: {intent}\n"
        f"Query summary: {summary}\n\n"
        f"Total records returned: {formatted['count']}\n\n"
        f"Full results:\n"
        f"{json.dumps(result_summary['rows'], indent=2, default=str)}"
    )

    client = get_client()
    try:
        stream = client.models.generate_content_stream(
            model="gemini-2.5-flash",
            contents=narrative_prompt,
            config=types.GenerateContentConfig(
                system_instruction=NARRATIVE_SYSTEM,
                max_output_tokens=1200,
            ),
        )
        # Collect the full response first so markdown stripping works across chunk boundaries
        full_text = ""
        for chunk in stream:
            if chunk.text:
                full_text += chunk.text
        # Strip markdown once on the complete text, then stream in sentences/lines
        clean_text = _strip_markdown(full_text)
        # Yield line-by-line so the frontend still gets a streaming feel
        for line in clean_text.splitlines(keepends=True):
            yield _sse("text", line)
    except Exception as e:
        yield _sse("error", f"Failed to generate narrative: {str(e)}")

    yield _sse("done", {"cypher": cypher, "node_count": len(formatted["nodes"])})


def _sse(event: str, data) -> str:
    if isinstance(data, str):
        payload = data
    else:
        payload = json.dumps(data, default=str)
    return f"event: {event}\ndata: {payload}\n\n"
