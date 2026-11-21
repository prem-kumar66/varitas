"""
Veritas Backend — FastAPI Server (v2)
======================================
Endpoints:
  POST   /api/session/start          - Create session with candidate metadata
  POST   /api/session/:id/finalize   - Mark session complete, compute summary
  GET    /api/session/:id/report     - Download PDF report
  GET    /api/sessions               - List all sessions (comparison view)
  POST   /api/question               - Set current question
  GET    /api/templates              - List role-based question templates
  GET    /api/templates/:key         - Get template questions
  GET    /api/demo/scenarios         - List demo scenarios
  POST   /api/demo/run               - Run a scripted demo answer
  WS     /ws/candidate/:id           - Candidate audio stream
  WS     /ws/interviewer/:id         - Dashboard live updates
"""
import os
import io
import time
import json
import asyncio
import wave
import shutil
from typing import Dict, Set, Optional
from contextlib import asynccontextmanager

import aiosqlite

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import Response, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from config import GROQ_MODEL

from analyzer import CognitiveAnalyzer, AnswerSegment, Baseline
from follow_up import FollowUpGenerator
from validator import validate_answer, is_non_answer
from scoring import compute_overall
from auth import create_access_token, get_current_teacher_token, get_current_admin_token
import db
from db import (
    ALLOWED_DEPARTMENTS,
    COLLEGE_EMAIL_SUFFIX,
    is_valid_college_email,
    normalize_department,
    db_register_faculty,
    db_authenticate_faculty,
    db_submit_faculty_query,
    db_list_faculty_queries,
    db_update_faculty_query,
    db_create_or_update_assignment,
    db_get_student_assignment,
    db_list_department_assignments,
    db_delete_assignment,
    db_get_department_subjects,
    db_request_subject_validation,
    db_approve_subject_questions,
    db_get_faculty_validation_tasks,
    db_get_student_notifications,
    db_update_faculty_passcode,
)
import report
import demo_mode
import templates as templates_mod
from rag.vectorstore import get_rag_store
from rag.ingest import process_document_bytes
from rag.evaluator import evaluate_with_rag
from generator import AssessmentGenerator

load_dotenv()

WHISPER_MODEL_NAME = os.getenv("WHISPER_MODEL", "base")
whisper_model = None


def load_whisper():
    global whisper_model
    if whisper_model is None:
        from faster_whisper import WhisperModel
        print(f"Loading Whisper model: {WHISPER_MODEL_NAME}...")
        whisper_model = WhisperModel(WHISPER_MODEL_NAME, device="cpu", compute_type="int8")
        print("[OK] Whisper loaded")
    return whisper_model


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.init_db()
    
    # Sync academic subjects & question templates into DB, removing obsolete ones
    valid_keys = set(templates_mod.SUBJECT_TEMPLATES.keys())
    async with aiosqlite.connect(db.DB_PATH) as _db:
        placeholders = ','.join('?' for _ in valid_keys)
        await _db.execute(f"DELETE FROM subjects WHERE key NOT IN ({placeholders})", list(valid_keys))
        await _db.execute(f"DELETE FROM questions WHERE subject_key NOT IN ({placeholders})", list(valid_keys))
        await _db.commit()

    for key, template in templates_mod.SUBJECT_TEMPLATES.items():
        await db.db_add_subject(key, template["name"], template["department"])
        existing_q = await db.db_list_questions(key)
        if not existing_q:
            for q in template["questions"]:
                await db.db_add_question(
                    subject_key=key,
                    question_text=q["question"],
                    reference_answer=q["reference_answer"],
                    rubric_keywords=q["rubric_keywords"],
                    max_marks=q.get("max_marks", 10),
                    time_limit_sec=q.get("time_limit_sec", 120),
                )
    load_whisper()
    yield


app = FastAPI(title="Veritas Academic", lifespan=lifespan)

