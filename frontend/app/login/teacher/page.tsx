"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BookOpen, 
  UserCheck, 
  KeyRound, 
  Building, 
  ArrowRight, 
  ArrowLeft, 
  ShieldAlert, 
  User, 
  Lock, 
  Phone, 
  Award, 
  CheckCircle2, 
  UserX,
  Compass,
  Eye,
  EyeOff,
  Mail,
  Hash,
  X,
  RefreshCw
} from "lucide-react";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";

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

export default function TeacherLoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"signin" | "signup" | "guest">("signin");

  // Common Form States
  const [facultyName, setFacultyName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [department, setDepartment] = useState("cse");
  const [designation, setDesignation] = useState("Professor");

  // Visibility Toggles (Eye Icon)
  const [showSignInPasscode, setShowSignInPasscode] = useState(false);
  const [showSignUpPasscode, setShowSignUpPasscode] = useState(false);
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

  // Guest State
  const [guestName, setGuestName] = useState("Guest Evaluator");
  const [guestDept, setGuestDept] = useState("cse");

  const [error, setError] = useState<string | null>(null);
  const [isDuplicateDept, setIsDuplicateDept] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Validate College Email Domain
  const checkEmail = (email: string) => {
    return email.trim().toLowerCase().endsWith("@anurag.edu.in");
  };

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
        body: JSON.stringify({ email: clean, user_type: "faculty" }),
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
      setForgotError(err.message || "Failed to send verification code. Ensure your faculty email is registered.");
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
          user_type: "faculty",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Invalid or expired verification code.");
      }

      setForgotSuccess("Code verified! Set your new passcode.");
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
          user_type: "faculty",
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
    setTeacherEmail(forgotEmail);
    setPasscode("");
    setForgotStep("email");
    setForgotError(null);
    setForgotSuccess(null);
    setSuccessMsg("Passcode reset successfully! Please sign in with your new passcode.");
  };

  // Handle Faculty Sign In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsDuplicateDept(false);

    const emailClean = teacherEmail.trim().toLowerCase();
    if (!checkEmail(emailClean)) {
      setError("Only college email addresses ending with @anurag.edu.in are allowed.");
      return;
    }

    if (!passcode.trim()) {
      setError("Please enter your password.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${BACKEND_HTTP}/api/faculty/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailClean,
          passcode: passcode.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Authentication failed");
      }

      const faculty = data.faculty;
      const isAdminUser = Boolean(faculty.is_admin || faculty.email?.toLowerCase() === "admin@anurag.edu.in" || faculty.department === "all");
      const teacherAuth = {
        teacherName: faculty.name || facultyName || (isAdminUser ? "System Administrator" : "Faculty Evaluator"),
        teacherId: faculty.email,
        email: faculty.email,
        department: faculty.department || (isAdminUser ? "all" : "cse"),
        designation: faculty.designation || designation,
        role: faculty.role || (isAdminUser ? "Dean / Super Admin" : "Professor"),
        is_guest: false,
        is_admin: isAdminUser,
        token: data.token,
        loggedInAt: Date.now(),
      };

      localStorage.setItem("veritas_teacher_auth", JSON.stringify(teacherAuth));
      if (data.token) {
        localStorage.setItem("veritas_teacher_token", data.token);
      }
      localStorage.setItem("veritas_teacher_dept", faculty.department || (isAdminUser ? "all" : "cse"));

      setSuccessMsg(isAdminUser ? "Welcome Admin! Redirecting to Admin Panel..." : "Signed in successfully! Redirecting...");
      setTimeout(() => {
        if (isAdminUser) {
          router.push("/teacher/admin");
        } else {
          router.push("/teacher/dashboard");
        }
      }, 500);
    } catch (err: any) {
      setIsLoading(false);
      if (err.message && err.message.toLowerCase().includes("failed to fetch")) {
        setError("Cannot connect to backend server. Make sure backend is running on http://127.0.0.1:8000");
      } else {
        setError(err.message || "Invalid credentials. Please check your email and passcode or register.");
      }
    }
  };

  // Handle Faculty Sign Up
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsDuplicateDept(false);

    const emailClean = teacherEmail.trim().toLowerCase();
    if (!checkEmail(emailClean)) {
      setError("Only college email addresses ending with @anurag.edu.in are allowed.");
      return;
    }

    if (!facultyName.trim() || !passcode.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${BACKEND_HTTP}/api/faculty/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailClean,
          name: facultyName.trim(),
          department,
          phone: mobileNumber.trim(),
          designation,
          passcode: passcode.trim(),
        }),
      });

      const data = await res.json();
      if (res.status === 409 || data.detail === "already signed up for one dept") {
        setIsDuplicateDept(true);
        setError("already signed up for one dept");
        setIsLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(data.detail || "Signup failed");
      }

      const faculty = data.faculty;
      const teacherAuth = {
        teacherName: faculty.name,
        teacherId: faculty.email,
        email: faculty.email,
        mobileNumber: faculty.phone,
        department: faculty.department,
        designation: faculty.designation,
        role: faculty.designation,
        is_guest: false,
        loggedInAt: Date.now(),
      };

      localStorage.setItem("veritas_teacher_auth", JSON.stringify(teacherAuth));
      localStorage.setItem("veritas_teacher_dept", faculty.department);

      setSuccessMsg("Faculty Profile registered in your assigned department! Redirecting...");
      setTimeout(() => {
        router.push("/teacher/dashboard");
      }, 700);
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || "Failed to create faculty profile");
    }
  };

  // Handle Guest Faculty Login
  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch(`${BACKEND_HTTP}/api/faculty/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: guestName.trim() || "Guest Faculty",
          department: guestDept,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Guest signin failed");

      const faculty = data.faculty;
      const teacherAuth = {
        teacherName: faculty.name,
        teacherId: faculty.email,
        email: faculty.email,
        department: faculty.department,
        designation: "Guest Observer",
        role: "Guest Faculty",
        is_guest: true,
        token: data.token,
        loggedInAt: Date.now(),
      };

      localStorage.setItem("veritas_teacher_auth", JSON.stringify(teacherAuth));
      if (data.token) {
        localStorage.setItem("veritas_teacher_token", data.token);
      }
      localStorage.setItem("veritas_teacher_dept", faculty.department);

      setSuccessMsg("Logged in as Guest Faculty (Limited Permissions). Redirecting...");
      setTimeout(() => {
        router.push("/teacher/dashboard");
      }, 500);
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || "Failed guest login");
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
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#171717]">Faculty &amp; Admin Portal</h1>
          <p className="text-xs text-[#555555]">
            Authorized department access with verified <strong className="text-[#171717]">@anurag.edu.in</strong> credentials.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-[#F8F8F8] p-1.5 rounded-xl border border-[#E5E5E5]">
          <button
            type="button"
            onClick={() => { setTab("signin"); setError(null); setIsDuplicateDept(false); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition text-center ${
              tab === "signin"
                ? "bg-[#C8102E] text-white shadow-md"
                : "text-[#555555] hover:text-[#171717]"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab("signup"); setError(null); setIsDuplicateDept(false); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition text-center ${
              tab === "signup"
                ? "bg-[#C8102E] text-white shadow-md"
                : "text-[#555555] hover:text-[#171717]"
            }`}
          >
            Sign Up
          </button>
          <button
            type="button"
            onClick={() => { setTab("guest"); setError(null); setIsDuplicateDept(false); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition text-center ${
              tab === "guest"
                ? "bg-[#171717] text-white shadow-md"
                : "text-[#555555] hover:text-[#171717]"
            }`}
          >
            Guest View
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-xs text-red-700 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
            
            {/* If duplicate dept error */}
            {isDuplicateDept && (
              <div className="pt-2 border-t border-red-200">
                <p className="text-[11px] text-red-600">
                  Faculty members can only belong to one department. If your department or domain has shifted, please contact college administration.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* FACULTY SIGN IN FORM */}
        {tab === "signin" && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-2">
                College Email ID (@anurag.edu.in)
              </label>
              <div className="relative">
                <UserCheck className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                <input
                  type="email"
                  required
                  placeholder="faculty.name@anurag.edu.in"
                  value={teacherEmail}
                  onChange={(e) => setTeacherEmail(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-3 pl-10 pr-4 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E] transition"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555]">
                  Evaluator Passcode / Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(true);
                    setForgotStep("email");
                    setForgotEmail(teacherEmail);
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
                <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                <input
                  type={showSignInPasscode ? "text" : "password"}
                  required
                  placeholder="Enter passcode"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-3 pl-10 pr-10 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E] transition"
                />
                <button
                  type="button"
                  onClick={() => setShowSignInPasscode(!showSignInPasscode)}
                  className="absolute right-3.5 top-3.5 text-[#777777] hover:text-[#171717] transition"
                  tabIndex={-1}
                  aria-label={showSignInPasscode ? "Hide passcode" : "Show passcode"}
                >
                  {showSignInPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-[#C8102E] hover:bg-[#A50E25] text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 text-xs uppercase tracking-wider mt-2 disabled:opacity-60"
            >
              {isLoading ? "Authenticating..." : "Sign In to Department Portal"} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* FACULTY SIGN UP FORM */}
        {tab === "signup" && (
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
                  placeholder="Dr. Rajesh Sharma"
                  value={facultyName}
                  onChange={(e) => setFacultyName(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-4 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1">
                College Email ID (@anurag.edu.in)
              </label>
              <div className="relative">
                <UserCheck className="w-4 h-4 absolute left-3.5 top-3 text-[#555555]" />
                <input
                  type="email"
                  required
                  placeholder="rajesh.cse@anurag.edu.in"
                  value={teacherEmail}
                  onChange={(e) => setTeacherEmail(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-3 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1">
                  Mobile Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-3 text-[#555555]" />
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

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1">
                  Designation
                </label>
                <div className="relative">
                  <Award className="w-4 h-4 absolute left-3 top-3 text-[#555555]" />
                  <select
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-9 pr-2 text-xs text-[#171717] focus:outline-none focus:border-[#C8102E]"
                  >
                    <option value="Professor">Professor</option>
                    <option value="Associate Professor">Associate Professor</option>
                    <option value="Assistant Professor">Assistant Professor</option>
                    <option value="HOD">Head of Department (HOD)</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1">
                Assigned Department (Choose strictly your domain)
              </label>
              <div className="relative">
                <Building className="w-4 h-4 absolute left-3.5 top-3 text-[#555555]" />
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-4 text-xs text-[#171717] focus:outline-none focus:border-[#C8102E]"
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
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-[#555555]" />
                <input
                  type={showSignUpPasscode ? "text" : "password"}
                  required
                  placeholder="Create password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-10 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E]"
                />
                <button
                  type="button"
                  onClick={() => setShowSignUpPasscode(!showSignUpPasscode)}
                  className="absolute right-3.5 top-3 text-[#777777] hover:text-[#171717] transition"
                  tabIndex={-1}
                  aria-label={showSignUpPasscode ? "Hide password" : "Show password"}
                >
                  {showSignUpPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-[#C8102E] hover:bg-[#A50E25] text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 text-xs uppercase tracking-wider mt-2 disabled:opacity-60"
            >
              {isLoading ? "Creating Profile..." : "Register Faculty Profile & Login"} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* GUEST FACULTY LOGIN FORM */}
        {tab === "guest" && (
          <form onSubmit={handleGuestLogin} className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl text-xs text-amber-800 flex items-start gap-2">
              <Compass className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Guest Faculty Mode:</strong> Provides limited read-only authorization. You can explore a department syllabus and student score trends without modifying grading records or accessing student private contact numbers.
              </span>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                Guest Name / Observer Title
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                <input
                  type="text"
                  placeholder="Guest Observer"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-4 text-xs text-[#171717] focus:outline-none focus:border-[#171717]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                Department to Explore
              </label>
              <div className="relative">
                <Building className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                <select
                  value={guestDept}
                  onChange={(e) => setGuestDept(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-4 text-xs text-[#171717] focus:outline-none focus:border-[#171717]"
                >
                  {ALLOWED_DEPARTMENTS.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-[#171717] hover:bg-[#333333] text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 text-xs uppercase tracking-wider mt-2 disabled:opacity-60"
            >
              {isLoading ? "Entering Guest Mode..." : "Enter as Guest Faculty (Limited)"} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        <div className="flex flex-col items-center gap-2 pt-2 border-t border-[#E5E5E5]">
          <Link href="/login/student" className="text-xs text-[#555555] hover:text-[#C8102E] transition">
            Are you a Student? Click here for Student Portal
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
                    <h2 className="text-xl font-extrabold text-[#171717]">Reset Evaluator Passcode</h2>
                    <p className="text-xs text-[#555555]">
                      Enter your registered <strong className="text-[#171717]">@anurag.edu.in</strong> faculty email. We will send a 6-digit verification code.
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
                      Faculty Email ID
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                      <input
                        type="email"
                        required
                        placeholder="faculty.name@anurag.edu.in"
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
                    <h2 className="text-xl font-extrabold text-[#171717]">Verify Faculty Email</h2>
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
                    <h2 className="text-xl font-extrabold text-[#171717]">Set New Passcode</h2>
                    <p className="text-xs text-[#555555]">
                      Create a new password for your faculty evaluator account.
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
                      New Passcode / Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                      <input
                        type={showResetNewPassword ? "text" : "password"}
                        required
                        placeholder="Enter new passcode"
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
                      Confirm New Passcode
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                      <input
                        type={showResetConfirmPassword ? "text" : "password"}
                        required
                        placeholder="Confirm new passcode"
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
                    {forgotLoading ? "Updating..." : "Save New Passcode"} <ArrowRight className="w-4 h-4" />
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
                    <h2 className="text-xl font-extrabold text-[#171717]">Passcode Reset Complete!</h2>
                    <p className="text-xs text-[#555555]">
                      Your faculty credentials have been updated. You can now sign in using your new passcode.
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
