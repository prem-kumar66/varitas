"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, User, Hash, BookOpen, ArrowRight, ArrowLeft, Phone, Calendar, Lock, CheckCircle2 } from "lucide-react";

export default function StudentLoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  // Common Form States
  const [studentName, setStudentName] = useState("");
  const [rollNumber, setRollNumber] = useState("23eg107b35");
  const [mobileNumber, setMobileNumber] = useState("");
  const [academicYear, setAcademicYear] = useState("3rd Year");
  const [department, setDepartment] = useState("ai_ml");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"written" | "oral" | "quiz">("written");

  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Handle Student Sign In
  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollNumber.trim() || !password.trim()) return;

    setIsLoading(true);

    // Save student session
    const studentAuth = {
      studentName: studentName.trim() || "Student Candidate",
      rollNumber: rollNumber.trim(),
      mobileNumber: mobileNumber.trim() || "N/A",
      academicYear,
      department,
      mode,
      loggedInAt: Date.now(),
    };

    localStorage.setItem("veritas_student_auth", JSON.stringify(studentAuth));

    setTimeout(() => {
      router.push("/candidate");
    }, 500);
  };

  // Handle Student Sign Up
  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !rollNumber.trim() || !password.trim()) return;

    setIsLoading(true);

    const studentAuth = {
      studentName: studentName.trim(),
      rollNumber: rollNumber.trim(),
      mobileNumber: mobileNumber.trim(),
      academicYear,
      department,
      mode,
      loggedInAt: Date.now(),
    };

    localStorage.setItem("veritas_student_auth", JSON.stringify(studentAuth));
    setSuccessMsg("Account registered successfully! Redirecting to test portal...");

    setTimeout(() => {
      router.push("/candidate");
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
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#171717]">Student Portal</h1>
          <p className="text-xs text-[#555555]">Sign in to your account or create a new student profile for assessments.</p>
        </div>

        {/* Tab Switcher: Sign In vs Sign Up */}
        <div className="flex bg-[#F8F8F8] p-1.5 rounded-xl border border-[#E5E5E5]">
          <button
            type="button"
            onClick={() => setTab("signin")}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition text-center ${
              tab === "signin"
                ? "bg-[#C8102E] text-white shadow-md"
                : "text-[#555555] hover:text-[#171717]"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setTab("signup")}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition text-center ${
              tab === "signup"
                ? "bg-[#C8102E] text-white shadow-md"
                : "text-[#555555] hover:text-[#171717]"
            }`}
          >
            Sign Up
          </button>
        </div>

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-xs text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* SIGN IN FORM */}
        {tab === "signin" ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                Roll Number / Student ID
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                <input
                  type="text"
                  required
                  placeholder="23eg107b35"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-3 pl-10 pr-4 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E] transition font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-3 pl-10 pr-4 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E] transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-[#C8102E] hover:bg-[#A50E25] text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 text-xs uppercase tracking-wider mt-2"
            >
              {isLoading ? "Signing in..." : "Sign In to Student Portal"} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* SIGN UP FORM */
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-4 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E] transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                  Roll Number
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                  <input
                    type="text"
                    required
                    placeholder="23eg107b35"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-3 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E] transition font-mono"
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
                Current Academic Year
              </label>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 px-4 text-xs text-[#171717] focus:outline-none focus:border-[#C8102E] transition"
              >
                <option value="1st Year">1st Year (Freshman)</option>
                <option value="2nd Year">2nd Year (Sophomore)</option>
                <option value="3rd Year">3rd Year (Junior)</option>
                <option value="4th Year / Final Year">4th Year / Final Year (Senior)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                Department / Stream
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 px-4 text-xs text-[#171717] focus:outline-none focus:border-[#C8102E] transition"
              >
                <option value="ai_ml">Artificial Intelligence &amp; Machine Learning</option>
              </select>
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
                  placeholder="Create a secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-4 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E] transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-[#C8102E] hover:bg-[#A50E25] text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 text-xs uppercase tracking-wider mt-2"
            >
              {isLoading ? "Creating Account..." : "Create Account & Start Test"} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        <div className="text-center pt-2">
          <Link href="/login/teacher" className="text-xs text-[#555555] hover:text-[#C8102E] transition">
            Are you a Teacher / Faculty Member? Access Portal Here
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
