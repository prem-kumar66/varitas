"""
Unit tests for Veritas answer validation and scoring.
Tests validate_answer_heuristic and is_non_answer directly without network, Groq, or RAG.
"""
import pytest
import sys
import os

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from validator import is_non_answer, validate_answer_heuristic
from analyzer import CognitiveAnalyzer, AnswerSegment
import perplexity

# Disable GPT-2 network download during unit tests
perplexity._disabled = True


QUESTION = "Explain the architecture of Apache Pig and how it executes data flow programs on Hadoop clusters."
REFERENCE = (
    "Apache Pig consists of Pig Latin language and an execution environment. "
    "The Pig Latin compiler translates high-level data flow scripts into directed acyclic "
    "graphs of MapReduce jobs that run across Hadoop distributed clusters."
)
RUBRIC = ["Pig Latin", "compiler", "MapReduce", "Hadoop", "data flow"]


@pytest.mark.parametrize("nonsense", [
    "notknerkwne",
    "rtttert",
    "sfwfqweqw",
    "",
])
def test_is_non_answer_detects_nonsense(nonsense):
    """Nonsense words and empty strings must be flagged as non-answers."""
    assert is_non_answer(nonsense, QUESTION) is True


@pytest.mark.parametrize("nonsense", [
    "notknerkwne",
    "rtttert",
    "sfwfqweqw",
    "",
])
def test_validate_answer_heuristic_nonsense_scores_zero(nonsense):
    """Nonsense answers must receive exactly 0.0 accuracy score with no free points."""
    result = validate_answer_heuristic(
        question=QUESTION,
        candidate_answer=nonsense,
        reference_answer=REFERENCE,
        rubric_keywords=RUBRIC,
    )
    assert result["accuracy_score"] == 0.0
    assert result["key_points_covered"] == []
    assert result["missing_points"] == ["Answer is too short or does not address the question."]
    assert result["conceptual_feedback"] == "No meaningful answer was given."


def test_correct_on_topic_answer():
    """A correct, on-topic answer with 8+ words sharing question vocabulary scores > 0."""
    valid_answer = (
        "Apache Pig provides Pig Latin to write high level data flow programs that "
        "the compiler converts into MapReduce jobs executed on Hadoop."
    )
    assert is_non_answer(valid_answer, QUESTION) is False

    result = validate_answer_heuristic(
        question=QUESTION,
        candidate_answer=valid_answer,
        reference_answer=REFERENCE,
        rubric_keywords=RUBRIC,
    )
    assert result["accuracy_score"] > 60.0
    assert len(result["key_points_covered"]) > 0
    assert "No meaningful answer was given." not in result["conceptual_feedback"]


def test_no_rubric_overlap_only():
    """When no rubric is provided, score comes solely from reference overlap with no default award."""
    candidate_answer = (
        "Apache Pig execution environment compiles data flow programs into MapReduce jobs on Hadoop."
    )
    assert is_non_answer(candidate_answer, QUESTION) is False

    # Score with empty rubric
    result = validate_answer_heuristic(
        question=QUESTION,
        candidate_answer=candidate_answer,
        reference_answer=REFERENCE,
        rubric_keywords=[],
    )
    # Score should be strictly proportional to word overlap, not a hardcoded default (like 50, 75, or 85)
    assert 0.0 < result["accuracy_score"] <= 100.0

    # If the answer shares question vocabulary (>= 8 words) but has ZERO reference overlap:
    unrelated_answer = "Explain the architecture of Apache Pig and how it executes completely different things elsewhere."
    assert is_non_answer(unrelated_answer, QUESTION) is False
    zero_overlap_result = validate_answer_heuristic(
        question=QUESTION,
        candidate_answer=unrelated_answer,
        reference_answer="Unrelated reference content about something else entirely.",
        rubric_keywords=[],
    )
    # With 0 overlap and no rubric, score must be 0.0 (no default awarded)
    assert zero_overlap_result["accuracy_score"] == 0.0


def test_written_mode_authenticity_penalizes_nonsense():
    """Written mode authenticity must not award 100/100 to nonsense answers."""
    analyzer = CognitiveAnalyzer()
    seg = AnswerSegment(
        question=QUESTION,
        transcript="notknerkwne",
        question_end_time=0.0,
        answer_start_time=1.0,
        answer_end_time=3.0,
        word_count=1,
        duration_sec=2.0,
    )
    scores, risk = analyzer.analyze(seg, copy_paste_attempts=0, is_written=True)
    authenticity = analyzer.authenticity_score(risk)

    # Risk must be at least 50.0 and authenticity must be capped at 50.0
    assert risk >= 50.0
    assert authenticity <= 50.0


def test_oral_mode_authenticity_unaffected():
    """Oral mode must maintain its own behavioral signals without written non-answer penalty."""
    analyzer = CognitiveAnalyzer()
    seg = AnswerSegment(
        question="Tell me about yourself.",
        transcript="Hello I am a student studying computer science.",
        question_end_time=0.0,
        answer_start_time=1.0,
        answer_end_time=4.0,
        word_count=8,
        duration_sec=3.0,
    )
    # Oral mode: is_written=False (default)
    scores, risk = analyzer.analyze(seg, is_written=False)
    # Should not trigger written mode non-answer penalty
    assert "Flagged: non-meaningful answer" not in scores.explanations.get("pacing", "")
