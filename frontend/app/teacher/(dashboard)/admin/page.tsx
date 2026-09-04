"use client";
import { useState, useEffect, useCallback } from "react";
import { 
  ShieldCheck, 
  Users, 
  Building, 
  FileText, 
  RefreshCcw,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Search,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Mail,
  Phone,
  AlertCircle
} from "lucide-react";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";

const DEPT_COLORS: Record<string, string> = {
  cse: "#3B82F6",
  ai: "#8B5CF6",
  aiml: "#EC4899",
  it: "#06B6D4",
  ece: "#F59E0B",
  eee: "#10B981",
  civil: "#6366F1",
  mech: "#EF4444",
  "data science": "#F97316",
  ecm: "#84CC16",
  all: "#C8102E",
};

const DEPT_LABELS: Record<string, string> = {
  cse: "CSE",
  ai: "AI",
  aiml: "AIML",
  it: "IT",
  ece: "ECE",
  eee: "EEE",
  civil: "Civil",
  mech: "Mech",
  "data science": "Data Sci",
  ecm: "ECM",
};

export default function AdminDashboardPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [queries, setQueries] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [queriesLoading, setQueriesLoading] = useState(true);
  const [updatingQueryId, setUpdatingQueryId] = useState<number | null>(null);
  const [expandedQuery, setExpandedQuery] = useState<number | null>(null);

  useEffect(() => {
    const authStr = localStorage.getItem("veritas_teacher_auth");
    if (authStr) {
      try {
        const auth = JSON.parse(authStr);
        if (auth.is_admin || auth.email?.toLowerCase() === "admin@anurag.edu.in" || auth.department === "all") {
          setIsAdmin(true);
        }
      } catch (e) {}
    }
    setCheckingAuth(false);
  }, []);

  const fetchSessions = useCallback(() => {
    setLoading(true);
    const deptParam = selectedDept === "all" ? "" : `?department=${encodeURIComponent(selectedDept)}`;
    fetch(`${BACKEND_HTTP}/api/sessions${deptParam}`)
      .then((r) => r.json())
      .then((d) => {
        setSessions(d.sessions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedDept]);

  const fetchQueries = useCallback(() => {
    setQueriesLoading(true);
    fetch(`${BACKEND_HTTP}/api/faculty/queries`)
      .then((r) => r.json())
      .then((d) => {
        setQueries(d.queries || []);
        setQueriesLoading(false);
      })
      .catch(() => setQueriesLoading(false));
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);
  useEffect(() => { fetchQueries(); }, [fetchQueries]);

  const updateQueryStatus = async (id: number, status: string) => {
    setUpdatingQueryId(id);
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/faculty/query/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchQueries();
      }
    } finally {
      setUpdatingQueryId(null);
    }
  };

  const filteredSessions = sessions.filter(s =>
    (s.candidate_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.roll_number || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.candidate_email || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.department || "").toLowerCase().includes(search.toLowerCase())
  );

  // Build dept stats
  const deptStats: Record<string, number> = {};
  sessions.forEach(s => {
    const d = (s.department || "unknown").toLowerCase();
    deptStats[d] = (deptStats[d] || 0) + 1;
  });

  const pendingQueries = queries.filter(q => q.status === "pending");

  if (checkingAuth) {
    return <div className="p-12 text-center text-sm text-[#777777]">Verifying admin privileges...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto">
            <ShieldCheck className="w-10 h-10 text-[#C8102E]" />
          </div>
          <h2 className="text-2xl font-extrabold text-[#171717]">Admin Access Required</h2>
          <p className="text-sm text-[#555555]">
            This panel is only accessible to the System Administrator account. Sign in using the admin credentials.
          </p>
          <div className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-2xl p-4 text-left text-xs font-mono space-y-1">
            <p><span className="text-[#C8102E]">Email:</span> admin@anurag.edu.in</p>
            <p><span className="text-[#C8102E]">Password:</span> admin123</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-[#171717] flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-[#C8102E]" /> Admin Control Panel
          </h1>
          <p className="text-sm text-[#555555] mt-1">
            Full visibility across all departments, students, and department shift queries.
          </p>
        </div>
        <button
          onClick={() => { fetchSessions(); fetchQueries(); }}
          className="flex items-center gap-2 text-xs font-semibold text-[#555555] hover:text-[#171717] bg-white border border-[#E5E5E5] px-3 py-2 rounded-xl transition hover:border-[#171717]"
        >
          <RefreshCcw className="w-4 h-4 text-[#C8102E]" /> Refresh All
        </button>
      </div>

      {/* Dept Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(DEPT_LABELS).map(([code, label]) => (
          <button
            key={code}
            onClick={() => setSelectedDept(prev => prev === code ? "all" : code)}
            className={`flex flex-col items-center justify-center p-4 rounded-2xl border font-bold transition text-xs ${
              selectedDept === code
                ? "shadow-md scale-105"
                : "bg-white border-[#E5E5E5] hover:border-gray-300 text-[#555555]"
            }`}
            style={{
              borderColor: selectedDept === code ? DEPT_COLORS[code] : undefined,
              backgroundColor: selectedDept === code ? `${DEPT_COLORS[code]}12` : undefined,
              color: selectedDept === code ? DEPT_COLORS[code] : undefined,
            }}
          >
            <span className="text-xl font-extrabold">{deptStats[code] || 0}</span>
            <span className="uppercase tracking-wide">{label}</span>
          </button>
        ))}
      </div>

      {/* QUERIES SECTION */}
      <div className="bg-white border border-[#E5E5E5] rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-[#C8102E]" />
            <h2 className="text-lg font-bold text-[#171717]">Domain Shift & Faculty Queries</h2>
            {pendingQueries.length > 0 && (
              <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingQueries.length} Pending
              </span>
            )}
          </div>
          <button onClick={fetchQueries} className="text-xs text-[#555555] hover:text-[#171717] flex items-center gap-1.5">
            <RefreshCcw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {queriesLoading ? (
          <div className="p-6 text-sm text-[#555555]">Loading queries...</div>
        ) : queries.length === 0 ? (
          <div className="p-8 text-center text-[#777777] text-sm">No domain shift queries submitted yet.</div>
        ) : (
          <div className="divide-y divide-[#E5E5E5]">
            {queries.map((q) => (
              <div key={q.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-bold text-[#171717] text-sm">{q.name}</span>
                      <span className="text-xs text-[#777777] font-mono truncate">{q.email}</span>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          q.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : q.status === "approved"
                            ? "bg-emerald-100 text-emerald-800"
                            : q.status === "under review"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {q.status || "pending"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#555555]">
                      <span className="font-bold uppercase text-[#C8102E]">{q.current_dept}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#AAAAAA]" />
                      <span className="font-bold uppercase text-emerald-700">{q.target_dept}</span>
                      {q.phone && (
                        <span className="flex items-center gap-1 ml-2">
                          <Phone className="w-3 h-3" /> {q.phone}
                        </span>
                      )}
                    </div>
                    {q.reason && (
                      <button
                        onClick={() => setExpandedQuery(expandedQuery === q.id ? null : q.id)}
                        className="flex items-center gap-1 text-[10px] text-[#777777] hover:text-[#171717] mt-1.5 transition"
                      >
                        {expandedQuery === q.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {expandedQuery === q.id ? "Hide Reason" : "View Reason"}
                      </button>
                    )}
                    {expandedQuery === q.id && (
                      <p className="mt-2 text-xs text-[#555555] bg-[#F8F8F8] p-3 rounded-xl border border-[#E5E5E5]">
                        {q.reason}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {q.status !== "approved" && (
                      <button
                        onClick={() => updateQueryStatus(q.id, "approved")}
                        disabled={updatingQueryId === q.id}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {updatingQueryId === q.id ? "Updating..." : "Approve"}
                      </button>
                    )}
                    {q.status !== "under review" && (
                      <button
                        onClick={() => updateQueryStatus(q.id, "under review")}
                        disabled={updatingQueryId === q.id}
                        className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition disabled:opacity-50"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Review
                      </button>
                    )}
                    {q.status !== "rejected" && (
                      <button
                        onClick={() => updateQueryStatus(q.id, "rejected")}
                        disabled={updatingQueryId === q.id}
                        className="flex items-center gap-1.5 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold px-3 py-1.5 rounded-xl transition disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ALL STUDENTS / SESSIONS SECTION */}
      <div className="bg-white border border-[#E5E5E5] rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-[#C8102E]" />
            <h2 className="text-lg font-bold text-[#171717]">
              All Students — {selectedDept === "all" ? "All Departments" : <span className="uppercase text-[#C8102E]">{DEPT_LABELS[selectedDept] || selectedDept}</span>}
            </h2>
            <span className="text-xs font-semibold text-[#555555] bg-[#F8F8F8] border border-[#E5E5E5] px-2 py-0.5 rounded-full">
              {filteredSessions.length} records
            </span>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#AAAAAA]" />
            <input
              type="text"
              placeholder="Search name, roll, dept..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-[#C8102E] w-56"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-[#555555]">Loading student records across all departments...</div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-10 text-center text-[#777777] text-sm">No student records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#F8F8F8] border-b border-[#E5E5E5]">
                <tr>
                  {["Department", "Student Name", "Roll No.", "Email", "Year", "Mode", "Avg Score"].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-bold text-[#555555] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0F0]">
                {filteredSessions.map((s, idx) => {
                  const dept = (s.department || "unknown").toLowerCase();
                  const deptColor = DEPT_COLORS[dept] || "#AAAAAA";
                  return (
                    <tr key={idx} className="hover:bg-[#F8F8F8] transition">
                      <td className="px-4 py-3">
                        <span
                          className="text-[10px] font-bold uppercase px-2 py-1 rounded-full"
                          style={{ backgroundColor: `${deptColor}18`, color: deptColor }}
                        >
                          {DEPT_LABELS[dept] || dept}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#171717] whitespace-nowrap">{s.candidate_name || "—"}</td>
                      <td className="px-4 py-3 font-mono text-[#C8102E]">{s.roll_number || "—"}</td>
                      <td className="px-4 py-3 text-[#555555] max-w-[160px] truncate">{s.candidate_email || "—"}</td>
                      <td className="px-4 py-3 text-[#555555]">{s.academic_year || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="bg-[#F8F8F8] border border-[#E5E5E5] px-2 py-0.5 rounded text-[10px] font-medium uppercase">
                          {s.mode || "oral"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-[#171717]">
                        {s.avg_overall ? s.avg_overall.toFixed(1) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
