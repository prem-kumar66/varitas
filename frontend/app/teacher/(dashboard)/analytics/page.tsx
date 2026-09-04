"use client";
import { useState, useEffect } from "react";
import { TrendingUp, Award, ShieldCheck, Target } from "lucide-react";
import { motion } from "framer-motion";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";

export default function AnalyticsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND_HTTP}/api/sessions`)
      .then((r) => r.json())
      .then((d) => {
        setSessions(d.sessions || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-extrabold text-[#171717]">Analytics</h1>
        <p className="text-[#555555] mt-1">Deep dive into class performance metrics.</p>
      </div>

      <div className="bg-white border border-[#E5E5E5] p-8 rounded-3xl shadow-sm">
        <h3 className="text-sm uppercase tracking-wider font-bold text-[#171717] mb-8 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#C8102E]" /> Score Distribution
        </h3>
        
        {loading ? (
          <div className="h-40 flex items-center justify-center text-[#555555]">Loading...</div>
        ) : sessions.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-[#555555]">No data available.</div>
        ) : (
          <div className="h-64 flex items-end gap-3">
            {sessions.map((s, i) => {
              const score = s.avg_overall ?? s.avg_authenticity ?? 80;
              return (
                <motion.div
                  key={s.id}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(10, score)}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05 }}
                  className={`flex-1 rounded-t-lg transition-all hover:opacity-80 relative group ${
                    score >= 85 ? "bg-[#C8102E]" : score >= 70 ? "bg-emerald-400" : "bg-red-300"
                  }`}
                >
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition">
                    {s.candidate_name}: {score.toFixed(1)}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        <div className="flex justify-between text-xs text-[#555555] mt-4 pt-4 border-t border-[#E5E5E5]">
          <span>Earliest Assessment</span>
          <span>Latest Assessment</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E5E5E5] p-6 rounded-3xl shadow-sm">
          <h3 className="font-bold text-[#171717] mb-6 flex items-center gap-2">
            <Target className="w-5 h-5 text-orange-500" /> Conceptual Accuracy Trends
          </h3>
          <div className="space-y-4">
            {sessions.slice(0, 5).map((s) => (
              <div key={s.id}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-[#555555]">{s.candidate_name}</span>
                  <span className="font-bold">{s.avg_accuracy?.toFixed(1) || 85}%</span>
                </div>
                <div className="h-1.5 w-full bg-[#F8F8F8] rounded-full overflow-hidden">
                  <div className="h-full bg-orange-400 rounded-full" style={{ width: `${s.avg_accuracy || 85}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#E5E5E5] p-6 rounded-3xl shadow-sm">
          <h3 className="font-bold text-[#171717] mb-6 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-500" /> Authenticity Trends
          </h3>
          <div className="space-y-4">
            {sessions.slice(0, 5).map((s) => (
              <div key={s.id}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-[#555555]">{s.candidate_name}</span>
                  <span className="font-bold">{s.avg_authenticity?.toFixed(1) || 90}%</span>
                </div>
                <div className="h-1.5 w-full bg-[#F8F8F8] rounded-full overflow-hidden">
                  <div className="h-full bg-purple-400 rounded-full" style={{ width: `${s.avg_authenticity || 90}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
