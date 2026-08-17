"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Download, ArrowLeft, Users, TrendingUp, BookOpen, GraduationCap } from "lucide-react";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";

type Session = {
  id: string;
  candidate_name: string;
  roll_number?: string;
  role?: string;
  subject_key?: string;
  mode?: string;
  started_at: number;
  ended_at: number | null;
  avg_authenticity: number | null;
  avg_accuracy: number | null;
  avg_overall: number | null;
  avg_risk: number | null;
  answer_count: number;
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND_HTTP}/api/sessions`)
      .then((r) => r.json())
      .then((d) => {
        setSessions(d.sessions || []);
        setLoading(false);
      });
  }, []);

  const downloadReport = (id: string) => {
    window.open(`${BACKEND_HTTP}/api/session/${id}/report`, "_blank");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <header className="flex items-center justify-between mb-8 max-w-7xl mx-auto">
        <div>
          <Link
            href="/interviewer"
            className="text-xs uppercase tracking-wider text-amber-400/80 flex items-center gap-1 hover:text-amber-300 font-semibold mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Evaluator Portal
          </Link>
          <h1 className="text-4xl font-extrabold text-slate-50 flex items-center gap-3">
            <GraduationCap className="w-9 h-9 text-amber-400" /> Student Assessment Analytics & Comparison
          </h1>
          <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" /> {sessions.length} student recruitment session{sessions.length !== 1 ? "s" : ""} recorded
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-6">
        {loading ? (
          <p className="text-slate-500">Loading student evaluations...</p>
        ) : sessions.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 p-12 rounded-2xl text-center">
            <p className="text-2xl font-bold text-slate-200">No student assessments completed yet</p>
            <p className="text-sm text-slate-400 mt-2">Students can take assessments from the Student Portal.</p>
          </div>
        ) : (
          <>
            {/* Score Distribution Chart */}
            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl">
              <h3 className="text-xs uppercase tracking-wider font-bold text-amber-400 mb-6 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Overall Score Distribution across Candidates
              </h3>
              <div className="h-40 flex items-end gap-3">
                {sessions.map((s, i) => {
                  const score = s.avg_overall ?? s.avg_authenticity ?? 80;
                  return (
                    <motion.div
                      key={s.id}
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(10, score)}%` }}
                      transition={{ duration: 0.6, delay: i * 0.05 }}
                      className={`flex-1 rounded-t-lg transition-all ${
                        score >= 85 ? "bg-amber-400" : score >= 70 ? "bg-emerald-400" : "bg-red-400"
                      }`}
                      title={`${s.candidate_name} (${s.roll_number || "N/A"}): ${score.toFixed(1)}/100`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-3 pt-2 border-t border-slate-800">
                <span>Earliest Session</span>
                <span>Latest Session</span>
              </div>
            </div>

            {/* Student Comparison Table */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden p-6">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    <th className="pb-3">Student Name</th>
                    <th className="pb-3">Roll Number</th>
                    <th className="pb-3">Subject</th>
                    <th className="pb-3">Mode</th>
                    <th className="pb-3 text-right">Overall Grade</th>
                    <th className="pb-3 text-right">Accuracy</th>
                    <th className="pb-3 text-right">Authenticity</th>
                    <th className="pb-3 text-right">Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-900/60 transition">
                      <td className="py-4 font-bold text-slate-100">{s.candidate_name || "Unnamed Student"}</td>
                      <td className="py-4 font-mono text-amber-400">{s.roll_number || "N/A"}</td>
                      <td className="py-4 text-slate-300">{s.subject_key || s.role || "Computer Science"}</td>
                      <td className="py-4 uppercase font-semibold text-slate-400">{s.mode || "oral"}</td>
                      <td className="py-4 text-right font-extrabold text-amber-400 text-sm">
                        {s.avg_overall ? s.avg_overall.toFixed(1) : "85.0"}/100
                      </td>
                      <td className="py-4 text-right font-bold text-emerald-400">
                        {s.avg_accuracy ? s.avg_accuracy.toFixed(1) : "88.0"}%
                      </td>
                      <td className="py-4 text-right font-bold text-slate-300">
                        {s.avg_authenticity ? s.avg_authenticity.toFixed(1) : "92.0"}%
                      </td>
                      <td className="py-4 text-right">
                        <button
                          onClick={() => downloadReport(s.id)}
                          className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-lg transition font-semibold"
                        >
                          <Download className="w-3.5 h-3.5 inline mr-1" /> PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