frontend_origins_raw = os.getenv("FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
frontend_origins = [orig.strip() for orig in frontend_origins_raw.split(",") if orig.strip()]
if not frontend_origins:
    frontend_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Session state (in-memory) ----------
class InterviewSession:
    def __init__(self, session_id: str, language: str = "en"):
        self.session_id = session_id
        self.language = language
        self.analyzer = CognitiveAnalyzer(language=language)
        self.follow_up_gen = FollowUpGenerator()
        self.subject_key: Optional[str] = None
        self.current_question: str = ""
        self.current_reference_answer: str = ""
        self.current_rubric_keywords: list = []
        self.question_end_time: float = 0.0
        self.calibration_pending: bool = False
        self.candidate_ws: Optional[WebSocket] = None
        self.interviewer_wss: Set[WebSocket] = set()
        self.candidate_sample_rate: int = 16000  # adjusted per-client

    async def broadcast(self, payload: dict):
        dead = []
        for ws in self.interviewer_wss:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for d in dead:
            self.interviewer_wss.discard(d)
        if self.candidate_ws:
            try:
                await self.candidate_ws.send_json(payload)
            except Exception:
                pass


sessions: Dict[str, InterviewSession] = {}


def get_session(sid: str, language: str = "en") -> InterviewSession:
    if sid not in sessions:
        sessions[sid] = InterviewSession(sid, language)
    return sessions[sid]


# ---------- Models ----------
class SessionStart(BaseModel):
    session_id: str
    candidate_name: str = ""
    candidate_email: Optional[str] = ""
    department: Optional[str] = ""
    roll_number: str = ""
    mobile_number: str = ""
    academic_year: str = ""
    role: str = ""
    subject_key: str = ""
    mode: str = "oral"
    language: str = "en"
    exam_id: Optional[str] = None

class QuestionPayload(BaseModel):
    session_id: str
    question: str
    reference_answer: str = ""
    rubric_keywords: Optional[list] = None
    is_calibration: bool = False

class WrittenAnswerPayload(BaseModel):
    session_id: str
    question: str
    answer_text: str
    duration_sec: float = 0.0
    copy_paste_attempts: int = 0
    reference_answer: str = ""
    rubric_keywords: Optional[list] = None

class SubjectPayload(BaseModel):
    key: str
    name: str
    department: str

class QuestionBankPayload(BaseModel):
    subject_key: str
    question_text: str
    reference_answer: str
    rubric_keywords: list
    max_marks: int = 10
    time_limit_sec: int = 120

class QuizAnswerPayload(BaseModel):
    session_id: str
    subject_key: str
    question_index: int
    question_text: str
    selected_option: str
    is_correct: Optional[bool] = None
    correct_option: Optional[str] = None
    correct_text: Optional[str] = None
    selected_text: Optional[str] = None
    explanation: Optional[str] = None

class RAGQueryPayload(BaseModel):
    query: str
    subject_key: Optional[str] = None
    top_k: int = 4

class RAGEvaluatePayload(BaseModel):
    question: str
    student_answer: str
    subject_key: Optional[str] = None
    reference_answer: Optional[str] = None
    question_text: str
    selected_option: str  # "A" | "B" | "C" | "D"

class DemoRun(BaseModel):
    session_id: str
    scenario_key: str

class FinalizeBody(BaseModel):
    session_id: str

class AssessmentGeneratePayload(BaseModel):
    prompt: str
    subject_key: str
    mode: str
    num_questions: int = 5
    difficulty: str = "medium"
    source_filename: Optional[str] = None
    avoid_questions: Optional[list] = []

class AssessmentPublishPayload(BaseModel):
    exam_id: str
    name: str
    mode: str
    subject: str = ""
    unit: str = ""
    department: str = ""
    year: str = ""
    section: str = ""
    source_pdf: str = ""
    teacher: str = ""
    difficulty: str = "medium"
    questions: list

# ---------- Academic Question Bank APIs ----------
@app.get("/api/academic/subjects")
async def get_academic_subjects(department: Optional[str] = None):
    if department:
        subjects = await db_get_department_subjects(department)
        return {"subjects": subjects}
    subjects = await db.db_list_subjects()
    if not subjects:
        return {"subjects": templates_mod.list_templates()}
    return {"subjects": subjects}


@app.post("/api/academic/subjects")
async def add_academic_subject(body: SubjectPayload, current_user: dict = Depends(get_current_teacher_token)):
    await db.db_add_subject(body.key, body.name, body.department)
    return {"ok": True}


@app.get("/api/academic/questions")
async def get_academic_questions(subject_key: Optional[str] = None):
    questions = await db.db_list_questions(subject_key)
    return {"questions": questions}


@app.post("/api/academic/questions")
async def add_academic_question(body: QuestionBankPayload, current_user: dict = Depends(get_current_teacher_token)):
    qid = await db.db_add_question(
        body.subject_key, body.question_text, body.reference_answer,
        body.rubric_keywords, body.max_marks, body.time_limit_sec,
    )
    return {"ok": True, "id": qid}


@app.delete("/api/academic/questions/{question_id}")
async def delete_academic_question(question_id: int, current_user: dict = Depends(get_current_teacher_token)):
    await db.db_delete_question(question_id)
    return {"ok": True}


# ---------- Quiz (MCQ) Endpoints ----------
@app.get("/api/quiz/questions")
async def get_quiz_questions(subject_key: str = "computer_science"):
    """Return MCQ questions WITHOUT correct_answer — validated server-side only."""
    questions = templates_mod.get_mcq_questions(subject_key, include_answers=False)
    if not questions:
        raise HTTPException(status_code=404, detail=f"No MCQ questions found for subject '{subject_key}'")
    return {"subject_key": subject_key, "questions": questions, "total": len(questions)}


@app.post("/api/quiz/submit")
async def submit_quiz_answer(payload: QuizAnswerPayload):
    """Validate a student's MCQ answer server-side and save the result."""
    if payload.is_correct is not None:
        result = {
            "correct": payload.is_correct,
            "correct_answer": payload.correct_option or "",
            "correct_answer_text": payload.correct_text or "",
            "selected_option": payload.selected_option,
            "selected_text": payload.selected_text or "",
            "explanation": payload.explanation or "",
            "score": 10 if payload.is_correct else 0,
        }
    else:
        result = templates_mod.check_mcq_answer(
            payload.subject_key, payload.question_index, payload.selected_option
        )
    if result is None:
        raise HTTPException(status_code=400, detail="Invalid question index or subject key")

    now = time.time()
    sess = get_session(payload.session_id)

    # Build a concise transcript for the DB (the selected option text)
    transcript = f"Selected: {payload.selected_option}. {result['selected_text']}"
    score = float(result["score"])
    accuracy = 100.0 if result["correct"] else 0.0
    authenticity = 100.0  # MCQ has no authenticity dimension
    overall = score

    feedback = (
        f"✓ Correct! {result['explanation']}"
        if result["correct"]
        else f"✗ Incorrect. Correct answer: {result['correct_answer']}) {result['correct_answer_text']}. {result['explanation']}"
    )

    await db.save_answer(
        session_id=payload.session_id,
        question=payload.question_text,
        transcript=transcript,
        delay_sec=0.0,
        duration_sec=0.0,
        word_count=1,
        risk_score=0.0,
        authenticity_score=authenticity,
        signals={},
        explanations={},
        evidence={},
        follow_up=feedback,
        perplexity=None,
        is_calibration=False,
        created_at=now,
        mode="quiz",
        accuracy_score=accuracy,
        overall_score=overall,
        copy_paste_attempts=0,
        reference_answer=result["correct_answer_text"],
        key_points_covered=[result["correct_answer_text"]] if result["correct"] else [],
        missing_points=[] if result["correct"] else [result["correct_answer_text"]],
        conceptual_feedback=result["explanation"],
    )

    return {
        "correct": result["correct"],
        "correct_answer": result["correct_answer"],
        "correct_answer_text": result["correct_answer_text"],
        "selected_option": result["selected_option"],
        "selected_text": result["selected_text"],
        "explanation": result["explanation"],
        "score": score,
        "overall_score": overall,
        "accuracy_score": accuracy,
        "conceptual_feedback": feedback,
    }


# ---------- Session lifecycle ----------
@app.post("/api/session/start")
async def session_start(body: SessionStart):
    # Enforce single attempt policy if exam_id and roll_number are provided
    if body.exam_id and body.roll_number:
        already_done = await db.db_has_student_attempted(body.roll_number, body.exam_id)
        if already_done:
            raise HTTPException(
                status_code=403,
                detail="You have already completed this assessment. Re-attempts are not allowed."
            )

    started_at = time.time()
    sess = get_session(body.session_id, body.language)
    sess.language = body.language
    sess.subject_key = body.subject_key or None
    sess.analyzer = CognitiveAnalyzer(language=body.language)
    # Enforce @anurag.edu.in for students
    clean_email = (body.candidate_email or "").strip().lower()
    if clean_email and not is_valid_college_email(clean_email):
        raise HTTPException(status_code=400, detail="Only college email addresses ending with @anurag.edu.in are allowed.")

    clean_dept = normalize_department(body.department or "")
    await db.upsert_session(
        body.session_id, body.candidate_name, body.roll_number,
        body.mobile_number, body.academic_year,
        body.role, body.subject_key, body.mode, started_at,
        clean_dept, clean_email
    )
    return {"ok": True, "session_id": body.session_id, "started_at": started_at}


@app.post("/api/session/finalize")
@app.post("/api/session/end")
async def session_finalize(body: FinalizeBody):
    await db.finalize_session(body.session_id, time.time())
    return {"ok": True}


@app.get("/api/session/{session_id}/report")
async def session_report(session_id: str):
    sess = await db.get_session(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    answers = await db.get_session_answers(session_id)
    pdf_bytes = report.generate_report(sess, answers)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="veritas_{session_id}.pdf"'},
    )


@app.get("/api/sessions")
async def list_sessions(department: Optional[str] = None, current_user: dict = Depends(get_current_teacher_token)):
    dept_clean = (department or "").strip().lower()
    dept_param = None if (not dept_clean or dept_clean == "all") else normalize_department(dept_clean)
    return {"sessions": await db.list_sessions(department=dept_param)}


@app.get("/api/session/{session_id}/answers")
async def session_answers(session_id: str):
    return {"answers": await db.get_session_answers(session_id)}


# ---------- Question ----------
@app.post("/api/question")
async def set_question(payload: QuestionPayload):
    sess = get_session(payload.session_id)
    sess.current_question = payload.question
    sess.current_reference_answer = payload.reference_answer or ""
    sess.current_rubric_keywords = payload.rubric_keywords or []
    sess.question_end_time = time.time()
    sess.calibration_pending = payload.is_calibration
    await sess.broadcast({
        "type": "question_set",
        "question": payload.question,
        "reference_answer": payload.reference_answer,
        "rubric_keywords": payload.rubric_keywords,
        "is_calibration": payload.is_calibration,
        "timestamp": sess.question_end_time,
    })
    return {"ok": True, "question_end_time": sess.question_end_time}


# ---------- Written Answer Submission ----------
@app.post("/api/submit-written-answer")
async def submit_written_answer(payload: WrittenAnswerPayload):
    sess = get_session(payload.session_id)
    now = time.time()
    word_count = len(payload.answer_text.split())
    duration_sec = max(1.0, payload.duration_sec)

    seg = AnswerSegment(
        question=payload.question,
        transcript=payload.answer_text,
        question_end_time=now - duration_sec,
        answer_start_time=now - duration_sec,
        answer_end_time=now,
        word_count=word_count,
        duration_sec=duration_sec,
    )

    # 1. Anti-Cheat & Cognitive Authenticity Analysis
    scores, risk = sess.analyzer.analyze(
        seg, copy_paste_attempts=payload.copy_paste_attempts, is_written=True
    )
    authenticity = sess.analyzer.authenticity_score(risk)

    # 2. Semantic Validation vs Reference Model Answer
    validation = validate_answer(
        payload.question, payload.answer_text,
        payload.reference_answer or sess.current_reference_answer,
        payload.rubric_keywords or sess.current_rubric_keywords,
    )
    accuracy = validation["accuracy_score"]
    if is_non_answer(payload.answer_text, payload.question):
        accuracy = 0.0

    # Composite Score: gated relevance formula
    overall_score = compute_overall(accuracy, authenticity)

    signals_dict = {
        "delay": scores.delay, "fluency": scores.fluency,
        "hesitation": scores.hesitation, "polish": scores.polish,
        "pacing": scores.pacing, "consistency": scores.consistency,
    }
    evidence_dict = {
        k: [{"span": e.span, "reason": e.reason, "weight": e.weight} for e in v]
        for k, v in scores.evidence.items()
    }

    out_payload = {
        "type": "analysis",
        "mode": "written",
        "transcript": payload.answer_text,
        "question": payload.question,
        "timing": {"delay_before_answer": 0.0, "answer_duration": duration_sec},
        "signals": signals_dict,
        "explanations": scores.explanations,
        "evidence": evidence_dict,
        "risk_score": round(risk, 1),
        "authenticity_score": round(authenticity, 1),
        "accuracy_score": round(accuracy, 1),
        "overall_score": overall_score,
        "copy_paste_attempts": payload.copy_paste_attempts,
        "reference_answer": payload.reference_answer or sess.current_reference_answer,
        "key_points_covered": validation["key_points_covered"],
        "missing_points": validation["missing_points"],
        "conceptual_feedback": validation["conceptual_feedback"],
        "follow_up": "Written answer submission complete.",
        "word_count": word_count,
        "perplexity": scores.perplexity_value,
        "calibrated": False,
        "simulated": False,
    }

    await sess.broadcast(out_payload)

    await db.save_answer(
        session_id=sess.session_id,
        question=payload.question,
        transcript=payload.answer_text,
        delay_sec=0.0,
        duration_sec=duration_sec,
        word_count=word_count,
        risk_score=risk,
        authenticity_score=authenticity,
        signals=signals_dict,
        explanations=scores.explanations,
        evidence=evidence_dict,
        follow_up="Written answer submission",
        perplexity=scores.perplexity_value,
        is_calibration=False,
        created_at=now,
        mode="written",
        accuracy_score=accuracy,
        overall_score=overall_score,
        copy_paste_attempts=payload.copy_paste_attempts,
        reference_answer=payload.reference_answer or sess.current_reference_answer,
        key_points_covered=validation["key_points_covered"],
        missing_points=validation["missing_points"],
        conceptual_feedback=validation["conceptual_feedback"],
    )

    return out_payload


# ---------- Templates ----------
@app.get("/api/templates")
async def list_templates():
    return {"templates": templates_mod.list_templates()}


@app.get("/api/templates/{key}")
async def get_template(key: str):
    t = templates_mod.get_template(key)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return t


# ---------- Demo Mode ----------
@app.get("/api/demo/scenarios")
async def list_demo():
    return {"scenarios": demo_mode.list_scenarios()}


@app.post("/api/demo/run")
async def run_demo(body: DemoRun):
    """Inject a scripted answer into the pipeline (skips audio)."""
    scenario = demo_mode.get_scenario(body.scenario_key)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    sess = get_session(body.session_id)

    # Run each round of the scenario with a short pause between
    for round_data in scenario["rounds"]:
        sess.current_question = round_data["question"]
        sess.question_end_time = time.time()
        await sess.broadcast({
            "type": "question_set",
            "question": round_data["question"],
            "is_calibration": False,
            "timestamp": sess.question_end_time,
        })
        await asyncio.sleep(1.5)

        # Simulate the candidate's timing
        await sess.broadcast({
            "type": "candidate_speaking",
            "started_at": time.time(),
        })

        # Inject scripted answer
        now = time.time()
        seg = AnswerSegment(
            question=round_data["question"],
            transcript=round_data["transcript"],
            question_end_time=sess.question_end_time,
            answer_start_time=sess.question_end_time + round_data["delay_before_answer"],
            answer_end_time=sess.question_end_time + round_data["delay_before_answer"] + round_data["answer_duration"],
            word_count=len(round_data["transcript"].split()),
            duration_sec=round_data["answer_duration"],
        )

        await process_segment(sess, seg, is_calibration=False, simulate=True)
        await asyncio.sleep(2.0)

    return {"ok": True}


# ---------- Audio ----------
def transcribe_pcm(pcm_bytes: bytes, sample_rate: int) -> tuple[str, float, float]:
    """Transcribe PCM16 mono audio at any sample rate."""
    model = load_whisper()
    audio = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    duration = len(audio) / sample_rate

    # Resample to 16kHz if needed (Whisper's native rate)
    if sample_rate != 16000:
        # Simple linear resample — good enough for Whisper, no scipy needed
        target_len = int(len(audio) * 16000 / sample_rate)
        if target_len > 0:
            xp = np.linspace(0, 1, len(audio))
            x_new = np.linspace(0, 1, target_len)
            audio = np.interp(x_new, xp, audio).astype(np.float32)

    start = time.time()
    segments, _info = model.transcribe(
        audio, beam_size=1, language="en",
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 300},
    )
    text = " ".join(seg.text for seg in segments).strip()
    elapsed = time.time() - start
    return text, duration, elapsed


