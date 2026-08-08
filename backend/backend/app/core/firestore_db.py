import json
import os
import sqlite3
import threading
import uuid
from typing import Optional

from app.core.config import get_firestore, APP_ID, DATA_DIR, STORAGE_BACKEND

# ---------------------------------------------------------------------------
# Storage backends
# ---------------------------------------------------------------------------
# 1. firestore: real Google Firestore (used when credentials are configured).
# 2. sqlite:    persistent local file database. This is the DEFAULT when
#               Firestore is not configured, so accounts and wellness data
#               survive backend/frontend/computer restarts.
# 3. memory:    in-memory only. Retained strictly as a development/testing
#               fallback and used ONLY when STORAGE_BACKEND=memory is set.
#               Data in this store is LOST when the process stops.
# ---------------------------------------------------------------------------

_DB_PATH = os.path.join(DATA_DIR, "emora.db")
# RLock so nested calls (save_doc -> _connect) don't self-deadlock.
_WRITE_LOCK = threading.RLock()

# Dev-only in-memory fallback (explicit STORAGE_BACKEND=memory).
# Key = "/".join(path parts), Value = document dict (without the id part).
MEMORY_STORE: dict[str, dict] = {}


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(_DB_PATH, timeout=15)
    conn.row_factory = sqlite3.Row
    with _WRITE_LOCK:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute(
            "CREATE TABLE IF NOT EXISTS docs ("
            " collection TEXT NOT NULL,"
            " doc_id TEXT NOT NULL,"
            " data TEXT NOT NULL,"
            " PRIMARY KEY (collection, doc_id))"
        )
    return conn


def backend() -> str:
    """Returns the active storage backend: 'firestore', 'sqlite' or 'memory'."""
    if STORAGE_BACKEND == "firestore":
        return "firestore" if get_firestore() else "sqlite"
    if STORAGE_BACKEND == "sqlite":
        return "sqlite"
    if STORAGE_BACKEND == "memory":
        return "memory"
    # Default: Firestore when configured, otherwise persistent SQLite.
    return "firestore" if get_firestore() else "sqlite"


def storage_info() -> dict:
    """Expose which backend is active (for status/debug endpoints)."""
    return {"backend": backend(), "data_dir": DATA_DIR, "db_path": _DB_PATH}


def _fs_ref(ref, part, is_doc):
    if is_doc:
        return ref.document(part)
    return ref.collection(part)


def _resolve(parts):
    """Build a Firestore collection/document reference from path parts.
    Parts alternate collection, document, collection, document ...
    A collection-level path has an even number of parts.
    """
    db = get_firestore()
    if not parts:
        return db
    ref = db
    is_doc = True
    for p in parts:
        ref = _fs_ref(ref, p, is_doc)
        is_doc = not is_doc
    return ref


def user_base(uid: str, feature: str) -> list[str]:
    """Standard document path for a user feature (collection level)."""
    return ["artifacts", APP_ID, "users", uid, feature]


def save_doc(parts: list[str], data: dict) -> None:
    """Upsert a document, MERGING fields into the existing document.

    Mirrors Firestore's set(data, merge=True) semantics: callers rely on
    partial updates (e.g. end_session adds ended_at/status without losing
    turns/created_at). parts must end with a document id.
    """
    mode = backend()
    if mode == "firestore":
        _resolve(parts).set(data, merge=True)
        return
    if mode == "memory":
        key = "/".join(parts)
        merged = dict(MEMORY_STORE.get(key, {}))
        merged.update(data)
        MEMORY_STORE[key] = merged
        return
    collection = "/".join(parts[:-1])
    doc_id = parts[-1]
    existing = get_doc(parts) or {}
    merged = dict(existing)
    merged.update(data)
    payload = json.dumps(merged, default=str)
    with _WRITE_LOCK:
        conn = _connect()
        try:
            conn.execute(
                "INSERT INTO docs (collection, doc_id, data) VALUES (?,?,?) "
                "ON CONFLICT(collection, doc_id) DO UPDATE SET data=excluded.data",
                (collection, doc_id, payload),
            )
            conn.commit()
        finally:
            conn.close()


def add_doc(parts: list[str], data: dict) -> str:
    """Create a document with an auto-generated id. Returns the id."""
    doc_id = uuid.uuid4().hex
    save_doc(parts + [doc_id], data)
    return doc_id


def get_doc(parts: list[str]) -> Optional[dict]:
    """Fetch a single document. parts must end with a document id."""
    mode = backend()
    if mode == "firestore":
        ref = _resolve(parts)
        snap = ref.get()
        return snap.to_dict() if snap and snap.exists else None
    if mode == "memory":
        return MEMORY_STORE.get("/".join(parts))
    collection = "/".join(parts[:-1])
    doc_id = parts[-1]
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT data FROM docs WHERE collection=? AND doc_id=?",
            (collection, doc_id),
        ).fetchone()
    finally:
        conn.close()
    return json.loads(row["data"]) if row else None


def delete_doc(parts: list[str]) -> None:
    """Delete a document. parts must end with a document id."""
    mode = backend()
    if mode == "firestore":
        _resolve(parts).delete()
        return
    if mode == "memory":
        MEMORY_STORE.pop("/".join(parts), None)
        return
    collection = "/".join(parts[:-1])
    doc_id = parts[-1]
    with _WRITE_LOCK:
        conn = _connect()
        try:
            conn.execute(
                "DELETE FROM docs WHERE collection=? AND doc_id=?",
                (collection, doc_id),
            )
            conn.commit()
        finally:
            conn.close()


def list_docs(parts: list[str]) -> list[dict]:
    """List all documents in a collection. Each entry includes its id."""
    mode = backend()
    if mode == "firestore":
        ref = _resolve(parts)
        out = []
        for snap in ref.stream():
            d = snap.to_dict() or {}
            d["id"] = snap.id
            out.append(d)
        return out
    if mode == "memory":
        prefix = "/".join(parts) + "/"
        out = []
        for key, value in MEMORY_STORE.items():
            if key.startswith(prefix):
                rest = key[len(prefix):]
                if "/" in rest:
                    continue
                d = dict(value)
                d["id"] = rest
                out.append(d)
        return out
    collection = "/".join(parts)
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT doc_id, data FROM docs WHERE collection=?", (collection,)
        ).fetchall()
    finally:
        conn.close()
    out = []
    for r in rows:
        d = json.loads(r["data"])
        d["id"] = r["doc_id"]
        out.append(d)
    return out


def query_docs(parts: list[str], field: str, value) -> list[dict]:
    """Filter a collection by an equality match on one field."""
    if backend() == "firestore":
        ref = _resolve(parts)
        out = []
        for snap in ref.where(field, "==", value).stream():
            d = snap.to_dict() or {}
            d["id"] = snap.id
            out.append(d)
        return out
    return [d for d in list_docs(parts) if d.get(field) == value]
