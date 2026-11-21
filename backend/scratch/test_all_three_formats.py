import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import main
import db

async def run_format_tests():
    await db.init_db()

    chunks = [
        {
            "text": (
                "Apache Pig is an open-source high-level platform for analyzing large datasets that consists of a high-level "
                "language called Pig Latin and an execution framework. The key feature of Pig is that its compiler translates "
                "Pig Latin scripts into directed acyclic graphs (DAGs) of MapReduce jobs executed on Hadoop clusters. "
                "Pig provides data structures like bags, tuples, and fields for handling structured and semi-structured data."
            ),
            "source": "ApachePig_Guide.pdf",
            "similarity_score": 0.95,
        }
    ]

    formats = [
        ("oral", "Generate 1 oral viva question about Apache Pig"),
        ("written", "Generate 1 written exam question with reference answer and rubric for Apache Pig"),
        ("quiz", "Generate 1 MCQ quiz question on Apache Pig with 4 options"),
    ]

    print("\n=================== TESTING ALL 3 FORMATS ===================")
    for mode, prompt in formats:
        print(f"\n--- FORMAT: {mode.upper()} ---")
        payload = main.AssessmentGeneratePayload(
            prompt=prompt,
            mode=mode,
            num_questions=1,
            difficulty="medium",
            subject_key="global",
        )
        
        from generator import AssessmentGenerator
        gen = AssessmentGenerator()
        res = gen.generate(
            prompt=payload.prompt,
            mode=payload.mode,
            num_questions=payload.num_questions,
            difficulty=payload.difficulty,
            context_chunks=chunks,
        )
        print(f"Generation Method: {res['generation_method']}")
        print(f"Warning: {res['warning']}")
        q = res["questions"][0]
        print(f"Question: {q.get('question')}")
        if mode == "oral":
            print(f"Reference Answer (oral - short): {q.get('reference_answer')}")
            print(f"Has options: {'options' in q}")
            assert "reference_answer" in q
            assert "options" not in q
        elif mode == "written":
            print(f"Reference Answer (written - paragraph): {q.get('reference_answer')}")
            print(f"Rubric Keywords: {q.get('rubric_keywords')}")
            print(f"Has options: {'options' in q}")
            assert "reference_answer" in q
            assert "rubric_keywords" in q
            assert 4 <= len(q["rubric_keywords"]) <= 6
            assert "options" not in q
        elif mode == "quiz":
            print(f"Options: {q.get('options')}")
            print(f"Correct Answer: {q.get('correct_answer')}")
            print(f"Explanation: {q.get('explanation')}")
            assert "options" in q
            assert len(q["options"]) == 4
            assert q["correct_answer"] in ["A", "B", "C", "D"]
            assert "explanation" in q
        print(f"✓ {mode.upper()} format verified successfully!")

    print("\n=================== ALL 3 FORMATS SUCCEEDED ===================\n")

if __name__ == "__main__":
    asyncio.run(run_format_tests())
