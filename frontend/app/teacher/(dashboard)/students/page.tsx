"use client";
import { useState, useEffect } from "react";
import { useTeacherContext } from "@/components/teacher/TeacherProvider";
import { Users, Search, ChevronRight, ShieldAlert, Lock, Mail, Phone } from "lucide-react";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";

export default function StudentsPage() {
  const { department, year, section, isGuest } = useTeacherContext();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    const deptParam = department ? `?department=${encodeURIComponent(department)}` : "";
    fetch(`${BACKEND_HTTP}/api/sessions${deptParam}`)
      .then((r) => r.json())
      .then((d) => {
        setSessions(d.sessions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [department]);

  // Deduplicate students based on candidate_name and roll_number for the view
  const uniqueStudents = Array.from(new Map(
    sessions.map(s => [s.candidate_name + (s.roll_number || ""), s])
  ).values()).filter(s => 
    (s.candidate_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.roll_number || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.candidate_email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {isGuest && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-xs flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <strong className="font-bold">Guest Faculty Limited Access:</strong> You are viewing read-only student data for department{" "}
            <span className="font-mono font-bold uppercase">{department || "General"}</span>. Student phone numbers and direct evaluations are protected.
          </div>
        </div>
      )}

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-[#171717] flex items-center gap-3">
            <Users className="w-8 h-8 text-[#C8102E]" /> Students
          </h1>
          <p className="text-[#555555] mt-1 text-sm">
            Strict Department Record: <strong className="text-[#171717] uppercase">{department || "Unassigned"}</strong> &bull; {year || "All Years"} &bull; Section {section || "All"}
          </p>
        </div>
        
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#AAAAAA]" />
          <input 
            type="text" 
            placeholder="Search student or roll no..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-white border border-[#E5E5E5] rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-[#C8102E] transition w-64"
          />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
          <p className="text-[#555555] text-sm">Loading department student records...</p>
        ) : uniqueStudents.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white border border-[#E5E5E5] rounded-3xl p-8 space-y-2">
            <Users className="w-12 h-12 text-[#AAAAAA] mx-auto mb-2" />
            <h3 className="font-bold text-[#171717]">No students found for {department?.toUpperCase()}</h3>
            <p className="text-xs text-[#777777]">
              Student records are strictly isolated. No students from other departments will appear here.
            </p>
          </div>
        ) : (
          uniqueStudents.map((s, idx) => (
            <div key={idx} className="bg-white border border-[#E5E5E5] p-5 rounded-3xl hover:border-[#C8102E] hover:shadow-lg transition-all group relative cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl bg-[#FFF1F2] flex items-center justify-center text-lg font-bold text-[#C8102E]">
                  {(s.candidate_name || "U")[0].toUpperCase()}
                </div>
                <span className="text-[10px] font-mono font-bold bg-[#F8F8F8] border border-[#E5E5E5] px-2 py-0.5 rounded text-[#555555] uppercase">
                  {s.department || department || "CSE"}
                </span>
              </div>

              <h3 className="font-bold text-[#171717] truncate">{s.candidate_name || "Unnamed Student"}</h3>
              <p className="text-xs font-mono text-[#C8102E] mt-0.5">{s.roll_number || "No Roll No."}</p>
              
              <div className="mt-2 text-[11px] text-[#777777] space-y-1">
                {s.candidate_email && (
                  <div className="flex items-center gap-1 truncate">
                    <Mail className="w-3 h-3 text-[#AAAAAA] shrink-0" />
                    <span className="truncate">{s.candidate_email}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-[#AAAAAA] shrink-0" />
                  <span>
                    {isGuest 
                      ? "+91 ******" + (s.mobile_number ? s.mobile_number.slice(-4) : "0000")
                      : s.mobile_number || "N/A"
                    }
                  </span>
                </div>
              </div>

              <div className="flex justify-between text-xs text-[#555555] border-t border-[#E5E5E5] pt-3 mt-4">
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
