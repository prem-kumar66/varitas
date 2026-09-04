"""
Veritas Academic -- Assessment Generator
=========================================
Generates exam questions based on RAG context chunks using Groq LLM.
If Groq is unavailable, falls back to extracting questions directly from
the RAG chunk text -- NEVER uses mock/placeholder data.
"""
import os
import re
import json
from typing import Optional, List, Dict

# Try to import Groq -- optional dependency
try:
    from groq import Groq
    _GROQ_AVAILABLE = True
except ImportError:
    _GROQ_AVAILABLE = False


class AssessmentGenerator:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        self.client = None

        if not _GROQ_AVAILABLE:
            print("[Generator] Groq package not installed -- using local extraction.")
            return

        if not self.api_key or self.api_key.startswith("gsk_your"):
            print("[Generator] GROQ_API_KEY not set -- will generate questions directly from RAG text.")
            return

        try:
            import httpx
            self.client = Groq(api_key=self.api_key, http_client=httpx.Client())
            print("[Generator] Groq LLM client initialized successfully.")
        except Exception as e:
            print(f"[Generator] Failed to initialize Groq: {e}")

    def generate(
        self,
        prompt: str,
        mode: str,
        num_questions: int,
        difficulty: str,
        context_chunks: List[Dict],
    ) -> List[Dict]:
        """
        Generates an assessment based on the RAG context chunks and parameters.
        Returns a list of real question dictionaries based on PDF content.
        Raises ValueError if no RAG content is available.
        """
        if not context_chunks:
            raise ValueError("NO_RAG_CONTENT")

        # Build context string from real PDF chunks
        rag_context = "\n\n".join([c.get("text", "").strip() for c in context_chunks if c.get("text", "").strip()])

        if not rag_context.strip():
            raise ValueError("NO_RAG_CONTENT")

        if self.client:
            # Use Groq LLM for high-quality generation
            try:
                return self._llm_generate(prompt, mode, num_questions, difficulty, rag_context)
            except Exception as e:
                print(f"[Generator] LLM generation failed: {e}. Falling back to local extraction.")
                return self._local_extract(mode, num_questions, context_chunks)
        else:
            # No LLM available -- extract directly from PDF chunks
            print("[Generator] No LLM available -- extracting questions from RAG chunks directly.")
            return self._local_extract(mode, num_questions, context_chunks)

    def _llm_generate(self, prompt: str, mode: str, num_questions: int, difficulty: str, rag_context: str) -> List[Dict]:
        """Uses Groq LLM to generate questions from actual RAG context."""
        # Pre-compute conditionals (no backslashes inside f-strings in Python 3.10)
        mode_label = "For 'oral' or 'written' mode" if mode != "quiz" else "For 'quiz' mode"
        if mode != "quiz":
            format_example = '[{"question": "...", "reference_answer": "...", "rubric_keywords": ["kw1", "kw2"]}]'
        else:
            format_example = '[{"question": "...", "options": {"A": "...", "B": "...", "C": "...", "D": "..."}, "correct_answer": "A", "explanation": "..."}]'

        system_prompt = f"""You are an expert academic evaluator creating exam questions.
Generate exactly {num_questions} questions of '{difficulty}' difficulty for a '{mode}' exam.
IMPORTANT: Both Questions AND Reference Answers MUST be strictly derived from the provided Syllabus Context below.
Do NOT invent topics, and do NOT use generic AI knowledge or mock data. Every reference answer must be based entirely on the provided text.

{mode_label}, return a raw JSON array:
{format_example}

ONLY return valid JSON. No markdown, no backticks, no extra text before or after the JSON array."""

        user_prompt = f"""Syllabus Context (from the uploaded PDF):
---
{rag_context[:6000]}
---

Teacher's Request: {prompt}

Generate {num_questions} {mode} questions and detailed reference answers based ONLY on the above Syllabus Context."""

        response = self.client.chat.completions.create(
            model="qwen/qwen3.8-27b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.6,
            max_tokens=3000,
        )

        content = response.choices[0].message.content.strip()

        # Robust JSON extraction
        content = re.sub(r"^```json\s*", "", content, flags=re.IGNORECASE)
        content = re.sub(r"^```\s*", "", content)
        content = re.sub(r"\s*```$", "", content)
        content = content.strip()

        # Find the JSON array even if there's surrounding text
        match = re.search(r"\[.*\]", content, re.DOTALL)
        if match:
            content = match.group(0)

        questions = json.loads(content)

        if not isinstance(questions, list) or len(questions) == 0:
            raise ValueError("LLM returned empty or invalid question list.")

        # Validate each question has required fields
        validated = []
        for q in questions:
            if not q.get("question"):
                continue
            if mode == "quiz":
                if not q.get("options") or not q.get("correct_answer"):
                    continue
            else:
                if not q.get("reference_answer"):
                    q["reference_answer"] = "Refer to the course material for a detailed answer."
                if not q.get("rubric_keywords"):
                    q["rubric_keywords"] = []
            validated.append(q)

        if not validated:
            raise ValueError("LLM returned no valid questions.")

        return validated[:num_questions]

    def _local_extract(self, mode: str, num_questions: int, context_chunks: List[Dict]) -> List[Dict]:
        """
        Extracts real questions directly from RAG chunk text WITHOUT any LLM.
        Uses sentence analysis on the actual PDF content.
        Never returns mock data.
        """
        questions = []
        used_texts = set()

        # Sort chunks by relevance score
        sorted_chunks = sorted(context_chunks, key=lambda c: c.get("similarity_score", 0), reverse=True)

        for chunk in sorted_chunks:
            if len(questions) >= num_questions:
                break

            raw_text = chunk.get("text", "").strip()
            if not raw_text or len(raw_text) < 50:
                continue

            # Split into sentences
            sentences = re.split(r'(?<=[.!?])\s+', raw_text)
            sentences = [s.strip() for s in sentences if len(s.strip()) > 30]

            for i, sentence in enumerate(sentences):
                if len(questions) >= num_questions:
                    break

                # Skip duplicates
                sig = sentence[:60]
                if sig in used_texts:
                    continue
                used_texts.add(sig)

                # Look for definition-style sentences (ideal for viva/written)
                is_definition = any(kw in sentence.lower() for kw in [
                    " is ", " are ", " refers to ", " defined as ", " means ",
                    " involves ", " describes ", " consists of ", " includes "
                ])
                is_process = any(kw in sentence.lower() for kw in [
                    " first ", " then ", " next ", " finally ", " steps ", " process "
                ])

                # Build context from surrounding sentences
                context_window = " ".join(sentences[max(0, i-1):min(len(sentences), i+3)])

                if mode == "quiz":
                    q = self._make_mcq_from_sentence(sentence, context_window)
                else:
                    q = self._make_open_question(sentence, context_window, is_definition, is_process)

                if q:
                    questions.append(q)

        if not questions:
            raise ValueError("NO_RAG_CONTENT")

        return questions[:num_questions]

    def _make_open_question(self, sentence: str, context: str, is_definition: bool, is_process: bool) -> Optional[Dict]:
        """Constructs an open-ended question from a sentence."""
        sentence_clean = sentence.rstrip(".")

        # Identify the main subject/concept
        words = sentence_clean.split()
        if len(words) < 5:
            return None

        # Build question based on sentence structure
        if is_definition:
            # Extract the subject (usually before "is", "are", etc.)
            for kw in [" is ", " are ", " refers to ", " defined as "]:
                if kw in sentence_clean.lower():
                    idx = sentence_clean.lower().index(kw)
                    subject = sentence_clean[:idx].strip().strip(",")
                    if subject and len(subject) < 80:
                        question = f"What is {subject}? Explain with examples."
                        return {
                            "question": question,
                            "reference_answer": sentence_clean + ". " + context if len(context) > len(sentence_clean) else sentence_clean,
                            "rubric_keywords": self._extract_keywords(sentence_clean)
                        }

        if is_process:
            question = f"Describe the process or steps involved: {sentence_clean[:100]}?"
            return {
                "question": question,
                "reference_answer": context,
                "rubric_keywords": self._extract_keywords(context)
            }

        # Generic: turn statement into a question
        # Find a key noun phrase to ask about
        question = f"Explain the concept described in the following context and its significance:\n\"{sentence_clean[:150]}\""
        return {
            "question": question,
            "reference_answer": context,
            "rubric_keywords": self._extract_keywords(context)
        }

    def _make_mcq_from_sentence(self, sentence: str, context: str) -> Optional[Dict]:
        """Creates a basic MCQ from a factual sentence."""
        sentence_clean = sentence.rstrip(".")
        words = sentence_clean.split()
        if len(words) < 6:
            return None

        # Find a key term to use as the answer
        for kw in [" is ", " are "]:
            if kw in sentence_clean.lower():
                idx = sentence_clean.lower().index(kw)
                subject = sentence_clean[:idx].strip()
                definition_part = sentence_clean[idx + len(kw):].strip()

                if subject and definition_part and len(subject) < 80:
                    correct = definition_part[:120]
                    # Generate plausible distractors from other words in context
                    context_words = list(set(context.split()) - set(sentence.split()))
                    distractor_pool = [w.strip(".,;:()") for w in context_words if len(w) > 5][:10]

                    d1 = f"The inverse of {subject.lower()}"
                    d2 = f"A process unrelated to {subject.lower()}"
                    d3 = f"A type of data structure"

                    if len(distractor_pool) >= 3:
                        d1 = f"A method involving {distractor_pool[0]}"
                        d2 = f"Related to {distractor_pool[1]} operations"
                        d3 = f"The process of {distractor_pool[2]}"

                    return {
                        "question": f"What is {subject}?",
                        "options": {
                            "A": correct,
                            "B": d1,
                            "C": d2,
                            "D": d3
                        },
                        "correct_answer": "A",
                        "explanation": f"{subject} is defined as: {correct}"
                    }
        return None

    def _extract_keywords(self, text: str) -> List[str]:
        """Extracts meaningful keywords from text."""
        # Remove common stop words and extract meaningful terms
        stop = {"the", "a", "an", "is", "are", "was", "were", "in", "on", "at", "to",
                "of", "and", "or", "but", "it", "its", "this", "that", "with", "for",
                "as", "by", "from", "be", "has", "have", "been", "will", "can", "may",
                "which", "what", "how", "when", "where", "their", "they", "we", "you"}
        words = re.findall(r'\b[a-zA-Z]{4,}\b', text)
        keywords = list(dict.fromkeys(w.lower() for w in words if w.lower() not in stop))
        return keywords[:8]

