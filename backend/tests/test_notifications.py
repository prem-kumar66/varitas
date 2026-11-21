"""
Unit tests for student notification read status and management.
Verifies that:
1. When an exam is published, notifications have is_read = 0 (red mark active).
2. When marked as read, is_read = 1 (red mark removed).
3. Individual or bulk notifications can be marked as read.
"""
import sys
import os
import asyncio

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import db
from main import get_student_notifications, mark_student_notifications_read, MarkNotificationsReadPayload


def test_student_notifications_read_flow(tmp_path, monkeypatch):
    """Test full cycle of notification creation, polling unread, and marking as read."""
    async def _run():
        test_db_file = str(tmp_path / "test_notif.db")
        monkeypatch.setattr(db, "DB_PATH", test_db_file)
        await db.init_db()

        roll = "23eg107b35"
        # Register student in AIML 4th Year
        await db.db_register_student(
            email="prem@anurag.edu.in",
            name="Prem",
            roll_number=roll,
            academic_year="4th Year",
            department="aiml",
            section="B",
            password="password123",
            mobile="9876543210"
        )

        # 1. Teacher publishes an exam -> notification dispatched
        count = await db.db_notify_section_for_exam(
            department="aiml",
            year="4th Year",
            section="B",
            exam_name="Deep Learning Midterm",
            mode="quiz",
            teacher="Dr. Rao",
            exam_id="exam_dl_99",
        )
        assert count == 1

        # 2. Student fetches notifications -> must be unread (is_read == 0)
        notifs = await db.db_get_student_notifications(roll)
        assert len(notifs) == 1
        assert notifs[0]["is_read"] == 0
        assert notifs[0]["test_ready"] == 1
        assert notifs[0]["exam_id"] == "exam_dl_99"

        # 3. Test API endpoint get_student_notifications
        res = await get_student_notifications(roll)
        assert len(res["notifications"]) == 1
        assert res["notifications"][0]["is_read"] == 0

        # 4. Student views notification -> mark as read via API endpoint
        mark_res = await mark_student_notifications_read(
            MarkNotificationsReadPayload(student_roll=roll, notification_id=notifs[0]["id"])
        )
        assert mark_res["ok"] is True
        assert mark_res["marked_count"] == 1

        # 5. Subsequent fetch -> notification is now read (is_read == 1, red mark gone)
        updated = await db.db_get_student_notifications(roll)
        assert len(updated) == 1
        assert updated[0]["is_read"] == 1

        # 6. Teacher publishes a second exam -> new notification with is_read == 0
        await db.db_notify_section_for_exam(
            department="aiml",
            year="4th Year",
            section="B",
            exam_name="Computer Vision Final",
            mode="oral",
            teacher="Dr. Rao",
            exam_id="exam_cv_100",
        )

        all_notifs = await db.db_get_student_notifications(roll)
        assert len(all_notifs) == 2
        # One read, one unread
        unread = [n for n in all_notifs if n["is_read"] == 0]
        read = [n for n in all_notifs if n["is_read"] == 1]
        assert len(unread) == 1
        assert unread[0]["exam_id"] == "exam_cv_100"
        assert len(read) == 1
        assert read[0]["exam_id"] == "exam_dl_99"

        # 7. Bulk mark all read for student
        bulk_res = await mark_student_notifications_read(
            MarkNotificationsReadPayload(student_roll=roll)
        )
        assert bulk_res["ok"] is True
        final_notifs = await db.db_get_student_notifications(roll)
        assert all(n["is_read"] == 1 for n in final_notifs)

    asyncio.run(_run())
