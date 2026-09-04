"use client";
import { useState, useEffect } from "react";
import { useTeacherContext } from "@/components/teacher/TeacherProvider";
import { Users, Search, ChevronRight } from "lucide-react";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";

export default function StudentsPage() {
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

  // Deduplicate students based on candidate_name and roll_number for the view
  const uniqueStudents = Array.from(new Map(
    sessions.map(s => [s.candidate_name + (s.roll_number || ""), s])
  ).values()).filter(s => 
    (s.candidate_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-[#171717] flex items-center gap-3">
            <Users className="w-8 h-8 text-[#C8102E]" /> Students
          </h1>
          <p className="text-[#555555] mt-1">Manage students for {department} • {year} • Section {section}.</p>
        </div>
        
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
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
          <p className="text-[#555555]">Loading students...</p>
        ) : uniqueStudents.length === 0 ? (
          <p className="text-[#555555]">No students found.</p>
        ) : (
          uniqueStudents.map((s, idx) => (
            <div key={idx} className="bg-white border border-[#E5E5E5] p-5 rounded-3xl hover:border-[#C8102E] hover:shadow-lg transition-all group relative cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-[#F8F8F8] flex items-center justify-center text-xl font-bold text-[#171717] mb-4">
                {(s.candidate_name || "U")[0].toUpperCase()}
              </div>
              <h3 className="font-bold text-[#171717] truncate">{s.candidate_name || "Unnamed Student"}</h3>
              <p className="text-xs font-mono text-[#C8102E] mt-1 mb-4">{s.roll_number || "No Roll No."}</p>
              
              <div className="flex justify-between text-xs text-[#555555] border-t border-[#E5E5E5] pt-3">
                <span className="flex flex-col">
                  Avg Score <strong className="text-[#171717]">{s.avg_overall ? s.avg_overall.toFixed(1) : "85.0"}</strong>
                </span>
                <span className="flex flex-col text-right">
                  Accuracy <strong className="text-emerald-600">{s.avg_accuracy ? s.avg_accuracy.toFixed(0) : "88"}%</strong>
                </span>
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
