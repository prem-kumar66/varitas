"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, Radio, AlertTriangle, ShieldCheck, CheckCircle2,
  Edit3, ArrowRight, RefreshCw, User, Hash, BookOpen, Clock, AlertCircle, 
  Sparkles, ListChecks, Lock, Unlock, Bell, Send, Check, ChevronRight, CheckCircle
} from "lucide-react";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";
const BACKEND_WS = process.env.NEXT_PUBLIC_BACKEND_WS || "ws://localhost:8000";

type Question = { 
  id?: number; 
  question_text: string; 
  reference_answer?: string; 
  rubric_keywords?: string[]; 
  max_marks?: number; 
  time_limit_sec?: number 
};

type MCQQuestion = { 
  index: number; 
  question: string; 
  options: { A: string; B: string; C: string; D: string } 
};

type CurriculumSubject = {
  key: string;
  subject: string;
  name?: string;
  department: string;
  total_questions: number;
  approved_questions: number;
  has_approved: boolean;
  status: string;
};

type AssignmentRule = {
  is_locked: boolean;
  mode: "open" | "oral" | "written" | "quiz";
  scope: "section" | "student" | "none";
  title?: string;
  faculty_email?: string;
};

type StudentNotification = {
  id: number;
  subject: string;
  department: string;
  message: string;
  test_ready: number;
  is_read: number;
  created_at: number;
};

