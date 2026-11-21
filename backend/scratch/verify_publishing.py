import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import db
from generator import AssessmentGenerator
import main

async def main_test():
    await db.init_db()

    # 1. Generate an MCQ using AssessmentGenerator
    gen = AssessmentGenerator()
    chunks = [
        {
            "text": "Apache Pig is a high-level platform for creating programs that run on Apache Hadoop. The language for this platform is called Pig Latin.",
            "source": "ApachePig.pdf",
            "similarity_score": 0.9,
        }
    ]
    gen_result = gen.generate(
        prompt="Generate 1 MCQ question",
        mode="quiz",
        num_questions=1,
        difficulty="medium",
        context_chunks=chunks,
    )
    print("Generation result method:", gen_result["generation_method"])
    print("Generated question:", gen_result["questions"][0]["question"])
    print("Options:", gen_result["questions"][0]["options"])
    print("Correct answer:", gen_result["questions"][0]["correct_answer"])

    # 2. Publish it via POST /api/assessments handler
    exam_id = f"test-exam-{os.urandom(4).hex()}"
    pub_payload = main.AssessmentPublishPayload(
        exam_id=exam_id,
        name="Verification MCQ Exam",
        mode="quiz",
        department="Computer Science & Engineering",
        year="4th Year",
        section="A",
        questions=gen_result["questions"],
    )
    pub_res = await main.publish_assessment(pub_payload)
    print("Publish assessment result:", pub_res)

    # 3. Fetch it through the student route: GET /api/student/active_exam
    student_exam = await main.get_student_active_exam(
        department="Computer Science & Engineering",
        year="4th Year",
        section="A",
        roll_number="21eg105a01",
        exam_id=exam_id,
    )
    print("Student fetch published status:", student_exam.get("published"))
    print("Student exam questions received:", len(student_exam.get("exam", {}).get("questions", [])))
    print("Student exam question text:", student_exam["exam"]["questions"][0]["question"])

    # 4. Also verify list available exams for student
    avail = await main.get_student_available_exams(
        department="Computer Science & Engineering",
        year="4th Year",
        section="A",
        roll_number="21eg105a01",
    )
    matching = [e for e in avail.get("exams", []) if e.get("exam_id") == exam_id]
    print(f"Exam {exam_id} found in available exams list: {len(matching) == 1}")

    assert student_exam.get("published") is True
    assert len(student_exam["exam"]["questions"]) == 1
    print("ALL VERIFICATIONS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(main_test())