async def process_segment(
    sess: InterviewSession,
    seg: AnswerSegment,
    is_calibration: bool,
    simulate: bool = False,
):
    """Common path: analyze, generate follow-up, broadcast, persist."""
    # Calibration mode — establish baseline, broadcast simpler event
    if is_calibration:
        baseline = sess.analyzer.calibrate(seg)
        sess.calibration_pending = False
        await sess.broadcast({
            "type": "calibration_complete",
            "transcript": seg.transcript,
            "baseline": {
                "avg_delay": baseline.avg_delay,
                "avg_wpm": baseline.avg_wpm,
                "filler_rate": baseline.filler_rate,
                "avg_perplexity": baseline.avg_perplexity,
            },
        })
        await db.save_answer(
            sess.session_id, seg.question, seg.transcript,
            seg.answer_start_time - seg.question_end_time, seg.duration_sec, seg.word_count,
            0.0, 100.0, {}, {}, {},
            "Calibration round — no follow-up", baseline.avg_perplexity,
            True, time.time(),
        )
        return

    # Normal answer
    scores, risk = sess.analyzer.analyze(seg)
    authenticity = sess.analyzer.authenticity_score(risk)

    # Conceptual validation (with RAG context if available)
    validation = validate_answer(
        seg.question,
        seg.transcript,
        sess.current_reference_answer,
        sess.current_rubric_keywords,
        subject_key=sess.subject_key,
    )
    accuracy = float(validation.get("accuracy_score", 0.0))
    if is_non_answer(seg.transcript, seg.question):
        accuracy = 0.0
    overall_score = compute_overall(accuracy, authenticity)

    loop = asyncio.get_event_loop()
    follow_up = await loop.run_in_executor(
        None, sess.follow_up_gen.generate,
        seg.question, seg.transcript, risk, sess.language,
        validation.get("retrieved_chunks"),
    )

    signals_dict = {
        "delay": scores.delay, "fluency": scores.fluency,
        "hesitation": scores.hesitation, "polish": scores.polish,
        "pacing": scores.pacing, "consistency": scores.consistency,
    }
    evidence_dict = {
        k: [{"span": e.span, "reason": e.reason, "weight": e.weight} for e in v]
        for k, v in scores.evidence.items()
    }

    payload = {
        "type": "analysis",
        "transcript": seg.transcript,
        "question": seg.question,
        "timing": {
            "delay_before_answer": seg.answer_start_time - seg.question_end_time,
            "answer_duration": seg.duration_sec,
        },
        "signals": signals_dict,
        "explanations": scores.explanations,
        "evidence": evidence_dict,
        "risk_score": round(risk, 1),
        "authenticity_score": round(authenticity, 1),
        "accuracy_score": round(accuracy, 1),
        "overall_score": overall_score,
        "faithfulness_score": round(float(validation.get("faithfulness_score", accuracy)), 1),
        "key_points_covered": validation.get("key_points_covered", []),
        "missing_points": validation.get("missing_points", []),
        "citations": validation.get("citations", []),
        "conceptual_feedback": validation.get("conceptual_feedback", ""),
        "rag_grounded": bool(validation.get("rag_grounded", False)),
        "follow_up": follow_up,
        "word_count": seg.word_count,
        "perplexity": scores.perplexity_value,
        "calibrated": sess.analyzer.baseline.calibrated,
        "simulated": simulate,
    }
    await sess.broadcast(payload)

    await db.save_answer(
        session_id=sess.session_id,
        question=seg.question,
        transcript=seg.transcript,
        delay_sec=seg.answer_start_time - seg.question_end_time,
        duration_sec=seg.duration_sec,
        word_count=seg.word_count,
        risk_score=risk,
        authenticity_score=authenticity,
        signals=signals_dict,
        explanations=scores.explanations,
        evidence=evidence_dict,
        follow_up=follow_up,
        perplexity=scores.perplexity_value,
        is_calibration=False,
        created_at=time.time(),
        mode="oral",
        accuracy_score=accuracy,
        overall_score=overall_score,
        copy_paste_attempts=0,
        reference_answer=sess.current_reference_answer,
        key_points_covered=validation.get("key_points_covered", []),
        missing_points=validation.get("missing_points", []),
        conceptual_feedback=validation.get("conceptual_feedback", ""),
    )


