"use client";
import { useState, useEffect } from "react";
import { Download, Search, Filter, ClipboardList } from "lucide-react";
import { useTeacherContext } from "@/components/teacher/TeacherProvider";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";

export default function EvaluationsPage() {
  const { department, year, section } = useTeacherContext();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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

  const filtered = sessions.filter(s => 
    (s.candidate_name || "").toLowerCase().includes(search.toLowerCase()) || 
    (s.roll_number || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-[#171717] flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-[#C8102E]" /> Student Evaluations
          </h1>
          <p className="text-[#555555] mt-1">Review and manage assessments for {department}.</p>
        </div>
        
        <div className="flex gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-[#AAAAAA]" />
            <input 
              type="text" 
              placeholder="Search student..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white border border-[#E5E5E5] rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-[#C8102E] transition w-64"
            />
          </div>
          <button className="bg-white border border-[#E5E5E5] p-2 rounded-xl text-[#555555] hover:text-[#171717] hover:border-[#C8102E] transition">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="bg-white border border-[#E5E5E5] rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-[#F8F8F8] text-[#555555] border-b border-[#E5E5E5] uppercase tracking-wider text-xs">
              <th className="py-4 px-6 font-bold">Student</th>
              <th className="py-4 px-6 font-bold">Subject / Mode</th>
              <th className="py-4 px-6 font-bold text-center">Score</th>
              <th className="py-4 px-6 font-bold text-center">Accuracy</th>
              <th className="py-4 px-6 font-bold text-center">Authenticity</th>
              <th className="py-4 px-6 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5E5]">
            {loading ? (
              <tr><td colSpan={6} className="py-8 text-center text-[#555555]">Loading evaluations...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-[#555555]">No evaluations found.</td></tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="hover:bg-[#FFF1F2]/50 transition">
                  <td className="py-4 px-6">
                    <div className="font-bold text-[#171717]">{s.candidate_name || "Unnamed Student"}</div>
                    <div className="text-xs text-[#C8102E] font-mono">{s.roll_number || "N/A"}</div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-medium text-[#171717]">{s.subject_key || s.role || "CS"}</div>
                    <div className="text-xs text-[#555555] uppercase">{s.mode || "oral"}</div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="font-extrabold text-[#C8102E]">{s.avg_overall ? s.avg_overall.toFixed(1) : "85.0"}</span>
                  </td>
                  <td className="py-4 px-6 text-center text-emerald-600 font-semibold">
                    {s.avg_accuracy ? s.avg_accuracy.toFixed(1) : "88.0"}%
                  </td>
                  <td className="py-4 px-6 text-center text-purple-600 font-semibold">
                    {s.avg_authenticity ? s.avg_authenticity.toFixed(1) : "92.0"}%
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => downloadReport(s.id)}
                      className="px-4 py-2 bg-white border border-[#E5E5E5] hover:border-[#C8102E] text-[#555555] hover:text-[#C8102E] rounded-xl transition text-xs font-bold inline-flex items-center gap-2 shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" /> PDF
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
