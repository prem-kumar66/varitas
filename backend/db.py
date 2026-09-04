"""
Persistence layer — async SQLite
Stores sessions, answers, signals, academic subjects, question banks, and answer keys.
"""
import os
import json
import aiosqlite
from typing import List, Dict, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "veritas.db")


SCHEMA = """
CREATE TABLE IF NOT EXISTS subjects (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_key TEXT NOT NULL,
    question_text TEXT NOT NULL,
    reference_answer TEXT NOT NULL,
    rubric_keywords TEXT,
    max_marks INTEGER DEFAULT 10,
    time_limit_sec INTEGER DEFAULT 120,
    FOREIGN KEY (subject_key) REFERENCES subjects(key)
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    candidate_name TEXT,
    roll_number TEXT,
    mobile_number TEXT,
    academic_year TEXT,
    role TEXT,
    subject_key TEXT,
    mode TEXT DEFAULT 'oral',
    started_at REAL NOT NULL,
    ended_at REAL,
    avg_authenticity REAL,
    avg_accuracy REAL,
    avg_overall REAL,
    avg_risk REAL,
    baseline_json TEXT
);

CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    question TEXT NOT NULL,
    transcript TEXT NOT NULL,
    mode TEXT DEFAULT 'oral',
    delay_sec REAL,
    duration_sec REAL,
    word_count INTEGER,
    risk_score REAL,
    authenticity_score REAL,
    accuracy_score REAL DEFAULT 0.0,
    overall_score REAL DEFAULT 0.0,
    copy_paste_attempts INTEGER DEFAULT 0,
    reference_answer TEXT,
    key_points_covered_json TEXT,
    missing_points_json TEXT,
    conceptual_feedback TEXT,
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

CREATE TABLE IF NOT EXISTS assessments (
    exam_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mode TEXT NOT NULL,
    subject TEXT,
    unit TEXT,
    department TEXT,
    year TEXT,
    section TEXT,
    source_pdf TEXT,
    teacher TEXT,
    difficulty TEXT,
    questions_json TEXT NOT NULL,
    created_at REAL NOT NULL
);
"""


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(SCHEMA)
        # Migrate columns if existing database without new fields
        table_info = await (await db.execute("PRAGMA table_info(sessions)")).fetchall()
        column_names = [col[1] for col in table_info]
        if "roll_number" not in column_names:
            await db.execute("ALTER TABLE sessions ADD COLUMN roll_number TEXT")
        if "mobile_number" not in column_names:
            await db.execute("ALTER TABLE sessions ADD COLUMN mobile_number TEXT")
        if "academic_year" not in column_names:
            await db.execute("ALTER TABLE sessions ADD COLUMN academic_year TEXT")
        if "subject_key" not in column_names:
            await db.execute("ALTER TABLE sessions ADD COLUMN subject_key TEXT")
        if "mode" not in column_names:
            await db.execute("ALTER TABLE sessions ADD COLUMN mode TEXT DEFAULT 'oral'")
        if "avg_accuracy" not in column_names:
            await db.execute("ALTER TABLE sessions ADD COLUMN avg_accuracy REAL")
        if "avg_overall" not in column_names:
            await db.execute("ALTER TABLE sessions ADD COLUMN avg_overall REAL")

        ans_info = await (await db.execute("PRAGMA table_info(answers)")).fetchall()
        ans_cols = [col[1] for col in ans_info]
        if "mode" not in ans_cols:
            await db.execute("ALTER TABLE answers ADD COLUMN mode TEXT DEFAULT 'oral'")
        if "accuracy_score" not in ans_cols:
            await db.execute("ALTER TABLE answers ADD COLUMN accuracy_score REAL DEFAULT 0.0")
        if "overall_score" not in ans_cols:
            await db.execute("ALTER TABLE answers ADD COLUMN overall_score REAL DEFAULT 0.0")
        if "copy_paste_attempts" not in ans_cols:
            await db.execute("ALTER TABLE answers ADD COLUMN copy_paste_attempts INTEGER DEFAULT 0")
        if "reference_answer" not in ans_cols:
            await db.execute("ALTER TABLE answers ADD COLUMN reference_answer TEXT")
        if "key_points_covered_json" not in ans_cols:
            await db.execute("ALTER TABLE answers ADD COLUMN key_points_covered_json TEXT")
        if "missing_points_json" not in ans_cols:
            await db.execute("ALTER TABLE answers ADD COLUMN missing_points_json TEXT")
        if "conceptual_feedback" not in ans_cols:
            await db.execute("ALTER TABLE answers ADD COLUMN conceptual_feedback TEXT")

        await db.commit()


