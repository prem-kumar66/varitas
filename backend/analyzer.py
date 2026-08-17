"""
Veritas Cognitive Analyzer (v2)
================================
Behavioral risk signals for interview authenticity. Now with:
  - Per-session calibration baselines (fairness fix)
  - Word-level evidence tracking (explainability)
  - Real GPT-2 perplexity for fluency signal
  - Multi-language framework (English fully supported; stubs for others)

POSITIONING: This is RISK ESTIMATION. Each signal is weak alone.
"""
import re
import time
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from collections import deque

from perplexity import perplexity, perplexity_to_signal


# ---------- Language-specific lexicons ----------
FILLER_WORDS_EN = {
    "um", "uh", "uhh", "umm", "er", "err", "ah", "ahh",
    "like", "you know", "i mean", "sort of", "kind of",
    "basically", "actually", "literally", "right", "so",
}

LLM_TELL_PHRASES_EN = [
    "it's important to note", "it is worth noting", "in conclusion",
    "to summarize", "firstly", "secondly", "thirdly",
    "moreover", "furthermore", "additionally", "in essence", "essentially",
    "leveraging", "leverage", "utilize", "utilized", "facilitate",
    "robust", "seamless", "comprehensive", "holistic approach",
    "best practices", "key takeaway", "navigate the complexities",
    "ever-evolving", "cutting-edge", "delve into", "tapestry",
]

SELF_CORRECTION_PATTERNS = [
    r"\b(i mean|or rather|wait|no |let me rephrase|sorry)\b",
    r"\b(\w+)\s+\1\b",  # word repetition: "the the"
]


@dataclass
class Evidence:
    """A piece of word-level evidence behind a signal score."""
    span: str          # the matched text
    reason: str        # human-readable explanation
    weight: float      # contribution to the signal (0-100)


@dataclass
class AnswerSegment:
    question: str
    transcript: str
    question_end_time: float
    answer_start_time: float
    answer_end_time: float
    word_count: int = 0
    duration_sec: float = 0.0


@dataclass
class SignalScores:
    delay: float = 0.0
    fluency: float = 0.0
    hesitation: float = 0.0
    polish: float = 0.0
    pacing: float = 0.0
    consistency: float = 0.0
    explanations: Dict[str, str] = field(default_factory=dict)
    evidence: Dict[str, List[Evidence]] = field(default_factory=dict)
    perplexity_value: Optional[float] = None


@dataclass
class Baseline:
    """Per-candidate baseline from calibration round."""
    calibrated: bool = False
    avg_delay: float = 1.5
    avg_wpm: float = 145.0
    filler_rate: float = 0.02      # fillers per word
    avg_perplexity: float = 100.0
    samples: int = 0


