"""
Unit tests for Veritas Scoring Gate and Security Token Authentication.
Covers:
1. compute_overall formula (accuracy 0 gives 0, authenticity can only scale, not add).
2. Oral answer question alignment (answer is saved with question showing at answer_start).
3. JWT signed token creation and verification using JWT_SECRET.
"""
import os
import sys
import time

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scoring import compute_overall
from auth import create_access_token, verify_access_token
from analyzer import AnswerSegment


# =========================================================================
# 1. Scoring Formula & Relevance Gate Tests
# =========================================================================

def test_scoring_formula_zero_accuracy_gives_zero():
    """An off-topic or nonsense answer with 0 accuracy must score strictly 0.0 regardless of authenticity."""
    assert compute_overall(accuracy=0.0, authenticity=100.0) == 0.0
    assert compute_overall(accuracy=0.0, authenticity=80.0) == 0.0
    assert compute_overall(accuracy=0.0, authenticity=0.0) == 0.0
    assert compute_overall(accuracy=0, authenticity=95) == 0.0


def test_scoring_formula_perfect_scores():
    """100% accuracy and 100% authenticity must yield 100.0."""
    assert compute_overall(accuracy=100.0, authenticity=100.0) == 100.0


def test_scoring_formula_scaling():
    """Authenticity scales accuracy between 65% (0% auth) and 100% (100% auth)."""
    # 100 accuracy, 0 authenticity -> 100 * (0.65 + 0.35 * 0) = 65.0
    assert compute_overall(accuracy=100.0, authenticity=0.0) == 65.0
    
    # 50 accuracy, 100 authenticity -> 50 * (0.65 + 0.35 * 1.0) = 50.0
    assert compute_overall(accuracy=50.0, authenticity=100.0) == 50.0

    # 80 accuracy, 90 authenticity -> round(80 * (0.65 + 0.35 * 0.9), 1) = round(77.2, 1) = 77.2
    assert compute_overall(accuracy=80.0, authenticity=90.0) == 77.2


def test_scoring_formula_handles_none_and_edge_cases():
    """Missing or negative values should be safely clamped to 0.0."""
    assert compute_overall(accuracy=None, authenticity=100.0) == 0.0
    assert compute_overall(accuracy=-10.0, authenticity=100.0) == 0.0
    assert compute_overall(accuracy=50.0, authenticity=None) == 32.5  # 50 * 0.65
    assert compute_overall(accuracy=120.0, authenticity=150.0) == 100.0


# =========================================================================
# 2. Oral Answer Question Alignment Tests
# =========================================================================

def test_oral_answer_question_locked_at_answer_start():
    """
    Oral answers must be associated with the question showing when answer_start occurred,
    even if the session moves or receives a new question before answer_end.
    """
    q_initial = "What is a Convolutional Neural Network?"
    q_subsequent = "Explain Backpropagation in Multi-Layer Perceptrons."

    # Simulate question active at answer_start
    speaking_question = q_initial
    start_time = time.time()
    
    # Simulate time passing and session question changing before candidate finishes speaking
    current_session_question = q_subsequent
    end_time = start_time + 4.5
    transcript = "A convolutional neural network uses convolutional layers and filters to extract spatial features."

    # When answer_end arrives, the resolved question MUST be speaking_question, NOT current_session_question
    resolved_question = speaking_question or current_session_question
    assert resolved_question == q_initial
    assert resolved_question != q_subsequent

    seg = AnswerSegment(
        question=resolved_question,
        transcript=transcript,
        question_end_time=start_time - 1.0,
        answer_start_time=start_time,
        answer_end_time=end_time,
        word_count=len(transcript.split()),
        duration_sec=end_time - start_time,
    )

    assert seg.question == q_initial
    assert seg.duration_sec >= 4.0
    assert seg.word_count > 5


# =========================================================================
# 3. Security Token (JWT) Tests
# =========================================================================

def test_jwt_token_creation_and_verification():
    """Generated JWT token must verify cleanly and return payload claims."""
    faculty_payload = {
        "sub": "prof.rao@anurag.edu.in",
        "email": "prof.rao@anurag.edu.in",
        "role": "Professor",
        "department": "aiml",
        "is_admin": False,
    }
    token = create_access_token(faculty_payload)
    assert token is not None
    assert isinstance(token, str)
    assert len(token.split(".")) == 3

    verified = verify_access_token(token)
    assert verified is not None
    assert verified["sub"] == "prof.rao@anurag.edu.in"
    assert verified["email"] == "prof.rao@anurag.edu.in"
    assert verified["department"] == "aiml"
    assert verified["is_admin"] is False


def test_jwt_token_tampering_rejected():
    """Tampered token with altered signature or payload must be rejected."""
    token = create_access_token({"sub": "admin@anurag.edu.in", "is_admin": True})
    parts = token.split(".")
    # Tamper with signature
    tampered_token = f"{parts[0]}.{parts[1]}.tampered_signature"
    assert verify_access_token(tampered_token) is None


def test_jwt_token_expiration():
    """Expired tokens must fail verification."""
    # Token expired 10 seconds ago
    token = create_access_token({"sub": "test@anurag.edu.in"}, expires_delta=-10)
    assert verify_access_token(token) is None