# ---------- WebSocket: candidate audio ----------
@app.websocket("/ws/candidate/{session_id}")
async def candidate_socket(ws: WebSocket, session_id: str):
    await ws.accept()
    sess = get_session(session_id)
    sess.candidate_ws = ws

    # Send current question immediately upon connection so they don't miss it
    if sess.current_question:
        try:
            await ws.send_json({
                "type": "question_set",
                "question": sess.current_question,
                "is_calibration": sess.calibration_pending,
                "timestamp": sess.question_end_time,
            })
        except Exception:
            pass

    answer_buffer = bytearray()
    answer_start_time: Optional[float] = None
    speaking_question: Optional[str] = None
    speaking_question_end_time: Optional[float] = None

    try:
        while True:
            msg = await ws.receive()
            if "text" in msg:
                data = json.loads(msg["text"])
                if data.get("type") == "hello":
                    # Client tells us its actual sample rate
                    sess.candidate_sample_rate = int(data.get("sample_rate", 16000))
                    await ws.send_json({"type": "ready", "sample_rate": sess.candidate_sample_rate})

                elif data.get("type") == "answer_start":
                    answer_buffer = bytearray()
                    answer_start_time = time.time()
                    speaking_question = data.get("question") or sess.current_question
                    speaking_question_end_time = sess.question_end_time
                    await sess.broadcast({"type": "candidate_speaking", "started_at": answer_start_time})

                elif data.get("type") == "answer_end" and answer_start_time:
                    answer_end_time = time.time()
                    server_duration = answer_end_time - answer_start_time
                    if len(answer_buffer) > 8000:  # >0.25s of audio
                        loop = asyncio.get_event_loop()
                        transcript, _dur, _proc = await loop.run_in_executor(
                            None, transcribe_pcm,
                            bytes(answer_buffer), sess.candidate_sample_rate,
                        )
                        if transcript:
                            seg = AnswerSegment(
                                question=speaking_question or sess.current_question,
                                transcript=transcript,
                                question_end_time=speaking_question_end_time or sess.question_end_time,
                                answer_start_time=answer_start_time,
                                answer_end_time=answer_end_time,
                                word_count=len(transcript.split()),
                                duration_sec=server_duration,
                            )
                            await process_segment(sess, seg, is_calibration=sess.calibration_pending)
                    answer_buffer = bytearray()
                    answer_start_time = None
                    speaking_question = None
                    speaking_question_end_time = None

                elif data.get("type") == "webrtc":
                    await sess.broadcast({"type": "webrtc_from_candidate", "payload": data["payload"]})

            elif "bytes" in msg:
                if answer_start_time is not None:
                    answer_buffer.extend(msg["bytes"])

    except WebSocketDisconnect:
        sess.candidate_ws = None
    except Exception as e:
        print(f"Candidate WS error: {e}")
        sess.candidate_ws = None


# ---------- WebSocket: interviewer ----------
@app.websocket("/ws/interviewer/{session_id}")
async def interviewer_socket(ws: WebSocket, session_id: str):
    await ws.accept()
    sess = get_session(session_id)
    sess.interviewer_wss.add(ws)
    await ws.send_json({
        "type": "connected",
        "session_id": session_id,
        "calibrated": sess.analyzer.baseline.calibrated,
    })
    try:
        while True:
            msg = await ws.receive_json()
            if msg.get("type") == "webrtc":
                if sess.candidate_ws:
                    try:
                        await sess.candidate_ws.send_json({"type": "webrtc_from_interviewer", "payload": msg["payload"]})
                    except Exception:
                        pass
    except WebSocketDisconnect:
        sess.interviewer_wss.discard(ws)
    except Exception as e:
        print(f"Interviewer WS error: {e}")
        sess.interviewer_wss.discard(ws)


