"use client";
import { useState, useEffect } from "react";
import { useTeacherContext } from "@/components/teacher/TeacherProvider";
import { 
  FileText, 
  Send, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Building, 
  User, 
  Mail, 
  Phone, 
  HelpCircle,
  ArrowRight
} from "lucide-react";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";

const ALLOWED_DEPARTMENTS = [
  { code: "cse", name: "Computer Science & Engineering (CSE)" },
  { code: "ai", name: "Artificial Intelligence (AI)" },
  { code: "aiml", name: "AI & Machine Learning (AIML)" },
  { code: "data science", name: "Data Science" },
  { code: "it", name: "Information Technology (IT)" },
  { code: "ece", name: "Electronics & Communication (ECE)" },
  { code: "eee", name: "Electrical & Electronics (EEE)" },
  { code: "civil", name: "Civil Engineering (CIVIL)" },
  { code: "mech", name: "Mechanical Engineering (MECH)" },
  { code: "ecm", name: "Electronics & Computer Eng. (ECM)" },
];

export default function FacultyQueriesPage() {
  const { department } = useTeacherContext();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentDept, setCurrentDept] = useState(department || "cse");
  const [targetDept, setTargetDept] = useState("ai");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");

  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [queries, setQueries] = useState<any[]>([]);

  useEffect(() => {
    const authStr = localStorage.getItem("veritas_teacher_auth");
    if (authStr) {
      try {
        const auth = JSON.parse(authStr);
        if (auth.teacherName || auth.name) setName(auth.teacherName || auth.name);
        if (auth.teacherId || auth.email) {
          const em = auth.teacherId || auth.email;
          if (em.includes("@")) {
            setEmail(em);
            fetchQueries(em);
          }
        }
        if (auth.department) setCurrentDept(auth.department.toLowerCase());
        if (auth.mobileNumber || auth.phone) setPhone(auth.mobileNumber || auth.phone);
      } catch (e) {}
    }
  }, []);

  const fetchQueries = (userEmail: string) => {
    fetch(`${BACKEND_HTTP}/api/faculty/queries?email=${encodeURIComponent(userEmail)}`)
      .then((r) => r.json())
      .then((d) => setQueries(d.queries || []))
      .catch(() => {});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.endsWith("@anurag.edu.in")) {
      setStatusMsg({
        type: "error",
        text: "Only college email addresses ending with @anurag.edu.in are allowed."
      });
      return;
    }

    if (currentDept.toLowerCase() === targetDept.toLowerCase()) {
      setStatusMsg({
        type: "error",
        text: "Target department must be different from current assigned department."
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/faculty/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          name: name.trim(),
          current_dept: currentDept,
          target_dept: targetDept,
          phone: phone.trim(),
          reason: reason.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to submit query");
      }

      setStatusMsg({
        type: "success",
        text: "Your domain shift request has been submitted successfully. The academic administration will review and update your department assignment."
      });
      setReason("");
      fetchQueries(cleanEmail);
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to submit query" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      <div>
        <h1 className="text-3xl font-extrabold text-[#171717] flex items-center gap-3">
          <FileText className="w-8 h-8 text-[#C8102E]" /> Domain Shift &amp; Department Queries
        </h1>
        <p className="text-[#555555] mt-1 text-sm">
          Faculty members assigned to a department can request an administrative transfer or domain realignment.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Submission Form */}
        <div className="lg:col-span-2 bg-white border border-[#E5E5E5] rounded-3xl p-7 shadow-sm space-y-6">
          <div className="border-b border-[#E5E5E5] pb-4">
            <h2 className="text-lg font-bold text-[#171717]">Submit Department Change Request</h2>
            <p className="text-xs text-[#555555] mt-1">
              Submit your college transfer order details or department shift request for academic dean approval.
            </p>
          </div>

          {statusMsg && (
            <div
              className={`p-4 rounded-2xl text-xs flex items-center gap-2.5 ${
                statusMsg.type === "success"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border border-rose-200 text-rose-800"
              }`}
            >
              {statusMsg.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                  Faculty Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-3.5 text-[#AAAAAA]" />
                  <input
                    type="text"
                    required
                    placeholder="Dr. Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-3 text-xs text-[#171717] focus:outline-none focus:border-[#C8102E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                  College Email ID (@anurag.edu.in)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-[#AAAAAA]" />
                  <input
                    type="email"
                    required
                    placeholder="prof.name@anurag.edu.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-3 text-xs text-[#171717] focus:outline-none focus:border-[#C8102E]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                  Current Assigned Dept
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 absolute left-3.5 top-3.5 text-[#AAAAAA]" />
                  <select
                    value={currentDept}
                    onChange={(e) => setCurrentDept(e.target.value)}
                    className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-3 text-xs text-[#171717] focus:outline-none focus:border-[#C8102E]"
                  >
                    {ALLOWED_DEPARTMENTS.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#C8102E] mb-1.5">
                  Target / Desired Department
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 absolute left-3.5 top-3.5 text-[#C8102E]" />
                  <select
                    value={targetDept}
                    onChange={(e) => setTargetDept(e.target.value)}
                    className="w-full bg-[#FFF1F2] border border-[#C8102E]/30 rounded-xl py-2.5 pl-10 pr-3 text-xs text-[#171717] focus:outline-none focus:border-[#C8102E]"
                  >
                    {ALLOWED_DEPARTMENTS.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                Contact Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-[#AAAAAA]" />
                <input
                  type="tel"
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-3 text-xs text-[#171717] focus:outline-none focus:border-[#C8102E]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                Reason / Transfer Order Reference
              </label>
              <textarea
                required
                rows={3}
                placeholder="Mention college circular number, internal domain shift order, or reasons for shifting domain..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl p-3 text-xs text-[#171717] focus:outline-none focus:border-[#C8102E]"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-[#C8102E] hover:bg-[#A50E25] text-white font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? "Submitting Request..." : "Submit Domain Shift Request"}
            </button>
          </form>
        </div>

        {/* Sidebar Info & Recent Status */}
        <div className="space-y-6">
          <div className="bg-[#FFF1F2] border border-[#C8102E]/20 rounded-3xl p-6">
            <h3 className="font-bold text-[#C8102E] flex items-center gap-2 text-sm">
              <HelpCircle className="w-4 h-4" /> Department Policy
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-[#555555] leading-relaxed list-disc list-inside">
              <li>Faculty are strictly assigned to <strong>one department only</strong>.</li>
              <li>Only <strong>@anurag.edu.in</strong> email IDs are authorized.</li>
              <li>Student information is completely isolated per department to maintain grading privacy.</li>
              <li>Domain transfer requests are processed by the college administration.</li>
            </ul>
          </div>

          <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-[#171717] text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#AAAAAA]" /> My Recent Shift Queries
            </h3>

            {queries.length === 0 ? (
              <p className="text-xs text-[#777777] italic">No previous domain queries found for {email || "this email"}.</p>
            ) : (
              <div className="space-y-3">
                {queries.map((q, idx) => (
                  <div key={idx} className="p-3 bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[#171717] uppercase">
                        {q.current_dept} &rarr; {q.target_dept}
                      </span>
                      <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded font-bold uppercase">
                        {q.status || "Pending"}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#555555] line-clamp-2">{q.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
