"""
Veritas Academic — Semantic Answer Key Validator
=================================================
Validates candidate/student answers (oral or written) against standard model answers
and evaluation rubrics provided by evaluators/professors.

Evaluates:
  - Conceptual Accuracy Score (0-100%)
  - Covered Rubric Key Points vs. Missing Key Points
  - Detailed Conceptual Feedback
"""
import os
import json
import re
from typing import List, Dict, Optional
from dotenv import load_dotenv
from config import GROQ_MODEL

load_dotenv()

MIN_ANSWER_WORDS = 8  # tune later if short correct answers are being rejected

def is_non_answer(answer: str, question: str) -> bool:
    """True if the answer is too short or shares no meaningful vocabulary with the question."""
    words = re.findall(r"[a-z]+", (answer or "").lower())
    if len(words) < MIN_ANSWER_WORDS:
        return True
    q_words = set(re.findall(r"[a-z]{4,}", (question or "").lower()))
    return not q_words.intersection(words)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
groq_client = None

if GROQ_API_KEY:
    try:
        from groq import Groq
        import httpx
        groq_client = Groq(api_key=GROQ_API_KEY, http_client=httpx.Client())
    except Exception as e:
        print(f"Warning: Could not initialize Groq client for validator: {e}")


def validate_answer_llm(
    question: str,
    candidate_answer: str,
    reference_answer: str,
    rubric_keywords: List[str],
) -> Optional[Dict]:
    """Uses Groq Llama-3 to grade candidate answer against reference answer."""
    if not groq_client or not candidate_answer.strip():
        return None

    rubric_str = ", ".join(rubric_keywords) if rubric_keywords else "N/A"
    
    prompt = f"""You are an expert college recruitment evaluator & academic grader.
Evaluate the following student's response against the standard model/reference answer and rubric criteria.

Question: {question}
Model Reference Answer: {reference_answer}
Rubric Key Concepts: {rubric_str}

Student Answer: {candidate_answer}

Provide your evaluation strictly in valid JSON format with the following keys:
{{
  "accuracy_score": <number between 0 and 100 representing conceptual correctness>,
  "key_points_covered": [<list of key points/concepts correctly addressed by the student>],
  "missing_points": [<list of essential concepts missing or incorrect in student answer>],
  "conceptual_feedback": "<2-3 sentence constructive feedback for the student>"
}}
Return ONLY JSON without markdown formatting.
"""

    try:
        completion = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": "You are a precise academic answer key evaluator. Return JSON only."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=500,
        )
        text = completion.choices[0].message.content.strip()
        text = re.sub(r"^```json\s*", "", text, flags=re.MULTILINE)
        text = re.sub(r"```$", "", text, flags=re.MULTILINE).strip()
        data = json.loads(text)
        return {
            "accuracy_score": float(data.get("accuracy_score", 0.0)),
            "key_points_covered": list(data.get("key_points_covered", [])),
            "missing_points": list(data.get("missing_points", [])),
            "conceptual_feedback": str(data.get("conceptual_feedback", "Answer evaluated against reference answer.")),
        }
    except Exception as e:
        print(f"Validator LLM error: {e}")
        return None


def _validate_open_ended(
    question: str,
    candidate_answer: str,
) -> Optional[Dict]:
    """
    Open-ended LLM grading when no reference answer or rubric is available.
    Uses the LLM's domain knowledge to evaluate conceptual correctness, 
    relevance and completeness relative to the question asked.
    """
    if not groq_client or not candidate_answer.strip():
        return None

    prompt = f"""You are a strict academic evaluator with deep subject matter expertise.
A student was asked the following question and gave the following answer.
You must evaluate how accurately and completely the student answered the question, using your knowledge of the subject.

Question: {question}

Student Answer: {candidate_answer}

Evaluate the student's answer strictly. Consider:
- Does the answer directly address what was asked?
- Is the information factually correct?
- Are key concepts covered or missing?
- Is the answer complete or vague/incomplete?

Give a realistic, honest score. Do NOT give high scores for vague or irrelevant answers.
A one-sentence or off-topic answer should score below 40.
A partially correct answer should score 40-70.
A complete and accurate answer should score 70-100.

Provide your evaluation strictly in valid JSON format:
{{
  "accuracy_score": <number between 0 and 100>,
  "key_points_covered": [<list of concepts correctly addressed>],
  "missing_points": [<list of important concepts missing or incorrect>],
  "conceptual_feedback": "<2-3 sentence honest evaluation of the student's answer>"
}}
Return ONLY JSON without markdown formatting.
"""

    try:
        completion = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": "You are a strict academic evaluator. Be honest and accurate. Return JSON only."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=500,
        )
        text = completion.choices[0].message.content.strip()
        text = re.sub(r"^```json\s*", "", text, flags=re.MULTILINE)
        text = re.sub(r"```$", "", text, flags=re.MULTILINE).strip()
        data = json.loads(text)
        return {
            "accuracy_score": float(data.get("accuracy_score", 0.0)),
            "key_points_covered": list(data.get("key_points_covered", [])),
            "missing_points": list(data.get("missing_points", [])),
            "conceptual_feedback": str(data.get("conceptual_feedback", "Answer evaluated based on question context.")),
        }
    except Exception as e:
        print(f"Open-ended validator LLM error: {e}")
        return None




