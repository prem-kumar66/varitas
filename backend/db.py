"""
Persistence layer — async SQLite
Stores sessions, answers, signals, academic subjects, question banks, and answer keys.
"""
import os
import re
import json
import time
import secrets
import aiosqlite
from typing import List, Dict, Optional, Tuple

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

CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_email TEXT UNIQUE NOT NULL,
    student_name TEXT NOT NULL,
    student_roll TEXT UNIQUE NOT NULL,
    mobile_number TEXT,
    academic_year TEXT NOT NULL,
    department TEXT NOT NULL,
    section TEXT DEFAULT 'A',
    password TEXT NOT NULL,
    created_at REAL NOT NULL,
    exam_id TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS faculty (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    phone TEXT,
    designation TEXT,
    passcode TEXT,
    created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS faculty_queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    current_dept TEXT,
    target_dept TEXT NOT NULL,
    phone TEXT,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    created_at REAL NOT NULL
);

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

CREATE TABLE IF NOT EXISTS test_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    faculty_email TEXT NOT NULL,
    department TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    section TEXT NOT NULL,
    assigned_mode TEXT NOT NULL,
    student_roll TEXT,
    title TEXT,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS faculty_validation_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department TEXT NOT NULL,
    subject TEXT NOT NULL,
    student_roll TEXT NOT NULL,
    student_name TEXT NOT NULL,
    student_email TEXT,
    status TEXT DEFAULT 'pending',
    assigned_faculty TEXT,
    created_at REAL NOT NULL,
    resolved_at REAL
);

CREATE TABLE IF NOT EXISTS student_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_roll TEXT NOT NULL,
    subject TEXT NOT NULL,
    department TEXT NOT NULL,
    message TEXT NOT NULL,
    test_ready INTEGER DEFAULT 1,
    is_read INTEGER DEFAULT 0,
    created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS exam_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_roll TEXT NOT NULL,
    exam_id TEXT NOT NULL,
    session_id TEXT,
    subject TEXT,
    score REAL DEFAULT 0.0,
    max_score REAL DEFAULT 0.0,
    authenticity_score REAL DEFAULT 100.0,
    violations_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'completed',
    completed_at REAL NOT NULL,
    UNIQUE(student_roll, exam_id)
);

CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    user_type TEXT NOT NULL,
    otp TEXT NOT NULL,
    created_at REAL NOT NULL,
    expires_at REAL NOT NULL,
    used INTEGER DEFAULT 0
);
"""


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(SCHEMA)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS password_resets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                user_type TEXT NOT NULL,
                otp TEXT NOT NULL,
                created_at REAL NOT NULL,
                expires_at REAL NOT NULL,
                used INTEGER DEFAULT 0
            )
        """)
        # Migrate columns if existing database without new fields
        await db.execute("""
            CREATE TABLE IF NOT EXISTS exam_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_roll TEXT NOT NULL,
                exam_id TEXT NOT NULL,
                session_id TEXT,
                subject TEXT,
                score REAL DEFAULT 0.0,
                max_score REAL DEFAULT 0.0,
                authenticity_score REAL DEFAULT 100.0,
                violations_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'completed',
                completed_at REAL NOT NULL,
                UNIQUE(student_roll, exam_id)
            )
        """)
        # Migrate columns in exam_attempts if existing without new fields
        attempt_cols = [c[1] for c in await (await db.execute("PRAGMA table_info(exam_attempts)")).fetchall()]
        if "session_id" not in attempt_cols:
            await db.execute("ALTER TABLE exam_attempts ADD COLUMN session_id TEXT")
        if "subject" not in attempt_cols:
            await db.execute("ALTER TABLE exam_attempts ADD COLUMN subject TEXT")
        if "violations_count" not in attempt_cols:
            await db.execute("ALTER TABLE exam_attempts ADD COLUMN violations_count INTEGER DEFAULT 0")
        student_cols = [c[1] for c in await (await db.execute("PRAGMA table_info(students)")).fetchall()]
        if "section" not in student_cols:
            await db.execute("ALTER TABLE students ADD COLUMN section TEXT DEFAULT 'A'")

        # Ensure student section accurately reflects their roll number if present
        async with db.execute("SELECT id, student_roll, section FROM students") as cur:
            all_st = await cur.fetchall()
        for st_id, st_roll, st_sec in all_st:
            if st_roll:
                m = re.match(r"^(\d{2})eg(\d{3})([a-r])(\d{2})$", st_roll.strip().lower())
                if m:
                    actual_sec = m.group(3).upper()
                    if st_sec != actual_sec:
                        await db.execute("UPDATE students SET section = ? WHERE id = ?", (actual_sec, st_id))

        notif_cols = [c[1] for c in await (await db.execute("PRAGMA table_info(student_notifications)")).fetchall()]
        if "exam_id" not in notif_cols:
            await db.execute("ALTER TABLE student_notifications ADD COLUMN exam_id TEXT DEFAULT ''")

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
        if "department" not in column_names:
            await db.execute("ALTER TABLE sessions ADD COLUMN department TEXT")
        if "candidate_email" not in column_names:
            await db.execute("ALTER TABLE sessions ADD COLUMN candidate_email TEXT")

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

        
        # Seed synthetic admin account
        async with db.execute("SELECT * FROM faculty WHERE LOWER(email) = 'admin@anurag.edu.in'") as cur:
            admin_row = await cur.fetchone()
            if not admin_row:
                await db.execute(
                    """INSERT INTO faculty (email, name, department, phone, designation, passcode, created_at)
                       VALUES ('admin@anurag.edu.in', 'System Administrator', 'all', '9999999999', 'Dean of Academic Affairs', 'admin123', ?)""",
                    (1700000000.0,)
                )

        # Add missing columns to questions table if not present
        async with db.execute("PRAGMA table_info(questions)") as cur:
            q_cols = [c[1] for c in await cur.fetchall()]
        for col_name, col_def in [
            ("department", "TEXT DEFAULT 'cse'"),
            ("subject", "TEXT"),
            ("status", "TEXT DEFAULT 'approved'"),
            ("validated_by", "TEXT"),
            ("validated_at", "REAL"),
        ]:
            if col_name not in q_cols:
                await db.execute(f"ALTER TABLE questions ADD COLUMN {col_name} {col_def}")

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
    department: str = "",
    candidate_email: str = "",
):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO sessions (id, candidate_name, roll_number, mobile_number, academic_year, role, subject_key, mode, started_at, department, candidate_email)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                   candidate_name = excluded.candidate_name,
                   roll_number = excluded.roll_number,
                   mobile_number = excluded.mobile_number,
                   academic_year = excluded.academic_year,
                   role = excluded.role,
                   subject_key = excluded.subject_key,
                   mode = excluded.mode,
                   department = excluded.department,
                   candidate_email = excluded.candidate_email""",
            (session_id, candidate_name, roll_number, mobile_number, academic_year, role, subject_key, mode, started_at, department, candidate_email),
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


async def list_sessions(department: Optional[str] = None) -> List[Dict]:
    """For the comparison dashboard, filtered by department (strict equality only — no LIKE to prevent 'ai' matching 'aiml')."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        if department:
            dept_clean = normalize_department(department.strip())
            # Use strict equality only — LIKE '%ai%' would incorrectly match 'aiml' sessions
            query = """SELECT s.*, COUNT(a.id) as answer_count
                       FROM sessions s
                       LEFT JOIN answers a ON a.session_id = s.id AND a.is_calibration = 0
                       WHERE LOWER(TRIM(COALESCE(s.department, ''))) = ?
                       GROUP BY s.id
                       ORDER BY s.started_at DESC"""
            params = (dept_clean,)
            async with db.execute(query, params) as cur:
                rows = await cur.fetchall()
                return [dict(r) for r in rows]
        else:
            async with db.execute(
                """SELECT s.*, COUNT(a.id) as answer_count
                   FROM sessions s
                   LEFT JOIN answers a ON a.session_id = s.id AND a.is_calibration = 0
                   GROUP BY s.id
                   ORDER BY s.started_at DESC"""
            ) as cur:
                rows = await cur.fetchall()
                return [dict(r) for r in rows]


