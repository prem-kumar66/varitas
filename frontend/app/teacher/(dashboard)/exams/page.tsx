"use client";
import { useState, useEffect } from "react";
import { useTeacherContext } from "@/components/teacher/TeacherProvider";
import { getTeacherAuthHeaders } from "@/lib/auth";
import { 
  BookOpen, 
  Search, 
  Filter, 
  Plus, 
  Clock, 
  Users, 
  FileText, 
  CheckCircle2, 
  HelpCircle, 
  Mic, 
  Edit3, 
  ChevronRight, 
  Eye, 
  X, 
  ArrowUpRight,
  Sparkles,
  Award
} from "lucide-react";
import Link from "next/link";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";

export default function TeacherExamsPage() {
  const { department, year, section } = useTeacherContext();
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMode, setSelectedMode] = useState<string>("all");
  const [selectedExamForModal, setSelectedExamForModal] = useState<any | null>(null);

  const fetchExams = () => {
    setLoading(true);
    const qp = new URLSearchParams();
    if (department) qp.set("department", department);
    fetch(`${BACKEND_HTTP}/api/assessments?${qp.toString()}`, { headers: getTeacherAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setAssessments(d.assessments || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchExams();
  }, [department]);

  const filteredExams = assessments.filter((a) => {
    const matchesSearch = 
      (a.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.subject || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.exam_id || "").toLowerCase().includes(search.toLowerCase());
    const matchesMode = selectedMode === "all" || a.mode === selectedMode;
    return matchesSearch && matchesMode;
  });

  const countQuiz = assessments.filter((a) => a.mode === "quiz").length;
  const countOral = assessments.filter((a) => a.mode === "oral").length;
  const countWritten = assessments.filter((a) => a.mode === "written").length;

  const modeBadgeStyle = (mode: string) => {
    switch (mode) {
      case "quiz":
        return "bg-rose-50 text-[#C8102E] border-rose-200";
      case "oral":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "written":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const modeIcon = (mode: string) => {
    switch (mode) {
      case "quiz":
        return <HelpCircle className="w-4 h-4 text-[#C8102E]" />;
      case "oral":
        return <Mic className="w-4 h-4 text-emerald-600" />;
      case "written":
        return <Edit3 className="w-4 h-4 text-indigo-600" />;
      default:
        return <FileText className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-[#171717] flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-[#C8102E]" /> Published Exams & History
            </h1>
            {department && (
              <span className="bg-[#FFF1F2] text-[#C8102E] border border-[#C8102E]/20 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                {department}
              </span>
            )}
          </div>
          <p className="text-[#555555] mt-1 text-sm">
            Monitor, inspect, and track all assessments published for students in your department.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/teacher/ai"
            className="bg-[#C8102E] hover:bg-[#A00D24] text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> Create New Exam
          </Link>
          <Link
            href="/teacher/evaluations"
            className="bg-white border border-[#E5E5E5] hover:border-[#C8102E] text-[#171717] px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition"
          >
            <Award className="w-4 h-4 text-[#C8102E]" /> View Student Results
          </Link>
        </div>
      </header>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-[#777777] uppercase tracking-wider block">Total Published</span>
          <div className="text-2xl font-black text-[#171717] mt-1">{assessments.length}</div>
          <span className="text-[11px] text-[#555555] mt-1 block">All evaluation formats</span>
        </div>

        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-[#777777] uppercase tracking-wider block flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#C8102E]" /> MCQ Quizzes
          </span>
          <div className="text-2xl font-black text-[#171717] mt-1">{countQuiz}</div>
          <span className="text-[11px] text-[#555555] mt-1 block">Objective assessments</span>
        </div>

        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-[#777777] uppercase tracking-wider block flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Oral Vivas
          </span>
          <div className="text-2xl font-black text-[#171717] mt-1">{countOral}</div>
          <span className="text-[11px] text-[#555555] mt-1 block">Speech & anti-cheat viva</span>
        </div>

        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-[#777777] uppercase tracking-wider block flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500" /> Written Tests
          </span>
          <div className="text-2xl font-black text-[#171717] mt-1">{countWritten}</div>
          <span className="text-[11px] text-[#555555] mt-1 block">Rubric-evaluated essays</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-[#E5E5E5] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        {/* Mode Filter Buttons */}
        <div className="flex items-center gap-2">
          {[
            { id: "all", label: "All Formats" },
            { id: "quiz", label: "MCQ Quiz" },
            { id: "oral", label: "Oral Viva" },
            { id: "written", label: "Written Test" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedMode(m.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                selectedMode === m.id
                  ? "bg-[#C8102E] text-white shadow-sm"
                  : "bg-[#F8F8F8] text-[#555555] hover:text-[#171717] hover:bg-[#EEEEEE]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#AAAAAA]" />
          <input
            type="text"
            placeholder="Search exams or subjects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-[#C8102E] transition"
          />
        </div>
      </div>

      {/* Exam List */}
      {loading ? (
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-12 text-center text-[#777777]">
          <div className="w-8 h-8 border-2 border-[#C8102E] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold">Loading exams...</p>
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="bg-white border border-[#E5E5E5] rounded-3xl p-12 text-center shadow-sm">
          <BookOpen className="w-12 h-12 text-[#AAAAAA] mx-auto mb-3" />
          <h3 className="text-lg font-bold text-[#171717]">No Exams Found</h3>
          <p className="text-xs text-[#777777] max-w-md mx-auto mt-1 mb-6">
            {search || selectedMode !== "all"
              ? "No assessments match your active search or mode filter."
              : `No exams have been published yet for ${department?.toUpperCase() || "your department"}.`}
          </p>
          <Link
            href="/teacher/ai"
            className="inline-flex items-center gap-2 bg-[#C8102E] hover:bg-[#A00D24] text-white px-5 py-2.5 rounded-xl font-bold text-xs transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> Create Assessment with AI
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExams.map((exam) => {
            const qCount = exam.questions?.length || 0;
            const formattedDate = exam.created_at
              ? new Date(exam.created_at * 1000).toLocaleString()
              : "—";

            return (
              <div
                key={exam.exam_id}
                className="bg-white border border-[#E5E5E5] rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-[#C8102E]/40 transition flex flex-col justify-between"
              >
                <div>
                  {/* Top row: Mode Badge & Target Section */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${modeBadgeStyle(
                        exam.mode
                      )}`}
                    >
                      {modeIcon(exam.mode)}
                      {exam.mode === "quiz" ? "MCQ Quiz" : exam.mode === "oral" ? "Oral Viva" : "Written"}
                    </span>
                    <span className="text-[11px] font-semibold text-[#777777] bg-[#F8F8F8] px-2 py-0.5 rounded-lg border border-[#E5E5E5]">
                      {exam.section ? `Sec ${exam.section}` : "All Sections"}
                    </span>
                  </div>

                  {/* Exam Title & Subject */}
                  <h3 className="font-bold text-base text-[#171717] leading-snug line-clamp-1">
                    {exam.name || "Untitled Assessment"}
                  </h3>
                  <p className="text-xs text-[#555555] mt-1 font-medium">
                    {exam.subject || "General"} {exam.unit ? `· Unit ${exam.unit}` : ""}
                  </p>

                  {/* Metadata Chips */}
                  <div className="mt-4 pt-3 border-t border-[#F0F0F0] grid grid-cols-2 gap-2 text-xs text-[#666666]">
                    <div>
                      <span className="text-[10px] text-[#999999] uppercase font-bold block">Target</span>
                      <span className="font-semibold text-[#171717]">
                        {exam.year || "All Years"} · {exam.department?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#999999] uppercase font-bold block">Questions</span>
                      <span className="font-semibold text-[#171717]">{qCount} Questions</span>
                    </div>
                  </div>

                  <div className="mt-2 text-[11px] text-[#888888] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#AAAAAA]" />
                    <span>{formattedDate}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-5 pt-3 border-t border-[#F0F0F0] flex items-center gap-2">
                  <button
                    onClick={() => setSelectedExamForModal(exam)}
                    className="flex-1 bg-[#F8F8F8] hover:bg-[#ECECEC] text-[#171717] py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#C8102E]" /> Preview Questions
                  </button>
                  <Link
                    href="/teacher/evaluations"
                    className="p-2 rounded-xl bg-white border border-[#E5E5E5] hover:border-[#C8102E] text-[#555555] hover:text-[#C8102E] transition"
                    title="View Submissions"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Preview Exam Questions */}
      {selectedExamForModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-[#E5E5E5] overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#E5E5E5] flex items-start justify-between bg-[#F8F8F8]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${modeBadgeStyle(
                      selectedExamForModal.mode
                    )}`}
                  >
                    {modeIcon(selectedExamForModal.mode)}
                    {selectedExamForModal.mode}
                  </span>
                  <span className="text-xs font-semibold text-[#777777]">
                    {selectedExamForModal.department?.toUpperCase()} · {selectedExamForModal.year || "All"}
                  </span>
                </div>
                <h3 className="font-extrabold text-lg text-[#171717]">
                  {selectedExamForModal.name}
                </h3>
                <p className="text-xs text-[#555555]">
                  Subject: {selectedExamForModal.subject || "General"} · ID: <span className="font-mono text-[#777777]">{selectedExamForModal.exam_id}</span>
                </p>
              </div>

              <button
                onClick={() => setSelectedExamForModal(null)}
                className="p-2 rounded-full hover:bg-slate-200 text-[#777777] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Questions Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {(!selectedExamForModal.questions || selectedExamForModal.questions.length === 0) ? (
                <p className="text-center text-sm text-[#777777] py-8">
                  No questions found in this assessment record.
                </p>
              ) : (
                selectedExamForModal.questions.map((q: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold text-[#171717]">
                      <span className="text-[#C8102E]">Question {idx + 1}</span>
                      {q.max_marks && <span className="text-[#777777]">{q.max_marks} marks</span>}
                    </div>

                    <p className="font-semibold text-[#171717] text-sm">
                      {q.question || q.question_text || "Question content"}
                    </p>

                    {/* Options if MCQ */}
                    {q.options && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {Object.entries(q.options).map(([k, v]) => (
                          <div
                            key={k}
                            className={`p-2 rounded-lg border text-[11px] ${
                              q.correct_answer === k
                                ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold"
                                : "bg-white border-[#E5E5E5] text-[#444444]"
                            }`}
                          >
                            <span className="font-mono mr-1.5">{k}:</span> {String(v)}
                            {q.correct_answer === k && " ✓"}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reference Answer if Oral/Written */}
                    {q.reference_answer && (
                      <div className="bg-white p-2.5 rounded-lg border border-[#E5E5E5] text-[11px] text-[#444444] mt-2">
                        <strong className="text-[#171717] block mb-0.5">Reference / Model Answer:</strong>
                        {q.reference_answer}
                      </div>
                    )}

                    {/* Rubric keywords */}
                    {q.rubric_keywords && q.rubric_keywords.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap pt-1">
                        <span className="text-[10px] text-[#777777] font-bold">Keywords:</span>
                        {q.rubric_keywords.map((kw: string, kidx: number) => (
                          <span
                            key={kidx}
                            className="bg-slate-200 text-slate-800 text-[10px] px-2 py-0.5 rounded-md font-medium"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#E5E5E5] bg-[#F8F8F8] flex justify-end">
              <button
                onClick={() => setSelectedExamForModal(null)}
                className="bg-[#171717] hover:bg-[#333333] text-white px-5 py-2 rounded-xl text-xs font-bold transition"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
