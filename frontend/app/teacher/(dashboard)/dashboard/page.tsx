"use client";
import { useTeacherContext } from "@/components/teacher/TeacherProvider";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { getTeacherAuthHeaders } from "@/lib/auth";
import { 
  Users, 
  Target, 
  ShieldCheck, 
  Award, 
  BrainCircuit, 
  ChevronRight, 
  Bot, 
  FileText,
  Bell,
  BookOpen,
  X
} from "lucide-react";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";

export default function TeacherDashboard() {
  const { department, year, section } = useTeacherContext();
  const [sessions, setSessions] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [subjectPerformance, setSubjectPerformance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPerformance, setLoadingPerformance] = useState(true);
  const [showWeakAreasModal, setShowWeakAreasModal] = useState(false);

  useEffect(() => {
    // Filter sessions strictly by the teacher's department
    const deptParam = department ? `?department=${encodeURIComponent(department)}` : "";
    fetch(`${BACKEND_HTTP}/api/sessions${deptParam}`, { headers: getTeacherAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setSessions(d.sessions || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });

    // Fetch published assessments for notifications panel
    if (department) {
      const qp = new URLSearchParams();
      qp.set("department", department);
      if (year) qp.set("year", year);
      fetch(`${BACKEND_HTTP}/api/assessments?${qp}`, { headers: getTeacherAuthHeaders() })
        .then((r) => r.json())
        .then((d) => setAssessments(d.assessments || []))
        .catch(() => {});
    }

    // Fetch subject performance grouped in SQL
    const spParams = new URLSearchParams();
    if (department) spParams.set("department", department);
    if (year) spParams.set("year", year);
    if (section) spParams.set("section", section);

    setLoadingPerformance(true);
    fetch(`${BACKEND_HTTP}/api/analytics/subject-performance?${spParams.toString()}`, { headers: getTeacherAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setSubjectPerformance(d.subject_performance || []);
        setLoadingPerformance(false);
      })
      .catch((err) => {
        console.error("Failed to load subject performance:", err);
        setLoadingPerformance(false);
      });
  }, [department, year, section]);

  const totalStudents = sessions.length;
  const avgScore = totalStudents > 0 
    ? sessions.reduce((acc, s) => acc + (s.avg_overall || 80), 0) / totalStudents 
    : 0;
  const avgAuthenticity = totalStudents > 0
    ? sessions.reduce((acc, s) => acc + (s.avg_authenticity || 90), 0) / totalStudents
    : 0;
  const avgAccuracy = totalStudents > 0
    ? sessions.reduce((acc, s) => acc + (s.avg_accuracy || 85), 0) / totalStudents
    : 0;

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-[#171717] text-white p-8 rounded-3xl relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 p-12 opacity-10">
          <BrainCircuit className="w-64 h-64 text-[#C8102E]" />
        </div>
        <div className="relative z-10">
          <h2 className="text-3xl font-extrabold mb-2">Welcome back, Professor 👋</h2>
          <p className="text-gray-400 mb-8 max-w-lg">
            Here's what's happening with {department} • {year} • Section {section} today.
            Check recent evaluations or ask Teacher AI for insights.
          </p>
          <div className="flex gap-4">
            <Link href="/teacher/ai" className="bg-[#C8102E] hover:bg-[#A50E25] text-white px-6 py-3 rounded-xl font-bold transition flex items-center gap-2">
              <Bot className="w-5 h-5" /> Open Teacher AI
            </Link>
            <Link href="/teacher/evaluations" className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-bold transition flex items-center gap-2 border border-white/10">
              <FileText className="w-5 h-5" /> View Evaluations
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Students" value={totalStudents.toString()} icon={Users} color="text-blue-500" bg="bg-blue-50" />
        <StatCard title="Average Score" value={`${avgScore.toFixed(1)}%`} icon={Award} color="text-emerald-500" bg="bg-emerald-50" />
        <StatCard title="Authenticity" value={`${avgAuthenticity.toFixed(1)}%`} icon={ShieldCheck} color="text-purple-500" bg="bg-purple-50" />
        <StatCard title="Accuracy" value={`${avgAccuracy.toFixed(1)}%`} icon={Target} color="text-orange-500" bg="bg-orange-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Class Weak Areas */}
        <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-[#171717] text-lg">Class Weak Areas</h3>
            <button 
              onClick={() => setShowWeakAreasModal(true)} 
              className="text-xs font-semibold text-[#C8102E] hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>
          <p className="text-[11px] text-[#777777] italic mb-4">
            Scores are being recalculated; treat rankings as provisional
          </p>
          {loadingPerformance ? (
            <div className="py-8 text-center text-[#777777] text-sm">
              Loading performance data...
            </div>
          ) : subjectPerformance.length === 0 ? (
            <div className="py-8 text-center text-[#777777] text-sm">
              No completed attempts recorded yet for this class.
            </div>
          ) : (
            <div className="space-y-4">
              {subjectPerformance.slice(0, 4).map((item, idx) => (
                <SubjectPerformanceRow key={`${item.teacher_name}-${item.subject}-${idx}`} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Recent Evaluations */}
        <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-[#171717] text-lg">Recent Evaluations</h3>
            <Link href="/teacher/evaluations" className="text-xs font-semibold text-[#C8102E] hover:underline">View All</Link>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[#555555] border-b border-[#E5E5E5]">
                  <th className="pb-3 font-semibold">Student</th>
                  <th className="pb-3 font-semibold">Subject</th>
                  <th className="pb-3 font-semibold">Score</th>
                  <th className="pb-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-[#555555]">Loading...</td>
                  </tr>
                ) : sessions.slice(0, 5).map((s) => (
                  <tr key={s.id} className="hover:bg-[#F8F8F8] transition">
                    <td className="py-3">
                      <div className="font-bold text-[#171717]">{s.candidate_name || "Unnamed"}</div>
                      <div className="text-xs text-[#555555]">{s.roll_number || "N/A"}</div>
                    </td>
                    <td className="py-3 text-[#555555]">{s.subject_key || s.role || "CS"}</td>
                    <td className="py-3 font-bold text-[#C8102E]">{s.avg_overall ? s.avg_overall.toFixed(1) : "85.0"}</td>
                    <td className="py-3 text-right">
                      <button 
                        onClick={() => window.open(`${BACKEND_HTTP}/api/session/${s.id}/report`, "_blank")}
                        className="text-xs bg-[#FFF1F2] text-[#C8102E] px-3 py-1.5 rounded-lg font-semibold hover:bg-[#C8102E] hover:text-white transition"
                      >
                        Report
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Published Exam Notifications Panel */}
      <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[#171717] text-lg flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#C8102E]" />
            Exam Notification History
            {assessments.length > 0 && (
              <span className="ml-2 bg-[#C8102E] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {assessments.length}
              </span>
            )}
          </h3>
          <Link href="/teacher/exams" className="text-xs font-semibold text-[#C8102E] hover:underline">
            Manage Exams
          </Link>
        </div>
        {assessments.length === 0 ? (
          <div className="text-center py-8 text-[#777777] text-sm">
            <BookOpen className="w-10 h-10 mx-auto mb-2 text-[#AAAAAA]" />
            <p>No exams published yet for <strong className="text-[#171717] uppercase">{department || "your dept"}</strong>.</p>
            <p className="text-xs mt-1">Go to <span className="font-semibold text-[#C8102E]">Create Exam</span> to publish your first assessment.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {assessments.map((a: any) => (
              <div key={a.exam_id} className="flex items-start gap-3 p-3 bg-[#F8F8F8] rounded-xl border border-[#E5E5E5] hover:border-[#C8102E]/30 transition">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white text-xs font-bold ${
                  a.mode === "quiz" ? "bg-blue-500" : a.mode === "oral" ? "bg-purple-500" : "bg-emerald-500"
                }`}>
                  {a.mode === "quiz" ? "Q" : a.mode === "oral" ? "V" : "W"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-[#171717] truncate">{a.name}</span>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      a.mode === "quiz" ? "bg-blue-50 text-blue-700" : a.mode === "oral" ? "bg-purple-50 text-purple-700" : "bg-emerald-50 text-emerald-700"
                    }`}>{a.mode}</span>
                  </div>
                  <p className="text-xs text-[#555555] mt-0.5">
                    {a.subject && <span>{a.subject} · </span>}
                    {a.department?.toUpperCase()} · {a.year} · Sec {a.section || "All"} · {a.difficulty || "medium"}
                  </p>
                  <p className="text-[11px] text-[#AAAAAA] mt-0.5">
                    Published by {a.teacher || "Faculty"} · {new Date(a.created_at * 1000).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View All Weak Areas Modal */}
      {showWeakAreasModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-[#E5E5E5]"
          >
            <div className="flex items-start justify-between pb-4 border-b border-[#E5E5E5]">
              <div>
                <h3 className="text-xl font-bold text-[#171717]">Class Weak Areas & Subject Performance</h3>
                <p className="text-xs text-[#777777] italic mt-1">
                  Scores are being recalculated; treat rankings as provisional
                </p>
              </div>
              <button
                onClick={() => setShowWeakAreasModal(false)}
                className="p-1.5 rounded-full hover:bg-[#F8F8F8] text-[#555555] transition cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 my-4">
              {subjectPerformance.length === 0 ? (
                <div className="py-12 text-center text-[#777777]">
                  No performance data available for this class.
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[#555555] border-b border-[#E5E5E5]">
                      <th className="pb-3 font-semibold">Teacher</th>
                      <th className="pb-3 font-semibold">Subject</th>
                      <th className="pb-3 font-semibold">Exams</th>
                      <th className="pb-3 font-semibold">Student Attempts</th>
                      <th className="pb-3 font-semibold text-right">Average Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5]">
                    {subjectPerformance.map((item, idx) => {
                      const colors = getScoreColor(item.avg_score);
                      return (
                        <tr key={`${item.teacher_name}-${item.subject}-${idx}`} className="hover:bg-[#F8F8F8] transition">
                          <td className="py-3 font-bold text-[#171717]">
                            {item.teacher_name || item.teacher || "Faculty"}
                          </td>
                          <td className="py-3 text-[#333333] font-medium">
                            {item.subject}
                          </td>
                          <td className="py-3 text-[#555555]">
                            <div className="flex items-center gap-2">
                              <span>{item.exam_count}</span>
                              {item.exam_count < 3 && (
                                <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                  low sample
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 text-[#555555]">
                            <div>
                              <span>{item.student_attempts} {item.student_attempts === 1 ? "completed" : "completed"}</span>
                              {item.disqualified_attempts > 0 && (
                                <span className="text-red-500 text-xs ml-1.5 font-medium">
                                  ({item.disqualified_attempts} disqualified)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-2 bg-[#F8F8F8] rounded-full overflow-hidden hidden sm:block">
                                <div 
                                  className={`h-full ${colors.bg} rounded-full`}
                                  style={{ width: `${Math.min(100, Math.max(0, item.avg_score))}%` }}
                                />
                              </div>
                              <span className={`font-extrabold ${colors.text}`}>
                                {item.avg_score.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-3 border-t border-[#E5E5E5] flex justify-end">
              <button
                onClick={() => setShowWeakAreasModal(false)}
                className="bg-[#171717] hover:bg-[#333333] text-white px-5 py-2 rounded-xl text-sm font-semibold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function getScoreColor(score: number) {
  if (score < 50) {
    return {
      text: "text-[#C8102E]",
      bg: "bg-[#C8102E]",
      badge: "bg-red-50 text-[#C8102E] border-red-200",
    };
  }
  if (score < 70) {
    return {
      text: "text-amber-600",
      bg: "bg-amber-500",
      badge: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }
  return {
    text: "text-emerald-600",
    bg: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
}

function SubjectPerformanceRow({ item }: { item: any }) {
  const colors = getScoreColor(item.avg_score);
  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[#171717] text-sm truncate">{item.subject}</span>
            {item.exam_count < 3 && (
              <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                low sample
              </span>
            )}
          </div>
          <div className="text-xs text-[#555555] flex items-center gap-1.5 flex-wrap mt-0.5">
            <span className="font-medium text-[#333333]">{item.teacher_name || item.teacher || "Faculty"}</span>
            <span>•</span>
            <span>{item.exam_count} {item.exam_count === 1 ? "exam" : "exams"}</span>
            <span>•</span>
            <span>{item.student_attempts} {item.student_attempts === 1 ? "attempt" : "attempts"}</span>
            {item.disqualified_attempts > 0 && (
              <span className="text-red-500 font-medium">({item.disqualified_attempts} disqualified)</span>
            )}
          </div>
        </div>
        <div className={`text-sm font-extrabold ${colors.text} shrink-0 text-right`}>
          {item.avg_score.toFixed(1)}%
        </div>
      </div>
      <div className="h-2 w-full bg-[#F8F8F8] rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, item.avg_score))}%` }}
          className={`h-full ${colors.bg} rounded-full`}
        />
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, bg }: any) {
  return (
    <div className="bg-white border border-[#E5E5E5] p-6 rounded-3xl shadow-sm flex items-center gap-4 hover:border-[#C8102E] hover:shadow-md transition">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bg} ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-xs font-semibold text-[#555555] uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-extrabold text-[#171717]">{value}</p>
      </div>
    </div>
  );
}

function WeakTopic({ name, score }: any) {
  const colors = getScoreColor(score);
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-semibold text-[#171717]">{name}</span>
        <span className={`font-bold ${colors.text}`}>{score}%</span>
      </div>
      <div className="h-2 w-full bg-[#F8F8F8] rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          className={`h-full ${colors.bg} rounded-full`}
        />
      </div>
    </div>
  );
}
