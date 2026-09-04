"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, UserCheck, KeyRound, Building, ArrowRight, ArrowLeft, ShieldAlert, User, Lock, Phone, Award, CheckCircle2 } from "lucide-react";

export default function TeacherLoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  // Common Form States
  const [facultyName, setFacultyName] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [passcode, setPasscode] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [department, setDepartment] = useState("Computer Science & Engineering");
  const [designation, setDesignation] = useState("Professor");

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Handle Faculty Sign In
  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!teacherId.trim() || !passcode.trim()) return;

    setIsLoading(true);

    if (passcode.trim() === "teacher123" || passcode.trim() === "admin" || passcode.trim() === "admin123" || passcode.trim().length >= 4) {
      const teacherAuth = {
        teacherName: facultyName.trim() || "Faculty Evaluator",
        teacherId: teacherId.trim(),
        department,
        designation,
        role: "Evaluator / Professor",
        loggedInAt: Date.now(),
      };

      localStorage.setItem("veritas_teacher_auth", JSON.stringify(teacherAuth));

      setTimeout(() => {
        router.push("/teacher/select-department");
      }, 500);
    } else {
      setIsLoading(false);
      setError("Invalid Passcode! Use 'teacher123' or 'admin123' to log in.");
    }
  };

  // Handle Faculty Sign Up
  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!facultyName.trim() || !teacherId.trim() || !passcode.trim()) return;

    setIsLoading(true);

    const teacherAuth = {
      teacherName: facultyName.trim(),
      teacherId: teacherId.trim(),
      mobileNumber: mobileNumber.trim(),
      department,
      designation,
      role: designation,
      loggedInAt: Date.now(),
    };

    localStorage.setItem("veritas_teacher_auth", JSON.stringify(teacherAuth));
    setSuccessMsg("Faculty Profile created successfully! Redirecting to dashboard...");

    setTimeout(() => {
      router.push("/teacher/select-department");
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#F8F8F8] text-[#171717] flex flex-col justify-center items-center px-6 py-12">
      <Link
        href="/"
        className="absolute top-8 left-8 text-xs uppercase tracking-wider text-[#C8102E] hover:text-[#A50E25] flex items-center gap-2 font-semibold"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Home
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white border border-[#E5E5E5] rounded-3xl p-8 shadow-lg space-y-6"
      >
        {/* Header Icon & Title */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-[#FFF1F2] border border-[#C8102E]/20 rounded-2xl flex items-center justify-center mx-auto text-[#C8102E] shadow-sm">
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#171717]">Faculty &amp; Admin Portal</h1>
          <p className="text-xs text-[#555555]">Sign in to your faculty account or register as an evaluator.</p>
        </div>

        {/* Tab Switcher: Sign In vs Sign Up */}
        <div className="flex bg-[#F8F8F8] p-1.5 rounded-xl border border-[#E5E5E5]">
          <button
            type="button"
            onClick={() => { setTab("signin"); setError(null); }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition text-center ${
              tab === "signin"
                ? "bg-[#C8102E] text-white shadow-md"
                : "text-[#555555] hover:text-[#171717]"
            }`}
          >
            Faculty Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab("signup"); setError(null); }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition text-center ${
              tab === "signup"
                ? "bg-[#C8102E] text-white shadow-md"
                : "text-[#555555] hover:text-[#171717]"
            }`}
          >
            Faculty Sign Up
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-xs text-red-700 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-xs text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* FACULTY SIGN IN FORM */}
        {tab === "signin" ? (
          <form onSubmit={handleSignIn} className="space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-2">
                Faculty ID or Official Email
              </label>
              <div className="relative">
                <UserCheck className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                <input
                  type="text"
                  required
                  placeholder="prof.sharma@college.edu"
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-3 pl-10 pr-4 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E] transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-2">
                Evaluator Passcode / Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                <input
                  type="password"
                  required
                  placeholder="Passcode (e.g. teacher123)"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-3 pl-10 pr-4 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E] transition"
                />
              </div>
              <span className="text-[10px] text-[#555555] mt-1 block">Default demo passcode: <code className="text-[#C8102E]">teacher123</code></span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-[#C8102E] hover:bg-[#A50E25] text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 text-xs uppercase tracking-wider mt-2"
            >
              {isLoading ? "Authenticating..." : "Sign In to Faculty Portal"} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* FACULTY SIGN UP FORM */
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                Full Name with Salutation
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Rajesh Sharma"
                  value={facultyName}
                  onChange={(e) => setFacultyName(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-4 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E] transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                  Faculty ID / Email
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                  <input
                    type="text"
                    required
                    placeholder="prof.sharma@college.edu"
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                    className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-3 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E] transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                  Mobile Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-3.5 text-[#555555]" />
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-9 pr-3 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E] transition"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                Department
              </label>
              <div className="relative">
                <Building className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-4 text-xs text-[#171717] focus:outline-none focus:border-[#C8102E] transition"
                >
                  <option value="Computer Science & Engineering">Computer Science &amp; Engineering</option>
                  <option value="Data Science & Artificial Intelligence">Data Science &amp; Artificial Intelligence</option>
                  <option value="Business Administration">Business Administration</option>
                  <option value="General Aptitude & Placement Cell">General Aptitude &amp; Placement Cell</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                Designation
              </label>
              <div className="relative">
                <Award className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                <select
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-4 text-xs text-[#171717] focus:outline-none focus:border-[#C8102E] transition"
                >
                  <option value="Head of Department (HOD)">Head of Department (HOD)</option>
                  <option value="Professor">Professor</option>
                  <option value="Associate Professor">Associate Professor</option>
                  <option value="Placement Officer">Placement Officer</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                Create Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                <input
                  type="password"
                  required
                  placeholder="Create password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-4 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E] transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-[#C8102E] hover:bg-[#A50E25] text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 text-xs uppercase tracking-wider mt-2"
            >
              {isLoading ? "Creating Profile..." : "Create Faculty Profile & Login"} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        <div className="text-center pt-2">
          <Link href="/login/student" className="text-xs text-[#555555] hover:text-[#C8102E] transition">
            Are you a Student? Click here for Student Portal
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