export default function CandidatePage() {
  const router = useRouter();

  // Registration & Academic Config State
  const [studentName, setStudentName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [studentDept, setStudentDept] = useState("cse");
  const [academicYear, setAcademicYear] = useState("3rd Year");
  const [studentSection, setStudentSection] = useState("Section A");

  // Mode Selection & Assignment State
  const [mode, setMode] = useState<"oral" | "written" | "quiz">("quiz");
  const [assignmentRule, setAssignmentRule] = useState<AssignmentRule>({
    is_locked: false,
    mode: "open",
    scope: "none"
  });

  // Curriculum & Subject Selection State
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [selectedSubjectKey, setSelectedSubjectKey] = useState("");
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [requestingValidation, setRequestingValidation] = useState(false);
  const [validationSuccessMsg, setValidationSuccessMsg] = useState<string | null>(null);

  // Student Notifications State
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Active Test Flow State
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [mcqQuestions, setMcqQuestions] = useState<MCQQuestion[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);

  // Quiz / MCQ Runner State
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState<any>(null);

  // Written Mode State
  const [writtenAnswer, setWrittenAnswer] = useState("");
  const [pasteAttempts, setPasteAttempts] = useState(0);
  const [pasteWarning, setPasteWarning] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [isSubmittingWritten, setIsSubmittingWritten] = useState(false);

  // Oral Mode State
  const [joined, setJoined] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Evaluation & Results State
  const [lastAnalysis, setLastAnalysis] = useState<any>(null);
  const [answersHistory, setAnswersHistory] = useState<any[]>([]);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // 1. Initial Load from LocalStorage
  useEffect(() => {
    const savedAuth = localStorage.getItem("veritas_student_auth");
    if (savedAuth) {
      try {
        const auth = JSON.parse(savedAuth);
        if (auth.studentName) setStudentName(auth.studentName);
        if (auth.rollNumber) setRollNumber(auth.rollNumber);
        if (auth.mobileNumber) setMobileNumber(auth.mobileNumber);
        if (auth.candidateEmail || auth.studentEmail) setCandidateEmail(auth.candidateEmail || auth.studentEmail);
        if (auth.department) setStudentDept(auth.department.toLowerCase());
        if (auth.academicYear) setAcademicYear(auth.academicYear);
        if (auth.section) setStudentSection(auth.section);
      } catch (e) {}
    }
  }, []);

  // 2. Fetch Department Curriculum Subjects
  useEffect(() => {
    if (!studentDept) return;
    setLoadingSubjects(true);
    fetch(`${BACKEND_HTTP}/api/academic/subjects?department=${studentDept}`)
      .then((res) => res.json())
      .then((data) => {
        const subList: CurriculumSubject[] = data.subjects || [];
        setSubjects(subList);
        if (subList.length > 0) {
          setSelectedSubjectKey(subList[0].key);
        }
      })
      .catch((err) => console.error("Error fetching subjects:", err))
      .finally(() => setLoadingSubjects(false));
  }, [studentDept]);

  // 3. Check Faculty-Mandated Assignment Rule
  useEffect(() => {
    if (!studentDept) return;
    const url = `${BACKEND_HTTP}/api/assignments/check?department=${studentDept}&academic_year=${encodeURIComponent(
      academicYear
    )}&section=${encodeURIComponent(studentSection)}&roll_number=${encodeURIComponent(rollNumber)}`;

    fetch(url)
      .then((res) => res.json())
      .then((rule: AssignmentRule) => {
        setAssignmentRule(rule);
        if (rule.is_locked && rule.mode !== "open") {
          setMode(rule.mode);
        }
      })
      .catch((err) => console.error("Error checking assignment rule:", err));
  }, [studentDept, academicYear, studentSection, rollNumber]);

  // 4. Poll Student Notifications
  useEffect(() => {
    if (!rollNumber) return;
    const fetchNotifications = () => {
      fetch(`${BACKEND_HTTP}/api/student/notifications?roll_number=${encodeURIComponent(rollNumber)}`)
        .then((res) => res.json())
        .then((data) => {
          setNotifications(data.notifications || []);
        })
        .catch(() => {});
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 8000);
    return () => clearInterval(interval);
  }, [rollNumber]);

  const handleStudentLogout = () => {
    localStorage.removeItem("veritas_student_auth");
    router.push("/login/student");
  };

  // Selected subject object
  const currentSubject = subjects.find((s) => s.key === selectedSubjectKey) || subjects[0];
  const isSubjectApproved = currentSubject?.has_approved ?? true;

  // Request Question Validation from Faculty
  const handleRequestValidation = async () => {
    if (!currentSubject || requestingValidation) return;
    setRequestingValidation(true);
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/academic/request-validation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department: studentDept,
          subject: currentSubject.subject,
          student_roll: rollNumber || "student",
          student_name: studentName || "Candidate",
          student_email: candidateEmail || `${rollNumber}@anurag.edu.in`
        })
      });
      const data = await res.json();
      if (data.ok) {
        setValidationSuccessMsg(`Validation request sent to your ${studentDept.toUpperCase()} department faculty! You will be notified as soon as they approve.`);
        // Refresh notifications
        fetch(`${BACKEND_HTTP}/api/student/notifications?roll_number=${encodeURIComponent(rollNumber)}`)
          .then(r => r.json())
          .then(d => setNotifications(d.notifications || []));
      }
    } catch (e) {
      console.error("Validation request error:", e);
    } finally {
      setRequestingValidation(false);
    }
  };

  // Helper to construct questions for active subject
  const prepareQuestionsForSubject = async (sub: CurriculumSubject) => {
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/academic/questions?department=${studentDept}&subject_key=${sub.key}`);
      const data = await res.json();
      let rawQ: any[] = data.questions || [];

      if (!rawQ || rawQ.length === 0) {
        // Fallback default questions for the subject
        rawQ = [
          {
            question_text: `Explain the fundamental concepts and core principles of ${sub.subject}.`,
            reference_answer: `Key architectural principles, theoretical definitions, and industrial applications of ${sub.subject}.`,
            rubric_keywords: ["Principles", "Architecture", "Applications", "Analysis"],
            max_marks: 10,
            time_limit_sec: 120
          },
          {
            question_text: `What are the primary challenges, trade-offs, and optimization strategies encountered in ${sub.subject}?`,
            reference_answer: `Algorithmic complexity, throughput, resource constraints, and standard optimization approaches.`,
            rubric_keywords: ["Trade-offs", "Optimization", "Performance", "Complexity"],
            max_marks: 10,
            time_limit_sec: 120
          },
          {
            question_text: `Describe a real-world scenario or modern case study where ${sub.subject} is implemented at scale.`,
            reference_answer: `Detailed implementation analysis, framework usage, and fault tolerance in large-scale production.`,
            rubric_keywords: ["Implementation", "Production", "Scalability", "Frameworks"],
            max_marks: 10,
            time_limit_sec: 120
          }
        ];
      }

      if (mode === "quiz") {
        const mcqList: MCQQuestion[] = [
          {
            index: 0,
            question: `Which of the following best characterizes the primary goal of ${sub.subject}?`,
            options: {
              A: "Maximizing algorithmic throughput and system resource utilization",
              B: "Eliminating the need for software testing entirely",
              C: "Limiting computational processes to single-threaded executions",
              D: "Replacing compiled languages with unstructured scripting"
            }
          },
          {
            index: 1,
            question: `In standard implementations of ${sub.subject}, what is the typical asymptotic time complexity for lookup in a balanced structure?`,
            options: {
              A: "O(1)",
              B: "O(log n)",
              C: "O(n^2)",
              D: "O(n!)"
            }
          },
          {
            index: 2,
            question: `What critical safety and consistency mechanism is predominantly enforced in ${sub.subject}?`,
            options: {
              A: "Arbitrary state mutation without synchronization",
              B: "Atomicity and transactional isolation",
              C: "Ignoring edge conditions during runtime",
              D: "Unchecked recursive allocation"
            }
          }
        ];
        setMcqQuestions(mcqList);
        setQuestions([]);
      } else {
        setQuestions(
          rawQ.map((q, idx) => ({
            id: idx + 1,
            question_text: q.question_text,
            reference_answer: q.reference_answer || "",
            rubric_keywords: q.rubric_keywords_list || ["Analysis", "Concepts"],
            max_marks: q.max_marks || 10,
            time_limit_sec: q.time_limit_sec || 120
          }))
        );
        setMcqQuestions([]);
      }
    } catch (e) {
      console.error("Failed to prepare questions", e);
    }
  };

  // Start Assessment Session
  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !rollNumber.trim()) return;
    if (!isSubjectApproved) return;

    await prepareQuestionsForSubject(currentSubject);

    const newSid = `stud-${Date.now().toString(36)}`;
    setSessionId(newSid);

    try {
      await fetch(`${BACKEND_HTTP}/api/session/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: newSid,
          candidate_name: studentName,
          candidate_email: candidateEmail || `${rollNumber}@anurag.edu.in`,
          department: studentDept || "cse",
          roll_number: rollNumber,
          mobile_number: mobileNumber,
          academic_year: academicYear,
          subject_key: selectedSubjectKey,
          mode: mode,
        }),
      });

      setSessionStarted(true);
      setCurrentQIndex(0);
      setStartTime(Date.now());

      if (mode === "oral") {
        initOralMode(newSid);
      }
    } catch (err) {
      console.error("Failed to start session:", err);
    }
  };

  // Oral WebSocket setup
  const initOralMode = async (sid: string) => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);

      const ws = new WebSocket(`${BACKEND_WS}/ws/candidate/${sid}`);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        setStatus("Connected to Veritas Oral Processor");
        setJoined(true);
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "analysis") {
            setLastAnalysis(data);
            setAnswersHistory((prev) => [...prev, data]);
          }
        } catch (err) {}
      };

      ws.onclose = () => setJoined(false);
      wsRef.current = ws;
    } catch (err) {
      console.error("Mic access error:", err);
    }
  };

  // Handle Paste in Written Mode (Anti-Cheat)
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setPasteAttempts((prev) => prev + 1);
    setPasteWarning(true);
    setTimeout(() => setPasteWarning(false), 4000);
  };

  // Submit Written Answer (Written / Oral modes)
  const handleSubmitWritten = async () => {
    if (!writtenAnswer.trim() || isSubmittingWritten) return;
    setIsSubmittingWritten(true);

    const activeQ = questions[currentQIndex];
    const duration = Math.max(2, Math.round((Date.now() - startTime) / 1000));

    try {
      const res = await fetch(`${BACKEND_HTTP}/api/submit-written-answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question: activeQ.question_text,
          answer_text: writtenAnswer,
          duration_sec: duration,
          copy_paste_attempts: pasteAttempts,
          reference_answer: activeQ.reference_answer || "",
          rubric_keywords: activeQ.rubric_keywords || [],
        }),
      });

      const analysis = await res.json();
      setLastAnalysis(analysis);
      setAnswersHistory((prev) => [...prev, analysis]);
      setWrittenAnswer("");
      setPasteAttempts(0);

      if (currentQIndex < questions.length - 1) {
        setCurrentQIndex((prev) => prev + 1);
        setStartTime(Date.now());
      } else {
        // Completed all questions
        fetch(`${BACKEND_HTTP}/api/session/end`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
      }
    } catch (err) {
      console.error("Error submitting answer:", err);
    } finally {
      setIsSubmittingWritten(false);
    }
  };

  // Submit Quiz / MCQ Answer
  const handleSubmitQuiz = async () => {
    if (!quizAnswer || isSubmittingQuiz) return;
    const activeMCQ = mcqQuestions[currentQIndex];
    if (!activeMCQ) return;
    setIsSubmittingQuiz(true);

    try {
      const res = await fetch(`${BACKEND_HTTP}/api/quiz/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          subject_key: selectedSubjectKey,
          question_index: activeMCQ.index,
          question_text: activeMCQ.question,
          selected_option: quizAnswer,
        }),
      });
      const result = await res.json();
      setQuizResult(result);
      setLastAnalysis({ ...result, mode: "quiz", word_count: 1, copy_paste_attempts: 0 });
      setAnswersHistory((prev) => [...prev, result]);
      setQuizAnswer(null);

      if (currentQIndex < mcqQuestions.length - 1) {
        setTimeout(() => {
          setCurrentQIndex((prev) => prev + 1);
          setQuizResult(null);
          setStartTime(Date.now());
        }, 1500);
      } else {
        // Complete Exam
        setTimeout(() => {
          fetch(`${BACKEND_HTTP}/api/session/end`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId }),
          });
        }, 1500);
      }
    } catch (err) {
      console.error("Error submitting quiz:", err);
    } finally {
      setIsSubmittingQuiz(false);
    }
  };

  // Oral Audio Streaming
  const startSpeaking = async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    try {
      let currentStream = streamRef.current;
      if (!currentStream) {
        currentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = currentStream;
        setStream(currentStream);
      }

      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;

      wsRef.current.send(JSON.stringify({ type: "hello", sample_rate: ctx.sampleRate }));
      wsRef.current.send(JSON.stringify({ type: "answer_start", ts: Date.now() }));

      const source = ctx.createMediaStreamSource(currentStream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += Math.abs(inputData[i]);
        }
        setAudioLevel(Math.min(100, Math.round((sum / inputData.length) * 500)));

        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(pcm16.buffer);
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      setSpeaking(true);
      setStatus("Speaking... Audio streaming to Veritas");
    } catch (err) {
      console.error("Error starting speech capture:", err);
    }
  };

  const stopSpeaking = () => {
    if (processorRef.current && audioCtxRef.current) {
      processorRef.current.disconnect();
      audioCtxRef.current.close();
    }
    setSpeaking(false);
    setAudioLevel(0);
    setStatus("Processing answer segment...");
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "answer_end", ts: Date.now() }));
    }
  };

  const activeQuestion = mode === "quiz" ? mcqQuestions[currentQIndex] : questions[currentQIndex];
  const isFinished = mode === "quiz" ? currentQIndex >= mcqQuestions.length && mcqQuestions.length > 0 : currentQIndex >= questions.length && questions.length > 0;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#171717] flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-[#E5E5E5] px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#C8102E] text-white rounded-xl flex items-center justify-center font-black tracking-widest text-base shadow-sm">
            V
          </div>
          <div>
            <h1 className="font-bold text-base leading-none text-[#171717]">Veritas Candidate Portal</h1>
            <span className="text-[11px] text-[#555555] font-medium">Anurag University  AI Proctoring & Assessment</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Student Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-xl border border-[#E5E5E5] hover:bg-slate-50 transition text-[#555555]"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {notifications.filter(n => n.test_ready === 1).length > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#C8102E] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {notifications.filter(n => n.test_ready === 1).length}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-[#E5E5E5] rounded-2xl shadow-xl p-4 z-50">
                <div className="flex items-center justify-between border-b pb-2 mb-2">
                  <span className="text-xs font-bold text-[#171717] uppercase">Question Updates & Alerts</span>
                  <span className="text-[10px] text-[#777777]">{notifications.length} alerts</span>
                </div>
                {notifications.length === 0 ? (
                  <p className="text-xs text-center text-gray-500 py-4">No notifications yet.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {notifications.map(n => (
                      <div key={n.id} className={`p-2.5 rounded-xl text-xs border ${n.test_ready ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-[#F8F8F8] border-[#E5E5E5] text-[#555555]"}`}>
                        <div className="font-bold flex items-center gap-1 mb-0.5">
                          {n.test_ready ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <Clock className="w-3.5 h-3.5 text-amber-500" />}
                          {n.subject}
                        </div>
                        <p className="text-[11px] leading-relaxed">{n.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-[#171717]">{studentName || "Student Candidate"}</div>
            <div className="text-[11px] font-mono text-[#555555] uppercase">{rollNumber || "ID: Unassigned"}  {studentDept.toUpperCase()}</div>
          </div>
          <button
            onClick={handleStudentLogout}
            className="text-xs font-semibold px-3 py-1.5 border border-[#E5E5E5] rounded-xl hover:bg-slate-100 transition text-[#555555]"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full flex flex-col justify-center">
        {!sessionStarted ? (
          /* STEP 1: Student Academic Setup & Mode Assignment Wizard */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-[#E5E5E5] rounded-2xl p-8 max-w-2xl mx-auto w-full shadow-xl"
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black text-[#171717]">Anurag Assessment Gateway</h2>
              <p className="text-xs text-[#555555] mt-1.5">
                Verify your academic coordinates, assessment mode assignment, and faculty-approved questions.
              </p>
            </div>

            {/* Notification alert banner if subject was recently validated */}
            {notifications.some(n => n.test_ready === 1) && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-sm">Subject Questions Approved!</span>
                  <span>{notifications.find(n => n.test_ready === 1)?.message}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleStartSession} className="space-y-6">
              {/* Grid 1: Academic Identity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-3.5 text-[#777777]" />
                    <input
                      type="text"
                      required
                      placeholder="Rahul Sharma"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-3 text-[#171717] focus:outline-none focus:border-[#C8102E] transition text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-1.5">
                    Roll Number
                  </label>
                  <div className="relative">
                    <Hash className="w-4 h-4 absolute left-3.5 top-3.5 text-[#777777]" />
                    <input
                      type="text"
                      required
                      placeholder="23eg107b35"
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value)}
                      className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-3 text-[#171717] font-mono focus:outline-none focus:border-[#C8102E] transition text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Grid 2: Department, Academic Year, Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#F8F8F8] p-4 rounded-xl border border-[#E5E5E5]">
                <div>
                  <label className="block text-[11px] font-bold text-[#555555] uppercase mb-1">Department</label>
                  <select
                    value={studentDept}
                    onChange={(e) => setStudentDept(e.target.value.toLowerCase())}
                    className="w-full bg-white border border-[#E5E5E5] rounded-lg p-2 text-xs font-semibold text-[#171717]"
                  >
                    <option value="cse">CSE</option>
                    <option value="aiml">AI & ML</option>
                    <option value="it">Information Tech</option>
                    <option value="ece">ECE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#555555] uppercase mb-1">Academic Year</label>
                  <select
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="w-full bg-white border border-[#E5E5E5] rounded-lg p-2 text-xs font-semibold text-[#171717]"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#555555] uppercase mb-1">Section</label>
                  <select
                    value={studentSection}
                    onChange={(e) => setStudentSection(e.target.value)}
                    className="w-full bg-white border border-[#E5E5E5] rounded-lg p-2 text-xs font-semibold text-[#171717]"
                  >
                    <option value="Section A">Section A</option>
                    <option value="Section B">Section B</option>
                    <option value="Section C">Section C</option>
                    <option value="Section D">Section D</option>
                  </select>
                </div>
              </div>

              {/* SECTION 2: Assessment Mode Check (Faculty Mandated vs Open Choice) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs uppercase tracking-wider font-semibold text-[#555555]">
                    Assessment Evaluation Mode
                  </label>
                  {assignmentRule.is_locked ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#C8102E] bg-[#FFF1F2] border border-[#C8102E]/20 px-2.5 py-0.5 rounded-full">
                      <Lock className="w-3 h-3" /> Mandated by Faculty ({assignmentRule.scope.toUpperCase()})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                      <Unlock className="w-3 h-3" /> Free Choice Active
                    </span>
                  )}
                </div>

                {assignmentRule.is_locked && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 mb-2 flex items-center gap-2.5">
                    <Lock className="w-4 h-4 text-[#C8102E] shrink-0" />
                    <div>
                      <span className="font-bold">Mandatory Test Assignment: </span>
                      {assignmentRule.faculty_email ? `Faculty ${assignmentRule.faculty_email}` : "Your department"} has designated <strong className="uppercase">{assignmentRule.mode}</strong> mode for {assignmentRule.scope === "student" ? "you specifically" : `${academicYear} ${studentSection}`}.
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "quiz", label: "MCQ Quiz", desc: "Instant graded test", icon: ListChecks },
                    { id: "oral", label: "Oral Viva", desc: "Speech anti-cheat", icon: Mic },
                    { id: "written", label: "Written Exam", desc: "Proctored essay", icon: Edit3 },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = mode === m.id;
                    const isDisabled = assignmentRule.is_locked && assignmentRule.mode !== m.id;

                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => !isDisabled && setMode(m.id as any)}
                        className={`p-4 rounded-xl border text-left flex flex-col transition relative ${
                          isDisabled
                            ? "opacity-40 bg-slate-100 border-slate-200 cursor-not-allowed"
                            : isSelected
                            ? "border-[#C8102E] bg-[#FFF1F2] shadow-sm"
                            : "border-[#E5E5E5] bg-white hover:border-[#A3A3A3]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Icon className={`w-5 h-5 ${isSelected ? "text-[#C8102E]" : "text-[#555555]"}`} />
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-[#C8102E]" />}
                        </div>
                        <span className={`text-sm font-bold ${isSelected ? "text-[#C8102E]" : "text-[#171717]"}`}>
                          {m.label}
                        </span>
                        <span className="text-[11px] text-[#777777] mt-0.5">{m.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 3: Subject Selection with Validation Workflow */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs uppercase tracking-wider font-semibold text-[#555555]">
                    Select Curriculum Subject
                  </label>
                  <span className="text-[11px] text-[#777777]">
                    {subjects.length} subjects found for {studentDept.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {subjects.map((sub) => {
                    const isSelected = selectedSubjectKey === sub.key;
                    const isApproved = sub.has_approved;

                    return (
                      <button
                        key={sub.key}
                        type="button"
                        onClick={() => setSelectedSubjectKey(sub.key)}
                        className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                          isSelected
                            ? "border-[#C8102E] bg-[#FFF1F2]"
                            : "border-[#E5E5E5] bg-white hover:border-[#A3A3A3]"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <span className="font-bold text-sm text-[#171717]">{sub.subject}</span>
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <Check className="w-3 h-3" /> Approved
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <Clock className="w-3 h-3" /> AI Drafted
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#777777] mt-2">
                          {sub.total_questions || 5} Questions in Pool
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Validation Status Box */}
                {currentSubject && (
                  <div className="mt-3">
                    {isSubjectApproved ? (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          Questions for <strong>{currentSubject.subject}</strong> have been accepted by faculty. You can begin the test immediately.
                        </span>
                      </div>
                    ) : (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block text-sm">Faculty Validation Required</span>
                            <span>
                              The questions for <strong>{currentSubject.subject}</strong> are drafted by the AI model. Under college policy, a faculty member must review and approve them before you can take the assessment.
                            </span>
                          </div>
                        </div>

                        {validationSuccessMsg ? (
                          <div className="p-2.5 bg-white border border-emerald-300 rounded-lg text-emerald-700 font-medium flex items-center gap-2">
                            <Send className="w-4 h-4 text-emerald-600" />
                            {validationSuccessMsg}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleRequestValidation}
                            disabled={requestingValidation}
                            className="bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-amber-700 transition flex items-center gap-2 shadow-sm disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                            {requestingValidation ? "Dispatching Query to Faculty..." : "Send Validation Query to Faculty"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Start Assessment Button */}
              <button
                type="submit"
                disabled={!isSubjectApproved}
                className="w-full bg-[#C8102E] text-white py-3.5 rounded-xl font-bold hover:bg-[#A00D24] transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <span>{isSubjectApproved ? "Begin Assessment Now" : "Awaiting Faculty Question Approval"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        ) : isFinished ? (
          /* STEP 3: Assessment Completed Screen */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-[#E5E5E5] rounded-2xl p-8 max-w-xl mx-auto w-full text-center shadow-2xl"
          >
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-[#171717]">Assessment Successfully Submitted</h2>
            <p className="text-sm text-[#555555] mt-2">
              Your response stream and anti-cheat parameters have been logged and computed in the Veritas analytics store.
            </p>

            <div className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl p-4 my-6 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#555555]">Candidate:</span>
                <span className="font-bold text-[#171717]">{studentName} ({rollNumber.toUpperCase()})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#555555]">Department & Section:</span>
                <span className="font-bold text-[#171717]">{studentDept.toUpperCase()}  {studentSection}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#555555]">Subject Evaluated:</span>
                <span className="font-bold text-[#171717]">{currentSubject?.subject}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#555555]">Mode:</span>
                <span className="font-bold text-[#C8102E] uppercase">{mode}</span>
              </div>
            </div>

            <button
              onClick={() => {
                setSessionStarted(false);
                setCurrentQIndex(0);
                setAnswersHistory([]);
              }}
              className="bg-[#171717] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-black transition"
            >
              Return to Candidate Gateway
            </button>
          </motion.div>
        ) : (
          /* STEP 2: Active Test Runner (Quiz / Oral / Written) */
          <div className="max-w-3xl mx-auto w-full space-y-6">
            {/* Active Header */}
            <div className="flex items-center justify-between bg-white border border-[#E5E5E5] p-4 rounded-2xl shadow-sm">
              <div>
                <span className="text-xs uppercase font-bold text-[#C8102E]">{currentSubject?.subject}</span>
                <h2 className="text-lg font-bold text-[#171717]">
                  Question {currentQIndex + 1} of {mode === "quiz" ? mcqQuestions.length : questions.length}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-bold uppercase">
                  {mode} Mode
                </span>
              </div>
            </div>

            {/* Question Display */}
            <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 shadow-sm">
              <p className="text-base font-semibold text-[#171717] leading-relaxed">
                {mode === "quiz" ? (activeQuestion as MCQQuestion)?.question : (activeQuestion as Question)?.question_text}
              </p>
            </div>

            {/* RUNNER: MCQ Quiz Mode */}
            {mode === "quiz" && (
              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 shadow-sm space-y-4">
                <div className="space-y-3">
                  {["A", "B", "C", "D"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setQuizAnswer(opt)}
                      className={`w-full p-4 rounded-xl border text-left text-sm flex items-center justify-between transition ${
                        quizAnswer === opt
                          ? "border-[#C8102E] bg-[#FFF1F2] font-bold text-[#C8102E]"
                          : "border-[#E5E5E5] hover:border-slate-400 text-[#171717]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold">
                          {opt}
                        </span>
                        <span>{(activeQuestion as MCQQuestion)?.options?.[opt as keyof typeof activeQuestion.options]}</span>
                      </div>
                      {quizAnswer === opt && <CheckCircle2 className="w-5 h-5 text-[#C8102E]" />}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleSubmitQuiz}
                  disabled={!quizAnswer || isSubmittingQuiz}
                  className="w-full bg-[#C8102E] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#A00D24] transition disabled:opacity-50"
                >
                  {isSubmittingQuiz ? "Recording Answer..." : "Submit Answer & Proceed"}
                </button>
              </div>
            )}

            {/* RUNNER: Written Mode */}
            {mode === "written" && (
              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 shadow-sm space-y-4">
                {pasteWarning && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#C8102E] shrink-0" />
                    <span><strong>Proctoring Notice:</strong> Copying and pasting is disabled and logged as an anomaly.</span>
                  </div>
                )}
                <textarea
                  rows={6}
                  value={writtenAnswer}
                  onChange={(e) => setWrittenAnswer(e.target.value)}
                  onPaste={handlePaste}
                  placeholder="Type your comprehensive technical answer here..."
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl p-4 text-sm text-[#171717] focus:outline-none focus:border-[#C8102E]"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#777777]">
                    Words: {writtenAnswer.trim() ? writtenAnswer.trim().split(/\s+/).length : 0} | Copy-Paste Attempts: {pasteAttempts}
                  </span>
                  <button
                    type="button"
                    onClick={handleSubmitWritten}
                    disabled={!writtenAnswer.trim() || isSubmittingWritten}
                    className="bg-[#C8102E] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-[#A00D24] transition disabled:opacity-50"
                  >
                    {isSubmittingWritten ? "Evaluating..." : "Submit Response"}
                  </button>
                </div>
              </div>
            )}

            {/* RUNNER: Oral Viva Mode */}
            {mode === "oral" && (
              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-8 shadow-sm text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-[#FFF1F2] border-4 border-[#C8102E] mx-auto flex items-center justify-center relative">
                  <Mic className={`w-10 h-10 ${speaking ? "text-[#C8102E] animate-pulse" : "text-slate-400"}`} />
                  {speaking && (
                    <span className="absolute -bottom-2 bg-[#C8102E] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                      Live
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#555555] font-medium">{status}</p>

                <div className="flex justify-center gap-4">
                  {!speaking ? (
                    <button
                      type="button"
                      onClick={startSpeaking}
                      className="bg-[#C8102E] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-[#A00D24] transition flex items-center gap-2"
                    >
                      <Mic className="w-4 h-4" /> Start Speaking Answer
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopSpeaking}
                      className="bg-black text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition flex items-center gap-2"
                    >
                      <MicOff className="w-4 h-4" /> Stop & Evaluate Answer
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (currentQIndex < questions.length - 1) {
                        setCurrentQIndex((prev) => prev + 1);
                      } else {
                        fetch(`${BACKEND_HTTP}/api/session/end`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ session_id: sessionId }),
                        });
                      }
                    }}
                    className="border border-[#E5E5E5] px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition"
                  >
                    Next Question
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
