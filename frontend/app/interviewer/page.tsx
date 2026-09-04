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
type Citation = {
  source_ref?: string;
  topic?: string;
  quote_snippet?: string;
  verdict?: string;
  source?: string;
  page?: number;
  similarity?: number;
};

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
  faithfulness_score?: number;
  rag_grounded?: boolean;
  citations?: Citation[];
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
  const [activeTab, setActiveTab] = useState<"dashboard" | "question_bank" | "rag_documents">("dashboard");
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
  const [selectedBankSubject, setSelectedBankSubject] = useState("ai_ml");
  const [bankQuestions, setBankQuestions] = useState<QuestionItem[]>([]);

  // Add Question Form State
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newReferenceAnswer, setNewReferenceAnswer] = useState("");
  const [newRubricKeywords, setNewRubricKeywords] = useState("");
  const [newMaxMarks, setNewMaxMarks] = useState(10);
  const [newTimeLimit, setNewTimeLimit] = useState(120);
  const [showAddForm, setShowAddForm] = useState(false);

  // RAG Knowledge Hub State
  const [ragSubject, setRagSubject] = useState("ai_ml");
  const [ragSources, setRagSources] = useState<any[]>([]);
  const [isUploadingRag, setIsUploadingRag] = useState(false);
  const [ragUploadMsg, setRagUploadMsg] = useState("");
  const [ragTestQuery, setRagTestQuery] = useState("");
  const [ragTestResults, setRagTestResults] = useState<any[]>([]);
  const [isSearchingRag, setIsSearchingRag] = useState(false);
  const [ragEvalStudentAnswer, setRagEvalStudentAnswer] = useState("");
  const [ragEvalResult, setRagEvalResult] = useState<any | null>(null);
  const [isEvaluatingRag, setIsEvaluatingRag] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    fetchRagSources();
  }, []);

  useEffect(() => {
    if (activeTab === "question_bank") {
      fetchBankQuestions(selectedBankSubject);
    } else if (activeTab === "rag_documents") {
      fetchRagSources();
    }
  }, [activeTab, selectedBankSubject]);

  const fetchRagSources = async () => {
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/rag/documents`);
      const data = await res.json();
      if (data.sources) setRagSources(data.sources);
    } catch (e) {
      console.error("Error fetching RAG sources:", e);
    }
  };

  const handleUploadRagDoc = async (file: File) => {
    if (!file) return;
    setIsUploadingRag(true);
    setRagUploadMsg("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("subject_key", ragSubject);
      const res = await fetch(`${BACKEND_HTTP}/api/rag/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setRagUploadMsg(`✓ Successfully indexed ${data.chunks_added} chunks for '${data.filename}' into '${data.subject_key}'`);
        fetchRagSources();
      } else {
        setRagUploadMsg(`✗ Upload failed: ${data.detail || "Error"}`);
      }
    } catch (e: any) {
      setRagUploadMsg(`✗ Error: ${e.message}`);
    } finally {
      setIsUploadingRag(false);
    }
  };

  const handleTestRagQuery = async () => {
    if (!ragTestQuery.trim()) return;
    setIsSearchingRag(true);
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/rag/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: ragTestQuery,
          subject_key: ragSubject === "all" ? undefined : ragSubject,
          top_k: 3,
        }),
      });
      const data = await res.json();
      if (data.results) setRagTestResults(data.results);
    } catch (e) {
      console.error("Error testing RAG query:", e);
    } finally {
      setIsSearchingRag(false);
    }
  };

  const handleRunRagEval = async () => {
    if (!ragTestQuery.trim() || !ragEvalStudentAnswer.trim()) return;
    setIsEvaluatingRag(true);
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/rag/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: ragTestQuery,
          student_answer: ragEvalStudentAnswer,
          subject_key: ragSubject === "all" ? undefined : ragSubject,
        }),
      });
      const data = await res.json();
      if (data.evaluation) setRagEvalResult(data.evaluation);
    } catch (e) {
      console.error("Error running RAG eval:", e);
    } finally {
      setIsEvaluatingRag(false);
    }
  };

  const handleClearRagIndex = async (subj: string) => {
    try {
      await fetch(`${BACKEND_HTTP}/api/rag/clear/${subj}`, { method: "DELETE" });
      fetchRagSources();
    } catch (e) {
      console.error("Error clearing RAG index:", e);
    }
  };

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
    <div className="min-h-screen bg-[#F8F8F8] text-[#171717] flex flex-col font-sans">
      {/* Header Bar */}
      <header className="px-8 py-5 border-b border-[#E5E5E5] bg-white backdrop-blur-md flex justify-between items-center">
        <Link href="/" className="flex items-center gap-3">
          <div className="p-2 bg-[#FFF1F2] rounded-lg border border-[#C8102E]/30">
            <BookOpen className="w-5 h-5 text-[#C8102E]" />
          </div>
          <div>
            <span className="font-bold text-lg text-[#171717]">VERITAS ACADEMIC</span>
            <span className="block text-[10px] uppercase tracking-widest text-[#555555]">Evaluator & Admin Portal</span>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <div className="flex bg-[#F8F8F8] p-1.5 rounded-xl border border-[#E5E5E5]">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "dashboard"
                  ? "bg-[#C8102E] text-slate-950 shadow-md"
                  : "text-[#555555] hover:text-[#171717]"
              }`}
            >
              <Users className="w-4 h-4" /> Student Evaluations
            </button>
            <button
              onClick={() => setActiveTab("question_bank")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "question_bank"
                  ? "bg-[#C8102E] text-slate-950 shadow-md"
                  : "text-[#555555] hover:text-[#171717]"
              }`}
            >
              <BookOpen className="w-4 h-4" /> Question Bank
            </button>
            <button
              onClick={() => setActiveTab("rag_documents")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "rag_documents"
                  ? "bg-gradient-to-r from-[#C8102E] to-[#A50E25] text-slate-950 shadow-md"
                  : "text-[#555555] hover:text-[#171717]"
              }`}
            >
              <Layers className="w-4 h-4" /> Syllabus & RAG Knowledge Hub
            </button>
          </div>

          <button
            onClick={handleTeacherLogout}
            className="px-3.5 py-2 bg-white hover:bg-[#E5E5E5] text-[#555555] border border-[#D4D4D4] rounded-xl transition text-xs font-semibold"
          >
            Log Out
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        {activeTab === "dashboard" ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 backdrop-blur-sm">
                <span className="text-xs uppercase tracking-wider font-semibold text-[#555555]">Total Evaluations</span>
                <div className="text-3xl font-extrabold text-[#171717] mt-2">{sessions.length}</div>
              </div>
              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 backdrop-blur-sm">
                <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400">Avg Authenticity</span>
                <div className="text-3xl font-extrabold text-emerald-400 mt-2">
                  {sessions.length > 0
                    ? roundNum(sessions.reduce((acc, s) => acc + (s.avg_authenticity || 80), 0) / sessions.length)
                    : 0}
                  %
                </div>
              </div>
              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 backdrop-blur-sm">
                <span className="text-xs uppercase tracking-wider font-semibold text-[#C8102E]">Avg Conceptual Accuracy</span>
                <div className="text-3xl font-extrabold text-[#C8102E] mt-2">
                  {sessions.length > 0
                    ? roundNum(sessions.reduce((acc, s) => acc + (s.avg_accuracy || 75), 0) / sessions.length)
                    : 0}
                  %
                </div>
              </div>
              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 backdrop-blur-sm">
                <span className="text-xs uppercase tracking-wider font-semibold text-[#C8102E]">RAG Knowledge Base</span>
                <div className="text-3xl font-extrabold text-[#C8102E] mt-2">
                  {ragSources.reduce((acc, s) => acc + (s.total_chunks || 0), 0)} Chunks
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#E5E5E5] rounded-2xl p-4 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-[#555555]" />
                <input
                  type="text"
                  placeholder="Search by student name or roll number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-xs text-[#171717] placeholder-slate-500 focus:outline-none w-full"
                />
              </div>

              <div className="flex items-center gap-3">
                <Filter className="w-4 h-4 text-[#555555]" />
                <select
                  value={selectedSubjectFilter}
                  onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                  className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2 px-3 text-xs text-[#555555] focus:outline-none focus:border-[#C8102E]"
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
                  className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2 px-3 text-xs text-[#555555] focus:outline-none focus:border-[#C8102E]"
                >
                  <option value="all">All Modes</option>
                  <option value="oral">Oral Interview</option>
                  <option value="written">Written Quiz</option>
                </select>
              </div>
            </div>

            <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E5E5E5] bg-[#F8F8F8]/40 text-[#555555] uppercase tracking-wider font-semibold">
                    <th className="p-4">Student</th>
                    <th className="p-4">Roll No.</th>
                    <th className="p-4">Subject</th>
                    <th className="p-4">Mode</th>
                    <th className="p-4">Authenticity</th>
                    <th className="p-4">Accuracy</th>
                    <th className="p-4">Final Score</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredSessions.map((s) => (
                    <tr key={s.id} className="hover:bg-[#E5E5E5]/30 transition">
                      <td className="p-4 font-semibold text-[#171717]">{s.candidate_name || "Anonymous"}</td>
                      <td className="p-4 font-mono text-[#555555]">{s.roll_number || "N/A"}</td>
                      <td className="p-4 capitalize text-[#555555]">{(s.subject_key || "General").replace(/_/g, " ")}</td>
                      <td className="p-4 capitalize">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            s.mode === "written"
                              ? "bg-[#FFF1F2] text-[#C8102E] border border-[#C8102E]/30"
                              : "bg-[#FFF1F2] text-[#C8102E] border border-[#C8102E]/30"
                          }`}
                        >
                          {s.mode || "oral"}
                        </span>
                      </td>
                      <td className="p-4 text-emerald-400 font-bold">{roundNum(s.avg_authenticity || 80)}%</td>
                      <td className="p-4 text-[#C8102E] font-bold">{roundNum(s.avg_accuracy || 75)}%</td>
                      <td className="p-4 font-extrabold text-[#171717]">{roundNum(s.avg_overall || 78)}/100</td>
                      <td className="p-4 text-right flex items-center justify-end gap-2">
                        <button
                          onClick={() => loadSessionDetails(s.id)}
                          className="px-3 py-1.5 bg-[#E5E5E5] hover:bg-[#D4D4D4] text-[#171717] rounded-lg text-xs font-semibold transition"
                        >
                          View Answers
                        </button>
                        <a
                          href={`${BACKEND_HTTP}/api/session/${s.id}/report`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 bg-[#FFF1F2] hover:bg-[#FFF1F2] text-[#C8102E] rounded-lg border border-[#C8102E]/30 transition"
                          title="Download PDF Report"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                  ))}
                  {filteredSessions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-[#555555]">
                        No evaluation sessions found matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {selectedSessionId && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-[#C8102E]/30 rounded-2xl p-6 shadow-2xl space-y-6"
              >
                <div className="flex justify-between items-center border-b border-[#E5E5E5] pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-[#171717] flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-[#C8102E]" />
                      Session Answer Key & Integrity Audit
                    </h3>
                    <p className="text-xs text-[#555555] mt-1">Review student answers side-by-side with evaluator reference keys, RAG citations, and anti-cheat audit flags.</p>
                  </div>
                  <button
                    onClick={() => setSelectedSessionId(null)}
                    className="p-2 text-[#555555] hover:text-[#171717] rounded-lg bg-[#F8F8F8] border border-[#E5E5E5]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-6">
                  {sessionAnswers.map((ans, idx) => (
                    <div key={idx} className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl p-5 space-y-4">
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <h4 className="font-bold text-sm text-[#171717]">
                          Q{idx + 1}. {ans.question}
                        </h4>
                        <div className="flex items-center gap-2">
                          {ans.rag_grounded && (
                            <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> RAG Grounded ({roundNum(ans.faithfulness_score || 85)}% Faithfulness)
                            </span>
                          )}
                          <span className="text-xs px-2.5 py-1 rounded-full bg-[#FFF1F2] text-[#C8102E] border border-[#C8102E]/30 font-semibold">
                            Score: {ans.overall_score || 85}/100
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="bg-white p-4 rounded-xl border border-[#E5E5E5] space-y-2">
                          <span className="text-[11px] font-bold text-[#C8102E] uppercase tracking-wider block">Student Submission:</span>
                          <p className="text-[#171717] leading-relaxed italic">"{ans.transcript}"</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-[#E5E5E5] space-y-2">
                          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">Model Reference Solution:</span>
                          <p className="text-[#555555] leading-relaxed">{ans.reference_answer || "N/A"}</p>
                        </div>
                      </div>

                      {ans.citations && ans.citations.length > 0 && (
                        <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-4 space-y-2">
                          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5" /> Retrieved Document Citations & Context:
                          </span>
                          <div className="space-y-1.5">
                            {ans.citations.map((cit, cidx) => (
                              <div key={cidx} className="text-xs text-[#555555] bg-[#F8F8F8]/60 p-2.5 rounded-lg border border-[#E5E5E5]">
                                <div className="flex justify-between items-center text-[11px] font-semibold text-emerald-300 mb-1">
                                  <span>{cit.source ? `${cit.source} (p. ${cit.page || 1})` : (cit.source_ref || "Knowledge Base Chunk")}</span>
                                  <span className="text-[#555555] capitalize">{cit.verdict || "Verified"}</span>
                                </div>
                                <p className="italic text-[#555555]">"{cit.quote_snippet || cit.topic}"</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

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
                              <span className="text-[#555555]">None identified</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {ans.conceptual_feedback && (
                        <div className="text-xs bg-white p-3 rounded-lg border border-[#E5E5E5] text-[#555555]">
                          <strong className="text-[#C8102E]">Feedback: </strong> {ans.conceptual_feedback}
                        </div>
                      )}

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
        ) : activeTab === "question_bank" ? (
          <div className="space-y-6">
            <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 flex justify-between items-center">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-[#C8102E]">Question Bank Manager</span>
                <h2 className="text-2xl font-bold text-[#171717] mt-1">Manage Subject Questions & Model Solutions</h2>
              </div>
              <div className="flex items-center gap-4">
                <select
                  value={selectedBankSubject}
                  onChange={(e) => setSelectedBankSubject(e.target.value)}
                  className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 px-4 text-xs font-semibold text-[#171717] focus:outline-none focus:border-[#C8102E]"
                >
                  {subjects.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.name || s.label}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="px-4 py-2.5 bg-[#C8102E] hover:bg-[#A50E25] text-slate-950 font-bold rounded-xl transition text-xs flex items-center gap-2 shadow-md"
                >
                  <Plus className="w-4 h-4" /> Add New Question
                </button>
              </div>
            </div>

            <AnimatePresence>
              {showAddForm && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleAddQuestion}
                  className="bg-white border border-[#C8102E]/30 rounded-2xl p-6 space-y-4 shadow-xl"
                >
                  <h3 className="text-base font-bold text-[#C8102E] flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Create Question & Reference Answer Key
                  </h3>

                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-2">Question Text</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Explain how Dijkstra's algorithm finds the shortest path."
                      value={newQuestionText}
                      onChange={(e) => setNewQuestionText(e.target.value)}
                      className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl p-3 text-xs text-[#171717] focus:outline-none focus:border-[#C8102E]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-2">Evaluator Reference / Model Solution</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Detailed model answer to validate student responses against..."
                      value={newReferenceAnswer}
                      onChange={(e) => setNewReferenceAnswer(e.target.value)}
                      className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl p-3 text-xs text-[#171717] focus:outline-none focus:border-[#C8102E]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-2">Rubric Key Concepts (Comma separated)</label>
                      <input
                        type="text"
                        placeholder="e.g. priority queue, greedy approach, non-negative weights"
                        value={newRubricKeywords}
                        onChange={(e) => setNewRubricKeywords(e.target.value)}
                        className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl p-3 text-xs text-[#171717] focus:outline-none focus:border-[#C8102E]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-2">Max Marks</label>
                      <input
                        type="number"
                        value={newMaxMarks}
                        onChange={(e) => setNewMaxMarks(Number(e.target.value))}
                        className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl p-3 text-xs text-[#171717] focus:outline-none focus:border-[#C8102E]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 bg-[#E5E5E5] text-[#555555] rounded-xl text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-[#C8102E] hover:bg-[#A50E25] text-slate-950 rounded-xl text-xs font-bold shadow-md"
                    >
                      Save Question
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="space-y-4">
              {bankQuestions.map((q, idx) => (
                <div key={q.id || idx} className="bg-white border border-[#E5E5E5] rounded-xl p-6 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-mono text-[#C8102E] font-semibold">Q{idx + 1}.</span>
                      <h4 className="text-base font-bold text-[#171717] inline ml-2">{q.question_text}</h4>
                    </div>
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-2 text-[#555555] hover:text-red-400 transition"
                      title="Delete question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="bg-[#F8F8F8] p-4 rounded-xl border border-[#E5E5E5] text-xs leading-relaxed">
                    <span className="font-bold text-emerald-400 block mb-1">Model Solution:</span>
                    <p className="text-[#555555]">{q.reference_answer}</p>
                  </div>

                  {q.rubric_keywords_list && q.rubric_keywords_list.length > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[#555555] font-semibold">Rubric Concepts:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {q.rubric_keywords_list.map((kw, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-md bg-[#FFF1F2] text-[#C8102E] border border-[#C8102E]/20 text-[11px]">
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
        ) : (
          <div className="space-y-6">
            <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 space-y-6">
              <div className="flex justify-between items-start flex-wrap gap-4">
                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> Smart-Vision RAG Knowledge Engine
                  </span>
                  <h2 className="text-2xl font-bold text-[#171717] mt-1">Syllabus Ingestion & Document Vector Store</h2>
                  <p className="text-xs text-[#555555] mt-1">
                    Upload course syllabus PDFs, lecture slides, textbooks, or rubric documents to ground candidate grading in authoritative material.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-[#555555]">Target Subject:</span>
                  <select
                    value={ragSubject}
                    onChange={(e) => setRagSubject(e.target.value)}
                    className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2 px-3 text-xs font-semibold text-[#171717] focus:outline-none focus:border-emerald-500"
                  >
                    <option value="global">Global (All Subjects)</option>
                    {subjects.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.name || s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-2 border-dashed border-[#E5E5E5] hover:border-emerald-500/50 rounded-2xl p-8 text-center transition bg-[#F8F8F8]/40">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.txt,.md"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleUploadRagDoc(e.target.files[0]);
                    }
                  }}
                />
                <div className="max-w-md mx-auto space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-sm text-[#171717]">Upload Course Material or Syllabus</h3>
                  <p className="text-xs text-[#555555]">
                    Supports PDF, TXT, or Markdown documents. Files are automatically chunked and indexed into the FAISS vector database.
                  </p>
                  <button
                    type="button"
                    disabled={isUploadingRag}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-2.5 bg-gradient-to-r from-[#C8102E] to-[#A50E25] hover:from-[#A50E25] hover:to-[#8B0B1F] text-slate-950 font-bold rounded-xl text-xs transition shadow-lg inline-flex items-center gap-2"
                  >
                    {isUploadingRag ? (
                      <>
                        <Sparkles className="w-4 h-4 animate-spin" /> Chunking & Indexing...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" /> Select Document PDF / Text
                      </>
                    )}
                  </button>
                  {ragUploadMsg && (
                    <p className={`text-xs font-semibold ${ragUploadMsg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>
                      {ragUploadMsg}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-[#171717] flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" /> Active Vector Store Knowledge Bases
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ragSources.map((source, idx) => (
                  <div key={idx} className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                        Subject: {source.subject.replace(/_/g, " ")}
                      </span>
                      <button
                        onClick={() => handleClearRagIndex(source.subject)}
                        className="text-xs text-[#555555] hover:text-red-400 transition"
                        title="Clear subject index"
                      >
                        Clear Index
                      </button>
                    </div>
                    <div className="text-2xl font-extrabold text-[#171717]">
                      {source.total_chunks} <span className="text-xs text-[#555555] font-normal">Indexed Chunks</span>
                    </div>
                    <div className="space-y-1 pt-1">
                      {source.documents.map((doc: any, dIdx: number) => (
                        <div key={dIdx} className="text-xs text-[#555555] flex justify-between items-center bg-white px-2.5 py-1.5 rounded-lg border border-[#E5E5E5]">
                          <span className="truncate max-w-[200px]">{doc.filename}</span>
                          <span className="text-[10px] text-emerald-400 font-semibold">{doc.chunks_count} chunks</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {ragSources.length === 0 && (
                  <div className="col-span-2 text-center py-6 text-[#555555] text-xs">
                    No documents uploaded yet. Upload course materials to begin vector grounding.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 space-y-6">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-[#C8102E]">Evaluation Sandbox</span>
                <h3 className="text-lg font-bold text-[#171717] mt-1">Test Similarity Search & RAGAS Grounding Live</h3>
                <p className="text-xs text-[#555555] mt-1">
                  Simulate candidate answers against the vector store to inspect retrieved context chunks and Groq LLM faithfulness scoring.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-2">
                      Test Question / Concept Query
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. How does virtual memory paging work?"
                      value={ragTestQuery}
                      onChange={(e) => setRagTestQuery(e.target.value)}
                      className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl p-3 text-xs text-[#171717] focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-2">
                      Sample Student Response (Optional for Full Evaluation)
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Type a student answer to test faithfulness and conceptual precision..."
                      value={ragEvalStudentAnswer}
                      onChange={(e) => setRagEvalStudentAnswer(e.target.value)}
                      className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl p-3 text-xs text-[#171717] focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={isSearchingRag}
                      onClick={handleTestRagQuery}
                      className="px-4 py-2 bg-[#E5E5E5] hover:bg-[#D4D4D4] text-[#171717] font-bold rounded-xl text-xs transition"
                    >
                      {isSearchingRag ? "Searching..." : "Retrieve Top-3 Chunks"}
                    </button>
                    <button
                      type="button"
                      disabled={isEvaluatingRag}
                      onClick={handleRunRagEval}
                      className="px-5 py-2 bg-gradient-to-r from-[#C8102E] to-[#A50E25] hover:from-[#A50E25] hover:to-[#8B0B1F] text-slate-950 font-bold rounded-xl text-xs transition shadow-md flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {isEvaluatingRag ? "Running RAGAS Eval..." : "Run RAGAS Evaluation"}
                    </button>
                  </div>
                </div>

                <div className="bg-[#F8F8F8] rounded-xl border border-[#E5E5E5] p-4 space-y-4 max-h-[450px] overflow-y-auto">
                  {ragEvalResult ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center border-b border-[#E5E5E5] pb-2">
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">RAGAS Evaluation Output</span>
                        <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-300 rounded font-semibold">
                          Score: {ragEvalResult.conceptual_accuracy || 80}/100
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-white p-2.5 rounded-lg border border-[#E5E5E5]">
                          <span className="text-[#555555] text-[10px] uppercase block">Faithfulness</span>
                          <span className="text-base font-bold text-emerald-400">{ragEvalResult.faithfulness_score}%</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-[#E5E5E5]">
                          <span className="text-[#555555] text-[10px] uppercase block">Relevance</span>
                          <span className="text-base font-bold text-[#C8102E]">{ragEvalResult.answer_relevance}%</span>
                        </div>
                      </div>

                      {ragEvalResult.citations && ragEvalResult.citations.length > 0 && (
                        <div className="space-y-1.5 text-xs">
                          <span className="text-[11px] font-bold text-[#555555] block">Extracted Citations:</span>
                          {ragEvalResult.citations.map((c: any, i: number) => (
                            <div key={i} className="p-2 bg-white rounded-lg border border-[#E5E5E5] text-[11px]">
                              <strong className="text-emerald-300">{c.source ? `${c.source} (p.${c.page})` : c.source_ref}: </strong>
                              <span className="italic text-[#555555]">"{c.quote_snippet}"</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {ragEvalResult.conceptual_feedback && (
                        <div className="text-xs bg-white p-3 rounded-lg text-[#555555] border border-[#E5E5E5]">
                          <strong className="text-[#C8102E]">Feedback: </strong> {ragEvalResult.conceptual_feedback}
                        </div>
                      )}
                    </div>
                  ) : ragTestResults.length > 0 ? (
                    <div className="space-y-3">
                      <span className="text-xs font-bold text-[#C8102E] uppercase tracking-wider block border-b border-[#E5E5E5] pb-2">
                        Retrieved Context Chunks ({ragTestResults.length})
                      </span>
                      {ragTestResults.map((res, i) => (
                        <div key={i} className="p-3 bg-white rounded-lg border border-[#E5E5E5] text-xs space-y-1">
                          <div className="flex justify-between items-center text-[10px] text-[#555555] font-semibold">
                            <span className="text-emerald-400">{res.source} (Page {res.page})</span>
                            <span>Similarity: {Math.round(res.similarity_score * 100)}%</span>
                          </div>
                          <p className="text-[#555555] text-[11px] leading-relaxed line-clamp-4">{res.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 text-[#555555] text-xs">
                      Enter a question or student response and click retrieve to inspect vector grounding.
                    </div>
                  )}
                </div>
              </div>
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
