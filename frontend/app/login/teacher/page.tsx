"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
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
  FileText,
  UserX,
  Compass
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
        loggedInAt: Date.now(),
      };

      localStorage.setItem("veritas_teacher_auth", JSON.stringify(teacherAuth));
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
        setError(err.message || "Invalid credentials. Use demo passcode 'teacher123' or 'admin123'");
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
        loggedInAt: Date.now(),
      };

      localStorage.setItem("veritas_teacher_auth", JSON.stringify(teacherAuth));
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
            
            {/* If duplicate dept error, provide redirect button to Queries */}
            {isDuplicateDept && (
              <div className="pt-2 border-t border-red-200">
                <p className="text-[11px] text-red-600 mb-2">
                  Faculty members can only belong to one department. If your department or domain has shifted, please submit an official transfer query.
                </p>
                <Link
                  href="/teacher/queries"
                  className="inline-flex items-center gap-1.5 bg-[#C8102E] hover:bg-[#A50E25] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5" /> Need to change department? Submit Domain Shift Query &rarr;
                </Link>
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
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-2">
                Evaluator Passcode / Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-[#555555]" />
                <input
                  type="password"
                  required
                  placeholder="Enter passcode"
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
                  type="password"
                  required
                  placeholder="Create password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-4 text-xs text-[#171717] placeholder-[#AAAAAA] focus:outline-none focus:border-[#C8102E]"
                />
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
          <Link href="/teacher/queries" className="text-[11px] text-[#777777] hover:text-[#171717] transition flex items-center gap-1">
            <FileText className="w-3 h-3 text-[#C8102E]" /> Need department realignment? Submit Query
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
