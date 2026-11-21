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
import random
import traceback
from typing import Optional, List, Dict, Tuple

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    from config import GROQ_MODEL
except ImportError:
    GROQ_MODEL = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")

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
        avoid_questions: Optional[List[str]] = None,
    ) -> Dict:
        """
        Generates an assessment based on the RAG context chunks and parameters.
        Returns a dict:
          - "questions": List[Dict]
          - "generation_method": "llm" | "fallback"
          - "warning": Optional[str]
        Raises ValueError if no RAG content is available.
        """
        if not context_chunks:
            raise ValueError("NO_RAG_CONTENT")

        # Normalize mode
        normalized_mode = "quiz" if mode in ("quiz", "mcq") else "written" if mode in ("written", "short answers", "long answers") else "oral"

        # Build context string from real PDF chunks
        rag_context = "\n\n".join([c.get("text", "").strip() for c in context_chunks if c.get("text", "").strip()])

        if not rag_context.strip():
            raise ValueError("NO_RAG_CONTENT")

        if self.client:
            # Use Groq LLM for high-quality generation
            try:
                questions, warning = self._llm_generate(
                    prompt, normalized_mode, num_questions, difficulty, rag_context, context_chunks, avoid_questions
                )
                return {
                    "questions": questions,
                    "generation_method": "llm",
                    "warning": warning,
                }
            except Exception as e:
                print(f"[Generator] LLM generation failed: {e}. Falling back to local extraction.")
                traceback.print_exc()
                short_reason = str(e) or e.__class__.__name__
                questions = self._local_extract(normalized_mode, num_questions, context_chunks)
                return {
                    "questions": questions,
                    "generation_method": "fallback",
                    "warning": short_reason,
                }
        else:
            # No LLM available -- extract directly from PDF chunks
            print("[Generator] No LLM available -- extracting questions from RAG chunks directly.")
            questions = self._local_extract(normalized_mode, num_questions, context_chunks)
            return {
                "questions": questions,
                "generation_method": "fallback",
                "warning": "LLM client not configured (missing or invalid GROQ_API_KEY).",
            }

    @staticmethod
    def is_custom_standalone_request(prompt: str) -> bool:
        """Determines if the prompt asks for a specific custom question/topic rather than generic document extraction."""
        p = prompt.strip().lower()

        # 1. Warm-up, introductory, or self-introduction request
        intro_triggers = [
            "introduce yourself", "tell me about yourself", "introduction",
            "warm-up", "warm up", "icebreaker", "ice-breaker", "introduce student", "self intro"
        ]
        if any(t in p for t in intro_triggers):
            return True

        # 2. Contains explicit quoted target question/topic e.g. "..." or '...'
        quote_match = re.search(r'["\']([^"\']{3,})["\']', prompt)
        if quote_match:
            quote_text = quote_match.group(1).lower()
            if not any(k in quote_text for k in ["pdf", "document", "unit", "chapter", "syllabus"]):
                return True

        # 3. Explicit standalone custom request format e.g. "generate question about X", "generate question on X", "ask X"
        is_doc_bound = any(k in p for k in ["from pdf", "from the pdf", "from document", "from the document", "from unit", "from syllabus", "from uploaded"])
        if not is_doc_bound:
            if any(prefix in p for prefix in ["question about ", "question on ", "question regarding ", "ask the student ", "ask about "]):
                return True

        return False

    def _llm_generate(
        self,
        prompt: str,
        mode: str,
        num_questions: int,
        difficulty: str,
        rag_context: str,
        context_chunks: Optional[List[Dict]] = None,
        avoid_questions: Optional[List[str]] = None,
    ) -> Tuple[List[Dict], Optional[str]]:
        """Uses Groq LLM to generate questions strictly derived from actual RAG PDF context or custom teacher request."""
        is_custom = self.is_custom_standalone_request(prompt)

        # Identify source file names
        source_names = list(set([os.path.basename(c.get("source", "")) for c in (context_chunks or []) if c.get("source")]))
        source_label = ", ".join(source_names) if source_names else "Uploaded PDF"
        default_source = "Teacher's Request" if is_custom else source_label

        if mode == "oral":
            mode_rules = """MODE: ORAL / VIVA
- Each question must ask for a conceptual explanation that a student could say aloud in spoken conversation.
- "reference_answer": MUST be a short, clear model answer (2-3 sentences max).
- DO NOT include "options" or multiple choice options.
- Schema: [{"question": "...", "reference_answer": "...", "source": "..."}]"""
            format_example = '[{"question": "Can you explain the main concept of X?", "reference_answer": "X is a technique for Y. It works by Z and is commonly used in W.", "source": "' + default_source + '"}]'
        elif mode == "written":
            mode_rules = """MODE: WRITTEN TEST
- Each question must ask for a structured, comprehensive written explanation or analysis.
- "reference_answer": MUST be a full, detailed model answer (one complete, well-formed paragraph).
- "rubric_keywords": MUST contain 4 to 6 essential technical terms or concepts expected in a complete response (e.g. ["term1", "term2", "term3", "term4"]).
- DO NOT include "options".
- Schema: [{"question": "...", "reference_answer": "...", "rubric_keywords": ["k1", "k2", "k3", "k4"], "source": "..."}]"""
            format_example = '[{"question": "Explain the architecture and execution flow of X in detail.", "reference_answer": "X architecture consists of... [one full paragraph explanation].", "rubric_keywords": ["k1", "k2", "k3", "k4"], "source": "' + default_source + '"}]'
        else: # quiz
            mode_rules = """MODE: MCQ QUIZ
- Each question must be a clear multiple-choice question testing understanding.
- "options": MUST contain EXACTLY 4 options with keys "A", "B", "C", and "D". Plausible distractors MUST be derived from the text.
- "correct_answer": MUST be exactly one of "A", "B", "C", or "D".
- Randomly distribute correct answers across A, B, C, and D. DO NOT always make A the correct answer.
- "explanation": 1-2 sentences explaining why the correct option is right.
- Schema: [{"question": "...", "options": {"A": "...", "B": "...", "C": "...", "D": "..."}, "correct_answer": "C", "explanation": "...", "source": "..."}]"""
            format_example = '[{"question": "What is the primary function of X?", "options": {"A": "...", "B": "...", "C": "...", "D": "..."}, "correct_answer": "C", "explanation": "X is responsible for...", "source": "' + default_source + '"}]'

        avoid_text = ""
        if avoid_questions:
            avoid_text = "\nCRITICAL: DO NOT generate any questions that are similar to these:\n" + "\n".join([f"- {q}" for q in avoid_questions]) + "\n"

        if is_custom:
            system_prompt = f"""You are an expert academic evaluator creating exam and viva assessment questions.
The teacher has provided a specific custom question or topic request.
CRITICAL ISOLATION RULE: Generate questions STRICTLY and EXCLUSIVELY focused on the Teacher's Custom Request.
- DO NOT mention, mix, or blend in any unrelated syllabus topics, PDF documents, or external technical terms that were not explicitly requested by the teacher.
- For an introduction request ('introduce yourself'), produce a clean, professional viva self-introduction question asking the student to introduce themselves, outline their academic background, and describe their primary technical interests and strengths.
- For any specific topic requested by the teacher, generate questions focused purely on that topic.
- Include "source": "Teacher's Request" for each question.

{mode_rules}

Generate exactly {num_questions} question(s) of '{difficulty}' difficulty for a '{mode}' assessment that directly fulfill the Teacher's Custom Request.

Return a raw JSON array matching this format:
{format_example}

ONLY return valid JSON. No markdown, no backticks, no extra text before or after the JSON array."""

            user_prompt = f"""Teacher's Custom Request: {prompt}
{avoid_text}
Generate exactly {num_questions} {mode} question(s) fulfilling the Teacher's Custom Request cleanly without mixing in external documents."""
        else:
            system_prompt = f"""You are an expert academic evaluator creating exam and viva assessment questions.
All questions, options, and reference answers MUST be derived from the provided Syllabus Context from '{source_label}'.
- For each question, include the "source" field indicating the source document name: "{source_label}".

{mode_rules}

Generate exactly {num_questions} question(s) of '{difficulty}' difficulty for a '{mode}' assessment based on the Syllabus Context.

Return a raw JSON array matching this format:
{format_example}

ONLY return valid JSON. No markdown, no backticks, no extra text before or after the JSON array."""

            user_prompt = f"""Syllabus Context (from the uploaded PDF '{source_label}'):
---
{rag_context[:25000]}
---

Teacher's Request: {prompt}
{avoid_text}
Generate exactly {num_questions} {mode} question(s) based on the above Syllabus Context."""

        response = self.client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3 if is_custom else 0.5,
            max_tokens=8000,
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

        # Validate each question strictly matches the mode requirements
        validated = []
        for q in questions:
            if not isinstance(q, dict):
                continue
            q_text = str(q.get("question", "")).strip()
            if not q_text:
                continue

            if mode == "oral":
                ref_ans = str(q.get("reference_answer", "")).strip()
                if not ref_ans:
                    continue
                validated.append({
                    "question": q_text,
                    "reference_answer": ref_ans,
                    "source": q.get("source") or default_source,
                })
            elif mode == "written":
                ref_ans = str(q.get("reference_answer", "")).strip()
                if not ref_ans:
                    continue
                rubric = q.get("rubric_keywords")
                if not isinstance(rubric, list) or len(rubric) == 0:
                    rubric = self._extract_keywords(ref_ans)
                rubric = [str(k).strip() for k in rubric if str(k).strip()]
                if len(rubric) < 4:
                    extra = self._extract_keywords(ref_ans)
                    for k in extra:
                        if k not in rubric:
                            rubric.append(k)
                        if len(rubric) >= 4:
                            break
                validated.append({
                    "question": q_text,
                    "reference_answer": ref_ans,
                    "rubric_keywords": rubric[:6],
                    "source": q.get("source") or default_source,
                })
            elif mode == "quiz":
                opts = q.get("options")
                correct = str(q.get("correct_answer", "")).strip().upper()
                if not isinstance(opts, dict):
                    continue
                opt_keys = ["A", "B", "C", "D"]
                if not all(k in opts for k in opt_keys) or len(opts) != 4:
                    continue
                if correct not in opt_keys:
                    continue
                validated.append({
                    "question": q_text,
                    "options": {k: str(opts[k]).strip() for k in opt_keys},
                    "correct_answer": correct,
                    "explanation": str(q.get("explanation", f"The correct answer is {correct}.")).strip(),
                    "source": q.get("source") or default_source,
                })

        if not validated:
            raise ValueError(f"No valid questions matching '{mode}' format returned by LLM.")

        warning = None
        if len(validated) < num_questions:
            warning = f"Only {len(validated)} of {num_questions} questions met format requirements for '{mode}' mode."

        return validated[:num_questions], warning

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
                    q = self._make_open_question(sentence, context_window, is_definition, is_process, mode=mode)

                if q:
                    q["source"] = os.path.basename(chunk.get("source", "Uploaded PDF"))
                    questions.append(q)

        if not questions:
            raise ValueError("NO_RAG_CONTENT")

        return questions[:num_questions]

    def _make_open_question(self, sentence: str, context: str, is_definition: bool, is_process: bool, mode: str = "written") -> Optional[Dict]:
        """Constructs an open-ended question from a sentence tailored for oral or written mode."""
        sentence_clean = sentence.rstrip(".")

        # Identify the main subject/concept
        words = sentence_clean.split()
        if len(words) < 5:
            return None

        question = None
        # Build question based on sentence structure
        if is_definition:
            for kw in [" is ", " are ", " refers to ", " defined as ", " means ", " includes "]:
                if kw in sentence_clean.lower():
                    idx = sentence_clean.lower().index(kw)
                    subject = sentence_clean[:idx].strip().strip(",")
                    if subject and len(subject) < 80:
                        question = f"What is {subject}? Explain with examples."
                        break

        if not question and is_process:
            question = f"Describe the process or steps involved: {sentence_clean[:100]}?"

        if not question:
            question = f"Explain the concept described in the following context and its significance:\n\"{sentence_clean[:150]}\""

        if mode == "oral":
            # Oral/Viva: short model answer (2-3 sentences max), no options, no rubric
            short_ref = sentence_clean + "."
            sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', context) if s.strip() and s.strip() != sentence_clean]
            if sentences:
                short_ref += " " + sentences[0] + "."
            return {
                "question": question,
                "reference_answer": short_ref,
            }
        else:
            # Written: full model answer (paragraph) + 4-6 rubric keywords, no options
            rubric = self._extract_keywords(context)
            if len(rubric) < 4:
                rubric = (rubric + ["fundamentals", "architecture", "operation", "significance"])[:6]
            return {
                "question": question,
                "reference_answer": context if len(context) > len(sentence_clean) else sentence_clean + ". Detailed explanation required.",
                "rubric_keywords": rubric[:6],
            }

    def _make_mcq_from_sentence(self, sentence: str, context: str) -> Optional[Dict]:
        """Creates a basic MCQ from a factual sentence with randomized option placement."""
        sentence_clean = sentence.rstrip(".")
        words = sentence_clean.split()
        if len(words) < 6:
            return None

        subject = None
        correct = None

        # Find a key term to use as the answer
        for kw in [" is ", " are ", " refers to ", " defined as ", " means ", " includes "]:
            if kw in sentence_clean.lower():
                idx = sentence_clean.lower().index(kw)
                subject = sentence_clean[:idx].strip().strip(",")
                correct = sentence_clean[idx + len(kw):].strip()[:120]
                break

        if not subject or not correct or len(subject) >= 80:
            if "," in sentence_clean:
                parts = sentence_clean.split(",", 1)
                subject = parts[0].strip()[:60]
                correct = parts[1].strip()[:120]
            else:
                subject = " ".join(words[:3])
                correct = " ".join(words[3:])[:120]

        if not subject or not correct:
            return None

        # Generate plausible distractors from other words in context
        context_words = list(set(context.split()) - set(sentence.split()))
        distractor_pool = [w.strip(".,;:()") for w in context_words if len(w) > 4][:10]

        d1 = f"A method involving {distractor_pool[0]}" if len(distractor_pool) > 0 else f"The inverse of {subject.lower()}"
        d2 = f"Related to {distractor_pool[1]} operations" if len(distractor_pool) > 1 else f"A process unrelated to {subject.lower()}"
        d3 = f"The process of {distractor_pool[2]}" if len(distractor_pool) > 2 else "A type of data structure"

        opts = [correct, d1, d2, d3]
        random.shuffle(opts)
        keys = ["A", "B", "C", "D"]
        options_dict = dict(zip(keys, opts))
        correct_key = keys[opts.index(correct)]

        return {
            "question": f"What is {subject}?",
            "options": options_dict,
            "correct_answer": correct_key,
            "explanation": f"{subject} is defined as: {correct}",
        }

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