# ---------- RAG Document & Grounding Endpoints ----------
@app.post("/api/rag/upload")
async def rag_upload_document(
    file: UploadFile = File(...),
    subject_key: str = Form("global"),
    current_user: dict = Depends(get_current_teacher_token),
):
    """Uploads a PDF or text syllabus/material document and automatically indexes it into the FAISS vectorstore."""
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        store = get_rag_store()
        # Duplicate detection: check if file is already present
        if store.has_document(file.filename, subject_key=subject_key):
            raise HTTPException(status_code=409, detail="PDF already present")

        chunks = process_document_bytes(content, file.filename)
        if not chunks:
            raise HTTPException(status_code=400, detail="Could not extract any readable text chunks from document.")

        added_count = store.add_documents(chunks, subject_key=subject_key)

        # Permanently save uploaded file bytes to disk
        try:
            clean_subj = subject_key.lower().replace(" ", "_")
            upload_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "data", "uploads", clean_subj))
            os.makedirs(upload_dir, exist_ok=True)
            saved_path = os.path.join(upload_dir, file.filename)
            with open(saved_path, "wb") as f:
                f.write(content)
        except Exception as e:
            print(f"[RAG API] Warning: could not persist physical file: {e}")

        return {
            "ok": True,
            "filename": file.filename,
            "subject_key": subject_key,
            "chunks_added": added_count,
            "message": f"Successfully built knowledge base automatically from '{file.filename}' ({added_count} chunks indexed).",
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[RAG API] Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/rag/documents")
async def rag_list_documents(subject_key: Optional[str] = None, current_user: dict = Depends(get_current_teacher_token)):
    """Lists indexed documents and chunks summary. Fuzzy-matches subject_key if exact match not found."""
    store = get_rag_store()
    resolved_key = subject_key
    if subject_key:
        clean = subject_key.lower().replace(" ", "_")
        available = list(store._indices.keys())
        if clean not in available:
            # Fuzzy match
            req_parts = set(clean.replace("_", " ").split())
            best_key, best_score = None, 0
            for key in available:
                if key == "global":
                    continue
                key_parts = set(key.replace("_", " ").split())
                overlap = len(req_parts & key_parts)
                if overlap > best_score:
                    best_score = overlap
                    best_key = key
            if best_score >= 2:
                resolved_key = best_key
                print(f"[RAG docs] Fuzzy matched '{clean}' -> '{best_key}'")
    return {"sources": store.list_indexed_sources(resolved_key)}


@app.delete("/api/rag/document")
async def rag_delete_document(filename: str, subject_key: Optional[str] = None, current_user: dict = Depends(get_current_teacher_token)):
    """Permanently removes a document and its indexed chunks from the RAG knowledge base and deletes the physical file."""
    if not filename or not filename.strip():
        raise HTTPException(status_code=400, detail="Document filename is required.")

    store = get_rag_store()
    deleted_chunks = store.delete_document(filename=filename, subject_key=subject_key)

    # Permanently delete physical file if stored
    deleted_file = False
    clean_target = os.path.basename(filename).strip().lower()
    upload_base = os.path.abspath(os.path.join(os.path.dirname(__file__), "data", "uploads"))
    if os.path.exists(upload_base):
        for root, _, files in os.walk(upload_base):
            for f in files:
                if f.lower() == clean_target:
                    try:
                        os.remove(os.path.join(root, f))
                        deleted_file = True
                    except Exception as e:
                        print(f"[RAG API] Error deleting physical file {f}: {e}")

    return {
        "ok": True,
        "filename": filename,
        "deleted_chunks": deleted_chunks,
        "file_removed": deleted_file,
        "message": f"Successfully permanently deleted '{filename}' ({deleted_chunks} chunks removed).",
    }


@app.delete("/api/rag/documents/{filename:path}")
async def rag_delete_document_path(filename: str, subject_key: Optional[str] = None, current_user: dict = Depends(get_current_teacher_token)):
    return await rag_delete_document(filename=filename, subject_key=subject_key, current_user=current_user)


@app.post("/api/rag/query")
async def rag_query_context(payload: RAGQueryPayload, current_user: dict = Depends(get_current_teacher_token)):
    """Performs similarity search to retrieve top knowledge base chunks for a question."""
    store = get_rag_store()
    results = store.similarity_search(
        query=payload.query,
        subject_key=payload.subject_key,
        top_k=payload.top_k,
    )
    return {"results": results}


@app.post("/api/rag/evaluate")
async def rag_evaluate_answer(payload: RAGEvaluatePayload, current_user: dict = Depends(get_current_teacher_token)):
    """Runs full RAGAS-style evaluation on a student answer against retrieved syllabus excerpts."""
    store = get_rag_store()
    query = f"{payload.question} {payload.reference_answer or ''}".strip()
    chunks = store.similarity_search(query=query, subject_key=payload.subject_key, top_k=4)
    eval_result = evaluate_with_rag(
        question=payload.question,
        student_answer=payload.student_answer,
        retrieved_chunks=chunks,
        model_reference_answer=payload.reference_answer,
    )
    return {
        "evaluation": eval_result,
        "retrieved_chunks": chunks,
    }


@app.delete("/api/rag/clear/{subject_key}")
async def rag_clear_subject(subject_key: str, current_user: dict = Depends(get_current_teacher_token)):
    """Clears indexed FAISS vector database and uploaded files for a given subject."""
    store = get_rag_store()
    store.clear_index(subject_key)

    # Clean up physical files for that subject
    clean_subj = subject_key.lower().replace(" ", "_")
    upload_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "data", "uploads", clean_subj))
    if os.path.exists(upload_dir):
        try:
            shutil.rmtree(upload_dir)
        except Exception as e:
            print(f"[RAG API] Error removing upload dir: {e}")

    return {"ok": True, "message": f"Knowledge base index and files permanently cleared for '{subject_key}'."}



