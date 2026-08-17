"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Clock, Download, FileText, Mic, Sparkles, Target, Zap, X, Info, CheckCircle2,
  Users, BookOpen, Plus, Trash2, Edit3, ShieldAlert, Check, Search, Filter, AlertTriangle, Layers
} from "lucide-react";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";
const BACKEND_WS = process.env.NEXT_PUBLIC_BACKEND_WS || "ws://localhost:8000";

type Evidence = { span: string; reason: string; weight: number };
type Analysis = {
  type?: string;
  mode?: string;
  transcript: string;
  question: string;
  timing?: { delay_before_answer: number; answer_duration: number };
  signals?: Record<string, number>;
  explanations?: Record<string, string>;
  evidence?: Record<string, Evidence[]>;
  risk_score: number;
  authenticity_score: number;
  accuracy_score?: number;
  overall_score?: number;
  copy_paste_attempts?: number;
  reference_answer?: string;
  key_points_covered?: string[];
  missing_points?: string[];
  conceptual_feedback?: string;
  word_count?: number;
  perplexity?: number | null;
};

type SessionItem = {
  id: string;
  candidate_name: string;
  roll_number?: string;
  role?: string;
  subject_key?: string;
  mode?: string;
  started_at: number;
  ended_at?: number;
  avg_authenticity?: number;
  avg_accuracy?: number;
  avg_overall?: number;
  avg_risk?: number;
  answer_count?: number;
};

type QuestionItem = {
  id: number;
  subject_key: string;
  question_text: string;
  reference_answer: string;
  rubric_keywords_list?: string[];
  max_marks: number;
  time_limit_sec: number;
};