def validate_answer_heuristic(
    question: str,
    candidate_answer: str,
    reference_answer: str,
    rubric_keywords: List[str],
) -> Dict:
    """Fallback grader used when the LLM is offline. Gives no credit for non-answers."""
    if is_non_answer(candidate_answer, question):
        return {
            "accuracy_score": 0.0,
            "key_points_covered": [],
            "missing_points": ["Answer is too short or does not address the question."],
            "conceptual_feedback": "No meaningful answer was given.",
        }

    cand_lower = candidate_answer.lower()
    ref_lower = reference_answer.lower()
    cand_words = set(re.findall(r"\b\w{3,}\b", cand_lower))
    ref_words = set(re.findall(r"\b\w{3,}\b", ref_lower))

    covered_rubric, missing_rubric = [], []
    for kw in rubric_keywords or []:
        (covered_rubric if kw.lower() in cand_lower else missing_rubric).append(kw)

    overlap = cand_words.intersection(ref_words)
    word_match_ratio = len(overlap) / max(1, len(ref_words))

    if rubric_keywords:
        rubric_match_ratio = len(covered_rubric) / len(rubric_keywords)
        score = (rubric_match_ratio * 60.0) + (min(1.0, word_match_ratio * 1.5) * 40.0)
    else:
        # No rubric: score only from overlap with the reference answer. Do not award a default.
        score = min(1.0, word_match_ratio * 1.5) * 100.0

    score = round(max(0.0, min(100.0, score)), 1)

    feedback = f"Matched {len(covered_rubric)} out of {len(rubric_keywords or [])} key rubric concepts."
    if score >= 80:
        feedback += " Excellent alignment with standard answer key."
    elif score >= 60:
        feedback += " Satisfactory conceptual grasp; some key points omitted."
    else:
        feedback += " Significant gaps compared to expected model answer."

    return {
        "accuracy_score": score,
        "key_points_covered": covered_rubric or list(overlap)[:5],
        "missing_points": missing_rubric or ["Detailed technical depth"],
        "conceptual_feedback": feedback,
    }


from rag.vectorstore import get_rag_store
from rag.evaluator import evaluate_with_rag


def validate_answer(
    question: str,
    candidate_answer: str,
    reference_answer: str = "",
    rubric_keywords: Optional[List[str]] = None,
    subject_key: Optional[str] = None,
) -> Dict:
    """
    Primary entry point for answer key validation.
    Performs RAG-grounded evaluation when indexed materials are available,
    with seamless fallback to standard reference answer grading.
    """
    rubric_keywords = rubric_keywords or []

    if is_non_answer(candidate_answer, question):
        return {
            "accuracy_score": 0.0,
            "faithfulness_score": 0.0,
            "answer_relevance": 0.0,
            "key_points_covered": [],
            "missing_points": ["Answer is too short or does not address the question."],
            "citations": [],
            "conceptual_feedback": "No meaningful answer was given.",
            "rag_grounded": False,
            "retrieved_chunks": [],
        }

    # 1. Attempt RAG Retrieval for the question
    retrieved_chunks = []
    try:
        store = get_rag_store()
        query = f"{question} {reference_answer}".strip()
        retrieved_chunks = store.similarity_search(query=query, subject_key=subject_key, top_k=3)
    except Exception as e:
        print(f"[Validator] RAG retrieval check: {e}")

    # If RAG chunks found and Groq is active, use RAG evaluation
    if retrieved_chunks and groq_client:
        rag_res = evaluate_with_rag(
            question=question,
            student_answer=candidate_answer,
            retrieved_chunks=retrieved_chunks,
            model_reference_answer=reference_answer,
        )
        return {
            "accuracy_score": float(rag_res.get("conceptual_accuracy", 0.0)),
            "faithfulness_score": float(rag_res.get("faithfulness_score", 0.0)),
            "answer_relevance": float(rag_res.get("answer_relevance", 0.0)),
            "key_points_covered": list(rag_res.get("key_points_covered", [])),
            "missing_points": list(rag_res.get("missing_points", [])),
            "citations": list(rag_res.get("citations", [])),
            "conceptual_feedback": str(rag_res.get("conceptual_feedback", "")),
            "rag_grounded": True,
            "retrieved_chunks": retrieved_chunks,
        }

    # 2. Fallback: no reference answer and no rubric
    if not reference_answer and not rubric_keywords:
        return {
            "accuracy_score": 0.0,
            "faithfulness_score": 0.0,
            "answer_relevance": 0.0,
            "key_points_covered": [],
            "missing_points": [],
            "citations": [],
            "conceptual_feedback": "No reference answer or rubric for this question. Teacher review required.",
            "rag_grounded": False,
            "retrieved_chunks": [],
            "needs_review": True,
        }


    llm_res = validate_answer_llm(question, candidate_answer, reference_answer, rubric_keywords)
    if llm_res is not None:
        llm_res["faithfulness_score"] = llm_res["accuracy_score"]
        llm_res["answer_relevance"] = llm_res["accuracy_score"]
        llm_res["citations"] = []
        llm_res["rag_grounded"] = False
        llm_res["retrieved_chunks"] = []
        return llm_res
    
    heur_res = validate_answer_heuristic(question, candidate_answer, reference_answer, rubric_keywords)
    heur_res["faithfulness_score"] = heur_res["accuracy_score"]
    heur_res["answer_relevance"] = heur_res["accuracy_score"]
    heur_res["citations"] = []
    heur_res["rag_grounded"] = False
    heur_res["retrieved_chunks"] = []
    return heur_res

