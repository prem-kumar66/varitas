"""
Veritas Scoring Gate
====================
Provides the single authoritative composite score formula for Veritas:
    overall = accuracy * (0.65 + 0.35 * authenticity / 100)

If accuracy is 0 (or answer is irrelevant/non-meaningful), overall score is strictly 0.0.
Authenticity can only scale an accurate answer, never award points to an irrelevant one.
"""


def compute_overall(accuracy: float, authenticity: float) -> float:
    """
    Compute composite overall score using the gated relevance formula:
        overall = accuracy * (0.65 + 0.35 * authenticity / 100)

    If accuracy is 0, overall is 0 regardless of authenticity.
    If accuracy is 100 and authenticity is 100, overall is 100.
    """
    try:
        acc = float(accuracy or 0.0)
    except (ValueError, TypeError):
        acc = 0.0

    try:
        auth = float(authenticity or 0.0)
    except (ValueError, TypeError):
        auth = 0.0

    acc = max(0.0, min(100.0, acc))
    auth = max(0.0, min(100.0, auth))

    if acc <= 0.0:
        return 0.0

    return round(acc * (0.65 + 0.35 * (auth / 100.0)), 1)