async def upsert_session(
    session_id: str,
    candidate_name: str = "",
    roll_number: str = "",
    mobile_number: str = "",
    academic_year: str = "",
    role: str = "",
    subject_key: str = "",
    mode: str = "oral",
    started_at: float = 0.0,
):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO sessions (id, candidate_name, roll_number, mobile_number, academic_year, role, subject_key, mode, started_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                   candidate_name = excluded.candidate_name,
                   roll_number = excluded.roll_number,
                   mobile_number = excluded.mobile_number,
                   academic_year = excluded.academic_year,
                   role = excluded.role,
                   subject_key = excluded.subject_key,
                   mode = excluded.mode""",
            (session_id, candidate_name, roll_number, mobile_number, academic_year, role, subject_key, mode, started_at),
        )
        await db.commit()


async def save_answer(
    session_id: str,
    question: str,
    transcript: str,
    delay_sec: float,
    duration_sec: float,
    word_count: int,
    risk_score: float,
    authenticity_score: float,
    signals: Dict,
    explanations: Dict,
    evidence: Dict,
    follow_up: str,
    perplexity: Optional[float],
    is_calibration: bool,
    created_at: float,
    mode: str = "oral",
    accuracy_score: float = 0.0,
    overall_score: float = 0.0,
    copy_paste_attempts: int = 0,
    reference_answer: str = "",
    key_points_covered: Optional[List[str]] = None,
    missing_points: Optional[List[str]] = None,
    conceptual_feedback: str = "",
):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO answers
               (session_id, question, transcript, mode, delay_sec, duration_sec, word_count,
                risk_score, authenticity_score, accuracy_score, overall_score, copy_paste_attempts,
                reference_answer, key_points_covered_json, missing_points_json, conceptual_feedback,
                signals_json, explanations_json, evidence_json, follow_up, perplexity, is_calibration, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                session_id, question, transcript, mode, delay_sec, duration_sec, word_count,
                risk_score, authenticity_score, accuracy_score, overall_score, copy_paste_attempts,
                reference_answer, json.dumps(key_points_covered or []),
                json.dumps(missing_points or []), conceptual_feedback,
                json.dumps(signals), json.dumps(explanations),
                json.dumps(evidence, default=lambda o: o.__dict__),
                follow_up, perplexity, 1 if is_calibration else 0, created_at
            ),
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
            res = []
            for r in rows:
                d = dict(r)
                if d.get("key_points_covered_json"):
                    d["key_points_covered"] = json.loads(d["key_points_covered_json"])
                if d.get("missing_points_json"):
                    d["missing_points"] = json.loads(d["missing_points_json"])
                res.append(d)
            return res


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
            """SELECT AVG(authenticity_score), AVG(accuracy_score), AVG(overall_score), AVG(risk_score)
               FROM answers
               WHERE session_id = ? AND is_calibration = 0""",
            (session_id,),
        ) as cur:
            row = await cur.fetchone()
            avg_auth, avg_acc, avg_overall, avg_risk = row if row else (0.0, 0.0, 0.0, 0.0)

        await db.execute(
            """UPDATE sessions
               SET ended_at = ?, avg_authenticity = ?, avg_accuracy = ?, avg_overall = ?, avg_risk = ?
               WHERE id = ?""",
            (ended_at, avg_auth or 0.0, avg_acc or 0.0, avg_overall or 0.0, avg_risk or 0.0, session_id),
        )
        await db.commit()


async def list_sessions() -> List[Dict]:
    """For the comparison dashboard."""
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


# ---------- Question Bank & Subject CRUD ----------
async def db_list_subjects() -> List[Dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM subjects ORDER BY department, name") as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]


async def db_add_subject(key: str, name: str, department: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO subjects (key, name, department) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET name=excluded.name, department=excluded.department",
            (key, name, department),
        )
        await db.commit()


async def db_list_questions(subject_key: Optional[str] = None) -> List[Dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        if subject_key:
            sql = "SELECT * FROM questions WHERE subject_key = ? ORDER BY id"
            args = (subject_key,)
        else:
            sql = "SELECT * FROM questions ORDER BY subject_key, id"
            args = ()
        async with db.execute(sql, args) as cur:
            rows = await cur.fetchall()
            res = []
            for r in rows:
                d = dict(r)
                if d.get("rubric_keywords"):
                    try:
                        d["rubric_keywords_list"] = json.loads(d["rubric_keywords"])
                    except Exception:
                        d["rubric_keywords_list"] = [k.strip() for k in d["rubric_keywords"].split(",")]
                res.append(d)
            return res


async def db_add_question(
    subject_key: str,
    question_text: str,
    reference_answer: str,
    rubric_keywords: List[str],
    max_marks: int = 10,
    time_limit_sec: int = 120,
) -> int:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """INSERT INTO questions (subject_key, question_text, reference_answer, rubric_keywords, max_marks, time_limit_sec)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (subject_key, question_text, reference_answer, json.dumps(rubric_keywords), max_marks, time_limit_sec),
        )
        await db.commit()
        return cursor.lastrowid