async def db_list_students_by_dept(department: str, year: Optional[str] = None) -> List[Dict]:
    """Return all registered students for a given department (strict match), optionally filtered by year."""
    dept_clean = normalize_department(department.strip())
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        conditions = ["LOWER(department) = ?"]
        params_list: list = [dept_clean]
        if year:
            conditions.append("academic_year = ?")
            params_list.append(year)
        sql = f"SELECT * FROM students WHERE {' AND '.join(conditions)} ORDER BY student_roll"
        async with db.execute(sql, tuple(params_list)) as cur:
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

async def db_notify_section_for_exam(
    department: str,
    year: str,
    section: str,
    exam_name: str,
    mode: str,
    teacher: str,
    exam_id: Optional[str] = None,
) -> int:
    """Insert a test_ready notification for every registered student in the section."""
    import time as _time
    now = _time.time()
    dept_clean = normalize_department(department)
    year_clean = year.strip()
    mode_label = {"quiz": "MCQ Quiz", "oral": "Oral Viva", "written": "Written Exam"}.get(mode, mode.title())
    message = (
        f"📢 New exam published by {teacher or 'your faculty'}! "
        f"'{exam_name}' — {mode_label} mode. "
        f"Open your assessment portal to begin now."
    )
    count = 0
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        sql = "SELECT student_roll FROM students WHERE LOWER(department) = ?"
        args = [dept_clean]
        if year_clean and year_clean.lower() != "all":
            sql += " AND academic_year = ?"
            args.append(year_clean)
        async with db.execute(sql, tuple(args)) as cur:
            students = await cur.fetchall()
        for s in students:
            roll = s["student_roll"]
            await db.execute(
                """INSERT INTO student_notifications
                   (student_roll, subject, department, message, test_ready, is_read, created_at, exam_id)
                   VALUES (?, ?, ?, ?, 1, 0, ?, ?)""",
                (roll, exam_name, dept_clean, message, now, exam_id or "")
            )
            count += 1
        await db.commit()
    return count


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


async def db_get_subject_performance(
    department: Optional[str] = None,
    year: Optional[str] = None,
    section: Optional[str] = None,
    db_path: Optional[str] = None,
) -> List[Dict]:
    """
    Computes subject performance grouped by teacher and subject directly in SQL.
    Only includes attempts with status = 'completed' in the average score calculation.
    Disqualified attempts are counted separately.
    Sorted by average score ascending (lowest first, weak areas at top).
    """
    conditions = []
    args = []
    if department and department.strip():
        dept_raw = department.strip()
        dept_norm = normalize_department(dept_raw)
        conditions.append("(LOWER(TRIM(a.department)) = ? OR LOWER(TRIM(a.department)) = ? OR LOWER(TRIM(a.department)) = 'all')")
        args.extend([dept_raw.lower(), dept_norm.lower()])
    if year and year.strip():
        year_raw = year.strip()
        conditions.append("(LOWER(TRIM(a.year)) = ? OR LOWER(TRIM(a.year)) = 'all')")
        args.append(year_raw.lower())
    if section and section.strip():
        sec_raw = section.strip()
        sec_clean = re.sub(r'(?i)^section\s*', '', sec_raw).upper()
        conditions.append("(LOWER(TRIM(a.section)) = ? OR UPPER(TRIM(a.section)) = ? OR UPPER(TRIM(REPLACE(a.section, 'Section ', ''))) = ? OR LOWER(TRIM(a.section)) = 'all' OR a.section = '' OR a.section IS NULL)")
        args.extend([sec_raw.lower(), sec_raw.upper(), sec_clean])

    where_clause = f" WHERE {' AND '.join(conditions)}" if conditions else ""
    sql = f"""
        SELECT
            COALESCE(NULLIF(TRIM(a.teacher), ''), 'Unknown Faculty') AS teacher_name,
            COALESCE(NULLIF(TRIM(a.subject), ''), 'General') AS subject_name,
            COUNT(DISTINCT a.exam_id) AS exam_count,
            COUNT(CASE WHEN ea.status = 'completed' THEN 1 END) AS student_attempts,
            COUNT(CASE WHEN ea.status = 'disqualified' THEN 1 END) AS disqualified_attempts,
            COALESCE(ROUND(AVG(CASE WHEN ea.status = 'completed' THEN ea.score END), 1), 0.0) AS avg_score
        FROM assessments a
        LEFT JOIN exam_attempts ea ON a.exam_id = ea.exam_id
        {where_clause}
        GROUP BY 1, 2
        ORDER BY avg_score ASC, exam_count DESC
    """

    target_db = db_path or DB_PATH
    async with aiosqlite.connect(target_db) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(sql, tuple(args)) as cur:
            rows = await cur.fetchall()
            result = []
            for r in rows:
                row_dict = dict(r)
                exam_cnt = int(row_dict["exam_count"])
                completed_cnt = int(row_dict["student_attempts"])
                disqualified_cnt = int(row_dict["disqualified_attempts"])
                avg_sc = float(row_dict["avg_score"])
                result.append({
                    "teacher": row_dict["teacher_name"],
                    "teacher_name": row_dict["teacher_name"],
                    "subject": row_dict["subject_name"],
                    "exam_count": exam_cnt,
                    "student_attempts": completed_cnt,
                    "completed_attempts": completed_cnt,
                    "disqualified_attempts": disqualified_cnt,
                    "avg_score": avg_sc,
                    "is_low_sample": exam_cnt < 3,
                })
            return result

