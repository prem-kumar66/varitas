"""
Persistence layer — async SQLite
Stores sessions, answers, signals for: report generation, history,
and multi-candidate comparison.
"""
import os
import json
import aiosqlite
from typing import List, Dict, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "veritas.db")


SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    candidate_name TEXT,
    role TEXT,
    started_at REAL NOT NULL,
    ended_at REAL,
    avg_authenticity REAL,
    avg_risk REAL,
    baseline_json TEXT
);

CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    question TEXT NOT NULL,
    transcript TEXT NOT NULL,
    delay_sec REAL,
    duration_sec REAL,
    word_count INTEGER,
    risk_score REAL,
    authenticity_score REAL,
    signals_json TEXT,
    explanations_json TEXT,
    evidence_json TEXT,
    follow_up TEXT,
    perplexity REAL,
    is_calibration INTEGER DEFAULT 0,
    created_at REAL NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_answers_session ON answers(session_id);
"""


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(SCHEMA)
        await db.commit()


async def upsert_session(session_id: str, candidate_name: str = "", role: str = "", started_at: float = 0.0):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO sessions (id, candidate_name, role, started_at)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                   candidate_name = excluded.candidate_name,
                   role = excluded.role""",
            (session_id, candidate_name, role, started_at),
        )
        await db.commit()


async def save_answer(
    session_id: str, question: str, transcript: str,
    delay_sec: float, duration_sec: float, word_count: int,
    risk_score: float, authenticity_score: float,
    signals: Dict, explanations: Dict, evidence: Dict,
    follow_up: str, perplexity: Optional[float],
    is_calibration: bool, created_at: float,
):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO answers
               (session_id, question, transcript, delay_sec, duration_sec, word_count,
                risk_score, authenticity_score, signals_json, explanations_json,
                evidence_json, follow_up, perplexity, is_calibration, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (session_id, question, transcript, delay_sec, duration_sec, word_count,
             risk_score, authenticity_score, json.dumps(signals),
             json.dumps(explanations), json.dumps(evidence, default=lambda o: o.__dict__),
             follow_up, perplexity, 1 if is_calibration else 0, created_at),
        )
        await db.commit()


async def get_session_answers(session_id: str) -> List[Dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM answers WHERE session_id = ? ORDER BY created_at",
            (session_id,),
        ) as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]


async def get_session(session_id: str) -> Optional[Dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)) as cur:
            row = await cur.fetchone()
            return dict(row) if row else None


async def finalize_session(session_id: str, ended_at: float):
    """Compute and persist session-level summary stats."""
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            """SELECT AVG(authenticity_score), AVG(risk_score) FROM answers
               WHERE session_id = ? AND is_calibration = 0""",
            (session_id,),
        ) as cur:
            row = await cur.fetchone()
            avg_auth, avg_risk = row if row else (0.0, 0.0)

        await db.execute(
            "UPDATE sessions SET ended_at = ?, avg_authenticity = ?, avg_risk = ? WHERE id = ?",
            (ended_at, avg_auth or 0.0, avg_risk or 0.0, session_id),
        )
        await db.commit()


async def list_sessions() -> List[Dict]:
    """For the comparison view."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """SELECT s.*, COUNT(a.id) as answer_count
               FROM sessions s
               LEFT JOIN answers a ON a.session_id = s.id AND a.is_calibration = 0
               GROUP BY s.id
               ORDER BY s.started_at DESC"""
        ) as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]
