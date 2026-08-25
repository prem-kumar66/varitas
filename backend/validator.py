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
from typing import List, Dict, Tuple, Optional
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
groq_client = None

if GROQ_API_KEY:
    try:
        from groq import Groq
        groq_client = Groq(api_key=GROQ_API_KEY)
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
            model="llama-3.1-8b-instant",
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
            "accuracy_score": float(data.get("accuracy_score", 70.0)),
            "key_points_covered": list(data.get("key_points_covered", [])),
            "missing_points": list(data.get("missing_points", [])),
            "conceptual_feedback": str(data.get("conceptual_feedback", "Answer evaluated against reference answer.")),
        }
    except Exception as e:
        print(f"Validator LLM error: {e}")
        return None


def validate_answer_heuristic(
    question: str,
    candidate_answer: str,
    reference_answer: str,
    rubric_keywords: List[str],
) -> Dict:
    """Smart heuristic fallback when LLM is offline."""
    cand_lower = candidate_answer.lower()
    ref_lower = reference_answer.lower()
    
    cand_words = set(re.findall(r"\b\w{3,}\b", cand_lower))
    ref_words = set(re.findall(r"\b\w{3,}\b", ref_lower))
    
    covered_rubric = []
    missing_rubric = []
    
    if rubric_keywords:
        for kw in rubric_keywords:
            if kw.lower() in cand_lower:
                covered_rubric.append(kw)
            else:
                missing_rubric.append(kw)
        rubric_match_ratio = len(covered_rubric) / max(1, len(rubric_keywords))
    else:
        rubric_match_ratio = 0.5

    overlap = cand_words.intersection(ref_words)
    word_match_ratio = len(overlap) / max(1, len(ref_words))
    
    # Combined score
    score = (rubric_match_ratio * 60.0) + (min(1.0, word_match_ratio * 1.5) * 40.0)
    
    # Check length penalty
    if len(cand_words) < 5:
        score = min(score, 30.0)

    score = round(max(10.0, min(100.0, score)), 1)
    
    feedback = f"Matched {len(covered_rubric)} out of {len(rubric_keywords or [1])} key rubric concepts."
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
            "accuracy_score": float(rag_res.get("conceptual_accuracy", 75.0)),
            "faithfulness_score": float(rag_res.get("faithfulness_score", 80.0)),
            "answer_relevance": float(rag_res.get("answer_relevance", 80.0)),
            "key_points_covered": list(rag_res.get("key_points_covered", [])),
            "missing_points": list(rag_res.get("missing_points", [])),
            "citations": list(rag_res.get("citations", [])),
            "conceptual_feedback": str(rag_res.get("conceptual_feedback", "")),
            "rag_grounded": True,
            "retrieved_chunks": retrieved_chunks,
        }

    # 2. Fallback to standard reference answer LLM validation
    if not reference_answer and not rubric_keywords:
        return {
            "accuracy_score": 85.0,
            "faithfulness_score": 85.0,
            "answer_relevance": 85.0,
            "key_points_covered": ["General comprehension"],
            "missing_points": [],
            "citations": [],
            "conceptual_feedback": "No reference answer or syllabus document uploaded for this question.",
            "rag_grounded": False,
            "retrieved_chunks": [],
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