async def db_get_active_assessment(
    department: str, 
    year: str, 
    section: str, 
    roll_number: Optional[str] = None,
    exam_id: Optional[str] = None
) -> Optional[Dict]:
    dept_clean = normalize_department(department)
    year_clean = year.strip()
    sec_clean = re.sub(r'(?i)^section\s*', '', section.strip()).upper() if section else ""
    
    inferred_sec = ""
    if roll_number:
        roll_match = re.match(r"^(\d{2})eg(\d{3})([a-r])(\d{2})$", roll_number.strip().lower())
        if roll_match:
            inferred_sec = roll_match.group(3).upper()

    target_sec = sec_clean or inferred_sec
    clean_roll = roll_number.strip().lower() if roll_number else ""

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        # If specific exam_id is requested, fetch it directly
        if exam_id and exam_id.strip():
            async with db.execute("SELECT * FROM assessments WHERE exam_id = ?", (exam_id.strip(),)) as cur:
                row = await cur.fetchone()
                if row:
                    d = dict(row)
                    if d.get("questions_json"):
                        try:
                            d["questions"] = json.loads(d["questions_json"])
                        except Exception:
                            d["questions"] = []
                    d["already_attempted"] = False
                    d["attempt"] = None
                    if clean_roll:
                        async with db.execute(
                            "SELECT * FROM exam_attempts WHERE LOWER(student_roll) = ? AND exam_id = ?",
                            (clean_roll, d["exam_id"]),
                        ) as att_cur:
                            att_row = await att_cur.fetchone()
                            if att_row:
                                d["already_attempted"] = True
                                d["attempt"] = dict(att_row)
                    return d

        # Fetch student's completed attempt exam_ids
        attempted_exam_ids = set()
        student_attempts = {}
        if clean_roll:
            async with db.execute(
                "SELECT * FROM exam_attempts WHERE LOWER(student_roll) = ?",
                (clean_roll,)
            ) as cur:
                for att in await cur.fetchall():
                    attempted_exam_ids.add(att["exam_id"])
                    student_attempts[att["exam_id"]] = dict(att)

        # Get all assessments matching dept and year (or all/empty)
        sql = """SELECT * FROM assessments 
                 WHERE (LOWER(department) = ? OR LOWER(department) = 'all' OR LOWER(department) = '') 
                 AND (LOWER(TRIM(year)) = ? OR LOWER(TRIM(year)) = 'all' OR LOWER(TRIM(year)) = '')
                 ORDER BY created_at DESC"""
        async with db.execute(sql, (dept_clean, year_clean.lower())) as cur:
            rows = await cur.fetchall()

        if not rows:
            # Fallback: department match without year restriction
            sql_dept = """SELECT * FROM assessments 
                          WHERE (LOWER(department) = ? OR LOWER(department) = 'all' OR LOWER(department) = '')
                          ORDER BY created_at DESC"""
            async with db.execute(sql_dept, (dept_clean,)) as cur:
                rows = await cur.fetchall()

        selected_row = None
        if rows:
            # Separate into unattempted and attempted
            unattempted = [r for r in rows if r["exam_id"] not in attempted_exam_ids]
            attempted = [r for r in rows if r["exam_id"] in attempted_exam_ids]

            # 1. From unattempted exams, try section matching:
            # 1a. Exact section match
            for r in unattempted:
                r_sec = re.sub(r'(?i)^section\s*', '', str(r["section"] or '')).strip().upper()
                if (target_sec and r_sec == target_sec) or (inferred_sec and r_sec == inferred_sec):
                    selected_row = r
                    break

            # 1b. Match 'ALL' or 'ALL SEC' or empty section
            if not selected_row:
                for r in unattempted:
                    r_sec = re.sub(r'(?i)^section\s*', '', str(r["section"] or '')).strip().upper()
                    if r_sec in ("ALL", "ALL SEC", ""):
                        selected_row = r
                        break

            # 1c. Any unattempted exam in the department (most recent)
            if not selected_row and unattempted:
                selected_row = unattempted[0]

            # 2. If all exams attempted, choose most recent matching attempted exam
            if not selected_row and attempted:
                for r in attempted:
                    r_sec = re.sub(r'(?i)^section\s*', '', str(r["section"] or '')).strip().upper()
                    if (target_sec and r_sec == target_sec) or (inferred_sec and r_sec == inferred_sec):
                        selected_row = r
                        break
                if not selected_row:
                    selected_row = attempted[0]

        if selected_row:
            d = dict(selected_row)
            if d.get("questions_json"):
                try:
                    d["questions"] = json.loads(d["questions_json"])
                except Exception:
                    d["questions"] = []
            
            d["already_attempted"] = d["exam_id"] in attempted_exam_ids
            d["attempt"] = student_attempts.get(d["exam_id"])
            return d

        return None


