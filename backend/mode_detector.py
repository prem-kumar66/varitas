"""
Pure function for detecting assessment mode.
Used by Teacher AI and verified by pytest.
"""
from typing import Literal

AssessmentMode = Literal["oral", "written", "quiz"]

def detect_mode(text: str, current_mode: str = "oral") -> AssessmentMode:
    """
    Detects assessment mode from text prompt.
    Uses current_mode as the default/source of truth.
    Only overrides if the prompt clearly mentions a specific format.
    """
    lower = (text or "").lower()

    if any(k in lower for k in ["mcq", "multiple choice", "quiz"]):
        return "quiz"
    if any(k in lower for k in ["written", "reference answer"]):
        return "written"
    if any(k in lower for k in ["viva", "oral"]):
        return "oral"

    if current_mode in ("quiz", "written", "oral"):
        return current_mode  # type: ignore
    return "oral"