async def db_delete_question(question_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM questions WHERE id = ?", (question_id,))
        await db.commit()

# ---------- Assessments ----------
async def db_save_assessment(
    exam_id: str,
    name: str,
    mode: str,
    subject: str,
    unit: str,
    department: str,
    year: str,
    section: str,
    source_pdf: str,
    teacher: str,
    difficulty: str,
    questions: List[Dict],
    created_at: float,
):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO assessments (exam_id, name, mode, subject, unit, department, year, section, source_pdf, teacher, difficulty, questions_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(exam_id) DO UPDATE SET
                   name = excluded.name,
                   mode = excluded.mode,
                   subject = excluded.subject,
                   unit = excluded.unit,
                   department = excluded.department,
                   year = excluded.year,
                   section = excluded.section,
                   source_pdf = excluded.source_pdf,
                   teacher = excluded.teacher,
                   difficulty = excluded.difficulty,
                   questions_json = excluded.questions_json
            """,
            (exam_id, name, mode, subject, unit, department, year, section, source_pdf, teacher, difficulty, json.dumps(questions), created_at)
        )
        await db.commit()

async def db_list_assessments(department: Optional[str] = None, year: Optional[str] = None) -> List[Dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        sql = "SELECT * FROM assessments"
        args = []
        conditions = []
        if department:
            conditions.append("department = ?")
            args.append(department)
        if year:
            conditions.append("year = ?")
            args.append(year)
        if conditions:
            sql += " WHERE " + " AND ".join(conditions)
        sql += " ORDER BY created_at DESC"
        
        async with db.execute(sql, tuple(args)) as cur:
            rows = await cur.fetchall()
            res = []
            for r in rows:
                d = dict(r)
                if d.get("questions_json"):
                    d["questions"] = json.loads(d["questions_json"])
                res.append(d)
            return res

async def db_get_assessment(exam_id: str) -> Optional[Dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM assessments WHERE exam_id = ?", (exam_id,)) as cur:
            row = await cur.fetchone()
            if row:
                d = dict(row)
                if d.get("questions_json"):
                    d["questions"] = json.loads(d["questions_json"])
                return d
            return None