async def db_list_available_exams_for_student(
    department: str,
    year: str,
    section: str,
    roll_number: Optional[str] = None
) -> List[Dict]:
    """Returns all published assessments for this student with attempt status."""
    dept_clean = normalize_department(department)
    clean_roll = roll_number.strip().lower() if roll_number else ""

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        attempts = {}
        if clean_roll:
            async with db.execute("SELECT * FROM exam_attempts WHERE LOWER(student_roll) = ?", (clean_roll,)) as cur:
                for att in await cur.fetchall():
                    attempts[att["exam_id"]] = dict(att)

        sql = """SELECT exam_id, name, mode, subject, unit, department, year, section, teacher, difficulty, questions_json, created_at
                 FROM assessments 
                 WHERE (LOWER(department) = ? OR LOWER(department) = 'all' OR LOWER(department) = '') 
                 ORDER BY created_at DESC"""
        async with db.execute(sql, (dept_clean,)) as cur:
            rows = await cur.fetchall()

        result = []
        for r in rows:
            d = dict(r)
            q_count = 0
            if d.get("questions_json"):
                try:
                    q_list = json.loads(d["questions_json"])
                    q_count = len(q_list)
                except Exception:
                    q_count = 0
            d.pop("questions_json", None)
            d["question_count"] = q_count
            d["already_attempted"] = d["exam_id"] in attempts
            d["attempt"] = attempts.get(d["exam_id"])
            result.append(d)
        return result