# ---------- Assessments ----------
@app.post("/api/assessments/generate")
async def generate_assessment(payload: AssessmentGeneratePayload, current_user: dict = Depends(get_current_teacher_token)):
    store = get_rag_store()
    
    print(f"\n--- [DEBUG] TEACHER AI RETRIEVAL ---")
    print(f"1. Query received: {payload.prompt}")
    print(f"2. Filters/metadata used: subject_key='{payload.subject_key}', source_filename='{payload.source_filename}'")

    # --- Fuzzy subject key resolution ---
    # The frontend may send "ai_4th_year" but the index is stored as "ai_&_ml_4th_year".
    # Find the best-matching indexed subject key by prefix/suffix similarity.
    def _resolve_subject_key(requested: str) -> Optional[str]:
        if not requested:
            return None
        clean = requested.lower().replace(" ", "_")
        available = list(store._indices.keys())
        # Exact match
        if clean in available:
            return clean
        # Fuzzy: find all indexed keys that share department prefix or year suffix
        req_parts = set(clean.replace("_", " ").split())
        best_key = None
        best_score = 0
        for key in available:
            if key == "global":
                continue
            key_parts = set(key.replace("_", " ").split())
            overlap = len(req_parts & key_parts)
            if overlap > best_score:
                best_score = overlap
                best_key = key
        # Only accept if at least 2 words overlap (avoid false positives)
        if best_score >= 2:
            print(f"[Generate] Fuzzy matched '{clean}' -> '{best_key}' (overlap={best_score})")
            return best_key
        return None

    resolved_key = _resolve_subject_key(payload.subject_key)
    print(f"3. Resolved subject key: '{resolved_key}'")

    chunks = []
    # Step 1: If specific source_filename is selected, fetch ONLY chunks from that file
    if payload.source_filename:
        chunks = store.get_document_chunks(payload.source_filename, subject_key=resolved_key)
        if not chunks:
            # Try searching all subjects for this specific file
            chunks = store.get_document_chunks(payload.source_filename, subject_key=None)
        if chunks:
            print(f"4. Loaded {len(chunks)} chunks directly from file: {payload.source_filename}")
        else:
            raise HTTPException(
                status_code=400,
                detail=f"No indexed content found for '{payload.source_filename}'. Please re-upload the PDF in Syllabus & RAG."
            )

    # Step 2: No specific file — similarity search restricted to resolved subject only
    if not chunks:
        query = payload.prompt.strip()
        if resolved_key:
            # Restrict to the teacher's own subject index
            chunks = store.get_subject_chunks(resolved_key)
            print(f"4. Retrieved {len(chunks)} subject chunks from '{resolved_key}'")
        
        if not chunks:
            # Last resort: similarity search within subject (not global fallback)
            chunks = store.similarity_search(query=query, subject_key=resolved_key, top_k=20)
            print(f"4. Similarity search returned {len(chunks)} chunks")

    if not chunks:
        # Check global fallback chunks
        chunks = store.get_subject_chunks("global")
        if not chunks:
            chunks = store.similarity_search(query=payload.prompt.strip(), subject_key=None, top_k=10)

    # If still no PDF chunks, but teacher specifically asks for an intro / warm-up question:
    is_intro_request = any(term in payload.prompt.lower() for term in ["introduce", "introduction", "about yourself", "warm up", "warm-up", "icebreaker", "background"])
    if not chunks and is_intro_request:
        chunks = [{"text": f"Subject Domain: {payload.subject_key or 'Academic Assessment'}. Standard academic viva introduction and candidate background evaluation.", "source": "Academic Viva Guidelines"}]

    # Step 3: Strict check -- if no PDF content exists in the knowledge base, do not generate
    if not chunks:
        raise HTTPException(
            status_code=400,
            detail="No PDF documents found in the Knowledge Base for this subject. Please upload a subject PDF first."
        )

    print(f"3. Number of chunks retrieved: {len(chunks)}")
    doc_names = list(set([c.get('source', 'Uploaded PDF') for c in chunks]))
    print(f"4. Names of retrieved documents: {doc_names}")
    
    # Step 4: Generate questions fulfilling Teacher's Request and grounded in chunks
    import importlib
    import generator as gen_mod
    importlib.reload(gen_mod)
    generator = gen_mod.AssessmentGenerator()
    try:
        gen_result = generator.generate(
            prompt=payload.prompt,
            mode=payload.mode,
            num_questions=payload.num_questions,
            difficulty=payload.difficulty,
            context_chunks=chunks,
            avoid_questions=payload.avoid_questions,
        )
    except ValueError as e:
        if "NO_RAG_CONTENT" in str(e):
            raise HTTPException(
                status_code=422,
                detail="No readable content found in the uploaded documents. Please upload a valid PDF first."
            )
        raise HTTPException(status_code=500, detail=str(e))
    
    if isinstance(gen_result, dict):
        questions = gen_result.get("questions", [])
        generation_method = gen_result.get("generation_method", "llm")
        warning = gen_result.get("warning")
    else:
        questions = gen_result
        generation_method = "llm"
        warning = None

    is_custom = gen_mod.AssessmentGenerator.is_custom_standalone_request(payload.prompt)
    return {
        "questions": questions,
        "source_documents": ["Teacher's Request"] if is_custom else doc_names,
        "is_custom": is_custom,
        "mode": payload.mode,
        "count": len(questions),
        "generation_method": generation_method,
        "warning": warning,
    }

class TeacherChatPayload(BaseModel):
    query: str
    context: Optional[dict] = None

@app.post("/api/teacher/chat")
def teacher_chat(payload: TeacherChatPayload, current_user: dict = Depends(get_current_teacher_token)):
    import os
    try:
        from groq import Groq
        import httpx
    except ImportError:
        return {"response": "I am a Teacher AI. Please install groq to enable dynamic chat."}
        
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or api_key.startswith("gsk_your"):
        return {"response": "I am a Teacher AI. Please set your GROQ_API_KEY to enable chat."}
        
    try:
        client = Groq(api_key=api_key, http_client=httpx.Client())
        system_prompt = "You are 'Teacher AI', an intelligent academic teaching assistant for Veritas Academic. Be helpful, polite, conversational, and brief. You help teachers generate quizzes, analyze topics, and manage their classes. Answer natural language realistically."
        
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": payload.query},
            ],
            temperature=0.7,
            max_tokens=1000,
        )
        return {"response": response.choices[0].message.content.strip()}
    except Exception as e:
        print(f"[Teacher Chat] Error: {e}")
        return {"response": "I am having trouble connecting to my brain right now. Please try again later."}


@app.post("/api/assessments")
async def publish_assessment(payload: AssessmentPublishPayload, current_user: dict = Depends(get_current_teacher_token)):
    now = time.time()
    await db.db_save_assessment(
        exam_id=payload.exam_id,
        name=payload.name,
        mode=payload.mode,
        subject=payload.subject,
        unit=payload.unit,
        department=payload.department,
        year=payload.year,
        section=payload.section,
        source_pdf=payload.source_pdf,
        teacher=payload.teacher,
        difficulty=payload.difficulty,
        questions=payload.questions,
        created_at=now,
    )
    # Notify all matching students immediately
    notified = 0
    try:
        notified = await db.db_notify_section_for_exam(
            department=payload.department,
            year=payload.year,
            section=payload.section,
            exam_name=payload.name,
            mode=payload.mode,
            teacher=payload.teacher,
            exam_id=payload.exam_id,
        )
    except Exception as e:
        print(f"[Notify] Warning: could not send student notifications: {e}")
    return {"ok": True, "exam_id": payload.exam_id, "students_notified": notified}


@app.get("/api/assessments")
async def list_assessments(department: Optional[str] = None, year: Optional[str] = None, current_user: dict = Depends(get_current_teacher_token)):
    assessments = await db.db_list_assessments(department, year)
    return {"assessments": assessments}


@app.get("/api/analytics/subject-performance")
async def get_subject_performance(
    department: Optional[str] = None,
    year: Optional[str] = None,
    section: Optional[str] = None,
    current_user: dict = Depends(get_current_teacher_token),
):
    rows = await db.db_get_subject_performance(
        department=department,
        year=year,
        section=section,
    )
    return {"subject_performance": rows}


@app.get("/api/assessments/{exam_id}")
async def get_assessment(exam_id: str):
    assessment = await db.db_get_assessment(exam_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return {"assessment": assessment}


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "whisper_loaded": whisper_model is not None,
        "active_sessions": len(sessions),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=True,
    )


# ---------- Faculty Management & Queries ----------
class StudentSignupPayload(BaseModel):
    email: str
    name: str
    roll_number: str
    mobile: str
    academic_year: str
    department: str
    password: str
    section: Optional[str] = "A"

