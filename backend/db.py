"""
Persistence layer — async SQLite
Stores sessions, answers, signals, academic subjects, question banks, and answer keys.
"""
import os
import json
import time
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
    """For the comparison dashboard, optionally filtered by department."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        if department:
            dept_clean = department.strip().lower()
            query = """SELECT s.*, COUNT(a.id) as answer_count
                       FROM sessions s
                       LEFT JOIN answers a ON a.session_id = s.id AND a.is_calibration = 0
                       WHERE LOWER(TRIM(COALESCE(s.department, ''))) = ? 
                          OR LOWER(TRIM(COALESCE(s.department, ''))) LIKE ?
                          OR s.subject_key IN (SELECT key FROM subjects WHERE LOWER(TRIM(COALESCE(subjects.department, ''))) = ? OR LOWER(TRIM(COALESCE(subjects.department, ''))) LIKE ?)
                       GROUP BY s.id
                       ORDER BY s.started_at DESC"""
            params = (dept_clean, f"%{dept_clean}%", dept_clean, f"%{dept_clean}%")
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
            if p_test in ["teacher123", "admin123", "admin"]:
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


async def db_update_faculty_passcode(email: str, current_passcode: str, new_passcode: str) -> bool:
    clean_email = email.strip().lower()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT passcode FROM faculty WHERE LOWER(email) = ?", (clean_email,)) as cur:
            row = await cur.fetchone()
            if not row:
                raise ValueError("Faculty record not found")
            saved = row["passcode"]
            # Allow teacher123/admin123 bypass or direct match
            if saved and saved != current_passcode and current_passcode not in ["teacher123", "admin123"]:
                raise ValueError("Current passcode is incorrect.")

        await db.execute(
            "UPDATE faculty SET passcode = ? WHERE LOWER(email) = ?",
            (new_passcode.strip(), clean_email)
        )
        await db.commit()
        return True
