"use client";
import { useState, useEffect } from "react";
import { useTeacherContext } from "@/components/teacher/TeacherProvider";
import { getTeacherAuthHeaders } from "@/lib/auth";
import { Users, Search, ChevronRight, ShieldAlert, Lock, Mail, Phone, BookOpen, Award } from "lucide-react";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";

export default function StudentsPage() {
  const { department, year, section, isGuest } = useTeacherContext();
  const [registeredStudents, setRegisteredStudents] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!department) return;
    setLoading(true);

    const deptParam = `department=${encodeURIComponent(department)}`;
    const yearParam = year ? `&year=${encodeURIComponent(year)}` : "";

    // Fetch registered students from the students table
    fetch(`${BACKEND_HTTP}/api/students?${deptParam}${yearParam}`, { headers: getTeacherAuthHeaders() })
      .then((r) => r.json())
      .then((d) => setRegisteredStudents(d.students || []))
      .catch(() => {});

    // Fetch exam sessions (oral/written completions) for enrichment
    fetch(`${BACKEND_HTTP}/api/sessions?${deptParam}`, { headers: getTeacherAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setSessions(d.sessions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [department, year]);

  // Build a merged student list:
  // Priority 1: registered students (from students table)
  // Enriched with session data (avg scores) if available
  const sessionsByRoll = new Map<string, any>();
  for (const s of sessions) {
    const key = (s.roll_number || "").toLowerCase();
    if (key && (!sessionsByRoll.has(key) || (s.avg_overall || 0) > (sessionsByRoll.get(key)?.avg_overall || 0))) {
      sessionsByRoll.set(key, s);
    }
  }

  // Build unified list from registered students
  const registeredList = registeredStudents.map((st) => {
    const roll = (st.student_roll || "").toLowerCase();
    const session = sessionsByRoll.get(roll);
    return {
      name: st.student_name,
      roll: st.student_roll,
      email: st.student_email,
      phone: st.mobile_number,
      department: st.department,
      year: st.academic_year,
      section: st.section,
      avg_overall: session?.avg_overall ?? null,
      avg_accuracy: session?.avg_accuracy ?? null,
      avg_authenticity: session?.avg_authenticity ?? null,
      source: "registered",
    };
  });

  // Include session students not in the registered list (edge case: old sessions)
  const registeredRolls = new Set(registeredStudents.map((s) => (s.student_roll || "").toLowerCase()));
  const sessionOnly = Array.from(sessionsByRoll.values())
    .filter((s) => s.roll_number && !registeredRolls.has(s.roll_number.toLowerCase()))
    .map((s) => ({
      name: s.candidate_name || "Unnamed",
      roll: s.roll_number,
      email: s.candidate_email,
      phone: s.mobile_number,
      department: s.department || department,
      year: s.academic_year || year,
      section: null,
      avg_overall: s.avg_overall ?? null,
      avg_accuracy: s.avg_accuracy ?? null,
      avg_authenticity: s.avg_authenticity ?? null,
      source: "session",
    }));

  const allStudents = [...registeredList, ...sessionOnly];

  // Filter by search query
  const filtered = allStudents.filter((s) =>
    (s.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.roll || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {isGuest && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-xs flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <strong className="font-bold">Guest Faculty Limited Access:</strong> You are viewing read-only student data for department{" "}
            <span className="font-mono font-bold uppercase">{department || "General"}</span>. Student phone numbers are protected.
          </div>
        </div>
      )}

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-[#171717] flex items-center gap-3">
            <Users className="w-8 h-8 text-[#C8102E]" /> Students
          </h1>
          <p className="text-[#555555] mt-1 text-sm">
            Department: <strong className="text-[#171717] uppercase">{department || "Unassigned"}</strong> &bull; {year || "All Years"} &bull; Section {section || "All"}
            <span className="ml-3 inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {allStudents.length} students
            </span>
          </p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#AAAAAA]" />
          <input
            type="text"
            placeholder="Search student or roll no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-white border border-[#E5E5E5] rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-[#C8102E] transition w-64"
          />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
          <p className="text-[#555555] text-sm">Loading department student records...</p>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white border border-[#E5E5E5] rounded-3xl p-8 space-y-2">
            <Users className="w-12 h-12 text-[#AAAAAA] mx-auto mb-2" />
            <h3 className="font-bold text-[#171717]">No students found for {department?.toUpperCase()}</h3>
            <p className="text-xs text-[#777777]">
              Student records are strictly isolated. Only {department?.toUpperCase()} students appear here.
              {search && " Try clearing the search filter."}
            </p>
          </div>
        ) : (
          filtered.map((s, idx) => (
            <div key={idx} className="bg-white border border-[#E5E5E5] p-5 rounded-3xl hover:border-[#C8102E] hover:shadow-lg transition-all group relative cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl bg-[#FFF1F2] flex items-center justify-center text-lg font-bold text-[#C8102E]">
                  {(s.name || "U")[0].toUpperCase()}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] font-mono font-bold bg-[#F8F8F8] border border-[#E5E5E5] px-2 py-0.5 rounded text-[#555555] uppercase">
                    {s.department?.toUpperCase() || department?.toUpperCase() || "—"}
                  </span>
                  {s.section && (
                    <span className="text-[9px] font-bold bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded">
                      Sec {s.section}
                    </span>
                  )}
                </div>
              </div>

              <h3 className="font-bold text-[#171717] truncate">{s.name || "Unnamed Student"}</h3>
              <p className="text-xs font-mono text-[#C8102E] mt-0.5">{s.roll || "No Roll No."}</p>
              <p className="text-[10px] text-[#777777] mt-0.5">{s.year || year || "—"}</p>

              <div className="mt-2 text-[11px] text-[#777777] space-y-1">
                {s.email && (
                  <div className="flex items-center gap-1 truncate">
                    <Mail className="w-3 h-3 text-[#AAAAAA] shrink-0" />
                    <span className="truncate">{s.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-[#AAAAAA] shrink-0" />
                  <span>
                    {isGuest
                      ? "+91 ******" + (s.phone ? s.phone.slice(-4) : "0000")
                      : s.phone || "N/A"
                    }
                  </span>
                </div>
              </div>

              <div className="flex justify-between text-xs text-[#555555] border-t border-[#E5E5E5] pt-3 mt-4">
                {s.avg_overall !== null ? (
                  <>
                    <span className="flex flex-col">
                      Avg Score <strong className="text-[#171717]">{s.avg_overall.toFixed(1)}</strong>
                    </span>
                    <span className="flex flex-col text-right">
                      Accuracy <strong className="text-emerald-600">{s.avg_accuracy ? s.avg_accuracy.toFixed(0) : "—"}%</strong>
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] text-[#AAAAAA] flex items-center gap-1 col-span-2">
                    <BookOpen className="w-3 h-3" /> No exam attempt yet
                  </span>
                )}
              </div>

              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="w-5 h-5 text-[#C8102E]" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