class StudentLoginPayload(BaseModel):
    roll_number: str
    password: str

class FacultySignupPayload(BaseModel):
    email: str
    name: str
    department: str
    phone: Optional[str] = ""
    designation: Optional[str] = "Professor"
    passcode: str


class FacultyLoginPayload(BaseModel):
    email: str
    passcode: str


class FacultyGuestPayload(BaseModel):
    name: Optional[str] = "Guest Faculty"
    department: str


class FacultyQueryPayload(BaseModel):
    email: str
    name: str
    current_dept: str
    target_dept: str
    phone: Optional[str] = ""
    reason: Optional[str] = ""


class ForgotPasswordRequestPayload(BaseModel):
    email: str
    user_type: str = "student"  # "student" or "faculty"


class VerifyOtpPayload(BaseModel):
    email: str
    otp: str
    user_type: str = "student"


class ResetPasswordPayload(BaseModel):
    email: str
    otp: str
    new_password: str
    user_type: str = "student"


@app.get("/api/faculty/departments")
async def get_faculty_departments():
    return {"departments": ALLOWED_DEPARTMENTS}


# --- Authentication & Password Recovery Endpoints ---
@app.post("/api/auth/forgot-password/request")
async def forgot_password_request(payload: ForgotPasswordRequestPayload):
    try:
        from db import db_create_password_reset_otp
        from mailer import send_password_reset_email

        clean_email = payload.email.strip().lower()
        clean_user_type = payload.user_type.strip().lower()
        
        otp, user_name = await db_create_password_reset_otp(clean_email, clean_user_type)
        
        # Send email (or fallback to dev preview)
        mail_res = send_password_reset_email(clean_email, user_name, otp, clean_user_type)
        
        resp = {
            "ok": True,
            "message": f"A 6-digit verification code has been sent to {clean_email}.",
            "email": clean_email,
            "user_type": clean_user_type,
            "mode": mail_res.get("mode", "smtp"),
        }
        if mail_res.get("mode") == "preview" or mail_res.get("otp"):
            resp["dev_code"] = otp
            resp["preview_notice"] = f"Development mode: Code is {otp}"
            
        return resp
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process password reset: {str(e)}")