class CognitiveAnalyzer:
    WEIGHTS = {
        "delay": 0.20,
        "fluency": 0.25,    # boosted because we now have real perplexity
        "hesitation": 0.15,
        "polish": 0.20,
        "pacing": 0.10,
        "consistency": 0.10,
    }

    def __init__(self, baseline: Optional[Baseline] = None, language: str = "en"):
        self.history: List[AnswerSegment] = []
        self.word_rate_history = deque(maxlen=10)
        self.baseline = baseline or Baseline()
        self.language = language
        self.fillers = FILLER_WORDS_EN
        self.llm_phrases = LLM_TELL_PHRASES_EN

    # =========================================================================
    # Calibration — establish per-candidate baseline from a warm-up answer
    # =========================================================================
    def calibrate(self, seg: AnswerSegment) -> Baseline:
        """
        Run on the introductory question's answer. Sets the candidate's natural
        baseline. Subsequent scoring is *relative* to this — fixes fairness issues
        with non-native speakers, introverts, etc.
        """
        words = seg.transcript.lower().split()
        if len(words) < 10:
            return self.baseline  # too short to calibrate

        delay = max(0.0, seg.answer_start_time - seg.question_end_time)
        wpm = (seg.word_count / max(0.1, seg.duration_sec)) * 60
        filler_count = sum(1 for w in words if w.strip(".,!?") in self.fillers)
        filler_rate = filler_count / max(1, len(words))
        ppl = perplexity(seg.transcript) or 100.0

        self.baseline = Baseline(
            calibrated=True,
            avg_delay=delay,
            avg_wpm=wpm,
            filler_rate=filler_rate,
            avg_perplexity=ppl,
            samples=1,
        )
        return self.baseline

    # =========================================================================
    # Signal 1: Response Delay (calibrated)
    # =========================================================================
    def score_delay(self, seg: AnswerSegment) -> Tuple[float, str, List[Evidence]]:
        delay = max(0.0, seg.answer_start_time - seg.question_end_time)
        evidence: List[Evidence] = []

        if self.baseline.calibrated:
            # Score relative to candidate's own baseline
            excess = delay - self.baseline.avg_delay
            if excess < 1.0:
                return 0.0, f"In line with baseline delay ({delay:.1f}s vs {self.baseline.avg_delay:.1f}s baseline)", []
            if excess < 2.5:
                ev = [Evidence(f"{delay:.1f}s", f"{excess:.1f}s longer than usual", 30.0)]
                return 30.0, f"Slightly longer pause than baseline ({delay:.1f}s)", ev
            if excess < 5.0:
                ev = [Evidence(f"{delay:.1f}s", f"{excess:.1f}s longer than baseline — possible external lookup", 65.0)]
                return 65.0, f"Unusual delay vs. baseline ({delay:.1f}s vs {self.baseline.avg_delay:.1f}s)", ev
            ev = [Evidence(f"{delay:.1f}s", f"{excess:.1f}s above baseline — strong outlier", 90.0)]
            return 90.0, f"Major delay anomaly ({delay:.1f}s)", ev

        # Uncalibrated absolute scoring (fallback)
        if delay < 1.5:
            return 0.0, f"Natural response time ({delay:.1f}s)", []
        if delay < 3.0:
            return 20.0, f"Brief thinking pause ({delay:.1f}s)", [Evidence(f"{delay:.1f}s", "Brief pause", 20.0)]
        if delay < 5.0:
            return 50.0, f"Extended pause before answering ({delay:.1f}s)", [Evidence(f"{delay:.1f}s", "Extended pause", 50.0)]
        if delay < 8.0:
            return 75.0, f"Long unexplained delay ({delay:.1f}s)", [Evidence(f"{delay:.1f}s", "Long delay", 75.0)]
        return 90.0, f"Very long delay — possible external lookup ({delay:.1f}s)", [Evidence(f"{delay:.1f}s", "Very long delay", 90.0)]

    # =========================================================================
    # Signal 2: Fluency — REAL perplexity (GPT-2) with sentence-stats fallback
    # =========================================================================
    def score_fluency(self, seg: AnswerSegment) -> Tuple[float, str, List[Evidence], Optional[float]]:
        text = seg.transcript.strip()
        if not text or len(text.split()) < 5:
            return 0.0, "Response too short for fluency analysis", [], None

        ppl = perplexity(text)
        if ppl is not None:
            score, explanation = perplexity_to_signal(ppl)
            evidence = []
            if score >= 50:
                evidence.append(Evidence(f"PPL={ppl:.0f}", explanation, score))

            # Calibration adjustment: if baseline established, compare relative
            if self.baseline.calibrated and self.baseline.avg_perplexity > 0:
                ratio = ppl / self.baseline.avg_perplexity
                if ratio < 0.5:
                    score = min(100.0, score + 15.0)
                    explanation += f" — half the candidate's baseline perplexity ({self.baseline.avg_perplexity:.0f})"
                    evidence.append(Evidence(f"ratio={ratio:.2f}", "Much lower than personal baseline", 15.0))
            return score, explanation, evidence, ppl

        # Fallback: sentence-length statistics
        sentences = [s for s in re.split(r'[.!?]+', text) if s.strip()]
        if not sentences:
            return 0.0, "No complete sentences", [], None
        avg_len = sum(len(s.split()) for s in sentences) / len(sentences)
        sent_lens = [len(s.split()) for s in sentences]
        variance = sum((l - avg_len) ** 2 for l in sent_lens) / max(1, len(sent_lens))
        if avg_len > 18 and variance < 10 and len(sentences) >= 3:
            return 65.0, f"Uniformly long sentences (avg {avg_len:.0f} words, heuristic only)", \
                   [Evidence(f"avg={avg_len:.0f}w, var={variance:.1f}", "Low sentence-length variance", 65.0)], None
        if avg_len > 22:
            return 50.0, f"Unusually structured sentence length ({avg_len:.0f})", [], None
        return 20.0, f"Natural sentence rhythm ({avg_len:.0f})", [], None

    # =========================================================================
    # Signal 3: Hesitation absence (calibrated)
    # =========================================================================
    def score_hesitation(self, seg: AnswerSegment) -> Tuple[float, str, List[Evidence]]:
        text = seg.transcript.lower()
        words = text.split()
        if len(words) < 20:
            return 0.0, "Response too short to assess hesitation", []

        filler_hits = [w for w in words if w.strip(".,!?") in self.fillers]
        correction_hits = []
        for pattern in SELF_CORRECTION_PATTERNS:
            correction_hits.extend(re.findall(pattern, text))

        rate = (len(filler_hits) + len(correction_hits)) / len(words)

        # Calibration adjustment: judge relative to candidate's own filler rate
        if self.baseline.calibrated:
            if rate < self.baseline.filler_rate * 0.3:  # 70% drop from baseline
                ev = [Evidence(f"rate={rate:.3f}", f"Much lower than baseline {self.baseline.filler_rate:.3f}", 75.0)]
                return 75.0, f"Disfluencies dropped sharply vs. baseline (filler rate {rate:.2%} vs {self.baseline.filler_rate:.2%})", ev
            if rate < self.baseline.filler_rate * 0.6:
                ev = [Evidence(f"rate={rate:.3f}", "Below baseline", 45.0)]
                return 45.0, f"Below-baseline hesitation rate", ev
            return 5.0, f"Hesitation in normal range for this candidate", []

        # Uncalibrated absolute scoring
        if rate == 0 and len(words) > 50:
            return 75.0, f"Zero hesitation markers in {len(words)} words — unusually smooth", []
        if rate < 0.01:
            return 55.0, f"Very few disfluencies ({len(filler_hits)} fillers in {len(words)} words)", []
        if rate < 0.03:
            return 25.0, "Below-average disfluency rate", []
        return 5.0, f"Natural hesitation patterns ({len(filler_hits)} fillers)", []

    # =========================================================================
    # Signal 4: LLM-tell phrasing (with span evidence)
    # =========================================================================
    def score_polish(self, seg: AnswerSegment) -> Tuple[float, str, List[Evidence]]:
        text = seg.transcript.lower()
        if len(text.split()) < 15:
            return 0.0, "Response too short to assess phrasing", []

        hits = []
        for phrase in self.llm_phrases:
            if phrase in text:
                hits.append(phrase)

        evidence = [Evidence(h, "LLM-typical phrase", 20.0) for h in hits]

        if len(hits) >= 4:
            return 80.0, f"Multiple textbook phrases: {', '.join(hits[:3])}…", evidence
        if len(hits) >= 2:
            return 55.0, f"Polished phrasing detected: {', '.join(hits)}", evidence
        if len(hits) == 1:
            return 25.0, f"One formal phrase: '{hits[0]}'", evidence
        return 5.0, "No notable AI-tell phrases", []

    # =========================================================================
    # Signal 5: Pacing uniformity (calibrated)
    # =========================================================================
    def score_pacing(self, seg: AnswerSegment) -> Tuple[float, str, List[Evidence]]:
        if seg.duration_sec < 5:
            return 0.0, "Too short to assess pacing", []

        wpm = (seg.word_count / seg.duration_sec) * 60
        self.word_rate_history.append(wpm)

        if self.baseline.calibrated:
            deviation = abs(wpm - self.baseline.avg_wpm)
            if deviation < 10:
                return 5.0, f"Pacing matches baseline ({wpm:.0f} wpm)", []
            if deviation > 40:
                ev = [Evidence(f"{wpm:.0f} wpm", f"Deviates {deviation:.0f} from baseline", 60.0)]
                return 60.0, f"Pacing diverges from baseline ({wpm:.0f} vs {self.baseline.avg_wpm:.0f})", ev
            return 20.0, f"Slight pacing variation ({wpm:.0f} wpm)", []

        if len(self.word_rate_history) >= 3:
            rates = list(self.word_rate_history)
            avg = sum(rates) / len(rates)
            var = sum((r - avg) ** 2 for r in rates) / len(rates)
            if var < 50 and 130 < avg < 170:
                return 60.0, f"Robotic pacing — uniform {avg:.0f} wpm across answers", \
                       [Evidence(f"variance={var:.0f}", "Very low cross-answer variance", 60.0)]
        if 145 < wpm < 165:
            return 30.0, f"Mechanical pacing ({wpm:.0f} wpm)", []
        return 10.0, f"Natural pacing ({wpm:.0f} wpm)", []

    # =========================================================================
    # Signal 6: Cross-answer consistency
    # =========================================================================
    def score_consistency(self, seg: AnswerSegment) -> Tuple[float, str, List[Evidence]]:
        if len(self.history) < 2:
            return 0.0, "Not enough prior answers to compare", []

        recent = " ".join(s.transcript.lower() for s in self.history[-3:])
        current = seg.transcript.lower()
        current_keywords = set(w for w in current.split() if len(w) > 5)
        prior_keywords = set(w for w in recent.split() if len(w) > 5)
        overlap = current_keywords & prior_keywords

        # Look for direct contradictions
        contradiction_pairs = [
            ("always", "never"), ("never", "always"),
            ("yes", "no"), ("no", "yes"),
            ("did", "didn't"), ("didn't", "did"),
            ("would", "wouldn't"),
        ]
        evidence = []
        for a, b in contradiction_pairs:
            if a in current and b in recent and len(overlap) > 3:
                evidence.append(Evidence(f"'{a}' vs '{b}'", "Contradictory framing across answers", 40.0))

        if evidence:
            return 50.0, "Possible contradiction with earlier answer", evidence
        return 5.0, "No detected inconsistency", []

    # =========================================================================
    # Written Mode Anti-Cheat: Cadence & Paste Detection
    # =========================================================================
    def score_written_cadence(
        self, seg: AnswerSegment, copy_paste_attempts: int = 0
    ) -> Tuple[float, str, List[Evidence]]:
        evidence: List[Evidence] = []
        score = 0.0

        if copy_paste_attempts > 0:
            score += min(90.0, copy_paste_attempts * 45.0)
            evidence.append(
                Evidence(
                    f"{copy_paste_attempts} paste event(s)",
                    "Attempted to paste text directly into answer area",
                    score,
                )
            )

        if seg.duration_sec > 0:
            typing_wpm = (seg.word_count / max(1.0, seg.duration_sec)) * 60
            if typing_wpm > 180 and seg.word_count > 30:
                evidence.append(
                    Evidence(
                        f"{typing_wpm:.0f} WPM",
                        "Unusually fast typing speed (possible automated paste / script insertion)",
                        75.0,
                    )
                )
                score = max(score, 75.0)

        if score > 0:
            return min(100.0, score), f"Written mode security flag triggered ({copy_paste_attempts} paste attempts)", evidence
        return 0.0, "Clean keystroke cadence without paste events", []

    # =========================================================================
    # Composite
    # =========================================================================
    def analyze(self, seg: AnswerSegment, copy_paste_attempts: int = 0, is_written: bool = False) -> Tuple[SignalScores, float]:
        scores = SignalScores()

        if is_written:
            cadence_score, cadence_exp, cadence_ev = self.score_written_cadence(seg, copy_paste_attempts)
            scores.pacing = cadence_score
            scores.explanations["pacing"] = cadence_exp
            scores.evidence["pacing"] = cadence_ev

            scores.delay = 0.0
            scores.explanations["delay"] = "N/A for written mode"
            scores.evidence["delay"] = []
            scores.hesitation = 0.0
            scores.explanations["hesitation"] = "N/A for written mode"
            scores.evidence["hesitation"] = []
        else:
            scores.delay, scores.explanations["delay"], scores.evidence["delay"] = self.score_delay(seg)
            scores.hesitation, scores.explanations["hesitation"], scores.evidence["hesitation"] = self.score_hesitation(seg)
            scores.pacing, scores.explanations["pacing"], scores.evidence["pacing"] = self.score_pacing(seg)

        scores.fluency, scores.explanations["fluency"], scores.evidence["fluency"], ppl = self.score_fluency(seg)
        scores.perplexity_value = ppl
        scores.polish, scores.explanations["polish"], scores.evidence["polish"] = self.score_polish(seg)
        scores.consistency, scores.explanations["consistency"], scores.evidence["consistency"] = self.score_consistency(seg)

        if is_written:
            risk = (
                scores.pacing * 0.40  # Cadence & Copy-Paste weight
                + scores.fluency * 0.35  # AI Perplexity weight
                + scores.polish * 0.25  # LLM phrase tell weight
            )
        else:
            risk = (
                scores.delay * self.WEIGHTS["delay"]
                + scores.fluency * self.WEIGHTS["fluency"]
                + scores.hesitation * self.WEIGHTS["hesitation"]
                + scores.polish * self.WEIGHTS["polish"]
                + scores.pacing * self.WEIGHTS["pacing"]
                + scores.consistency * self.WEIGHTS["consistency"]
            )

        self.history.append(seg)
        return scores, min(100.0, risk)

    def authenticity_score(self, risk: float) -> float:
        return max(0.0, 100.0 - risk)