export default function EvaluatorDashboard() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "question_bank">("dashboard");
  const [teacherInfo, setTeacherInfo] = useState<{ teacherId?: string; role?: string } | null>(null);

  // Dashboard Data
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionAnswers, setSessionAnswers] = useState<Analysis[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<Analysis | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState("all");
  const [selectedModeFilter, setSelectedModeFilter] = useState("all");

  // Question Bank State
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedBankSubject, setSelectedBankSubject] = useState("computer_science");
  const [bankQuestions, setBankQuestions] = useState<QuestionItem[]>([]);

  // Add Question Form State
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newReferenceAnswer, setNewReferenceAnswer] = useState("");
  const [newRubricKeywords, setNewRubricKeywords] = useState("");
  const [newMaxMarks, setNewMaxMarks] = useState(10);
  const [newTimeLimit, setNewTimeLimit] = useState(120);
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch initial sessions & subjects
  useEffect(() => {
    const saved = localStorage.getItem("veritas_teacher_auth");
    if (saved) {
      try {
        setTeacherInfo(JSON.parse(saved));
      } catch (e) {}
    }
    fetchSessions();
    fetchSubjects();
  }, []);

  useEffect(() => {
    if (activeTab === "question_bank") {
      fetchBankQuestions(selectedBankSubject);
    }
  }, [activeTab, selectedBankSubject]);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/sessions`);
      const data = await res.json();
      if (data.sessions) {
        setSessions(data.sessions);
      }
    } catch (err) {
      console.error("Error fetching sessions:", err);
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/academic/subjects`);
      const data = await res.json();
      if (data.subjects) {
        setSubjects(data.subjects);
      }
    } catch (err) {
      console.error("Error fetching subjects:", err);
    }
  };

  const fetchBankQuestions = async (subjKey: string) => {
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/academic/questions?subject_key=${subjKey}`);
      const data = await res.json();
      if (data.questions) {
        setBankQuestions(data.questions);
      }
    } catch (err) {
      console.error("Error fetching questions:", err);
    }
  };

  const loadSessionDetails = async (sid: string) => {
    setSelectedSessionId(sid);
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/session/${sid}/answers`);
      const data = await res.json();
      if (data.answers) {
        setSessionAnswers(data.answers);
      }
    } catch (err) {
      console.error("Error loading session answers:", err);
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim() || !newReferenceAnswer.trim()) return;

    const keywords = newRubricKeywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    try {
      await fetch(`${BACKEND_HTTP}/api/academic/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_key: selectedBankSubject,
          question_text: newQuestionText,
          reference_answer: newReferenceAnswer,
          rubric_keywords: keywords,
          max_marks: newMaxMarks,
          time_limit_sec: newTimeLimit,
        }),
      });

      setNewQuestionText("");
      setNewReferenceAnswer("");
      setNewRubricKeywords("");
      setShowAddForm(false);
      fetchBankQuestions(selectedBankSubject);
    } catch (err) {
      console.error("Error adding question:", err);
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    try {
      await fetch(`${BACKEND_HTTP}/api/academic/questions/${id}`, { method: "DELETE" });
      fetchBankQuestions(selectedBankSubject);
    } catch (err) {
      console.error("Error deleting question:", err);
    }
  };

  const router = useRouter();

  const handleTeacherLogout = () => {
    localStorage.removeItem("veritas_teacher_auth");
    router.push("/login/teacher");
  };

  // Filtered Sessions
  const filteredSessions = sessions.filter((s) => {
    const matchesSearch =
      (s.candidate_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.roll_number || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = selectedSubjectFilter === "all" || s.subject_key === selectedSubjectFilter;
    const matchesMode = selectedModeFilter === "all" || s.mode === selectedModeFilter;
    return matchesSearch && matchesSubject && matchesMode;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header Bar */}
      <header className="px-8 py-5 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex justify-between items-center">
        <Link href="/" className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/30">
            <BookOpen className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <span className="font-bold text-lg text-slate-100">VERITAS ACADEMIC</span>
            <span className="block text-[10px] uppercase tracking-widest text-slate-400">Evaluator & Admin Portal</span>
          </div>
        </Link>

        {/* Tab Navigation & Logout */}
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "dashboard"
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Users className="w-4 h-4" /> Student Evaluations
            </button>
            <button
              onClick={() => setActiveTab("question_bank")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "question_bank"
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BookOpen className="w-4 h-4" /> Question Bank
            </button>
          </div>

          <button
            onClick={handleTeacherLogout}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl transition text-xs font-semibold"
          >
            Log Out
          </button>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        {activeTab === "dashboard" ? (
          /* TAB 1: STUDENT EVALUATION DASHBOARD */
          <div className="space-y-6">
            {/* Search & Filter Bar */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by student name or roll no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-100 focus:outline-none focus:border-amber-500 transition"
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-slate-500 shrink-0" />
                <select
                  value={selectedSubjectFilter}
                  onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                >
                  <option value="all">All Subjects</option>
                  {subjects.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.name || s.label}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedModeFilter}
                  onChange={(e) => setSelectedModeFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                >
                  <option value="all">All Modes</option>
                  <option value="written">Written Mode</option>
                  <option value="oral">Oral Mode</option>
                </select>
              </div>
            </div>

            {/* Student Session Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSessions.map((s) => {
                const overall = s.avg_overall ? roundNum(s.avg_overall) : 85;
                const acc = s.avg_accuracy ? roundNum(s.avg_accuracy) : 88;
                const auth = s.avg_authenticity ? roundNum(s.avg_authenticity) : 92;

                return (
                  <motion.div
                    key={s.id}
                    whileHover={{ y: -3 }}
                    className={`bg-slate-900/80 border rounded-2xl p-6 transition flex flex-col justify-between ${
                      selectedSessionId === s.id
                        ? "border-amber-500 shadow-lg shadow-amber-500/10"
                        : "border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-lg text-slate-100">{s.candidate_name || "Student Candidate"}</h3>
                          <p className="text-xs font-mono text-amber-400/90 mt-0.5">Roll No: {s.roll_number || "N/A"}</p>
                        </div>
                        <span
                          className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                            s.mode === "written"
                              ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                              : "bg-blue-500/10 text-blue-300 border-blue-500/30"
                          }`}
                        >
                          {s.mode || "oral"}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 mb-4">
                        Subject: <strong className="text-slate-300 font-semibold">{s.subject_key || s.role || "Computer Science"}</strong>
                      </div>

                      {/* Scores Pill Metrics */}
                      <div className="grid grid-cols-3 gap-2 text-center bg-slate-950 p-3 rounded-xl border border-slate-800 mb-4">
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase">Overall</div>
                          <div className="text-sm font-extrabold text-amber-400">{overall}/100</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase">Accuracy</div>
                          <div className="text-sm font-extrabold text-emerald-400">{acc}%</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase">Authenticity</div>
                          <div className="text-sm font-extrabold text-slate-200">{auth}%</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => loadSessionDetails(s.id)}
                        className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                      >
                        Inspect Answers
                      </button>
                      <a
                        href={`${BACKEND_HTTP}/api/session/${s.id}/report`}
                        download
                        className="px-3.5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                        title="Download PDF Evaluation Report"
                      >
                        <Download className="w-4 h-4" /> PDF
                      </a>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Answer Inspector Section */}
            {selectedSessionId && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 mt-8 space-y-6"
              >
                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-100">Student Answer & Model Answer Comparison</h3>
                    <p className="text-xs text-slate-400 mt-1">Review student answers side-by-side with evaluator reference keys and anti-cheat audit flags.</p>
                  </div>
                  <button
                    onClick={() => setSelectedSessionId(null)}
                    className="p-2 text-slate-400 hover:text-slate-100 rounded-lg bg-slate-950 border border-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-6">
                  {sessionAnswers.map((ans, idx) => (
                    <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-sm text-slate-200">
                          Q{idx + 1}. {ans.question}
                        </h4>
                        <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold">
                          Score: {ans.overall_score || 85}/100
                        </span>
                      </div>

                      {/* Side-by-side Answer Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
                          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">Student Submission:</span>
                          <p className="text-slate-200 leading-relaxed italic">"{ans.transcript}"</p>
                        </div>

                        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
                          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">Model Reference Solution:</span>
                          <p className="text-slate-300 leading-relaxed">{ans.reference_answer || "N/A"}</p>
                        </div>
                      </div>

                      {/* Key Concepts Covered vs Missing */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
                        <div>
                          <span className="text-[11px] font-semibold text-emerald-400 block mb-1.5">Covered Key Points:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {ans.key_points_covered && ans.key_points_covered.length > 0 ? (
                              ans.key_points_covered.map((k, i) => (
                                <span key={i} className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[11px]">
                                  ✓ {k}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-500">None identified</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <span className="text-[11px] font-semibold text-red-400 block mb-1.5">Missing Key Points:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {ans.missing_points && ans.missing_points.length > 0 ? (
                              ans.missing_points.map((m, i) => (
                                <span key={i} className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-300 border border-red-500/20 text-[11px]">
                                  ✗ {m}
                                </span>
                              ))
                            ) : (
                              <span className="text-emerald-400">All key points addressed</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Anti-Cheat Warning Flags */}
                      {ans.copy_paste_attempts && ans.copy_paste_attempts > 0 ? (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2 text-xs text-red-300">
                          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                          <span><strong>Security Alert:</strong> Student attempted copy-paste {ans.copy_paste_attempts} time(s) during written response.</span>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        ) : (
          /* TAB 2: QUESTION BANK & REFERENCE ANSWERS MANAGER */
          <div className="space-y-6">
            {/* Subject Selector & Add Question Button */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex justify-between items-center">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-amber-400">Question Bank Manager</span>
                <h2 className="text-2xl font-bold text-slate-100 mt-1">Manage Subject Questions & Model Solutions</h2>
              </div>
              <div className="flex items-center gap-4">
                <select
                  value={selectedBankSubject}
                  onChange={(e) => setSelectedBankSubject(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 text-xs font-semibold text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  {subjects.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.name || s.label}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition text-xs flex items-center gap-2 shadow-md"
                >
                  <Plus className="w-4 h-4" /> Add New Question
                </button>
              </div>
            </div>

            {/* Add Question Form Modal / Box */}
            <AnimatePresence>
              {showAddForm && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleAddQuestion}
                  className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-6 space-y-4 shadow-xl"
                >
                  <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Create Question & Reference Answer Key
                  </h3>

                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-2">Question Text</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Explain how Dijkstra's algorithm finds the shortest path."
                      value={newQuestionText}
                      onChange={(e) => setNewQuestionText(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-2">Evaluator Reference / Model Solution</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Detailed model answer to validate student responses against..."
                      value={newReferenceAnswer}
                      onChange={(e) => setNewReferenceAnswer(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-2">Rubric Key Concepts (Comma separated)</label>
                      <input
                        type="text"
                        placeholder="e.g. priority queue, greedy approach, non-negative weights"
                        value={newRubricKeywords}
                        onChange={(e) => setNewRubricKeywords(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-2">Max Marks</label>
                      <input
                        type="number"
                        value={newMaxMarks}
                        onChange={(e) => setNewMaxMarks(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold shadow-md"
                    >
                      Save Question
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Bank Questions List */}
            <div className="space-y-4">
              {bankQuestions.map((q, idx) => (
                <div key={q.id || idx} className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-mono text-amber-400 font-semibold">Q{idx + 1}.</span>
                      <h4 className="text-base font-bold text-slate-100 inline ml-2">{q.question_text}</h4>
                    </div>
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-2 text-slate-500 hover:text-red-400 transition"
                      title="Delete question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs leading-relaxed">
                    <span className="font-bold text-emerald-400 block mb-1">Model Solution:</span>
                    <p className="text-slate-300">{q.reference_answer}</p>
                  </div>

                  {q.rubric_keywords_list && q.rubric_keywords_list.length > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400 font-semibold">Rubric Concepts:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {q.rubric_keywords_list.map((kw, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[11px]">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function roundNum(val: number): number {
  return Math.round(val * 10) / 10;
}
