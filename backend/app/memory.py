"""
Lightweight in-memory conversation store.
Keyed by session_id (passed from frontend via header or body).
Keeps the last N turns per session.
"""
from collections import defaultdict, deque
from typing import List, Dict

MAX_TURNS = 10  # keep last 10 user/assistant pairs = 20 messages

_store: Dict[str, deque] = defaultdict(lambda: deque(maxlen=MAX_TURNS * 2))


def get_history(session_id: str) -> List[dict]:
    return list(_store[session_id])


def add_turn(session_id: str, user_msg: str, assistant_msg: str):
    _store[session_id].append({"role": "user", "content": user_msg})
    _store[session_id].append({"role": "assistant", "content": assistant_msg})


def clear(session_id: str):
    _store[session_id].clear()


def list_sessions() -> List[str]:
    return list(_store.keys())
