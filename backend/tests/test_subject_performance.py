"""
Unit and integration tests for Subject Performance Analytics (SQL grouping).
Tests that:
1. Assessments and exam attempts are grouped by teacher and subject directly in SQL.
2. Only completed attempts are included in the average score calculation.
3. Disqualified attempts are counted separately.
4. Rows are sorted by average score ascending (lowest first, weak areas at top).
5. Low sample indicator triggers when exam count < 3.
"""
import sys
import os
import time
import asyncio

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import db
from main import get_subject_performance


def test_subject_performance_sql_grouping(tmp_path, monkeypatch):
    """
    Seed database with 2 teachers, each with 1 subject, record completed attempts
    with different scores (plus a disqualified attempt), and call db_get_subject_performance
    to verify averages, attempt counts, and sorting.
    """
    async def _run():
        test_db_file = str(tmp_path / "test_perf.db")
        monkeypatch.setattr(db, "DB_PATH", test_db_file)
        await db.init_db()

        now = time.time()

        # Teacher 1: Dr. Smith teaching Machine Learning (AIML, 2nd Year, Sec B)
        exam1_id = "exam_ml_101"
        await db.db_save_assessment(
            exam_id=exam1_id,
            name="Machine Learning Midterm",
            mode="written",
            subject="Machine Learning",
            unit="Unit 1",
            department="aiml",
            year="2nd Year",
            section="B",
            source_pdf="",
            teacher="Dr. Smith",
            difficulty="medium",
            questions=[{"question": "What is gradient descent?"}],
            created_at=now,
        )

        # Teacher 2: Prof. Davis teaching Operating Systems (AIML, 2nd Year, Sec B)
        exam2_id = "exam_os_201"
        await db.db_save_assessment(
            exam_id=exam2_id,
            name="Operating Systems Quiz",
            mode="quiz",
            subject="Operating Systems",
            unit="Unit 2",
            department="aiml",
            year="2nd Year",
            section="B",
            source_pdf="",
            teacher="Prof. Davis",
            difficulty="easy",
            questions=[{"question": "What is a semaphore?"}],
            created_at=now,
        )

        # Attempts for Dr. Smith (Machine Learning):
        # Student 1: 40.0 (completed)
        # Student 2: 60.0 (completed) -> Average completed score: 50.0
        # Student 3: 0.0 (disqualified) -> Must NOT be included in average score
        await db.db_record_exam_attempt(
            student_roll="23eg101a01",
            exam_id=exam1_id,
            subject="Machine Learning",
            score=40.0,
            max_score=100.0,
            status="completed",
        )
        await db.db_record_exam_attempt(
            student_roll="23eg101a02",
            exam_id=exam1_id,
            subject="Machine Learning",
            score=60.0,
            max_score=100.0,
            status="completed",
        )
        await db.db_record_exam_attempt(
            student_roll="23eg101a03",
            exam_id=exam1_id,
            subject="Machine Learning",
            score=0.0,
            max_score=100.0,
            status="disqualified",
        )

        # Attempts for Prof. Davis (Operating Systems):
        # Student 1: 80.0 (completed)
        # Student 2: 90.0 (completed) -> Average completed score: 85.0
        await db.db_record_exam_attempt(
            student_roll="23eg101a01",
            exam_id=exam2_id,
            subject="Operating Systems",
            score=80.0,
            max_score=100.0,
            status="completed",
        )
        await db.db_record_exam_attempt(
            student_roll="23eg101a02",
            exam_id=exam2_id,
            subject="Operating Systems",
            score=90.0,
            max_score=100.0,
            status="completed",
        )

        # Call the SQL grouping function
        results = await db.db_get_subject_performance()

        assert len(results) == 2, f"Expected 2 groups, got {len(results)}"

        # Sort verification: lowest average score first (weak areas at top)
        # Dr. Smith (avg 50.0) must be first, Prof. Davis (avg 85.0) second
        first = results[0]
        second = results[1]

        assert first["teacher"] == "Dr. Smith"
        assert first["subject"] == "Machine Learning"
        assert first["exam_count"] == 1
        assert first["student_attempts"] == 2
        assert first["completed_attempts"] == 2
        assert first["disqualified_attempts"] == 1
        assert first["avg_score"] == 50.0
        assert first["is_low_sample"] is True

        assert second["teacher"] == "Prof. Davis"
        assert second["subject"] == "Operating Systems"
        assert second["exam_count"] == 1
        assert second["student_attempts"] == 2
        assert second["completed_attempts"] == 2
        assert second["disqualified_attempts"] == 0
        assert second["avg_score"] == 85.0
        assert second["is_low_sample"] is True

        # Test filtering by department, year, section
        filtered = await db.db_get_subject_performance(department="aiml", year="2nd Year", section="B")
        assert len(filtered) == 2

        # Filtering for a non-matching department should return empty
        non_matching = await db.db_get_subject_performance(department="mech")
        assert len(non_matching) == 0

        # Test API route handler function directly
        res = await get_subject_performance(department="aiml", year="2nd Year", section="B")
        assert "subject_performance" in res
        assert len(res["subject_performance"]) == 2
        assert res["subject_performance"][0]["teacher"] == "Dr. Smith"
        assert res["subject_performance"][0]["avg_score"] == 50.0
        assert res["subject_performance"][1]["teacher"] == "Prof. Davis"
        assert res["subject_performance"][1]["avg_score"] == 85.0

    asyncio.run(_run())


def test_subject_performance_low_sample_threshold(tmp_path, monkeypatch):
    """Verify that is_low_sample is False when a subject has 3 or more exams."""
    async def _run():
        test_db_file = str(tmp_path / "test_sample.db")
        monkeypatch.setattr(db, "DB_PATH", test_db_file)
        await db.init_db()

        now = time.time()
        # Add 3 exams for same teacher and subject
        for i in range(3):
            await db.db_save_assessment(
                exam_id=f"exam_ds_{i}",
                name=f"Data Structures Quiz {i+1}",
                mode="quiz",
                subject="Data Structures",
                unit="Unit 1",
                department="cse",
                year="2nd Year",
                section="A",
                source_pdf="",
                teacher="Prof. Alan",
                difficulty="medium",
                questions=[],
                created_at=now + i,
            )

        # 1 completed attempt
        await db.db_record_exam_attempt(
            student_roll="23eg105a01",
            exam_id="exam_ds_0",
            subject="Data Structures",
            score=75.0,
            max_score=100.0,
            status="completed",
        )

        results = await db.db_get_subject_performance(department="cse")
        assert len(results) == 1
        assert results[0]["exam_count"] == 3
        assert results[0]["is_low_sample"] is False
        assert results[0]["avg_score"] == 75.0

    asyncio.run(_run())
