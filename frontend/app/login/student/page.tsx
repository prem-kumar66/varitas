"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  GraduationCap, 
  User, 
  Hash, 
  BookOpen, 
  ArrowRight, 
  ArrowLeft, 
  Phone, 
  Calendar, 
  Lock, 
  CheckCircle2, 
  Mail, 
  ShieldAlert, 
  Building,
  Eye,
  EyeOff,
  KeyRound,
  X,
  RefreshCw
} from "lucide-react";

const ALLOWED_DEPARTMENTS = [
  { code: "cse", label: "Computer Science & Engineering (CSE)" },
  { code: "ai", label: "Artificial Intelligence (AI)" },
  { code: "aiml", label: "AI & Machine Learning (AIML)" },
  { code: "data science", label: "Data Science" },
  { code: "it", label: "Information Technology (IT)" },
  { code: "ece", label: "Electronics & Communication (ECE)" },
  { code: "eee", label: "Electrical & Electronics (EEE)" },
  { code: "civil", label: "Civil Engineering (CIVIL)" },
  { code: "mech", label: "Mechanical Engineering (MECH)" },
  { code: "ecm", label: "Electronics & Computer Engineering (ECM)" },
];

export default function StudentLoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  // Common Form States
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [academicYear, setAcademicYear] = useState("3rd Year");
  const [department, setDepartment] = useState("cse");
  const [section, setSection] = useState("Section A");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"written" | "oral" | "quiz">("written");

  // Auto-detect Department, Year, and Section from standard Anurag University Roll Number
  const handleRollNumberChange = (val: string) => {
    setRollNumber(val);
    const raw = val.trim().toLowerCase();
    const match = raw.match(/^(\d{2})eg(\d{3})([a-r])(\d{0,2})$/i);
    if (match) {
      const yrCode = match[1];
      const deptCode = match[2];
      const secCode = match[3].toUpperCase();

      const yearMap: Record<string, string> = {
        "23": "4th Year",
        "24": "3rd Year",
        "25": "2nd Year",
        "26": "1st Year",
      };
      const deptMap: Record<string, string> = {
        "107": "aiml",
        "106": "ai",
        "105": "cse",
        "112": "it",
        "109": "cse",
        "110": "data science",
        "104": "ece",
        "101": "civil",
        "103": "mech",
        "502": "eee",
        "111": "ecm",
      };

      if (yearMap[yrCode]) setAcademicYear(yearMap[yrCode]);
      if (deptMap[deptCode]) setDepartment(deptMap[deptCode]);
      if (secCode) setSection(`Section ${secCode}`);
    }
  };

  // Visibility Toggles (Eye Icon)
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);

  // Forgot Password Modal States
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<"email" | "otp" | "reset" | "success">("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [devCodeNotice, setDevCodeNotice] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Validate College Email Domain
  const checkEmail = (email: string) => {
    return email.trim().toLowerCase().endsWith("@anurag.edu.in");
  };

  const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";

  // Forgot Password Step 1: Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);
    setDevCodeNotice(null);

    const clean = forgotEmail.trim().toLowerCase();
    if (!checkEmail(clean)) {
      setForgotError("Only college email addresses ending with @anurag.edu.in are allowed.");
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/auth/forgot-password/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: clean, user_type: "student" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to request verification code.");
      }

      setForgotSuccess(data.message);
      if (data.dev_code) {
        setDevCodeNotice(data.dev_code);
        setForgotOtp(data.dev_code);
      }
      setForgotStep("otp");
    } catch (err: any) {
      setForgotError(err.message || "Failed to send verification code. Ensure your email is registered.");
    } finally {
      setForgotLoading(false);
    }
  };

  // Forgot Password Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);

    if (!forgotOtp.trim() || forgotOtp.trim().length !== 6) {
      setForgotError("Please enter the 6-digit verification code.");
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/auth/forgot-password/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotEmail.trim().toLowerCase(),
          otp: forgotOtp.trim(),
          user_type: "student",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Invalid or expired verification code.");
      }

      setForgotSuccess("Code verified! Set your new password.");
      setForgotStep("reset");
    } catch (err: any) {
      setForgotError(err.message || "Invalid or expired verification code.");
    } finally {
      setForgotLoading(false);
    }
  };

  // Forgot Password Step 3: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);

    if (!newPassword || newPassword.length < 4) {
      setForgotError("Password must be at least 4 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setForgotError("Passwords do not match.");
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/auth/forgot-password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotEmail.trim().toLowerCase(),
          otp: forgotOtp.trim(),
          new_password: newPassword,
          user_type: "student",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to reset password.");
      }

      setForgotStep("success");
    } catch (err: any) {
      setForgotError(err.message || "Failed to reset password.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleFinishForgot = () => {
    setShowForgotModal(false);
    setStudentEmail(forgotEmail);
    setPassword("");
    setForgotStep("email");
    setForgotError(null);
    setForgotSuccess(null);
    setSuccessMsg("Password reset successfully! Please enter your new password to sign in.");
  };

  // Handle Student Sign In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = studentEmail.trim().toLowerCase();
    if (!checkEmail(cleanEmail)) {
      setError("Only college email addresses ending with @anurag.edu.in are allowed.");
      return;
    }

    if (!rollNumber.trim() || !password.trim()) {
      setError("Please fill in your Roll Number and Password.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${BACKEND_HTTP}/api/student/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roll_number: rollNumber.trim(),
          password: password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Login failed");
      }

      // Save student session based on DB response
      const dbStudent = data.student;
      const inferredSec = rollNumber.match(/^(\d{2})eg(\d{3})([a-r])/i)
        ? `Section ${rollNumber.match(/^(\d{2})eg(\d{3})([a-r])/i)![3].toUpperCase()}`
        : section || "Section A";

      const studentAuth = {
        studentName: dbStudent.studentName,
        studentEmail: dbStudent.studentEmail,
        candidateEmail: dbStudent.studentEmail,
        rollNumber: dbStudent.rollNumber,
        mobileNumber: dbStudent.mobileNumber,
        academicYear: dbStudent.academicYear,
        department: dbStudent.department,
        section: dbStudent.section || inferredSec,
        mode,
        loggedInAt: Date.now(),
      };

      localStorage.setItem("veritas_student_auth", JSON.stringify(studentAuth));

      setSuccessMsg("Signed in successfully! Launching candidate portal...");
      setTimeout(() => {
        router.push("/candidate");
      }, 500);
    } catch (err: any) {
      if (err.message && err.message.toLowerCase().includes("failed to fetch")) {
        setError("Cannot connect to backend server. Make sure backend is running.");
      } else {
        setError(err.message || "Invalid roll number or password.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Student Sign Up
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = studentEmail.trim().toLowerCase();
    if (!checkEmail(cleanEmail)) {
      setError("Only college email addresses ending with @anurag.edu.in are allowed.");
      return;
    }

    if (!studentName.trim() || !rollNumber.trim() || !password.trim()) {
      setError("Please complete all required fields.");
      return;
    }

    setIsLoading(true);

    try {
      const cleanSec = section.replace(/Section\s+/i, "").trim().toUpperCase() || "A";
      const res = await fetch(`${BACKEND_HTTP}/api/student/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          name: studentName.trim(),
          roll_number: rollNumber.trim(),
          mobile: mobileNumber.trim(),
          academic_year: academicYear,
          department,
          section: cleanSec,
          password: password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Signup failed");
      }

      const dbStudent = data.student;
      const studentAuth = {
        studentName: dbStudent.studentName,
        studentEmail: dbStudent.studentEmail,
        candidateEmail: dbStudent.studentEmail,
        rollNumber: dbStudent.rollNumber,
        mobileNumber: dbStudent.mobileNumber,
        academicYear: dbStudent.academicYear,
        department: dbStudent.department,
        section: dbStudent.section || section,
        mode,
        loggedInAt: Date.now(),
      };

      localStorage.setItem("veritas_student_auth", JSON.stringify(studentAuth));

      setSuccessMsg("Student Profile registered! Starting test session...");
      setTimeout(() => {
        router.push("/candidate");
      }, 600);
    } catch (err: any) {
      if (err.message && err.message.toLowerCase().includes("failed to fetch")) {
        setError("Cannot connect to backend server. Make sure backend is running.");
      } else {
        setError(err.message || "Failed to register account.");
      }
    } finally {
      setIsLoading(false);
    }
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
          <h1 className="text-2xl font-extrabold text-[#171717]">Student Test Portal</h1>
          <p className="text-xs text-[#555555]">
            Access your department examinations using your <strong className="text-[#171717]">@anurag.edu.in</strong> ID.
          </p>
        </div>

        {/* Tab Switcher */}
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
            Candidate Sign In
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
            New Student Register
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-xs text-red-700 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* SIGN IN FORM */}
        {tab === "signin" ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                College Email ID (@anurag.edu.in)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                <input
                  type="email"
                  required
                  placeholder=""
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-3 pl-10 pr-4 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E] transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                Roll Number / Student ID
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                <input
                  type="text"
                  required
                  placeholder=""
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-3 pl-10 pr-4 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E] transition font-mono uppercase"
                />
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
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-3 pl-10 pr-4 text-xs text-[#171717] focus:outline-none focus:border-[#C8102E] transition"
                >
                  {ALLOWED_DEPARTMENTS.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555]">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(true);
                    setForgotStep("email");
                    setForgotEmail(studentEmail);
                    setForgotError(null);
                    setForgotSuccess(null);
                    setDevCodeNotice(null);
                  }}
                  className="text-xs font-semibold text-[#C8102E] hover:text-[#A50E25] transition"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                <input
                  type={showSignInPassword ? "text" : "password"}
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-3 pl-10 pr-10 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E] transition"
                />
                <button
                  type="button"
                  onClick={() => setShowSignInPassword(!showSignInPassword)}
                  className="absolute right-3.5 top-3.5 text-[#777777] hover:text-[#171717] transition"
                  tabIndex={-1}
                  aria-label={showSignInPassword ? "Hide password" : "Show password"}
                >
                  {showSignInPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-[#C8102E] hover:bg-[#A50E25] text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 text-xs uppercase tracking-wider mt-2 disabled:opacity-60"
            >
              {isLoading ? "Signing in..." : "Sign In to Student Portal"} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* SIGN UP FORM */
          <form onSubmit={handleSignUp} className="space-y-3.5">
            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-3 text-[#555555]" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-4 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1">
                College Email ID (@anurag.edu.in)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3 text-[#555555]" />
                <input
                  type="email"
                  required
                  placeholder=""
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-3 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1">
                  Roll Number
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 absolute left-3.5 top-3 text-[#555555]" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. 23eg106d30"
                    value={rollNumber}
                    onChange={(e) => handleRollNumberChange(e.target.value)}
                    className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-3 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E] font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1">
                  Mobile Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-3 text-[#555555]" />
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-9 pr-3 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1">
                  Academic Year
                </label>
                <select
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 px-2 text-xs text-[#171717] focus:outline-none focus:border-[#C8102E]"
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1">
                  Department
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 px-2 text-xs text-[#171717] focus:outline-none focus:border-[#C8102E]"
                >
                  {ALLOWED_DEPARTMENTS.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.label.split(" (")[0]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1">
                  Section
                </label>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 px-2 text-xs text-[#171717] focus:outline-none focus:border-[#C8102E]"
                >
                  {["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R"].map((s) => (
                    <option key={s} value={`Section ${s}`}>
                      Sec {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1">
                Create Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-[#555555]" />
                <input
                  type={showSignUpPassword ? "text" : "password"}
                  required
                  placeholder="Create a secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-10 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E]"
                />
                <button
                  type="button"
                  onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                  className="absolute right-3.5 top-3 text-[#777777] hover:text-[#171717] transition"
                  tabIndex={-1}
                  aria-label={showSignUpPassword ? "Hide password" : "Show password"}
                >
                  {showSignUpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-[#C8102E] hover:bg-[#A50E25] text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 text-xs uppercase tracking-wider mt-2 disabled:opacity-60"
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

      {/* FORGOT PASSWORD MODAL */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl border border-[#E5E5E5] shadow-2xl max-w-md w-full p-6 sm:p-8 space-y-5 relative"
            >
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="absolute top-5 right-5 text-[#888888] hover:text-[#171717] transition p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Step 1: Request OTP */}
              {forgotStep === "email" && (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div className="text-center space-y-2">
                    <div className="w-14 h-14 bg-[#FFF1F2] border border-[#C8102E]/20 rounded-2xl flex items-center justify-center mx-auto text-[#C8102E] shadow-sm">
                      <KeyRound className="w-7 h-7" />
                    </div>
                    <h2 className="text-xl font-extrabold text-[#171717]">Reset Password</h2>
                    <p className="text-xs text-[#555555]">
                      Enter your registered <strong className="text-[#171717]">@anurag.edu.in</strong> student email. We will send a 6-digit verification code.
                    </p>
                  </div>

                  {forgotError && (
                    <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-xs text-red-700 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                      College Email ID
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                      <input
                        type="email"
                        required
                        placeholder="yourname@anurag.edu.in"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-3 pl-10 pr-4 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E] transition"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-3.5 bg-[#C8102E] hover:bg-[#A50E25] text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-60"
                  >
                    {forgotLoading ? "Sending Code..." : "Send Verification Code"} <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* Step 2: Verify OTP */}
              {forgotStep === "otp" && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="text-center space-y-2">
                    <div className="w-14 h-14 bg-[#FFF1F2] border border-[#C8102E]/20 rounded-2xl flex items-center justify-center mx-auto text-[#C8102E] shadow-sm">
                      <Mail className="w-7 h-7" />
                    </div>
                    <h2 className="text-xl font-extrabold text-[#171717]">Verify Email Code</h2>
                    <p className="text-xs text-[#555555]">
                      We sent a 6-digit verification code to <strong className="text-[#171717]">{forgotEmail}</strong>.
                    </p>
                  </div>

                  {devCodeNotice && (
                    <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-900 flex items-center justify-between">
                      <div>
                        <span className="font-bold">Dev/Demo Mode Code: </span>
                        <code className="bg-amber-100 px-2 py-0.5 rounded text-sm font-mono font-bold text-amber-900">{devCodeNotice}</code>
                      </div>
                      <button
                        type="button"
                        onClick={() => setForgotOtp(devCodeNotice)}
                        className="text-[11px] underline font-bold text-amber-800 hover:text-amber-950"
                      >
                        Auto-fill
                      </button>
                    </div>
                  )}

                  {forgotError && (
                    <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-xs text-red-700 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  {forgotSuccess && !forgotError && (
                    <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-xs text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{forgotSuccess}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                      6-Digit Verification Code
                    </label>
                    <div className="relative">
                      <Hash className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                      <input
                        type="text"
                        required
                        maxLength={6}
                        placeholder="••••••"
                        value={forgotOtp}
                        onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ""))}
                        className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-3 pl-10 pr-4 text-center text-lg tracking-[0.4em] font-mono text-[#171717] focus:outline-none focus:border-[#C8102E] transition"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <button
                      type="button"
                      onClick={() => setForgotStep("email")}
                      className="text-[#555555] hover:text-[#171717] underline"
                    >
                      Change email
                    </button>
                    <button
                      type="button"
                      disabled={forgotLoading}
                      onClick={handleRequestOtp}
                      className="text-[#C8102E] hover:text-[#A50E25] font-semibold flex items-center gap-1 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${forgotLoading ? "animate-spin" : ""}`} /> Resend code
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-3.5 bg-[#C8102E] hover:bg-[#A50E25] text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-60"
                  >
                    {forgotLoading ? "Verifying..." : "Verify Code"} <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* Step 3: Set New Password */}
              {forgotStep === "reset" && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="text-center space-y-2">
                    <div className="w-14 h-14 bg-[#FFF1F2] border border-[#C8102E]/20 rounded-2xl flex items-center justify-center mx-auto text-[#C8102E] shadow-sm">
                      <Lock className="w-7 h-7" />
                    </div>
                    <h2 className="text-xl font-extrabold text-[#171717]">Create New Password</h2>
                    <p className="text-xs text-[#555555]">
                      Choose a secure new password for your account.
                    </p>
                  </div>

                  {forgotError && (
                    <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-xs text-red-700 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                      <input
                        type={showResetNewPassword ? "text" : "password"}
                        required
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-3 pl-10 pr-10 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E] transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetNewPassword(!showResetNewPassword)}
                        className="absolute right-3.5 top-3.5 text-[#777777] hover:text-[#171717] transition"
                        tabIndex={-1}
                      >
                        {showResetNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                      <input
                        type={showResetConfirmPassword ? "text" : "password"}
                        required
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-3 pl-10 pr-10 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E] transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                        className="absolute right-3.5 top-3.5 text-[#777777] hover:text-[#171717] transition"
                        tabIndex={-1}
                      >
                        {showResetConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-3.5 bg-[#C8102E] hover:bg-[#A50E25] text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-60"
                  >
                    {forgotLoading ? "Saving Password..." : "Save New Password"} <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* Step 4: Success */}
              {forgotStep === "success" && (
                <div className="text-center space-y-4 py-2">
                  <div className="w-16 h-16 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 shadow-sm">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-xl font-extrabold text-[#171717]">Password Reset Complete!</h2>
                    <p className="text-xs text-[#555555]">
                      Your password has been changed successfully. You can now sign in using your new credentials.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleFinishForgot}
                    className="w-full py-3.5 bg-[#C8102E] hover:bg-[#A50E25] text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                  >
                    Back to Sign In <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