async def db_record_exam_attempt(
    student_roll: str,
    exam_id: str,
    session_id: Optional[str] = None,
    subject: Optional[str] = None,
    score: float = 0.0,
    max_score: float = 0.0,
    authenticity_score: float = 100.0,
    violations_count: int = 0,
    status: str = "completed",
) -> Dict:
    clean_roll = student_roll.strip().lower()
    clean_exam = exam_id.strip()
    now = time.time()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO exam_attempts
               (student_roll, exam_id, session_id, subject, score, max_score, authenticity_score, violations_count, status, completed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(student_roll, exam_id) DO UPDATE SET
                   session_id = excluded.session_id,
                   subject = COALESCE(excluded.subject, exam_attempts.subject),
                   score = excluded.score,
                   max_score = excluded.max_score,
                   authenticity_score = excluded.authenticity_score,
                   violations_count = excluded.violations_count,
                   status = excluded.status,
                   completed_at = excluded.completed_at
            """,
            (clean_roll, clean_exam, session_id, subject, score, max_score, authenticity_score, violations_count, status, now),
        )
        await db.commit()
    return {"ok": True, "student_roll": clean_roll, "exam_id": clean_exam, "status": status}


async def db_get_student_attempt(student_roll: str, exam_id: str) -> Optional[Dict]:
    clean_roll = student_roll.strip().lower()
    clean_exam = exam_id.strip()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM exam_attempts WHERE LOWER(student_roll) = ? AND exam_id = ?",
            (clean_roll, clean_exam),
        ) as cur:
            row = await cur.fetchone()
            if row:
                return dict(row)
    return None


async def db_has_student_attempted(student_roll: str, exam_id: str) -> bool:
    attempt = await db_get_student_attempt(student_roll, exam_id)
    return attempt is not None



# ---------- Faculty & Queries Management ----------
ALLOWED_DEPARTMENTS = ["ai", "aiml", "it", "cse", "ece", "eee", "civil", "mech", "data science", "ecm"]
COLLEGE_EMAIL_SUFFIX = "@anurag.edu.in"


def is_valid_college_email(email: str) -> bool:
    if not email:
        return False
    return email.strip().lower().endswith(COLLEGE_EMAIL_SUFFIX)


def normalize_department(dept: str) -> str:
    if not dept:
        return ""
    d = dept.strip().lower()
    mapping = {
        "artificial intelligence": "ai",
        "ai": "ai",
        "ai & ml": "aiml",
        "ai_ml": "aiml",
        "aiml": "aiml",
        "artificial intelligence & machine learning": "aiml",
        "it": "it",
        "information technology": "it",
        "cse": "cse",
        "computer science & engineering": "cse",
        "computer science": "cse",
        "ece": "ece",
        "electronics & communication engineering": "ece",
        "electronics & communication": "ece",
        "eee": "eee",
        "electrical & electronics engineering": "eee",
        "electrical & electronics": "eee",
        "civil": "civil",
        "civil engineering": "civil",
        "mech": "mech",
        "mechanical": "mech",
        "mechanical engineering": "mech",
        "data science": "data science",
        "datascience": "data science",
        "cse-ds": "data science",
        "computer science & data science": "data science",
        "ecm": "ecm",
        "all": "all",
        "admin": "all",
        "electronics & computer engineering": "ecm"
    }
    return mapping.get(d, d)


def validate_student_roll(roll_number: str, academic_year: str, department: str) -> str:
    clean_roll = roll_number.strip().lower()
    clean_dept = normalize_department(department)
    
    # Format: 23eg107b35
    pattern = r"^(\d{2})eg(\d{3})([a-r])(\d{2})$"
    match = re.match(pattern, clean_roll)
    
    if not match:
        raise ValueError("Roll number format is invalid. It must follow the pattern YYegDEPTSECID (e.g. 23eg107b35).")
        
    year_code = match.group(1)
    dept_code = match.group(2)
    sec_code = match.group(3).upper()
    
    year_map = {
        "23": "4th Year",
        "24": "3rd Year",
        "25": "2nd Year",
        "26": "1st Year"
    }
    
    dept_map = {
        "107": "aiml",
        "106": "ai",
        "105": "cse",
        "112": "it",
        "109": "cse", 
        "110": "data science",
        "104": "ece",
        "101": "civil",
        "103": "mech",
        "502": "eee",
        "111": "ecm"
    }
    
    expected_year = year_map.get(year_code)
    if not expected_year:
        raise ValueError(f"Unknown year code '{year_code}' in roll number.")
        
    if expected_year != academic_year:
        raise ValueError(f"Roll number year code '{year_code}' implies {expected_year}, but {academic_year} was selected.")
        
    expected_dept = dept_map.get(dept_code)
    if not expected_dept:
        raise ValueError(f"Unknown department code '{dept_code}' in roll number.")
        
    if normalize_department(expected_dept) != clean_dept:
        raise ValueError(f"Roll number department code ({dept_code} = {expected_dept.upper()}) does not match the selected department ({clean_dept.upper()}).")
    
    return sec_code

async def db_register_student(
    email: str,
    name: str,
    roll_number: str,
    mobile: str,
    academic_year: str,
    department: str,
    password: str,
    section: Optional[str] = None
) -> Dict:
    clean_email = email.strip().lower()
    clean_roll = roll_number.strip().lower()
    clean_dept = normalize_department(department)

    if not is_valid_college_email(clean_email):
        raise ValueError("Only college email addresses ending with @anurag.edu.in are allowed.")

    if clean_dept not in ALLOWED_DEPARTMENTS:
        raise ValueError(f"Invalid department. Allowed: {', '.join(ALLOWED_DEPARTMENTS)}")

    # Enforce Roll Number Strictness & infer section
    inferred_sec = validate_student_roll(clean_roll, academic_year, clean_dept)
    clean_sec = re.sub(r'(?i)^section\s*', '', (section or '').strip()).upper() if section else inferred_sec
    if not clean_sec:
        clean_sec = inferred_sec or "A"

    now = time.time()
    async with aiosqlite.connect(DB_PATH) as db:
        try:
            await db.execute(
                """INSERT INTO students (student_email, student_name, student_roll, mobile_number, academic_year, department, section, password, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (clean_email, name.strip(), clean_roll, mobile.strip(), academic_year.strip(), clean_dept, clean_sec, password, now)
            )
            await db.commit()
            return {
                "studentEmail": clean_email,
                "studentName": name.strip(),
                "rollNumber": clean_roll,
                "mobileNumber": mobile.strip(),
                "academicYear": academic_year.strip(),
                "department": clean_dept,
                "section": f"Section {clean_sec}"
            }
        except aiosqlite.IntegrityError as e:
            msg = str(e)
            if "student_email" in msg or "students.student_email" in msg:
                raise ValueError("An account with this email is already registered.")
            elif "student_roll" in msg or "students.student_roll" in msg:
                raise ValueError("An account with this Roll Number is already registered.")
            else:
                raise ValueError("Registration failed due to a duplicate record.")

async def db_authenticate_student(roll_number: str, password: str) -> Optional[Dict]:
    clean_roll = roll_number.strip().lower()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM students WHERE LOWER(student_roll) = ?", (clean_roll,)) as cur:
            row = await cur.fetchone()
            if not row:
                return None
            
            # Since this is a prototype, we're checking plain text.
            if row["password"] == password:
                sec_val = None
                try:
                    sec_val = row["section"]
                except Exception:
                    pass
                if not sec_val:
                    match = re.match(r"^(\d{2})eg(\d{3})([a-r])(\d{2})$", clean_roll)
                    sec_val = match.group(3).upper() if match else "A"
                clean_sec_letter = re.sub(r'(?i)^section\s*', '', str(sec_val)).strip().upper() or "A"

                return {
                    "studentEmail": row["student_email"],
                    "studentName": row["student_name"],
                    "rollNumber": row["student_roll"],
                    "mobileNumber": row["mobile_number"],
                    "academicYear": row["academic_year"],
                    "department": row["department"],
                    "section": f"Section {clean_sec_letter}"
                }
            return None

async def db_register_faculty(
    email: str,
    name: str,
    department: str,
    phone: str = "",
    designation: str = "Professor",
    passcode: str = ""
) -> Dict:
    clean_email = email.strip().lower()
    clean_dept = normalize_department(department)

    if not is_valid_college_email(clean_email):
        raise ValueError("Only college email addresses ending with @anurag.edu.in are allowed.")

    if clean_dept not in ALLOWED_DEPARTMENTS:
        raise ValueError(f"Invalid department. Allowed: {', '.join(ALLOWED_DEPARTMENTS)}")

    import time
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        # Check if email is already registered
        async with db.execute("SELECT * FROM faculty WHERE LOWER(email) = ?", (clean_email,)) as cur:
            existing = await cur.fetchone()
            if existing:
                raise ValueError("already signed up for one dept")

        now = time.time()
        await db.execute(
            """INSERT INTO faculty (email, name, department, phone, designation, passcode, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (clean_email, name.strip(), clean_dept, phone.strip(), designation.strip(), passcode.strip(), now)
        )
        await db.commit()

        return {
            "email": clean_email,
            "name": name.strip(),
            "department": clean_dept,
            "phone": phone.strip(),
            "designation": designation.strip(),
            "created_at": now
        }


async def db_authenticate_faculty(email: str, passcode: str) -> Optional[Dict]:
    clean_email = email.strip().lower()
    if not is_valid_college_email(clean_email):
        raise ValueError("Only college email addresses ending with @anurag.edu.in are allowed.")

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM faculty WHERE LOWER(email) = ?", (clean_email,)) as cur:
            row = await cur.fetchone()
            if not row:
                return None
            faculty = dict(row)
            saved_pass = faculty.get("passcode", "")
            p_test = passcode.strip()
            if saved_pass and saved_pass == p_test:
                return faculty
            return None


async def db_submit_faculty_query(
    email: str,
    name: str,
    current_dept: str,
    target_dept: str,
    phone: str = "",
    reason: str = ""
) -> Dict:
    clean_email = email.strip().lower()
    clean_target = normalize_department(target_dept)

    if not is_valid_college_email(clean_email):
        raise ValueError("Only college email addresses ending with @anurag.edu.in are allowed.")

    if clean_target not in ALLOWED_DEPARTMENTS:
        raise ValueError(f"Invalid target department. Allowed: {', '.join(ALLOWED_DEPARTMENTS)}")

    import time
    now = time.time()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO faculty_queries (email, name, current_dept, target_dept, phone, reason, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)""",
            (clean_email, name.strip(), normalize_department(current_dept), clean_target, phone.strip(), reason.strip(), now)
        )
        await db.commit()
        return {
            "email": clean_email,
            "name": name.strip(),
            "current_dept": normalize_department(current_dept),
            "target_dept": clean_target,
            "status": "pending",
            "created_at": now
        }


async def db_list_faculty_queries(email: Optional[str] = None) -> List[Dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        if email:
            clean_email = email.strip().lower()
            async with db.execute("SELECT * FROM faculty_queries WHERE LOWER(email) = ? ORDER BY created_at DESC", (clean_email,)) as cur:
                rows = await cur.fetchall()
                return [dict(r) for r in rows]
        else:
            async with db.execute("SELECT * FROM faculty_queries ORDER BY created_at DESC") as cur:
                rows = await cur.fetchall()
                return [dict(r) for r in rows]


async def db_update_faculty_query(query_id: int, new_status: str) -> Optional[Dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM faculty_queries WHERE id = ?", (query_id,)) as cur:
            row = await cur.fetchone()
            if not row:
                return None
            q = dict(row)
        
        await db.execute("UPDATE faculty_queries SET status = ? WHERE id = ?", (new_status.lower(), query_id))
        
        # If approved, update faculty department in faculty table
        if new_status.lower() == "approved" and q.get("email") and q.get("target_dept"):
            await db.execute(
                "UPDATE faculty SET department = ? WHERE LOWER(email) = ?",
                (q["target_dept"].lower(), q["email"].lower())
            )
        await db.commit()
        q["status"] = new_status.lower()
        return q


# --- Password Reset & OTP Verification ---
async def db_create_password_reset_otp(email: str, user_type: str = "student") -> Tuple[str, str]:
    clean_email = email.strip().lower()
    if not is_valid_college_email(clean_email):
        raise ValueError("Only college email addresses ending with @anurag.edu.in are allowed.")
    
    clean_user_type = user_type.strip().lower()
    now = time.time()
    expires_at = now + (10 * 60)  # 10 minutes validity

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        user_name = "User"
        if clean_user_type == "student":
            async with db.execute("SELECT student_name FROM students WHERE LOWER(student_email) = ?", (clean_email,)) as cur:
                row = await cur.fetchone()
                if not row:
                    raise ValueError(f"No student account found registered with {clean_email}")
                user_name = row["student_name"]
        elif clean_user_type == "faculty":
            async with db.execute("SELECT name FROM faculty WHERE LOWER(email) = ?", (clean_email,)) as cur:
                row = await cur.fetchone()
                if not row:
                    raise ValueError(f"No faculty account found registered with {clean_email}")
                user_name = row["name"]
        else:
            raise ValueError("Invalid user type. Must be 'student' or 'faculty'.")

        # Generate secure 6-digit numeric OTP
        otp = f"{secrets.randbelow(900000) + 100000}"

        # Invalidate previous unused OTPs for this email & user_type
        await db.execute(
            "UPDATE password_resets SET used = 1 WHERE LOWER(email) = ? AND user_type = ? AND used = 0",
            (clean_email, clean_user_type)
        )

        # Insert new OTP record
        await db.execute(
            """INSERT INTO password_resets (email, user_type, otp, created_at, expires_at, used)
               VALUES (?, ?, ?, ?, ?, 0)""",
            (clean_email, clean_user_type, otp, now, expires_at)
        )
        await db.commit()

        return otp, user_name


async def db_verify_password_reset_otp(email: str, otp: str, user_type: str = "student") -> bool:
    clean_email = email.strip().lower()
    clean_otp = otp.strip()
    clean_user_type = user_type.strip().lower()
    now = time.time()

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """SELECT * FROM password_resets 
               WHERE LOWER(email) = ? AND user_type = ? AND otp = ? AND used = 0
               ORDER BY created_at DESC LIMIT 1""",
            (clean_email, clean_user_type, clean_otp)
        ) as cur:
            row = await cur.fetchone()
            if not row:
                raise ValueError("Invalid or expired verification code.")
            if row["expires_at"] < now:
                raise ValueError("Verification code has expired. Please request a new code.")
            return True


async def db_reset_password_with_otp(email: str, otp: str, new_password: str, user_type: str = "student") -> bool:
    clean_email = email.strip().lower()
    clean_otp = otp.strip()
    clean_user_type = user_type.strip().lower()
    new_pass = new_password.strip()

    if not new_pass or len(new_pass) < 4:
        raise ValueError("Password must be at least 4 characters long.")

    # First verify the OTP
    await db_verify_password_reset_otp(clean_email, clean_otp, clean_user_type)

    async with aiosqlite.connect(DB_PATH) as db:
        if clean_user_type == "student":
            cur = await db.execute(
                "UPDATE students SET password = ? WHERE LOWER(student_email) = ?",
                (new_pass, clean_email)
            )
            if cur.rowcount == 0:
                raise ValueError("Student account not found.")
        elif clean_user_type == "faculty":
            cur = await db.execute(
                "UPDATE faculty SET passcode = ? WHERE LOWER(email) = ?",
                (new_pass, clean_email)
            )
            if cur.rowcount == 0:
                raise ValueError("Faculty account not found.")

        # Mark OTP as used
        await db.execute(
            "UPDATE password_resets SET used = 1 WHERE LOWER(email) = ? AND user_type = ? AND otp = ?",
            (clean_email, clean_user_type, clean_otp)
        )
        await db.commit()
        return True


# --- Test Mode Assignments ---
async def db_create_or_update_assignment(
    faculty_email: str,
    department: str,
    academic_year: str,
    section: str,
    assigned_mode: str,
    student_roll: Optional[str] = None,
    title: Optional[str] = None
) -> Dict:
    clean_dept = normalize_department(department)
    clean_roll = student_roll.strip().lower() if student_roll and student_roll.strip() else None
    clean_sec = section.strip().upper()
    now = time.time()
    
    async with aiosqlite.connect(DB_PATH) as db:
        # Check if existing assignment matches
        if clean_roll:
            await db.execute(
                """DELETE FROM test_assignments 
                   WHERE LOWER(student_roll) = ? AND LOWER(department) = ?""",
                (clean_roll, clean_dept)
            )
        else:
            await db.execute(
                """DELETE FROM test_assignments 
                   WHERE student_roll IS NULL 
                     AND LOWER(department) = ? 
                     AND LOWER(academic_year) = ? 
                     AND UPPER(section) = ?""",
                (clean_dept, academic_year.strip().lower(), clean_sec)
            )

        cur = await db.execute(
            """INSERT INTO test_assignments 
               (faculty_email, department, academic_year, section, student_roll, assigned_mode, title, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (faculty_email.strip().lower(), clean_dept, academic_year.strip(), clean_sec, clean_roll, assigned_mode.strip().lower(), title or f"{clean_dept.upper()} Assessment", now)
        )
        assignment_id = cur.lastrowid
        await db.commit()
        return {
            "id": assignment_id,
            "faculty_email": faculty_email,
            "department": clean_dept,
            "academic_year": academic_year,
            "section": clean_sec,
            "student_roll": clean_roll,
            "assigned_mode": assigned_mode.strip().lower(),
            "title": title,
            "created_at": now
        }


async def db_get_student_assignment(department: str, academic_year: str, section: str, roll_number: Optional[str] = None) -> Dict:
    clean_dept = normalize_department(department)
    clean_year = academic_year.strip().lower()
    clean_sec = section.strip().upper()
    clean_roll = roll_number.strip().lower() if roll_number else ""

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        # 1. Level 1: Individual Student Override
        if clean_roll:
            async with db.execute(
                """SELECT * FROM test_assignments 
                   WHERE LOWER(student_roll) = ? AND LOWER(department) = ? 
                   ORDER BY id DESC LIMIT 1""",
                (clean_roll, clean_dept)
            ) as cur:
                row = await cur.fetchone()
                if row:
                    item = dict(row)
                    return {
                        "assigned": True,
                        "is_locked": item["assigned_mode"] != "open",
                        "mode": item["assigned_mode"],
                        "assignment_title": item.get("title") or "Personalized Assignment",
                        "assigned_by": item.get("faculty_email"),
                        "scope": "individual"
                    }

        # 2. Level 2: Section-wide Assignment
        async with db.execute(
            """SELECT * FROM test_assignments 
               WHERE student_roll IS NULL 
                 AND LOWER(department) = ? 
                 AND (LOWER(academic_year) = ? OR academic_year = 'All')
                 AND (UPPER(section) = ? OR section = 'ALL')
               ORDER BY id DESC LIMIT 1""",
            (clean_dept, clean_year, clean_sec)
        ) as cur:
            row = await cur.fetchone()
            if row:
                item = dict(row)
                return {
                    "assigned": True,
                    "is_locked": item["assigned_mode"] != "open",
                    "mode": item["assigned_mode"],
                    "assignment_title": item.get("title") or f"{clean_sec} Section Mandate",
                    "assigned_by": item.get("faculty_email"),
                    "scope": "section"
                }

        # 3. Default: Open Choice
        return {
            "assigned": False,
            "is_locked": False,
            "mode": "open",
            "assignment_title": "Open Assessment Choice",
            "assigned_by": None,
            "scope": "none"
        }


async def db_list_department_assignments(department: str) -> List[Dict]:
    clean_dept = normalize_department(department)
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        if clean_dept == "all":
            query = "SELECT * FROM test_assignments ORDER BY id DESC"
            params = ()
        else:
            query = "SELECT * FROM test_assignments WHERE LOWER(department) = ? ORDER BY id DESC"
            params = (clean_dept,)
        async with db.execute(query, params) as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]


async def db_delete_assignment(assignment_id: int) -> bool:
    async with aiosqlite.connect(DB_PATH) as db:
        res = await db.execute("DELETE FROM test_assignments WHERE id = ?", (assignment_id,))
        await db.commit()
        return res.rowcount > 0


# --- Subject & Question Validation ---
async def db_get_department_subjects(department: str) -> List[Dict]:
    clean_dept = normalize_department(department)
    
    # Standard subjects by department for Anurag University
    standard_curriculum: Dict[str, List[str]] = {
        "cse": ["Data Structures & Algorithms", "Operating Systems", "Database Management Systems (DBMS)", "Computer Networks", "Design and Analysis of Algorithms", "Software Engineering"],
        "ai": ["Artificial Intelligence", "Knowledge Representation", "Search Algorithms & Game Theory", "Natural Language Processing", "Expert Systems"],
        "aiml": ["Machine Learning", "Deep Learning", "Supervised & Unsupervised Learning", "Neural Networks & PyTorch", "Computer Vision"],
        "data science": ["Applied Statistics & Probability", "Data Mining & Warehousing", "Big Data Analytics", "Python for Data Science", "Data Visualization"],
        "it": ["Web Technologies", "Cloud Computing", "Information Security", "Distributed Systems", "Object Oriented Programming Java"],
        "ece": ["Digital Signal Processing (DSP)", "VLSI Design", "Microprocessors & Microcontrollers", "Analog & Digital Communication", "Electromagnetic Theory"],
        "eee": ["Power Systems", "Control Systems Engineering", "Electrical Machines", "Power Electronics", "Renewable Energy Sources"],
        "civil": ["Structural Analysis", "Geotechnical Engineering", "Fluid Mechanics & Hydraulics", "Concrete Technology", "Transportation Engineering"],
        "mech": ["Thermodynamics", "Theory of Machines", "Strength of Materials", "Manufacturing Technology", "Heat & Mass Transfer"],
        "ecm": ["Embedded Systems", "Computer Architecture", "Sensor Networks & IoT", "Digital System Design", "Signals and Systems"]
    }

    subjects = standard_curriculum.get(clean_dept, ["General Technical Core", "Engineering Fundamentals"])
    
    # Check question approval counts for each subject
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        result = []
        for s in subjects:
            async with db.execute(
                """SELECT COUNT(*) as cnt, 
                          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_cnt,
                          SUM(CASE WHEN status = 'pending_validation' THEN 1 ELSE 0 END) as pending_cnt
                   FROM questions 
                   WHERE LOWER(department) = ? AND LOWER(COALESCE(subject, '')) = ?""",
                (clean_dept, s.lower())
            ) as cur:
                row = await cur.fetchone()
                total = row["cnt"] if row else 0
                appr = row["approved_cnt"] if row and row["approved_cnt"] else 0
                
                # Check if there are general questions for this department marked approved
                if total == 0:
                    async with db.execute(
                        "SELECT COUNT(*) as total_dept FROM questions WHERE LOWER(department) = ? AND status = 'approved'",
                        (clean_dept,)
                    ) as cur2:
                        row2 = await cur2.fetchone()
                        appr = row2["total_dept"] if row2 and row2["total_dept"] else 0

                result.append({
                    "subject": s,
                    "department": clean_dept,
                    "total_questions": total,
                    "approved_questions": appr or (5 if total == 0 else 0), # Default pool active
                    "has_approved": True if (appr and appr > 0) or total == 0 else False,
                    "status": "approved" if (appr and appr > 0) or total == 0 else "pending_validation"
                })
        return result


async def db_request_subject_validation(department: str, subject: str, student_roll: str, student_name: str, student_email: Optional[str] = None) -> Dict:
    clean_dept = normalize_department(department)
    now = time.time()
    async with aiosqlite.connect(DB_PATH) as db:
        # Check if task already pending
        async with db.execute(
            """SELECT id FROM faculty_validation_tasks 
               WHERE LOWER(department) = ? AND LOWER(subject) = ? AND status = 'pending'""",
            (clean_dept, subject.strip().lower())
        ) as cur:
            existing = await cur.fetchone()
            if existing:
                return {"ok": True, "message": "Validation request already pending with department faculty.", "task_id": existing[0]}

        cur = await db.execute(
            """INSERT INTO faculty_validation_tasks 
               (subject, department, student_roll, student_name, question_count, status, created_at)
               VALUES (?, ?, ?, ?, ?, 'pending', ?)""",
            (subject.strip(), clean_dept, student_roll.strip().lower(), student_name.strip(), 5, now)
        )
        task_id = cur.lastrowid

        # Also add student notification entry
        await db.execute(
            """INSERT INTO student_notifications 
               (student_email, student_roll, subject, department, message, status, test_ready, created_at)
               VALUES (?, ?, ?, ?, ?, 'unread', 0, ?)""",
            (student_email or f"{student_roll.strip().lower()}@anurag.edu.in", 
             student_roll.strip().lower(), 
             subject.strip(), 
             clean_dept, 
             f"Validation request for '{subject.strip()}' has been sent to your {clean_dept.upper()} faculty. You will be notified once approved.", 
             now)
        )
        await db.commit()
        return {"ok": True, "task_id": task_id, "message": f"Validation request for {subject} submitted."}


async def db_approve_subject_questions(department: str, subject: str, faculty_email: str) -> Dict:
    clean_dept = normalize_department(department)
    now = time.time()
    async with aiosqlite.connect(DB_PATH) as db:
        # 1. Mark questions approved
        await db.execute(
            """UPDATE questions 
               SET status = 'approved', validated_by = ?, validated_at = ? 
               WHERE LOWER(department) = ? AND LOWER(COALESCE(subject, '')) = ?""",
            (faculty_email.strip().lower(), now, clean_dept, subject.strip().lower())
        )
        # 2. Mark validation tasks approved
        await db.execute(
            """UPDATE faculty_validation_tasks 
               SET status = 'approved' 
               WHERE LOWER(department) = ? AND LOWER(subject) = ? AND status = 'pending'""",
            (clean_dept, subject.strip().lower())
        )
        # 3. Create ready notifications for all students who requested this subject
        async with db.execute(
            """SELECT DISTINCT student_roll, student_email FROM student_notifications 
               WHERE LOWER(department) = ? AND LOWER(subject) = ?""",
            (clean_dept, subject.strip().lower())
        ) as cur:
            students = await cur.fetchall()
            for s in students:
                await db.execute(
                    """INSERT INTO student_notifications 
                       (student_email, student_roll, subject, department, message, status, test_ready, created_at)
                       VALUES (?, ?, ?, ?, ?, 'unread', 1, ?)""",
                    (s[1], s[0], subject.strip(), clean_dept,
                     f"✅ Great news! '{subject.strip()}' questions have been validated and approved by faculty ({faculty_email}). You can now take your test!",
                     now)
                )

        await db.commit()
        return {"ok": True, "subject": subject, "approved_by": faculty_email}


async def db_get_faculty_validation_tasks(department: str) -> List[Dict]:
    clean_dept = normalize_department(department)
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        if clean_dept == "all":
            query = "SELECT * FROM faculty_validation_tasks ORDER BY id DESC"
            params = ()
        else:
            query = "SELECT * FROM faculty_validation_tasks WHERE LOWER(department) = ? ORDER BY id DESC"
            params = (clean_dept,)
        async with db.execute(query, params) as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]


async def db_get_student_notifications(student_roll: str) -> List[Dict]:
    clean_roll = student_roll.strip().lower()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM student_notifications WHERE LOWER(student_roll) = ? ORDER BY id DESC LIMIT 20",
            (clean_roll,)
        ) as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]


async def db_mark_student_notifications_read(student_roll: str, notification_id: Optional[int] = None) -> int:
    """Mark one or all notifications for a student as read (is_read = 1)."""
    clean_roll = student_roll.strip().lower()
    async with aiosqlite.connect(DB_PATH) as db:
        if notification_id is not None:
            cur = await db.execute(
                "UPDATE student_notifications SET is_read = 1 WHERE id = ? AND LOWER(student_roll) = ?",
                (notification_id, clean_roll),
            )
        else:
            cur = await db.execute(
                "UPDATE student_notifications SET is_read = 1 WHERE LOWER(student_roll) = ?",
                (clean_roll,),
            )
        await db.commit()
        return cur.rowcount


async def db_update_faculty_passcode(email: str, current_passcode: str, new_passcode: str) -> bool:
    clean_email = email.strip().lower()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT passcode FROM faculty WHERE LOWER(email) = ?", (clean_email,)) as cur:
            row = await cur.fetchone()
            if not row:
                raise ValueError("Faculty record not found")
            saved = row["passcode"]
            if saved and saved != current_passcode:
                raise ValueError("Current passcode is incorrect.")

        await db.execute(
            "UPDATE faculty SET passcode = ? WHERE LOWER(email) = ?",
            (new_passcode.strip(), clean_email)
        )
        await db.commit()
        return True

async def db_get_faculty_profile(email: str) -> Optional[Dict]:
    clean_email = email.strip().lower()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT name, email, department, phone, designation, created_at FROM faculty WHERE LOWER(email) = ?", (clean_email,)) as cur:
            row = await cur.fetchone()
            if row:
                return dict(row)
            return None

async def db_update_faculty_profile(email: str, name: str, phone: str, designation: str) -> bool:
    clean_email = email.strip().lower()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT id FROM faculty WHERE LOWER(email) = ?", (clean_email,)) as cur:
            row = await cur.fetchone()
            if not row:
                raise ValueError("Faculty record not found")
        
        await db.execute(
            "UPDATE faculty SET name = ?, phone = ?, designation = ? WHERE LOWER(email) = ?",
            (name.strip(), phone.strip() if phone else "", designation.strip() if designation else "", clean_email)
        )
        await db.commit()
        return True