@app.post("/api/auth/forgot-password/verify-otp")
async def forgot_password_verify(payload: VerifyOtpPayload):
    try:
        from db import db_verify_password_reset_otp
        clean_email = payload.email.strip().lower()
        clean_otp = payload.otp.strip()
        clean_user_type = payload.user_type.strip().lower()
        
        await db_verify_password_reset_otp(clean_email, clean_otp, clean_user_type)
        return {"ok": True, "message": "Verification code verified successfully."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")


@app.post("/api/auth/forgot-password/reset")
async def forgot_password_reset(payload: ResetPasswordPayload):
    try:
        from db import db_reset_password_with_otp
        clean_email = payload.email.strip().lower()
        clean_otp = payload.otp.strip()
        clean_new_pass = payload.new_password.strip()
        clean_user_type = payload.user_type.strip().lower()
        
        await db_reset_password_with_otp(clean_email, clean_otp, clean_new_pass, clean_user_type)
        return {
            "ok": True, 
            "message": "Password updated successfully. You can now log in with your new password."
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Password reset failed: {str(e)}")


@app.post("/api/student/signup")
async def student_signup(payload: StudentSignupPayload):
    try:
        from db import db_register_student
        student_data = await db_register_student(
            email=payload.email,
            name=payload.name,
            roll_number=payload.roll_number,
            mobile=payload.mobile,
            academic_year=payload.academic_year,
            department=payload.department,
            password=payload.password,
            section=payload.section
        )
        return {"ok": True, "message": "Student account created successfully", "student": student_data}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/student/login")
async def student_login(payload: StudentLoginPayload):
    try:
        from db import db_authenticate_student
        student_data = await db_authenticate_student(
            roll_number=payload.roll_number,
            password=payload.password
        )
        if not student_data:
            raise ValueError("Invalid roll number or password.")
        return {"ok": True, "student": student_data}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/faculty/signup")
async def faculty_signup(payload: FacultySignupPayload):
    try:
        faculty = await db_register_faculty(
            email=payload.email,
            name=payload.name,
            department=payload.department,
            phone=payload.phone or "",
            designation=payload.designation or "Professor",
            passcode=payload.passcode
        )
        return {"ok": True, "faculty": faculty}
    except ValueError as e:
        msg = str(e)
        if msg == "already signed up for one dept":
            raise HTTPException(status_code=409, detail="already signed up for one dept")
        raise HTTPException(status_code=400, detail=msg)


@app.post("/api/faculty/login")
async def faculty_login(payload: FacultyLoginPayload):
    try:
        faculty = await db_authenticate_faculty(payload.email, payload.passcode)
        if not faculty:
            raise HTTPException(
                status_code=401, 
                detail="Invalid credentials. Please check your email and passcode or register."
            )
        # Remove passcode before returning
        faculty.pop("passcode", None)
        is_admin = (faculty.get("email", "").lower() == "admin@anurag.edu.in") or (faculty.get("department") == "all")
        faculty["role"] = "Dean / Super Admin" if is_admin else (faculty.get("designation") or "Professor")
        faculty["is_guest"] = False
        faculty["is_admin"] = is_admin
        if is_admin:
            faculty["department"] = "all"

        token = create_access_token({
            "sub": faculty["email"],
            "email": faculty["email"],
            "role": faculty["role"],
            "is_admin": is_admin,
            "department": faculty["department"],
        })
        return {"ok": True, "faculty": faculty, "token": token}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/faculty/guest")
async def faculty_guest(payload: FacultyGuestPayload):
    dept = normalize_department(payload.department)
    if dept not in ALLOWED_DEPARTMENTS:
        raise HTTPException(status_code=400, detail=f"Invalid department. Allowed: {', '.join(ALLOWED_DEPARTMENTS)}")
    
    faculty_data = {
        "name": payload.name or "Guest Faculty",
        "email": f"guest.{dept}@anurag.edu.in",
        "department": dept,
        "designation": "Guest Observer",
        "role": "Guest Faculty",
        "is_guest": True,
        "is_admin": False,
    }
    token = create_access_token({
        "sub": faculty_data["email"],
        "email": faculty_data["email"],
        "role": "Guest Faculty",
        "is_admin": False,
        "department": dept,
    })
    return {
        "ok": True,
        "faculty": faculty_data,
        "token": token,
    }


@app.post("/api/faculty/query")
async def submit_faculty_query(payload: FacultyQueryPayload):
    try:
        query_record = await db_submit_faculty_query(
            email=payload.email,
            name=payload.name,
            current_dept=payload.current_dept,
            target_dept=payload.target_dept,
            phone=payload.phone or "",
            reason=payload.reason or ""
        )
        return {"ok": True, "query": query_record}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/faculty/queries")
async def list_faculty_queries(email: Optional[str] = None, current_user: dict = Depends(get_current_admin_token)):
    queries = await db_list_faculty_queries(email=email)
    return {"queries": queries}


class QueryStatusUpdatePayload(BaseModel):
    status: str


@app.patch("/api/faculty/query/{query_id}")
async def update_faculty_query_status(query_id: int, payload: QueryStatusUpdatePayload, current_user: dict = Depends(get_current_admin_token)):
    updated = await db_update_faculty_query(query_id, payload.status)
    if not updated:
        raise HTTPException(status_code=404, detail="Query not found")
    return {"ok": True, "query": updated}


# --- Academic Assessment Mode Assignment Models & Endpoints ---
class AssignModePayload(BaseModel):
    faculty_email: str
    department: str
    academic_year: str = "3rd Year"
    section: str = "Section A"
    assigned_mode: str = "oral" # "oral", "written", "quiz", "open"
    student_roll: Optional[str] = None
    title: Optional[str] = None


@app.get("/api/assignments/check")
async def check_student_assignment(
    department: str = "cse", 
    academic_year: str = "3rd Year", 
    section: str = "Section A", 
    roll_number: Optional[str] = None
):
    """Checks whether this student or section has a mandated test mode."""
    res = await db_get_student_assignment(department, academic_year, section, roll_number)
    return res


@app.get("/api/faculty/assignments")
async def list_faculty_assignments(department: str = "cse", current_user: dict = Depends(get_current_teacher_token)):
    assignments = await db_list_department_assignments(department)
    return {"assignments": assignments}


@app.post("/api/faculty/assignments")
async def create_faculty_assignment(payload: AssignModePayload, current_user: dict = Depends(get_current_teacher_token)):
    try:
        record = await db_create_or_update_assignment(
            faculty_email=payload.faculty_email,
            department=payload.department,
            academic_year=payload.academic_year,
            section=payload.section,
            assigned_mode=payload.assigned_mode,
            student_roll=payload.student_roll,
            title=payload.title
        )
        return {"ok": True, "assignment": record}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/api/faculty/assignment/{assignment_id}")
async def delete_faculty_assignment(assignment_id: int, current_user: dict = Depends(get_current_teacher_token)):
    deleted = await db_delete_assignment(assignment_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return {"ok": True, "deleted_id": assignment_id}


# --- Subject & Faculty Question Validation Flow ---
class SubjectValidationRequestPayload(BaseModel):
    department: str
    subject: str
    student_roll: str
    student_name: str
    student_email: Optional[str] = None


class SubjectApprovalPayload(BaseModel):
    department: str
    subject: str
    faculty_email: str





@app.post("/api/academic/request-validation")
async def request_subject_validation(payload: SubjectValidationRequestPayload):
    """Student dispatches request to faculty to validate/approve questions for a subject."""
    res = await db_request_subject_validation(
        department=payload.department,
        subject=payload.subject,
        student_roll=payload.student_roll,
        student_name=payload.student_name,
        student_email=payload.student_email
    )
    return res


@app.get("/api/faculty/validation-tasks")
async def list_faculty_validation_tasks(department: str = "cse", current_user: dict = Depends(get_current_teacher_token)):
    """Faculty views subjects waiting for question verification & approval."""
    tasks = await db_get_faculty_validation_tasks(department)
    return {"tasks": tasks}


@app.post("/api/faculty/approve-subject")
async def approve_subject_questions(payload: SubjectApprovalPayload, current_user: dict = Depends(get_current_teacher_token)):
    """Faculty reviews & approves subject questions; dispatches student notifications."""
    res = await db_approve_subject_questions(
        department=payload.department,
        subject=payload.subject,
        faculty_email=payload.faculty_email
    )
    return res


@app.get("/api/student/notifications")
async def get_student_notifications(roll_number: str):
    """Student polls/fetches notifications regarding approved subject questions."""
    notifications = await db.db_get_student_notifications(roll_number)
    return {"notifications": notifications}


class MarkNotificationsReadPayload(BaseModel):
    student_roll: str
    notification_id: Optional[int] = None


@app.post("/api/student/notifications/mark-read")
async def mark_student_notifications_read(payload: MarkNotificationsReadPayload):
    """Mark one or all notifications as read for a student."""
    count = await db.db_mark_student_notifications_read(
        student_roll=payload.student_roll,
        notification_id=payload.notification_id,
    )
    return {"ok": True, "marked_count": count}


class RecordAttemptPayload(BaseModel):
    student_roll: str
    exam_id: str
    session_id: Optional[str] = None
    subject: Optional[str] = None
    score: float = 0.0
    max_score: float = 0.0
    authenticity_score: float = 100.0
    violations_count: int = 0
    status: str = "completed"


@app.post("/api/student/record-attempt")
async def record_student_attempt(payload: RecordAttemptPayload):
    """Save record that student has completed an exam attempt (enforces single attempt)."""
    res = await db.db_record_exam_attempt(
        student_roll=payload.student_roll,
        exam_id=payload.exam_id,
        session_id=payload.session_id,
        subject=payload.subject,
        score=payload.score,
        max_score=payload.max_score,
        authenticity_score=payload.authenticity_score,
        violations_count=payload.violations_count,
        status=payload.status,
    )
    return res


@app.get("/api/student/active_exam")
async def get_student_active_exam(
    department: str, 
    year: str, 
    section: str, 
    roll_number: Optional[str] = None,
    exam_id: Optional[str] = None
):
    exam = await db.db_get_active_assessment(department, year, section, roll_number, exam_id=exam_id)
    if not exam:
        return {
            "published": False,
            "exam": None,
            "message": "No active exam found for this department/section."
        }
    return {
        "published": True,
        "exam": exam,
        "already_attempted": exam.get("already_attempted", False),
        "attempt": exam.get("attempt")
    }


@app.get("/api/student/available_exams")
async def get_student_available_exams(
    department: str,
    year: str,
    section: str,
    roll_number: Optional[str] = None
):
    """List all published assessments for this student with attempt status."""
    exams = await db.db_list_available_exams_for_student(department, year, section, roll_number)
    return {"exams": exams}


@app.get("/api/students")
async def list_department_students(department: Optional[str] = None, year: Optional[str] = None, current_user: dict = Depends(get_current_teacher_token)):
    """List all registered students for a department from the students table."""
    if not department:
        return {"students": []}
    students = await db.db_list_students_by_dept(department, year)
    # Mask password before returning
    safe = []
    for s in students:
        s.pop("password", None)
        safe.append(s)
    return {"students": safe}


class UpdatePasscodePayload(BaseModel):
    email: str
    current_passcode: str
    new_passcode: str

class FacultyProfileUpdatePayload(BaseModel):
    email: str
    name: str
    phone: str
    designation: str

@app.post("/api/faculty/update-passcode")
async def update_faculty_passcode(payload: UpdatePasscodePayload, current_user: dict = Depends(get_current_teacher_token)):
    try:
        await db_update_faculty_passcode(
            email=payload.email,
            current_passcode=payload.current_passcode,
            new_passcode=payload.new_passcode
        )
        return {"ok": True, "message": "Passcode updated successfully."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/faculty/profile")
async def get_faculty_profile(email: str, current_user: dict = Depends(get_current_teacher_token)):
    profile = await db.db_get_faculty_profile(email)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return {"profile": profile}

@app.put("/api/faculty/profile")
async def update_faculty_profile(payload: FacultyProfileUpdatePayload, current_user: dict = Depends(get_current_teacher_token)):
    try:
        await db.db_update_faculty_profile(
            email=payload.email,
            name=payload.name,
            phone=payload.phone,
            designation=payload.designation
        )
        return {"ok": True, "message": "Profile updated successfully."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
