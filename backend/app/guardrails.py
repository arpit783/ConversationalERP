"""
Domain guardrail: classifies user queries as in-scope or out-of-scope
before any query generation happens.
"""
import json
from google import genai
from google.genai import types
from app.config import GEMINI_API_KEY
from app.schema_context import GUARDRAIL_PROMPT

_client = None


def get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


def check_scope(user_message: str) -> dict:
    """
    Returns {"in_scope": bool, "reason": str}
    Fast, cheap call — gemini-2.5-flash is free tier.
    """
    client = get_client()
    resp = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=user_message,
        config=types.GenerateContentConfig(
            system_instruction=GUARDRAIL_PROMPT,
            max_output_tokens=120,
        ),
    )
    raw = resp.text.strip()
    try:
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except Exception:
        return {"in_scope": True, "reason": ""}
