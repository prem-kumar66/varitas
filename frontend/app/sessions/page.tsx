"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Download, ArrowLeft, Users, TrendingUp } from "lucide-react";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";

type Session = {
  id: string;
  candidate_name: string;
  role: string;
  started_at: number;
  ended_at: number | null;
  avg_authenticity: number | null;
  avg_risk: number | null;
  answer_count: number;
};

function tierColor(score: number | null) {
  if (score === null) return "text-gold-50/40";
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-gold-400";
  return "text-crimson-400";
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND_HTTP}/api/sessions`)
      .then((r) => r.json())
      .then((d) => { setSessions(d.sessions || []); setLoading(false); });
  }, []);

  const downloadReport = (id: string) => {
    window.open(`${BACKEND_HTTP}/api/session/${id}/report`, "_blank");
  };

  return (
    <div className="min-h-screen p-6">
      <header className="flex items-center justify-between mb-8">
        <div>
          <Link href="/interviewer" className="text-xs uppercase tracking-[0.3em] text-gold-400/70 flex items-center gap-1 hover:text-gold-400">
            <ArrowLeft className="w-3 h-3" /> Dashboard
          </Link>
          <h1 className="font-display text-4xl text-gradient-gold mt-2">Candidate Comparison</h1>
          <p className="text-sm text-gold-50/60 mt-1 flex items-center gap-2">
            <Users className="w-4 h-4" /> {sessions.length} interview{sessions.length !== 1 ? "s" : ""} on record
          </p>
        </div>
      </header>

      {loading ? (
        <p className="text-gold-50/40">Loading sessions…</p>
      ) : sessions.length === 0 ? (
        <div className="glass p-10 rounded-sm text-center">
          <p className="font-display text-2xl text-gold-200">No interviews yet</p>
          <p className="text-sm text-gold-50/50 mt-2">Start one from the dashboard.</p>
        </div>
      ) : (
        <>
          {/* Distribution chart */}
          <div className="glass p-6 rounded-sm mb-6">
            <h3 className="text-xs uppercase tracking-[0.2em] text-gold-400/70 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Authenticity Distribution
            </h3>
            <div className="h-32 flex items-end gap-2">
              {sessions.map((s, i) => {
                const auth = s.avg_authenticity ?? 0;
                return (
                  <motion.div key={s.id}
                    initial={{ height: 0 }}
                    animate={{ height: `${auth}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05 }}
                    className={`flex-1 rounded-t-sm ${
                      auth >= 70 ? "bg-emerald-400" : auth >= 40 ? "bg-gold-400" : "bg-crimson-400"
                    }`}
                    title={`${s.candidate_name}: ${auth.toFixed(0)}`} />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-gold-50/40 mt-2">
              <span>Oldest</span><span>Most recent</span>
            </div>
          </div>

          {/* Table */}
          <div className="glass p-6 rounded-sm">
            <table className="w-full">
              <thead>
                <tr className="text-xs uppercase tracking-[0.2em] text-gold-400/70 border-b border-gold-400/20">
                  <th className="text-left py-3 pr-4">Candidate</th>
                  <th className="text-left py-3 pr-4">Role</th>
                  <th className="text-left py-3 pr-4">Date</th>
                  <th className="text-right py-3 pr-4">Answers</th>
                  <th className="text-right py-3 pr-4">Authenticity</th>
                  <th className="text-right py-3 pr-4">Risk</th>
                  <th className="text-right py-3">Report</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b border-gold-400/10 hover:bg-gold-400/5">
                    <td className="py-4 pr-4 font-display text-gold-200">{s.candidate_name || "—"}</td>
                    <td className="py-4 pr-4 text-sm text-gold-50/70">{s.role || "—"}</td>
                    <td className="py-4 pr-4 text-sm text-gold-50/50">
                      {new Date(s.started_at * 1000).toLocaleDateString()}
                    </td>
                    <td className="py-4 pr-4 text-right font-mono text-sm text-gold-50/70">{s.answer_count}</td>
                    <td className={`py-4 pr-4 text-right font-mono font-bold ${tierColor(s.avg_authenticity)}`}>
                      {s.avg_authenticity?.toFixed(0) ?? "—"}
                    </td>
                    <td className="py-4 pr-4 text-right font-mono text-gold-50/70">
                      {s.avg_risk?.toFixed(0) ?? "—"}
                    </td>
                    <td className="py-4 text-right">
                      <button onClick={() => downloadReport(s.id)}
                              className="px-3 py-1 text-xs bg-gold-500/20 text-gold-300 rounded-sm hover:bg-gold-500/30 inline-flex items-center gap-1">
                        <Download className="w-3 h-3" /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
