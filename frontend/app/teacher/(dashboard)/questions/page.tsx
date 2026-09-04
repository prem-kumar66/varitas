"use client";
import { useState, useEffect } from "react";
import { 
  Database, Plus, Search, Sparkles, CheckCircle2, AlertCircle, 
  Clock, Users, Lock, Unlock, ArrowRight, BookOpen, Send, Trash2, ShieldCheck, Check
} from "lucide-react";
import { useTeacherContext } from "@/components/teacher/TeacherProvider";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";

export default function QuestionsPage() {
  const { department, year, email } = useTeacherContext();
  const [activeTab, setActiveTab] = useState<"validation" | "assignments" | "bank">("validation");

  // Tab 1: Validation Tasks
  const [validationTasks, setValidationTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [approvingSubject, setApprovingSubject] = useState<string | null>(null);
  const [approvalSuccess, setApprovalSuccess] = useState<string | null>(null);

  // Tab 2: Assignments
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [academicYear, setAcademicYear] = useState(year || "3rd Year");
  const [selectedSection, setSelectedSection] = useState("Section A");
  const [assignedMode, setAssignedMode] = useState<"oral" | "written" | "quiz" | "open">("quiz");
  const [studentRollTarget, setStudentRollTarget] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);

  // Tab 3: Question Bank
  const [questions, setQuestions] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [search, setSearch] = useState("");

  // Load Validation Tasks
  const loadValidationTasks = async () => {
    setLoadingTasks(true);
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/faculty/validation-tasks?department=${department || "cse"}`);
      const data = await res.json();
      setValidationTasks(data.tasks || []);
    } catch (e) {
      console.error("Failed to load validation tasks", e);
    } finally {
      setLoadingTasks(false);
    }
  };

  // Load Assignments
  const loadAssignments = async () => {
    setLoadingAssignments(true);
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/faculty/assignments?department=${department || "cse"}`);
      const data = await res.json();
      setAssignments(data.assignments || []);
    } catch (e) {
      console.error("Failed to load assignments", e);
    } finally {
      setLoadingAssignments(false);
    }
  };

  // Load Question Bank & Subjects
  const loadQuestionBank = async () => {
    setLoadingQuestions(true);
    try {
      const [qRes, sRes] = await Promise.all([
        fetch(`${BACKEND_HTTP}/api/academic/questions?department=${department || "cse"}`),
        fetch(`${BACKEND_HTTP}/api/academic/subjects?department=${department || "cse"}`)
      ]);
      const qData = await qRes.json();
      const sData = await sRes.json();
      setQuestions(qData.questions || []);
      setSubjects(sData.subjects || []);
    } catch (e) {
      console.error("Failed to load question bank", e);
    } finally {
      setLoadingQuestions(false);
    }
  };

  useEffect(() => {
    loadValidationTasks();
    loadAssignments();
    loadQuestionBank();
  }, [department]);

  // Handle Faculty Approve Subject
  const handleApproveSubject = async (subject: string) => {
    setApprovingSubject(subject);
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/faculty/approve-subject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department: department || "cse",
          subject: subject,
          faculty_email: email || "faculty@anurag.edu.in"
        })
      });
      const data = await res.json();
      if (data.ok) {
        setApprovalSuccess(`Questions for '${subject}' approved! Students have been notified that test is ready.`);
        loadValidationTasks();
        loadQuestionBank();
        setTimeout(() => setApprovalSuccess(null), 5000);
      }
    } catch (e) {
      console.error("Failed to approve subject", e);
    } finally {
      setApprovingSubject(null);
    }
  };

  // Handle Create Mode Assignment
  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAssignment(true);
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/faculty/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faculty_email: email || "faculty@anurag.edu.in",
          department: department || "cse",
          academic_year: academicYear,
          section: selectedSection,
          assigned_mode: assignedMode,
          student_roll: studentRollTarget.trim() ? studentRollTarget.trim().toLowerCase() : null,
          title: assignmentTitle || `${assignedMode.toUpperCase()} Assessment for ${selectedSection}`
        })
      });
      const data = await res.json();
      if (data.ok) {
        setAssignmentSuccess("Assessment mode rule saved successfully!");
        setStudentRollTarget("");
        setAssignmentTitle("");
        loadAssignments();
        setTimeout(() => setAssignmentSuccess(null), 4000);
      }
    } catch (e) {
      console.error("Failed to save assignment", e);
    } finally {
      setSavingAssignment(false);
    }
  };

  // Handle Delete Assignment
  const handleDeleteAssignment = async (id: number) => {
    try {
      await fetch(`${BACKEND_HTTP}/api/faculty/assignment/${id}`, { method: "DELETE" });
      loadAssignments();
    } catch (e) {
      console.error("Failed to delete assignment", e);
    }
  };

  const filteredQuestions = questions.filter(q => 
    (q.question_text || "").toLowerCase().includes(search.toLowerCase()) ||
    (q.subject_key || "").toLowerCase().includes(search.toLowerCase()) ||
    (q.subject || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-[#171717] flex items-center gap-3">
            <Database className="w-8 h-8 text-[#C8102E]" /> Academic Assessment Control
          </h1>
          <p className="text-[#555555] mt-1">
            Review student validation requests, assign mandatory test modes, and oversee the {department?.toUpperCase() || "CSE"} question bank.
          </p>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab("validation")}
            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition ${
              activeTab === "validation" 
                ? "bg-[#C8102E] text-white shadow-md" 
                : "bg-white border border-[#E5E5E5] text-[#555555] hover:bg-slate-50"
            }`}
          >
            <Clock className="w-4 h-4" /> Validation Tasks
            {validationTasks.filter(t => t.status === "pending").length > 0 && (
              <span className="ml-1 bg-white text-[#C8102E] text-xs px-2 py-0.5 rounded-full font-bold">
                {validationTasks.filter(t => t.status === "pending").length}
              </span>
            )}
          </button>
          
          <button 
            onClick={() => setActiveTab("assignments")}
            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition ${
              activeTab === "assignments" 
                ? "bg-[#C8102E] text-white shadow-md" 
                : "bg-white border border-[#E5E5E5] text-[#555555] hover:bg-slate-50"
            }`}
          >
            <Lock className="w-4 h-4" /> Mode Assignments
          </button>

          <button 
            onClick={() => setActiveTab("bank")}
            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition ${
              activeTab === "bank" 
                ? "bg-[#C8102E] text-white shadow-md" 
                : "bg-white border border-[#E5E5E5] text-[#555555] hover:bg-slate-50"
            }`}
          >
            <BookOpen className="w-4 h-4" /> Question Bank
          </button>
        </div>
      </header>

      {/* Success Notification Banners */}
      {approvalSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3 text-sm font-medium">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          {approvalSuccess}
        </div>
      )}

      {assignmentSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3 text-sm font-medium">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          {assignmentSuccess}
        </div>
      )}

      {/* TAB 1: VALIDATION REQUESTS */}
      {activeTab === "validation" && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-[#171717] flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#C8102E]" /> Pending Student Validation Queries
                </h2>
                <p className="text-xs text-[#666666] mt-1">
                  When students choose an AI-drafted subject, they submit a validation query. Approving will publish the questions and notify the student.
                </p>
              </div>
              <button 
                onClick={loadValidationTasks}
                className="text-xs font-semibold text-[#555555] hover:text-[#C8102E] border px-3 py-1.5 rounded-lg"
              >
                Refresh
              </button>
            </div>

            {loadingTasks ? (
              <div className="py-12 text-center text-sm text-[#777777]">Loading validation queries...</div>
            ) : validationTasks.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed border-[#E5E5E5] rounded-xl text-[#777777]">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="text-base font-semibold text-[#171717]">All Question Banks Up To Date</p>
                <p className="text-xs text-[#777777] mt-1">No pending validation requests from students for {department?.toUpperCase()}.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E5E5] text-xs uppercase tracking-wider text-[#666666] bg-[#F8F8F8]">
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Roll Number</th>
                      <th className="py-3 px-4">Questions</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5]">
                    {validationTasks.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50 transition">
                        <td className="py-3.5 px-4 font-bold text-[#171717]">{t.subject}</td>
                        <td className="py-3.5 px-4 text-[#444444]">{t.student_name}</td>
                        <td className="py-3.5 px-4 font-mono text-xs text-[#555555] uppercase">{t.student_roll}</td>
                        <td className="py-3.5 px-4 text-xs font-medium text-[#555555]">{t.question_count || 5} Questions</td>
                        <td className="py-3.5 px-4">
                          {t.status === "pending" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3" /> Pending Review
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Approved
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {t.status === "pending" ? (
                            <button
                              onClick={() => handleApproveSubject(t.subject)}
                              disabled={approvingSubject === t.subject}
                              className="bg-emerald-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold hover:bg-emerald-700 transition flex items-center gap-1.5 ml-auto disabled:opacity-50"
                            >
                              <ShieldCheck className="w-4 h-4" />
                              {approvingSubject === t.subject ? "Approving..." : "Approve & Notify"}
                            </button>
                          ) : (
                            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1 justify-end">
                              <Check className="w-3.5 h-3.5" /> Approved
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MODE ASSIGNMENT */}
      {activeTab === "assignments" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-1 bg-white border border-[#E5E5E5] rounded-2xl p-6 shadow-sm h-fit">
            <h2 className="text-lg font-bold text-[#171717] flex items-center gap-2 mb-2">
              <Lock className="w-5 h-5 text-[#C8102E]" /> Mandate Assessment Mode
            </h2>
            <p className="text-xs text-[#666666] mb-6">
              Lock the test mode (MCQ, Oral Viva, or Written) for an entire section or an individual student.
            </p>

            <form onSubmit={handleSaveAssignment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#555555] uppercase mb-1">Academic Year</label>
                <select 
                  value={academicYear} 
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl p-2.5 text-sm text-[#171717] focus:outline-none focus:border-[#C8102E]"
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#555555] uppercase mb-1">Target Section</label>
                <select 
                  value={selectedSection} 
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl p-2.5 text-sm text-[#171717] focus:outline-none focus:border-[#C8102E]"
                >
                  <option value="Section A">Section A</option>
                  <option value="Section B">Section B</option>
                  <option value="Section C">Section C</option>
                  <option value="Section D">Section D</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#555555] uppercase mb-1">Assigned Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "quiz", label: "MCQ Quiz" },
                    { id: "oral", label: "Oral Viva" },
                    { id: "written", label: "Written" },
                    { id: "open", label: "Open Choice" }
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setAssignedMode(m.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-center transition ${
                        assignedMode === m.id
                          ? "border-[#C8102E] bg-[#FFF1F2] text-[#C8102E]"
                          : "border-[#E5E5E5] text-[#555555] hover:bg-slate-50"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#555555] uppercase mb-1">
                  Individual Student Roll (Optional)
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. 23eg107b35 (Leave blank for whole section)"
                  value={studentRollTarget}
                  onChange={(e) => setStudentRollTarget(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl p-2.5 text-sm text-[#171717] font-mono focus:outline-none focus:border-[#C8102E]"
                />
                <p className="text-[11px] text-[#777777] mt-1">If specified, only overrides this student.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#555555] uppercase mb-1">Assignment Title / Instructions</label>
                <input 
                  type="text" 
                  placeholder="e.g. Mid-Term Viva Voce"
                  value={assignmentTitle}
                  onChange={(e) => setAssignmentTitle(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl p-2.5 text-sm text-[#171717] focus:outline-none focus:border-[#C8102E]"
                />
              </div>

              <button
                type="submit"
                disabled={savingAssignment}
                className="w-full bg-[#C8102E] text-white py-3 rounded-xl text-sm font-bold hover:bg-[#A00D24] transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50 mt-4"
              >
                <Lock className="w-4 h-4" />
                {savingAssignment ? "Enforcing Rule..." : "Enforce Mode Assignment"}
              </button>
            </form>
          </div>

          {/* Active Assignments Table */}
          <div className="lg:col-span-2 bg-white border border-[#E5E5E5] rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#171717] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#C8102E]" /> Active Mode Restrictions ({assignments.length})
              </h2>
              <button 
                onClick={loadAssignments}
                className="text-xs font-semibold text-[#555555] hover:text-[#C8102E] border px-3 py-1.5 rounded-lg"
              >
                Refresh
              </button>
            </div>

            {loadingAssignments ? (
              <div className="py-12 text-center text-sm text-[#777777]">Loading active rules...</div>
            ) : assignments.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed border-[#E5E5E5] rounded-xl text-[#777777]">
                <Unlock className="w-10 h-10 text-slate-400 mx-auto mb-2 opacity-80" />
                <p className="text-base font-semibold text-[#171717]">All Sections Open Choice</p>
                <p className="text-xs text-[#777777] mt-1">Students can freely choose between MCQ, Oral Viva, or Written assessments.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E5E5] text-xs uppercase tracking-wider text-[#666666] bg-[#F8F8F8]">
                      <th className="py-3 px-4">Scope</th>
                      <th className="py-3 px-4">Mandated Mode</th>
                      <th className="py-3 px-4">Title / Note</th>
                      <th className="py-3 px-4">Assigned By</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5]">
                    {assignments.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50 transition">
                        <td className="py-3.5 px-4 font-bold text-[#171717]">
                          {a.student_roll ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2.5 py-1 rounded-md font-mono">
                              Student: {a.student_roll.toUpperCase()}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md">
                              {a.academic_year} - {a.section}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            a.assigned_mode === "quiz" ? "bg-amber-100 text-amber-800" :
                            a.assigned_mode === "oral" ? "bg-rose-100 text-rose-800" :
                            a.assigned_mode === "written" ? "bg-sky-100 text-sky-800" :
                            "bg-emerald-100 text-emerald-800"
                          }`}>
                            <Lock className="w-3 h-3" /> {a.assigned_mode.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-[#555555]">{a.title || "-"}</td>
                        <td className="py-3.5 px-4 text-xs font-mono text-[#666666]">{a.faculty_email}</td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleDeleteAssignment(a.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Remove Lock"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: QUESTION BANK */}
      {activeTab === "bank" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white border border-[#E5E5E5] p-4 rounded-2xl shadow-sm">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[#AAAAAA]" />
              <input 
                type="text" 
                placeholder="Search questions or subjects..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-[#C8102E] transition w-80"
              />
            </div>
            <div className="text-xs text-[#666666]">
              Showing <span className="font-bold text-[#171717]">{filteredQuestions.length}</span> questions
            </div>
          </div>

          <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F8F8F8] border-b border-[#E5E5E5] text-[#555555] font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-6">Question Text</th>
                  <th className="py-3.5 px-6">Subject</th>
                  <th className="py-3.5 px-6">Max Marks</th>
                  <th className="py-3.5 px-6">Time Limit</th>
                  <th className="py-3.5 px-6">Validation Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {loadingQuestions ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#777777]">Loading question bank...</td>
                  </tr>
                ) : filteredQuestions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#777777]">No questions found.</td>
                  </tr>
                ) : (
                  filteredQuestions.map((q) => (
                    <tr key={q.id} className="hover:bg-[#FAFAFA] transition">
                      <td className="py-4 px-6 text-[#171717] font-medium max-w-md">{q.question_text}</td>
                      <td className="py-4 px-6 text-[#555555] font-medium">{q.subject || q.subject_key}</td>
                      <td className="py-4 px-6 text-[#171717] font-semibold">{q.max_marks || 10} pts</td>
                      <td className="py-4 px-6 text-[#555555]">{q.time_limit_sec || 120}s</td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Approved
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
