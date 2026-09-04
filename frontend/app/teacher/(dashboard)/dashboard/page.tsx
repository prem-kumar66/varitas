"use client";
import { useTeacherContext } from "@/components/teacher/TeacherProvider";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { 
  Users, 
  Target, 
  ShieldCheck, 
  Award, 
  BrainCircuit, 
  ChevronRight, 
  Bot, 
  FileText
} from "lucide-react";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";

export default function TeacherDashboard() {
  const { department, year, section } = useTeacherContext();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND_HTTP}/api/sessions`)
      .then((r) => r.json())
      .then((d) => {
        setSessions(d.sessions || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

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
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-[#171717] text-lg">Class Weak Areas</h3>
            <Link href="/teacher/analytics" className="text-xs font-semibold text-[#C8102E] hover:underline">View All</Link>
          </div>
          <div className="space-y-4">
            <WeakTopic name="Neural Networks" score={58} />
            <WeakTopic name="Clustering" score={61} />
            <WeakTopic name="Regression" score={65} />
          </div>
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
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-semibold text-[#171717]">{name}</span>
        <span className="font-bold text-[#C8102E]">{score}%</span>
      </div>
      <div className="h-2 w-full bg-[#F8F8F8] rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          className="h-full bg-[#C8102E] rounded-full"
        />
      </div>
    </div>
  );
}
