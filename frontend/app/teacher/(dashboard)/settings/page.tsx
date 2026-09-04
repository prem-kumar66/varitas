"use client";
import { useState, useEffect } from "react";
import { 
  Settings, 
  User, 
  Mail, 
  Phone, 
  Building, 
  Lock, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Sliders, 
  Save, 
  RefreshCcw, 
  HelpCircle,
  Clock,
  Sparkles
} from "lucide-react";
import { useTeacherContext } from "@/components/teacher/TeacherProvider";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";

const DEPT_LABELS: Record<string, string> = {
  cse: "Computer Science & Engineering (CSE)",
  ai: "Artificial Intelligence (AI)",
  aiml: "AI & Machine Learning (AIML)",
  "data science": "Data Science",
  it: "Information Technology (IT)",
  ece: "Electronics & Communication (ECE)",
  eee: "Electrical & Electronics (EEE)",
  civil: "Civil Engineering (CIVIL)",
  mech: "Mechanical Engineering (MECH)",
  ecm: "Electronics & Computer Engineering (ECM)",
  all: "All Departments (Super Admin)",
};

export default function TeacherSettingsPage() {
  const { department, isGuest, isAdmin } = useTeacherContext();

  // Profile State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [facultyDept, setFacultyDept] = useState("cse");
  const [designation, setDesignation] = useState("Assistant Professor");
  const [phone, setPhone] = useState("");

  // Security State
  const [currentPasscode, setCurrentPasscode] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);
  const [isUpdatingPass, setIsUpdatingPass] = useState(false);

  // Evaluation Preferences State
  const [vivaDurationMin, setVivaDurationMin] = useState(15);
  const [mcqCount, setMcqCount] = useState(10);
  const [strictnessLevel, setStrictnessLevel] = useState("Standard");
  const [prefSuccess, setPrefSuccess] = useState(false);

  useEffect(() => {
    const authStr = localStorage.getItem("veritas_teacher_auth");
    if (authStr) {
      try {
        const auth = JSON.parse(authStr);
        setName(auth.teacherName || auth.name || "");
        setEmail(auth.email || auth.teacherId || "");
        setFacultyDept(auth.department || "cse");
        setDesignation(auth.designation || auth.role || "Faculty Evaluator");
        setPhone(auth.phone || "");
      } catch (e) {}
    }

    const savedPrefs = localStorage.getItem("veritas_faculty_prefs");
    if (savedPrefs) {
      try {
        const p = JSON.parse(savedPrefs);
        if (p.vivaDurationMin) setVivaDurationMin(p.vivaDurationMin);
        if (p.mcqCount) setMcqCount(p.mcqCount);
        if (p.strictnessLevel) setStrictnessLevel(p.strictnessLevel);
      } catch (e) {}
    }
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (!newPasscode || newPasscode.length < 4) {
      setPassError("New passcode must be at least 4 characters long.");
      return;
    }

    if (newPasscode !== confirmPasscode) {
      setPassError("New passcodes do not match.");
      return;
    }

    setIsUpdatingPass(true);
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/faculty/update-passcode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          current_passcode: currentPasscode,
          new_passcode: newPasscode
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to update passcode");
      }
      setPassSuccess("Passcode updated successfully!");
      setCurrentPasscode("");
      setNewPasscode("");
      setConfirmPasscode("");
    } catch (err: any) {
      setPassError(err.message || "Failed to update passcode");
    } finally {
      setIsUpdatingPass(false);
    }
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    const prefs = { vivaDurationMin, mcqCount, strictnessLevel };
    localStorage.setItem("veritas_faculty_prefs", JSON.stringify(prefs));
    setPrefSuccess(true);
    setTimeout(() => setPrefSuccess(false), 3000);
  };

  return (
    <div className="max-w-4xl space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-[#171717] flex items-center gap-3">
          <Settings className="w-8 h-8 text-[#C8102E]" /> Account & Assessment Settings
        </h1>
        <p className="text-sm text-[#555555] mt-1">
          Manage your faculty profile, assessment parameters, and account security.
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-[#F0F0F0] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-[#C8102E]">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#171717]">{name || "Faculty Member"}</h2>
              <p className="text-xs text-[#777777] font-mono">{email}</p>
            </div>
          </div>
          <span className="text-xs font-bold uppercase px-3 py-1 bg-red-50 text-[#C8102E] rounded-full border border-red-100">
            {isAdmin ? "Super Administrator" : isGuest ? "Guest Observer" : "Authorized Faculty"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="font-semibold text-[#555555] block mb-1">Full Name</label>
            <input 
              type="text" 
              value={name} 
              disabled 
              className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl px-3 py-2 text-[#555555] font-medium"
            />
          </div>
          <div>
            <label className="font-semibold text-[#555555] block mb-1">Official College Email</label>
            <input 
              type="text" 
              value={email} 
              disabled 
              className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl px-3 py-2 text-[#555555] font-mono"
            />
          </div>
          <div>
            <label className="font-semibold text-[#555555] block mb-1">Assigned Department</label>
            <input 
              type="text" 
              value={DEPT_LABELS[facultyDept] || facultyDept.toUpperCase()} 
              disabled 
              className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl px-3 py-2 text-[#555555] font-medium"
            />
          </div>
          <div>
            <label className="font-semibold text-[#555555] block mb-1">Designation</label>
            <input 
              type="text" 
              value={designation} 
              disabled 
              className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl px-3 py-2 text-[#555555] font-medium"
            />
          </div>
        </div>
        <p className="text-[11px] text-[#777777] italic">
          To change department or official designation, please submit a request through the Domain Queries portal.
        </p>
      </div>

      {/* Assessment Default Preferences */}
      <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-[#F0F0F0] pb-4">
          <Sliders className="w-5 h-5 text-[#C8102E]" />
          <div>
            <h2 className="text-lg font-bold text-[#171717]">Assessment & Viva Parameters</h2>
            <p className="text-xs text-[#777777]">Set your default preferences for generated vivas and quizzes.</p>
          </div>
        </div>

        <form onSubmit={handleSavePreferences} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-semibold text-[#555555] block mb-1">Default Viva Duration</label>
              <select 
                value={vivaDurationMin} 
                onChange={(e) => setVivaDurationMin(Number(e.target.value))}
                className="w-full bg-white border border-[#E5E5E5] rounded-xl px-3 py-2 text-[#171717] focus:outline-none focus:border-[#C8102E]"
              >
                <option value={10}>10 Minutes (Quick Viva)</option>
                <option value={15}>15 Minutes (Standard)</option>
                <option value={20}>20 Minutes (In-Depth)</option>
                <option value={30}>30 Minutes (Comprehensive)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-[#555555] block mb-1">Questions per MCQ Quiz</label>
              <select 
                value={mcqCount} 
                onChange={(e) => setMcqCount(Number(e.target.value))}
                className="w-full bg-white border border-[#E5E5E5] rounded-xl px-3 py-2 text-[#171717] focus:outline-none focus:border-[#C8102E]"
              >
                <option value={5}>5 Questions</option>
                <option value={10}>10 Questions (Standard)</option>
                <option value={15}>15 Questions</option>
                <option value={20}>20 Questions</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-[#555555] block mb-1">AI Rubric Strictness</label>
              <select 
                value={strictnessLevel} 
                onChange={(e) => setStrictnessLevel(e.target.value)}
                className="w-full bg-white border border-[#E5E5E5] rounded-xl px-3 py-2 text-[#171717] focus:outline-none focus:border-[#C8102E]"
              >
                <option value="Lenient">Lenient (Conceptual Focus)</option>
                <option value="Standard">Standard (Balanced Academic)</option>
                <option value="Strict">Strict (Keywords & Syntax Heavy)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {prefSuccess && (
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Preferences saved locally!
              </span>
            )}
            <button
              type="submit"
              className="ml-auto flex items-center gap-2 bg-[#171717] hover:bg-[#2e2e2e] text-white text-xs font-bold px-4 py-2 rounded-xl transition"
            >
              <Save className="w-4 h-4" /> Save Parameters
            </button>
          </div>
        </form>
      </div>

      {/* Security / Password Card */}
      <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-[#F0F0F0] pb-4">
          <Lock className="w-5 h-5 text-[#C8102E]" />
          <div>
            <h2 className="text-lg font-bold text-[#171717]">Security & Passcode</h2>
            <p className="text-xs text-[#777777]">Change your portal access passcode.</p>
          </div>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
          {passError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-[#C8102E] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{passError}</span>
            </div>
          )}

          {passSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{passSuccess}</span>
            </div>
          )}

          <div>
            <label className="font-semibold text-xs text-[#555555] block mb-1">Current Passcode</label>
            <input 
              type="password" 
              placeholder="Enter current password"
              value={currentPasscode}
              onChange={(e) => setCurrentPasscode(e.target.value)}
              className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#C8102E]"
            />
          </div>

          <div>
            <label className="font-semibold text-xs text-[#555555] block mb-1">New Passcode</label>
            <input 
              type="password" 
              placeholder="Min 4 characters"
              value={newPasscode}
              onChange={(e) => setNewPasscode(e.target.value)}
              className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#C8102E]"
            />
          </div>

          <div>
            <label className="font-semibold text-xs text-[#555555] block mb-1">Confirm New Passcode</label>
            <input 
              type="password" 
              placeholder="Re-enter new password"
              value={confirmPasscode}
              onChange={(e) => setConfirmPasscode(e.target.value)}
              className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#C8102E]"
            />
          </div>

          <button
            type="submit"
            disabled={isUpdatingPass}
            className="flex items-center gap-2 bg-[#C8102E] hover:bg-[#a00d24] text-white text-xs font-bold px-4 py-2.5 rounded-xl transition disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            {isUpdatingPass ? "Updating..." : "Update Passcode"}
          </button>
        </form>
      </div>

      {/* University System Info */}
      <div className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-3xl p-5 text-xs text-[#777777] flex items-center justify-between">
        <div>
          <p className="font-bold text-[#171717]">Anurag University — Veritas Evaluation Portal v2.4</p>
          <p className="text-[11px]">Authorized for internal academic viva-voce and continuous evaluation.</p>
        </div>
        <span className="font-mono text-[10px] bg-white border border-[#E5E5E5] px-2.5 py-1 rounded-full text-emerald-700 font-semibold">
          ● System Active
        </span>
      </div>
    </div>
  );
}
