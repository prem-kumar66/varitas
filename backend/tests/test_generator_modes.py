"""
Tests for Teacher AI question generator formats, mode detection, and fallback handling.
"""
import sys
import os
from unittest.mock import MagicMock

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from generator import AssessmentGenerator
from mode_detector import detect_mode

DUMMY_CHUNKS = [
    {
        "text": (
            "Apache Pig is a high-level data-flow platform for executing MapReduce programs on Hadoop clusters. "
            "Pig Latin is the procedural language provided by Apache Pig for data analysis. "
            "The compiler translates Pig Latin programs into executable sequences of MapReduce jobs."
        ),
        "source": "ApachePig_Overview.pdf",
        "similarity_score": 0.95,
    }
]


def test_detect_mode_source_of_truth_and_overrides():
    """Type dropdown is the default source of truth, overridden only by explicit prompt keywords."""
    # Default to dropdown mode
    assert detect_mode("Explain the main concepts of Chapter 1", "oral") == "oral"
    assert detect_mode("Explain the main concepts of Chapter 1", "written") == "written"
    assert detect_mode("Explain the main concepts of Chapter 1", "quiz") == "quiz"

    # Override: MCQ / Quiz
    assert detect_mode("Generate 5 MCQ questions from this unit", "oral") == "quiz"
    assert detect_mode("Create a multiple choice quiz for tomorrow", "written") == "quiz"
    assert detect_mode("Make a quiz on big data", "oral") == "quiz"

    # Override: Written
    assert detect_mode("Generate 3 written questions with reference answer", "oral") == "written"
    assert detect_mode("Give me a written assessment", "quiz") == "written"

    # Override: Oral / Viva
    assert detect_mode("Generate viva questions for lab exam", "quiz") == "oral"
    assert detect_mode("5 oral questions for the interview", "written") == "oral"


def test_oral_mode_with_mocked_llm():
    """Oral/Viva mode returns reference_answer, no options, and generation_method='llm'."""
    generator = AssessmentGenerator(api_key="mock_key")
    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.choices = [
        MagicMock(
            message=MagicMock(
                content='''[
                    {
                        "question": "Can you explain how Apache Pig executes programs on Hadoop?",
                        "reference_answer": "Apache Pig translates Pig Latin scripts into MapReduce jobs. These jobs are then executed across Hadoop worker nodes.",
                        "source": "ApachePig_Overview.pdf"
                    }
                ]'''
            )
        )
    ]
    mock_client.chat.completions.create.return_value = mock_resp
    generator.client = mock_client

    result = generator.generate(
        prompt="Ask oral questions",
        mode="oral",
        num_questions=1,
        difficulty="medium",
        context_chunks=DUMMY_CHUNKS,
    )

    assert result["generation_method"] == "llm"
    assert len(result["questions"]) == 1
    q = result["questions"][0]
    assert "question" in q
    assert "reference_answer" in q
    assert "options" not in q


def test_written_mode_with_mocked_llm():
    """Written mode returns full paragraph reference_answer, 4-6 rubric_keywords, and no options."""
    generator = AssessmentGenerator(api_key="mock_key")
    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.choices = [
        MagicMock(
            message=MagicMock(
                content='''[
                    {
                        "question": "Explain the architecture of Apache Pig in detail.",
                        "reference_answer": "Apache Pig is a high-level platform for creating MapReduce programs. It consists of the Pig Latin compiler and the execution environment. The compiler parses and optimizes scripts into directed acyclic graphs of MapReduce tasks that run in parallel on Hadoop clusters.",
                        "rubric_keywords": ["Pig Latin", "compiler", "MapReduce", "Hadoop"],
                        "source": "ApachePig_Overview.pdf"
                    }
                ]'''
            )
        )
    ]
    mock_client.chat.completions.create.return_value = mock_resp
    generator.client = mock_client

    result = generator.generate(
        prompt="Generate written test",
        mode="written",
        num_questions=1,
        difficulty="medium",
        context_chunks=DUMMY_CHUNKS,
    )

    assert result["generation_method"] == "llm"
    assert len(result["questions"]) == 1
    q = result["questions"][0]
    assert "question" in q
    assert "reference_answer" in q
    assert "rubric_keywords" in q
    assert 4 <= len(q["rubric_keywords"]) <= 6
    assert "options" not in q


def test_quiz_mode_with_mocked_llm():
    """Quiz/MCQ mode returns exactly 4 options (A-D), one valid correct_answer, and explanation."""
    generator = AssessmentGenerator(api_key="mock_key")
    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.choices = [
        MagicMock(
            message=MagicMock(
                content='''[
                    {
                        "question": "What is the procedural language provided by Apache Pig?",
                        "options": {
                            "A": "Java Bytecode",
                            "B": "Pig Latin",
                            "C": "MapReduce DSL",
                            "D": "SQL Query"
                        },
                        "correct_answer": "B",
                        "explanation": "Pig Latin is the procedural dataflow language designed for Apache Pig.",
                        "source": "ApachePig_Overview.pdf"
                    }
                ]'''
            )
        )
    ]
    mock_client.chat.completions.create.return_value = mock_resp
    generator.client = mock_client

    result = generator.generate(
        prompt="Generate 1 MCQ",
        mode="quiz",
        num_questions=1,
        difficulty="medium",
        context_chunks=DUMMY_CHUNKS,
    )

    assert result["generation_method"] == "llm"
    assert len(result["questions"]) == 1
    q = result["questions"][0]
    assert "question" in q
    assert isinstance(q.get("options"), dict)
    assert set(q["options"].keys()) == {"A", "B", "C", "D"}
    assert q["correct_answer"] in ["A", "B", "C", "D"]
    assert "explanation" in q


def test_fallback_path_when_llm_raises():
    """When the Groq client raises an exception, generate falls back with generation_method='fallback' and a warning."""
    generator = AssessmentGenerator(api_key="mock_key")
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = RuntimeError("Rate limit exceeded on Groq")
    generator.client = mock_client

    result = generator.generate(
        prompt="Generate questions",
        mode="oral",
        num_questions=1,
        difficulty="medium",
        context_chunks=DUMMY_CHUNKS,
    )

    assert result["generation_method"] == "fallback"
    assert result["warning"] is not None
    assert "Rate limit exceeded" in result["warning"]
    assert len(result["questions"]) > 0


def test_fallback_mcq_answer_randomized_and_valid():
    """Fallback MCQ options must be shuffled, letters must be A-D, and correct_answer must not be stuck on A."""
    generator = AssessmentGenerator(api_key="mock_key")
    # No client -> forced fallback
    generator.client = None

    answers_seen = set()
    sentence = "Apache Pig is a high-level data-flow platform for executing MapReduce programs on Hadoop."
    context = (
        "Apache Pig is a high-level data-flow platform for executing MapReduce programs on Hadoop. "
        "The system processes distributed files using compiler optimization techniques and cluster nodes."
    )

    for _ in range(30):
        mcq = generator._make_mcq_from_sentence(sentence, context)
        assert mcq is not None
        assert "question" in mcq
        assert "options" in mcq
        assert set(mcq["options"].keys()) == {"A", "B", "C", "D"}
        assert mcq["correct_answer"] in ["A", "B", "C", "D"]
        correct_letter = mcq["correct_answer"]
        correct_text = mcq["options"][correct_letter]
        assert "high-level data-flow platform" in correct_text
        answers_seen.add(correct_letter)

    # In 30 random shuffles of 4 items, the correct answer must not be stuck only on "A"
    assert len(answers_seen) > 1, f"Expected varied correct answer letters, but saw only: {answers_seen}"
