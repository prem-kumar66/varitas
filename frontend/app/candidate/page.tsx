"use client";                                                                                               
import { useState, useRef, useEffect } from "react";                                                        
import { useRouter } from "next/navigation";                                                                
import Link from "next/link";                                                                               
import { motion, AnimatePresence } from "framer-motion";                                                    
import {                                                                                                    
  Mic, MicOff, Radio, AlertTriangle, ShieldCheck, CheckCircle2,                                             
  Edit3, ArrowRight, RefreshCw, User, Hash, BookOpen, Clock, AlertCircle,                                   
  Sparkles, ListChecks, Lock, Unlock, Bell, Send, Check, ChevronRight, CheckCircle, X
} from "lucide-react";                                                                                      
                                                                                                            
const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";                       
const BACKEND_WS = process.env.NEXT_PUBLIC_BACKEND_WS || "ws://localhost:8000";
const FULLSCREEN_PENALTY = 15;                             
                                                                                                            
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
  options: { A: string; B: string; C: string; D: string };                                                  
  correct_answer: string;                                                                                   
  explanation: string;                                                                                      
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
  exam_id?: string;                                                                                         
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
  const [mode, setMode] = useState<"oral" | "written" | "quiz">("oral");                                    
  const [examSubject, setExamSubject] = useState("");                                                       
  const [assignmentRule, setAssignmentRule] = useState<AssignmentRule>({                                    
    is_locked: false,                                                                                       
    mode: "open",                                                                                           
    scope: "none"                                                                                           
  });                                                                                                       
                                                                                                            
  // Student Notifications State                                                                            
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);                            
  const [showNotifications, setShowNotifications] = useState(false);                                        
                                                                                                            
  // Active Test Flow State                                                                                 
  const [sessionStarted, setSessionStarted] = useState(false);                                              
  const [examFinished, setExamFinished] = useState(false);                                                  
  const [sessionId, setSessionId] = useState("");                                                           
  const [questions, setQuestions] = useState<Question[]>([]);                                               
  const [mcqQuestions, setMcqQuestions] = useState<MCQQuestion[]>([]);                                      
  const [currentQIndex, setCurrentQIndex] = useState(0);                                                    
  const [oralQuestionSynced, setOralQuestionSynced] = useState(false);                                                    
  const [selectedSubjectKey, setSelectedSubjectKey] = useState("custom_exam");                              
  const [totalScore, setTotalScore] = useState(0);                                                          
  const [maxScore, setMaxScore] = useState(0);                                                              
                                                                                                            
  // Exam Attempt & Published State                                                                         
  const [activeExamId, setActiveExamId] = useState<string>("");                                             
  const [selectedExamId, setSelectedExamId] = useState<string>("");                                         
  const [availableExams, setAvailableExams] = useState<any[]>([]);                                          
  const [examPublished, setExamPublished] = useState<boolean>(false); // starts false until first fetch     
  const [alreadyAttempted, setAlreadyAttempted] = useState<boolean>(false);                                 
  const [previousAttempt, setPreviousAttempt] = useState<any>(null);                                        
  const [autoSubmitted, setAutoSubmitted] = useState<boolean>(false);                                       
  const [autoSubmitReason, setAutoSubmitReason] = useState<string>("");                                     
                                                                                                            
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
                                                                                                            
  // Exam Notification Toast                                                                                
  const [examToast, setExamToast] = useState<{ message: string; subject: string } | null>(null);            
  const seenNotifIds = useRef<Set<number>>(new Set());                                                      
                                                                                                            
  // Fullscreen Proctoring State                                                                            
  const [isFullscreen, setIsFullscreen] = useState(false);                                                  
  const [fullscreenWarning, setFullscreenWarning] = useState(false);                                        
  const [fullscreenExits, setFullscreenExits] = useState(0);                                                
  const [authenticityScore, setAuthenticityScore] = useState(100);                                          
                                                                                                            
  // Timer State                                                                                            
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);                                  
  const timerRef = useRef<NodeJS.Timeout | null>(null);                                                     
                                                                                                            
  // Refs                                                                                                   
  const wsRef = useRef<WebSocket | null>(null);                                                             
  const audioCtxRef = useRef<AudioContext | null>(null);                                                    
  const streamRef = useRef<MediaStream | null>(null);                                                       
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  // Anti-stale Refs for timers & question sync
  const writtenAnswerRef = useRef(writtenAnswer);
  writtenAnswerRef.current = writtenAnswer;

  const quizAnswerRef = useRef(quizAnswer);
  quizAnswerRef.current = quizAnswer;

  const questionsRef = useRef(questions);
  questionsRef.current = questions;

  const submitRef = useRef<{
    handleSubmitWritten: (forcedAnswer?: string) => Promise<void>;
    handleSubmitQuiz: (forcedAnswer?: string) => Promise<void>;
    handleTimeout: () => void;
  }>({
    handleSubmitWritten: async () => {},
    handleSubmitQuiz: async () => {},
    handleTimeout: () => {},
  });
                                            
                                                                                                            
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
                                                                                                            
        let sec = auth.section;                                                                             
        if (!sec && auth.rollNumber) {                                                                      
          const match = auth.rollNumber.trim().match(/^(\d{2})eg(\d{3})([a-r])/i);                          
          if (match) sec = `Section ${match[3].toUpperCase()}`;                                             
        }                                                                                                   
        if (sec) setStudentSection(sec);                                                                    
      } catch (e) {}                                                                                        
    }                                                                                                       
  }, []);                                                                                                   
                                                                                                            
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
      if (deptMap[deptCode]) setStudentDept(deptMap[deptCode]);                                             
      if (secCode) setStudentSection(`Section ${secCode}`);                                                 
    }                                                                                                       
  };                                                                                                        
                                                                                                            
  // 3. Check Faculty-Mandated Assignment Rule                                                              
  useEffect(() => {                                                                                         
    if (!studentDept) return;                                                                               
    const cleanSec = studentSection.replace(/Section\s+/i, "").trim();                                      
    const url = `${BACKEND_HTTP}/api/assignments/check?department=${studentDept}&academic_year=${encodeURIComponent(
      academicYear                                                                                          
    )}&section=${encodeURIComponent(cleanSec)}&roll_number=${encodeURIComponent(rollNumber)}`;              
                                                                                                            
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
          const notifs: any[] = data.notifications || [];
          setNotifications(notifs);
          // Find any new unread test_ready notification we haven't toasted yet
          const newExamNotif = notifs.find(
            (n) => n.test_ready === 1 && (!n.is_read || n.is_read === 0) && !seenNotifIds.current.has(n.id)
          );
          if (newExamNotif) {
            seenNotifIds.current.add(newExamNotif.id);
            setExamToast({ message: newExamNotif.message, subject: newExamNotif.subject });
            // Auto-dismiss after 8 seconds
            setTimeout(() => setExamToast(null), 8000);
          }
        })
        .catch(() => {});
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [rollNumber]);

  const markNotificationsAsRead = async (notificationId?: number) => {
    if (!rollNumber) return;
    // Optimistically mark as read in local state
    setNotifications((prev) =>
      prev.map((n) =>
        notificationId === undefined || n.id === notificationId
          ? { ...n, is_read: 1 }
          : n
      )
    );
    try {
      await fetch(`${BACKEND_HTTP}/api/student/notifications/mark-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_roll: rollNumber,
          notification_id: notificationId,
        }),
      });
    } catch (e) {
      console.error("Failed to mark notifications read:", e);
    }
  };

  const unreadCount = notifications.filter(
    (n) => !n.is_read || n.is_read === 0
  ).length;                                                                                         
                                                                                                            
                                                                                                            
  const handleStudentLogout = () => {                                                                       
    localStorage.removeItem("veritas_student_auth");                                                        
    router.push("/login/student");                                                                          
  };

  const prepareQuestionsForSubject = async (explicitExamId?: string) => {
    try {
      const cleanSec = studentSection.replace(/Section\s+/i, "").trim();
      const examIdToFetch = explicitExamId !== undefined ? explicitExamId : selectedExamId;

      // Also fetch full list of available exams for this student
      fetch(
        `${BACKEND_HTTP}/api/student/available_exams?department=${encodeURIComponent(
          studentDept
        )}&year=${encodeURIComponent(academicYear)}&section=${encodeURIComponent(
          cleanSec
        )}&roll_number=${encodeURIComponent(rollNumber)}`
      )
        .then((r) => r.json())
        .then((d) => {
          if (d.exams) setAvailableExams(d.exams);
        })
        .catch(() => {});

      let activeUrl = `${BACKEND_HTTP}/api/student/active_exam?department=${encodeURIComponent(
        studentDept
      )}&year=${encodeURIComponent(academicYear)}&section=${encodeURIComponent(
        cleanSec
      )}&roll_number=${encodeURIComponent(rollNumber)}`;
      if (examIdToFetch) {
        activeUrl += `&exam_id=${encodeURIComponent(examIdToFetch)}`;
      }

      // STEP 5: If exam has already started, do not alter active exam state
      if (sessionStarted) {
        return;
      }

      const res = await fetch(activeUrl);
      const data = await res.json();
      if (!res.ok || !data.published || !data.exam) {
        setExamPublished(false);
        setQuestions([]);
        setMcqQuestions([]);
        setActiveExamId("");
        setAlreadyAttempted(false);
        setPreviousAttempt(null);
        return;
      }

      setExamPublished(true);
      const exam = data.exam;
      if (!exam || !exam.questions) return;

      setActiveExamId(exam.exam_id || "");
      if (!selectedExamId) {
        setSelectedExamId(exam.exam_id || "");
      }
      setAlreadyAttempted(Boolean(data.already_attempted));
      setPreviousAttempt(data.attempt || null);
      setExamSubject(exam.subject || exam.name || "Global Exam");

      const rawQ = exam.questions;

      if (exam.mode === "quiz") {
        setMcqQuestions(rawQ.map((q: any, idx: number) => ({
          index: idx,
          question: q.question || q.question_text || "",
          options: q.options || { A: "N/A", B: "N/A", C: "N/A", D: "N/A" },
          correct_answer: q.correct_answer || "A",                                                          
          explanation: q.explanation || ""                                                                  
        })));                                                                                               
        setQuestions([]);                                                                                   
        setMode("quiz");                                                                                    
      } else {                                                                                              
        setQuestions(                                                                                       
          rawQ.map((q: any, idx: number) => ({                                                              
            id: idx + 1,                                                                                    
            question_text: q.question || q.question_text || "",                                             
            reference_answer: q.reference_answer || "",                                                     
            rubric_keywords: q.rubric_keywords || q.rubric_keywords_list || ["Analysis"],                   
            max_marks: q.max_marks || 10,                                                                   
            time_limit_sec: q.time_limit_sec || 120                                                         
          }))                                                                                               
        );                                                                                                  
        setMcqQuestions([]);                                                                                
        setMode(exam.mode);                                                                                 
      }                                                                                                     
    } catch (e) {                                                                                           
      console.error("Failed to fetch active exam", e);                                                      
    }                                                                                                       
  };                                                                                                        
                                                                                                            
  const handleSelectExam = (examId: string) => {                                                            
    setSelectedExamId(examId);                                                                              
    prepareQuestionsForSubject(examId);                                                                     
  };                                                                                                        
                                                                                                            
  useEffect(() => {                                                                                         
    if (!studentDept) return;                                                                               
    if (examFinished) return; // stop polling once exam is done                                             
    prepareQuestionsForSubject();                                                                           
    const interval = setInterval(() => prepareQuestionsForSubject(), 5000);                                 
    return () => clearInterval(interval);                                                                   
  }, [studentDept, academicYear, studentSection, rollNumber, examFinished, selectedExamId]);                
                                                                                                            
  // Sync active question to backend for oral evaluation                                                    
  useEffect(() => {                                                                                         
    if (sessionStarted && mode === "oral" && questions[currentQIndex]) {
      setOralQuestionSynced(false);
      const q = questions[currentQIndex];                                                                   
      fetch(`${BACKEND_HTTP}/api/question`, {                                                               
        method: "POST",                                                                                     
        headers: { "Content-Type": "application/json" },                                                    
        body: JSON.stringify({                                                                              
          session_id: sessionId,                                                                            
          question: q.question_text || "",                                                                        
          reference_answer: q.reference_answer || "",                                                       
          rubric_keywords: q.rubric_keywords || [],                                                         
          is_calibration: false,
        }),
      })
        .then((res) => {
          if (res.ok) setOralQuestionSynced(true);
        })
        .catch((e) => {
          console.error("Error setting oral question", e);
          setOralQuestionSynced(true);
        });
    }
  }, [sessionStarted, currentQIndex, mode, sessionId, questions]);

  // Handle Auto-Submit when authenticity score drops to 0
  const handleAutoSubmit = async (reason: string = "Authenticity score reached 0% due to proctoring violations.") => {
    if (examFinished) return;
    setAutoSubmitted(true);
    setAutoSubmitReason(reason);

    // Calculate score accumulated so far
    let finalScore = 0;
    let maxPossible = 100;
    if (mode === "quiz") {
      const correct = answersHistory.filter((a: any) => a.correct).length;
      finalScore = correct * 10;
      maxPossible = (mcqQuestions.length || 1) * 10;
    } else {
      // Written and oral: average of overall_score across answered questions (0-100)
      const answered = answersHistory.filter((a: any) => typeof (a.overall_score ?? a.score) === "number");
      finalScore = answered.length > 0
        ? Math.round(answered.reduce((sum: number, a: any) => sum + (a.overall_score ?? a.score ?? 0), 0) / answered.length)
        : 0;
      maxPossible = 100;
    }
    setTotalScore(finalScore);
    setMaxScore(maxPossible);

    // Record the attempt in database as disqualified / 0 authenticity
    try {
      await fetch(`${BACKEND_HTTP}/api/student/record-attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_roll: rollNumber,
          exam_id: activeExamId,
          session_id: sessionId,
          subject: examSubject,
          score: finalScore,
          max_score: mode === "quiz" ? maxPossible : 100,
          authenticity_score: 0,
          violations_count: fullscreenExits + 1,
          status: "disqualified"
        }),
      });
    } catch (e) {
      console.error("Failed to record disqualified attempt", e);
    }

    // Finalize session
    try {
      await fetch(`${BACKEND_HTTP}/api/session/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },                                                    
        body: JSON.stringify({ session_id: sessionId }),                                                    
      });                                                                                                   
    } catch {}                                                                                              
                                                                                                            
    // Cleanup audio resources if oral mode                                                                 
    if (processorRef.current && audioCtxRef.current) {                                                      
      try {                                                                                                 
        processorRef.current.disconnect();                                                                  
        audioCtxRef.current.close();                                                                        
      } catch {}                                                                                            
    }                                                                                                       
    if (wsRef.current) {                                                                                    
      try { wsRef.current.close(); } catch {}                                                               
    }                                                                                                       
                                                                                                            
    // Exit fullscreen                                                                                      
    try {                                                                                                   
      if (document.fullscreenElement) {                                                                     
        await document.exitFullscreen();                                                                    
      }                                                                                                     
    } catch {}                                                                                              
                                                                                                            
    setExamFinished(true);                                                                                  
    setAlreadyAttempted(true);
  };

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      const inFs = !!document.fullscreenElement;
      setIsFullscreen(inFs);
      if (!inFs && sessionStarted && !examFinished) {
        // Student exited fullscreen — penalise
        setFullscreenWarning(true);
        setFullscreenExits((prev) => prev + 1);
        setAuthenticityScore((prev) => {
          const nextScore = Math.max(0, prev - FULLSCREEN_PENALTY);
          return nextScore;
        });
      }
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, [sessionStarted, examFinished]);

  // Watch for authenticity score reaching 0 to trigger auto-submit
  useEffect(() => {
    if (sessionStarted && !examFinished && authenticityScore <= 0) {
      handleAutoSubmit("Authenticity score reached 0% due to repeated fullscreen exits.");
    }
  }, [authenticityScore, sessionStarted, examFinished]);

  // Per-question countdown timer
  useEffect(() => {
    if (!sessionStarted) return;                                                                            
    // Determine time limit for current question                                                            
    let limit: number;                                                                                      
    if (mode === "quiz") {                                                                                  
      limit = 60; // 60 seconds per MCQ                                                                     
    } else if (mode === "written") {                                                                        
      limit = questions[currentQIndex]?.time_limit_sec || 120;                                              
    } else {                                                                                                
      return; // oral mode manages its own timing                                                           
    }                                                                                                       
    setTimeRemaining(limit);                                                                                
                                                                                                            
    if (timerRef.current) clearInterval(timerRef.current);                                                  
    timerRef.current = setInterval(() => {                                                                  
      setTimeRemaining((prev) => {                                                                          
        if (prev === null || prev <= 1) {                                                                   
          clearInterval(timerRef.current!);                                                                 
          // Auto-submit when time runs out                                                                 
          if (mode === "quiz" && quizAnswer) {                                                              
            handleSubmitQuiz();                                                                             
          } else if (mode === "written" && writtenAnswer.trim()) {                                          
            handleSubmitWritten();                                                                          
          } else if (mode === "written") {                                                                  
            // Force advance even with blank answer                                                         
            setCurrentQIndex((prev) => prev + 1);                                                           
            setStartTime(Date.now());                                                                       
          }                                                                                                 
          return 0;                                                                                         
        }                                                                                                   
        return prev - 1;                                                                                    
      });                                                                                                   
    }, 1000);                                                                                               
                                                                                                            
    return () => { if (timerRef.current) clearInterval(timerRef.current); };                                
  }, [sessionStarted, currentQIndex, mode]);                                                                
                                                                                                            
  // Start Exam Session                                                                                     
  const startSession = async (e: React.FormEvent) => {                                                      
    e.preventDefault();                                                                                     
    if (!examPublished || (questions.length === 0 && mcqQuestions.length === 0)) {                          
      alert("Exam Not Published: No exam has been published by faculty for your section yet. Please wait for faculty to publish the assessment.");
      return;                                                                                               
    }                                                                                                       
    if (alreadyAttempted) {                                                                                 
      alert("Assessment Already Completed: You have already attempted this assessment. Each student is allowed only one attempt.");
      return;                                                                                               
    }                                                                                                       
                                                                                                            
    const newSid = `stud-${Date.now().toString(36)}`;                                                       
    setSessionId(newSid);                                                                                   
                                                                                                            
    // Enter fullscreen for proctoring                                                                      
    try {                                                                                                   
      await document.documentElement.requestFullscreen();                                                   
      setIsFullscreen(true);                                                                                
    } catch {                                                                                               
      // Fullscreen not available in this browser — continue anyway                                         
    }                                                                                                       
                                                                                                            
    // Reset proctoring state                                                                               
    setAuthenticityScore(100);                                                                              
    setFullscreenExits(0);                                                                                  
    setAutoSubmitted(false);                                                                                
    setAutoSubmitReason("");                                                                                
                                                                                                            
    try {                                                                                                   
      const startRes = await fetch(`${BACKEND_HTTP}/api/session/start`, {                                   
        method: "POST",                                                                                     
        headers: { "Content-Type": "application/json" },                                                    
        body: JSON.stringify({                                                                              
          session_id: newSid,                                                                               
          candidate_name: studentName || "Candidate",                                                       
          roll_number: rollNumber || "student",                                                             
          mobile_number: mobileNumber || "0000000000",                                                      
          academic_year: academicYear,                                                                      
          department: studentDept,                                                                          
          role: "student",                                                                                  
          subject_key: examSubject,                                                                         
          mode: mode,                                                                                       
          exam_id: activeExamId,                                                                            
        }),                                                                                                 
      });                                                                                                   
                                                                                                            
      if (!startRes.ok) {                                                                                   
        const errData = await startRes.json().catch(() => ({}));                                            
        alert(errData.detail || "Unable to start assessment session.");                                     
        return;                                                                                             
      }                                                                                                     
                                                                                                            
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
      const updatedHistory = [...answersHistory, analysis];
      setAnswersHistory(updatedHistory);
      setWrittenAnswer("");
      setPasteAttempts(0);

      const isLast = currentQIndex >= questions.length - 1;
      if (!isLast) {
        setCurrentQIndex((prev) => prev + 1);
        setStartTime(Date.now());
      } else {
        // Calculate score: scale each answer's overall_score (0-100) to the question's max_marks
        const maxPossible = questions.reduce((sum, q) => sum + (q.max_marks || 10), 0);
        const scored = updatedHistory.reduce((sum: number, a: any, idx: number) => {
          const qMarks = (questions[idx]?.max_marks || 10);
          const scaled = ((a.overall_score ?? a.score ?? 0) / 100) * qMarks;
          return sum + scaled;
        }, 0);
        const finalRounded = Math.round(scored);
        setTotalScore(finalRounded);
        setMaxScore(maxPossible);

        // Record attempt in backend
        try {
          await fetch(`${BACKEND_HTTP}/api/student/record-attempt`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              student_roll: rollNumber,
              exam_id: activeExamId,
              session_id: sessionId,
              subject: examSubject,
              score: finalRounded,
              max_score: maxPossible,
              authenticity_score: authenticityScore,
              violations_count: fullscreenExits,
              status: "completed"
            }),
          });
        } catch (e) {
          console.error("Failed to record written attempt:", e);
        }

        // End session
        try {
          await fetch(`${BACKEND_HTTP}/api/session/end`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId }),
          });
        } catch {}
        // Exit fullscreen
        try { if (document.fullscreenElement) await document.exitFullscreen(); } catch {}
        setExamFinished(true);                                                                              
        setAlreadyAttempted(true);                                                                          
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
      const isCorrect = quizAnswer.toUpperCase() === activeMCQ.correct_answer.toUpperCase();                
      const res = await fetch(`${BACKEND_HTTP}/api/quiz/submit`, {                                          
        method: "POST",                                                                                     
        headers: { "Content-Type": "application/json" },                                                    
        body: JSON.stringify({                                                                              
          session_id: sessionId,                                                                            
          subject_key: selectedSubjectKey,                                                                  
          question_index: activeMCQ.index,                                                                  
          question_text: activeMCQ.question,                                                                
          selected_option: quizAnswer,                                                                      
          is_correct: isCorrect,                                                                            
          correct_option: activeMCQ.correct_answer,                                                         
          correct_text: activeMCQ.options[activeMCQ.correct_answer as keyof typeof activeMCQ.options] || "",
          selected_text: activeMCQ.options[quizAnswer as keyof typeof activeMCQ.options] || "",             
          explanation: activeMCQ.explanation || ""                                                          
        }),                                                                                                 
      });                                                                                                   
      const result = await res.json();                                                                      
      setQuizResult(result);                                                                                
      setLastAnalysis({ ...result, mode: "quiz", word_count: 1, copy_paste_attempts: 0 });                  
      const updatedHistory = [...answersHistory, result];                                                   
      setAnswersHistory(updatedHistory);                                                                    
      setQuizAnswer(null);                                                                                  
                                                                                                            
      const isLast = currentQIndex >= mcqQuestions.length - 1;                                              
      if (!isLast) {                                                                                        
        setTimeout(() => {                                                                                  
          setCurrentQIndex((prev) => prev + 1);                                                             
          setQuizResult(null);                                                                              
          setStartTime(Date.now());                                                                         
        }, 1500);                                                                                           
      } else {                                                                                              
        // Calculate final score                                                                            
        const correct = updatedHistory.filter((a: any) => a.correct).length;                                
        const total = mcqQuestions.length;                                                                  
        const finalScoreVal = correct * 10;                                                                 
        const maxScoreVal = total * 10;                                                                     
        setTotalScore(finalScoreVal);                                                                       
        setMaxScore(maxScoreVal);                                                                           
        // End session and show completion screen                                                           
        setTimeout(async () => {                                                                            
          // Record attempt in backend                                                                      
          try {                                                                                             
            await fetch(`${BACKEND_HTTP}/api/student/record-attempt`, {                                     
              method: "POST",                                                                               
              headers: { "Content-Type": "application/json" },                                              
              body: JSON.stringify({                                                                        
                student_roll: rollNumber,                                                                   
                exam_id: activeExamId,                                                                      
                session_id: sessionId,                                                                      
                subject: examSubject,                                                                       
                score: finalScoreVal,                                                                       
                max_score: maxScoreVal,                                                                     
                authenticity_score: authenticityScore,                                                      
                violations_count: fullscreenExits,                                                          
                status: "completed"                                                                         
              }),                                                                                           
            });                                                                                             
          } catch (e) {                                                                                     
            console.error("Failed to record quiz attempt:", e);                                             
          }                                                                                                 
                                                                                                            
          try {                                                                                             
            await fetch(`${BACKEND_HTTP}/api/session/end`, {                                                
              method: "POST",                                                                               
              headers: { "Content-Type": "application/json" },                                              
              body: JSON.stringify({ session_id: sessionId }),                                              
            });                                                                                             
          } catch {}                                                                                        
          // Exit fullscreen                                                                                
          try { if (document.fullscreenElement) await document.exitFullscreen(); } catch {}                 
          setExamFinished(true);                                                                            
          setAlreadyAttempted(true);                                                                        
        }, 1500);                                                                                           
      }                                                                                                     
    } catch (err) {                                                                                         
      console.error("Error submitting quiz:", err);                                                         
    } finally {                                                                                             
      setIsSubmittingQuiz(false);                                                                           
    }                                                                                                       
  };                                                                                                        
                                                                                                            
  // Update submitRef on every render to ensure timer callback always calls latest handlers
  submitRef.current = {
    handleSubmitWritten,
    handleSubmitQuiz,
    handleTimeout: () => {
      if (mode === "quiz") {
        const ans = quizAnswerRef.current;
        if (ans) {
          submitRef.current.handleSubmitQuiz(ans);
        } else {
          submitRef.current.handleSubmitQuiz("");
        }
      } else if (mode === "written") {
        const ans = writtenAnswerRef.current;
        if (ans && ans.trim()) {
          submitRef.current.handleSubmitWritten(ans);
        } else {
          submitRef.current.handleSubmitWritten("");
        }
      }
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
      wsRef.current.send(JSON.stringify({ 
        type: "answer_start", 
        ts: Date.now(),
        question: questions[currentQIndex]?.question_text || "",
        question_index: currentQIndex
      }));                         
                                                                                                            
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
  const isFinished = examFinished;                                                                          
                                                                                                            
  return (                                                                                                  
    <div className="min-h-screen bg-[#FAFAFA] text-[#171717] flex flex-col font-sans">                      
                                                                                                            
      {/* Floating Exam Published Toast */}                                                                 
      {examToast && (                                                                                       
        <div className="fixed top-5 right-5 z-[9999] max-w-sm w-full animate-bounce-in">                    
          <div className="bg-white border-l-4 border-emerald-500 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
              <span className="text-xl">📢</span>                                                           
            </div>                                                                                          
            <div className="flex-1 min-w-0">                                                                
              <p className="text-sm font-bold text-[#171717]">New Exam Published!</p>                       
              <p className="text-xs text-[#555555] mt-0.5 leading-relaxed">{examToast.message}</p>          
              <p className="text-[11px] font-semibold text-emerald-600 mt-1">📝 {examToast.subject}</p>     
            </div>                                                                                          
            <button                                                                                         
              onClick={() => setExamToast(null)}                                                            
              className="text-slate-400 hover:text-slate-600 text-lg leading-none shrink-0 mt-0.5"          
            >×</button>                                                                                     
          </div>                                                                                            
        </div>                                                                                              
      )}                                                                                                    
                                                                                                            
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
              onClick={() => {
                const nextState = !showNotifications;
                setShowNotifications(nextState);
                if (nextState && unreadCount > 0) {
                  markNotificationsAsRead();
                }
              }}
              className="relative p-2 rounded-xl border border-[#E5E5E5] hover:bg-slate-50 transition text-[#555555] cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#C8102E] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-[#E5E5E5] rounded-2xl shadow-xl p-4 z-50">
                <div className="flex items-center justify-between border-b pb-2 mb-2">
                  <span className="text-xs font-bold text-[#171717] uppercase">Question Updates & Alerts</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#777777]">{notifications.length} alerts</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markNotificationsAsRead()}
                        className="text-[10px] font-semibold text-[#C8102E] hover:underline cursor-pointer"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
                {notifications.length === 0 ? (
                  <p className="text-xs text-center text-gray-500 py-4">No notifications yet.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {notifications.map((n) => {
                      const isUnread = !n.is_read || n.is_read === 0;
                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (isUnread) markNotificationsAsRead(n.id);
                            if (n.exam_id) {
                              handleSelectExam(n.exam_id);
                              setShowNotifications(false);
                            }
                          }}
                          className={`p-2.5 rounded-xl text-xs border transition ${
                            n.test_ready
                              ? isUnread
                                ? "bg-emerald-50 border-emerald-300 text-emerald-950 cursor-pointer hover:bg-emerald-100"
                                : "bg-emerald-50/40 border-emerald-100 text-emerald-900 cursor-pointer hover:bg-emerald-50"
                              : "bg-[#F8F8F8] border-[#E5E5E5] text-[#555555]"
                          }`}
                        >
                          <div className="font-bold flex items-center justify-between gap-1 mb-0.5">
                            <div className="flex items-center gap-1.5">
                              {n.test_ready ? (
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-amber-500" />
                              )}
                              <span>{n.subject}</span>
                              {isUnread && (
                                <span className="w-2 h-2 rounded-full bg-[#C8102E] shrink-0" title="Unread" />
                              )}
                            </div>
                            {n.test_ready === 1 && (
                              <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                Open →
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] leading-relaxed">{n.message}</p>
                        </div>
                      );
                    })}
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

            {/* Banner: Assessment Already Completed (Single Attempt Limit) */}
            {alreadyAttempted && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3">
                <Lock className="w-5 h-5 text-[#C8102E] shrink-0 mt-0.5" />
                <div className="space-y-1.5 flex-1">
                  <span className="font-bold block text-sm">Assessment Already Completed</span>
                  <p className="leading-relaxed">
                    You have already attempted and submitted this assessment. Veritas enforces a strict <strong>single attempt</strong> policy per student.
                  </p>
                  {previousAttempt && (
                    <div className="mt-2 text-[11px] bg-white/90 p-2.5 rounded-lg border border-rose-200 flex flex-wrap gap-x-4 gap-y-1 text-slate-700">
                      <div>Score: <strong className="text-[#171717]">{previousAttempt.score}/{previousAttempt.max_score}</strong></div>
                      <div>Authenticity: <strong className="text-[#171717]">{previousAttempt.authenticity_score}%</strong></div>
                      <div>Violations: <strong className="text-[#171717]">{previousAttempt.violations_count || 0}</strong></div>
                      <div>Status: <strong className="uppercase text-[#C8102E]">{previousAttempt.status}</strong></div>
                    </div>
                  )}

                  {/* Switch to unattempted exam callout */}
                  {availableExams.some((e) => !e.already_attempted) && (() => {
                    const unattemptedExam = availableExams.find((e) => !e.already_attempted);
                    return (
                      <div className="mt-3 pt-3 border-t border-rose-200 flex flex-wrap items-center justify-between gap-2 bg-white/80 p-2.5 rounded-lg">
                        <div className="text-xs text-rose-900 font-semibold">
                          <span>A new unattempted exam is available: </span>
                          <strong className="text-[#171717]">{unattemptedExam.name}</strong>
                          <span className="ml-1 uppercase text-[10px] bg-slate-200 text-slate-800 font-bold px-1.5 py-0.5 rounded">
                            {unattemptedExam.mode}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectExam(unattemptedExam.exam_id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1 shadow-sm"
                        >
                          <span>Take {unattemptedExam.mode === "oral" ? "Oral Viva" : unattemptedExam.mode === "written" ? "Written Exam" : "Quiz"} Now</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Banner: Exam Not Published Yet */}
            {(!examPublished || (questions.length === 0 && mcqQuestions.length === 0)) && !alreadyAttempted && (
              <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-sm">Exam Not Published</span>                       
                  <p className="leading-relaxed mt-0.5">                                                    
                    Faculty has not published any active exam for <strong>{studentDept.toUpperCase()} · {academicYear} · {studentSection}</strong> yet.
                    Please wait for your faculty to publish the assessment questions before starting.       
                  </p>                                                                                      
                </div>                                                                                      
              </div>                                                                                        
            )}                                                                                              
                                                                                                            
            {/* Notification banner when an exam has been published */}
            {notifications.some(n => n.test_ready === 1 && (!n.is_read || n.is_read === 0)) && (() => {
              const latest = notifications.find(n => n.test_ready === 1 && (!n.is_read || n.is_read === 0));
              if (!latest) return null;
              return (
                <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-3 relative">
                  <span className="text-2xl shrink-0">📢</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold block text-sm">Exam Published — Ready to Begin!</span>
                    <span className="leading-relaxed">{latest.message}</span>
                    <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-semibold text-emerald-700">📝 {latest.subject}</span>
                      {latest.exam_id && (
                        <button
                          type="button"
                          onClick={() => {
                            markNotificationsAsRead(latest.id);
                            handleSelectExam(latest.exam_id!);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
                        >
                          <span>Open This Exam</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => markNotificationsAsRead(latest.id)}
                    className="p-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 rounded-lg transition shrink-0 cursor-pointer"
                    title="Dismiss notification"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })()}                                                                                           
                                                                                                            
            {/* Available Published Examinations Selector */}                                               
            {availableExams.length > 0 && (                                                                 
              <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-[#E5E5E5] space-y-2.5">         
                <div className="flex items-center justify-between">                                         
                  <span className="text-xs uppercase tracking-wider font-bold text-[#555555] flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#C8102E]" /> Department Assessments ({availableExams.length})
                  </span>                                                                                   
                  <span className="text-[11px] text-[#777777]">Click to choose exam</span>                  
                </div>                                                                                      
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">                                     
                  {availableExams.map((exam) => {                                                           
                    const isSelected = (selectedExamId === exam.exam_id) || (!selectedExamId && activeExamId === exam.exam_id);
                    return (                                                                                
                      <button                                                                               
                        key={exam.exam_id}                                                                  
                        type="button"                                                                       
                        onClick={() => handleSelectExam(exam.exam_id)}                                      
                        className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                          isSelected                                                                        
                            ? "bg-white border-[#C8102E] shadow-sm ring-1 ring-[#C8102E]"                   
                            : "bg-white border-[#E5E5E5] hover:border-[#AAAAAA]"                            
                        }`}                                                                                 
                      >                                                                                     
                        <div className="min-w-0 flex-1 pr-2">                                               
                          <div className="font-bold text-xs text-[#171717] truncate">{exam.name}</div>      
                          <div className="text-[10px] text-[#555555] mt-0.5">                               
                            {exam.subject || "General"} · {exam.question_count} Qs                          
                          </div>                                                                            
                        </div>                                                                              
                        <div className="flex items-center gap-1.5 shrink-0">                                
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${     
                            exam.mode === "quiz" ? "bg-rose-50 text-[#C8102E]" : exam.mode === "oral" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
                          }`}>                                                                              
                            {exam.mode}                                                                     
                          </span>                                                                           
                          {exam.already_attempted ? (                                                       
                            <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" /> Attempted                                    
                            </span>                                                                         
                          ) : (                                                                             
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Ready                                
                            </span>                                                                         
                          )}                                                                                
                        </div>                                                                              
                      </button>                                                                             
                    );                                                                                      
                  })}                                                                                       
                </div>                                                                                      
              </div>                                                                                        
            )}                                                                                              
                                                                                                            
                                                                                                            
            <form onSubmit={startSession} className="space-y-6">                                            
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
                      placeholder="e.g. 23eg106d30"                                                         
                      value={rollNumber}                                                                    
                      onChange={(e) => handleRollNumberChange(e.target.value)}                              
                      className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2.5 pl-10 pr-3 text-[#171717] focus:outline-none focus:border-[#C8102E] transition text-sm"
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
                    <option value="ai">AI</option>                                                          
                    <option value="data science">Data Science</option>                                      
                    <option value="it">Information Tech</option>                                            
                    <option value="ece">ECE</option>                                                        
                    <option value="eee">EEE</option>                                                        
                    <option value="civil">Civil Engineering</option>                                        
                    <option value="mech">Mechanical Engineering</option>                                    
                    <option value="ecm">ECM</option>                                                        
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
                    <option value="Section E">Section E</option>                                            
                    <option value="Section F">Section F</option>                                            
                    <option value="Section G">Section G</option>                                            
                    <option value="Section H">Section H</option>                                            
                    <option value="Section I">Section I</option>                                            
                    <option value="Section J">Section J</option>                                            
                    <option value="Section K">Section K</option>                                            
                    <option value="Section L">Section L</option>                                            
                    <option value="Section M">Section M</option>                                            
                    <option value="Section N">Section N</option>                                            
                    <option value="Section O">Section O</option>                                            
                    <option value="Section P">Section P</option>                                            
                    <option value="Section Q">Section Q</option>                                            
                    <option value="Section R">Section R</option>                                            
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
                                                                                                            
              {/* Start Assessment Button */}                                                               
              <button                                                                                       
                type="submit"                                                                               
                disabled={!examPublished || alreadyAttempted || (questions.length === 0 && mcqQuestions.length === 0)}
                className="w-full bg-[#C8102E] text-white py-3.5 rounded-xl font-bold hover:bg-[#A00D24] transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >                                                                                             
                <span>                                                                                      
                  {!examPublished || (questions.length === 0 && mcqQuestions.length === 0)                  
                    ? "Exam Not Published Yet"                                                              
                    : alreadyAttempted                                                                      
                    ? "Already Attempted — Only 1 Attempt Allowed"                                          
                    : "Begin Assessment Now"}                                                               
                </span>                                                                                     
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
            {/* Big check or alert icon */}
            <div className={`w-20 h-20 ${autoSubmitted ? "bg-rose-100 text-[#C8102E]" : "bg-emerald-100 text-emerald-600"} rounded-full flex items-center justify-center mx-auto mb-4`}>
              {autoSubmitted ? <AlertTriangle className="w-10 h-10" /> : <CheckCircle2 className="w-10 h-10" />}
            </div>
            <h2 className="text-2xl font-black text-[#171717]">
              {autoSubmitted ? "⚠️ Exam Auto-Submitted!" : "🎉 Exam Submitted!"}
            </h2>
            <p className="text-sm text-[#555555] mt-2">
              {autoSubmitted
                ? "The assessment was automatically ended and submitted due to proctoring policy violations."
                : "Thank you for completing the assessment. Your responses have been securely logged."}
            </p>

            {/* Auto-submitted Warning Notice */}
            {autoSubmitted && (
              <div className="my-4 p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-950 text-xs text-left">
                <div className="font-bold text-rose-800 text-sm flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  Auto-Submission Notice (Authenticity Score: 0/100)
                </div>
                <p className="leading-relaxed">{autoSubmitReason || "Your authenticity score reached 0% due to integrity violations."}</p>
                <p className="mt-1 text-rose-700 font-semibold">Your exam record has been flagged for faculty review.</p>
              </div>
            )}

            {/* Score Card */}
            {maxScore > 0 && (
              <div className="my-6 p-6 bg-gradient-to-br from-[#C8102E]/5 to-[#C8102E]/10 border border-[#C8102E]/20 rounded-2xl">
                <p className="text-xs font-bold uppercase tracking-widest text-[#C8102E] mb-1">Your Score</p>
                <p className="text-5xl font-black text-[#171717]">
                  {totalScore}<span className="text-2xl text-[#555555]">/{maxScore}</span>
                </p>
                <p className="text-lg font-bold text-[#C8102E] mt-1">
                  {Math.round((totalScore / maxScore) * 100)}%
                  {" — "}
                  {Math.round((totalScore / maxScore) * 100) >= 90 ? "🏆 Excellent" :
                   Math.round((totalScore / maxScore) * 100) >= 75 ? "✅ Good" :
                   Math.round((totalScore / maxScore) * 100) >= 50 ? "📘 Average" : "⚠️ Needs Improvement"}
                </p>
              </div>
            )}

            {/* Summary Details */}
            <div className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl p-4 mb-6 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#555555]">Candidate:</span>
                <span className="font-bold text-[#171717]">{studentName} ({rollNumber.toUpperCase()})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#555555]">Department & Section:</span>
                <span className="font-bold text-[#171717]">{studentDept.toUpperCase()} — {studentSection}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#555555]">Subject:</span>
                <span className="font-bold text-[#171717]">{examSubject || "General Assessment"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#555555]">Mode:</span>
                <span className="font-bold text-[#C8102E] uppercase">{mode}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#E5E5E5]">
                <span className="text-[#555555]">Authenticity Score:</span>
                <span className={`font-bold ${authenticityScore >= 85 ? "text-emerald-600" : authenticityScore >= 60 ? "text-amber-600" : "text-rose-600"}`}>
                  {authenticityScore}/100
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#555555]">Fullscreen Violations:</span>
                <span className={`font-bold ${fullscreenExits === 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {fullscreenExits === 0 ? "None ✅" : `${fullscreenExits} ⚠️`}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSessionStarted(false);
                  setExamFinished(false);
                  setCurrentQIndex(0);
                  setAnswersHistory([]);
                  setTotalScore(0);
                  setMaxScore(0);
                  // Reset attempt state so backend can re-check for new exams
                  setAlreadyAttempted(false);
                  setPreviousAttempt(null);
                  setExamPublished(false);
                  prepareQuestionsForSubject();
                }}
                className="flex-1 border border-[#E5E5E5] text-[#171717] px-6 py-3 rounded-xl font-bold text-sm hover:bg-slate-50 transition"
              >
                Back to Portal
              </button>
              <button
                onClick={() => router.push("/login/student")}
                className="flex-1 bg-[#C8102E] text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-[#A00D24] transition"
              >
                Go to Home →
              </button>
            </div>
            <p className="text-[11px] text-[#777777] mt-3">
              🔒 Single Attempt Policy: Your assessment has been recorded. Each student is allowed only one attempt.
            </p>
          </motion.div>

        ) : (
          /* STEP 2: Active Test Runner (Quiz / Oral / Written) */
          <div className="max-w-3xl mx-auto w-full space-y-6">
                                                                                                            
            {/* Fullscreen Exit Warning Modal */}                                                           
            {fullscreenWarning && (                                                                         
              <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4">     
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border-t-4 border-[#C8102E]">
                  <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-7 h-7 text-rose-600" />                                     
                  </div>                                                                                    
                  <h3 className="text-xl font-black text-[#171717]">Proctoring Alert!</h3>                  
                  <p className="text-sm text-[#555555] mt-2 leading-relaxed">                               
                    You exited fullscreen mode. This is a <strong>proctoring violation</strong>.            
                    Your authenticity score has been reduced by <strong className="text-rose-600">{FULLSCREEN_PENALTY} points</strong>. Please stay in fullscreen mode to maintain test integrity.
                  </p>                                                                                      
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 my-4 text-sm">           
                    <span className="font-bold text-rose-800">Authenticity Score: {authenticityScore}/100</span>
                    <span className="ml-2 text-rose-600">({fullscreenExits} violation{fullscreenExits !== 1 ? "s" : ""})</span>
                  </div>                                                                                    
                  <button                                                                                   
                    onClick={async () => {                                                                  
                      setFullscreenWarning(false);                                                          
                      try { await document.documentElement.requestFullscreen(); } catch {}                  
                    }}                                                                                      
                    className="w-full bg-[#C8102E] text-white py-3 rounded-xl font-bold hover:bg-[#A00D24] transition text-sm"
                  >                                                                                         
                    Return to Fullscreen & Continue                                                         
                  </button>                                                                                 
                </div>                                                                                      
              </div>                                                                                        
            )}                                                                                              
                                                                                                            
            {/* Active Proctoring Header */}                                                                
            <div className="bg-white border border-[#E5E5E5] p-4 rounded-2xl shadow-sm">                    
              <div className="flex items-center justify-between">                                           
                <div>                                                                                       
                  <span className="text-xs uppercase font-bold text-[#C8102E]">{examSubject}</span>         
                  <h2 className="text-lg font-bold text-[#171717]">                                         
                  Question {currentQIndex + 1} of {mode === "quiz" ? mcqQuestions.length : questions.length}
                  </h2>                                                                                     
                </div>                                                                                      
                <div className="flex items-center gap-3">                                                   
                  {/* Timer */}                                                                             
                  {timeRemaining !== null && (                                                              
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                      timeRemaining <= 10                                                                   
                        ? "bg-rose-100 text-rose-700 animate-pulse"                                         
                        : timeRemaining <= 30                                                               
                        ? "bg-amber-100 text-amber-700"                                                     
                        : "bg-slate-100 text-slate-700"                                                     
                    }`}>                                                                                    
                      <Clock className="w-3.5 h-3.5" />                                                     
                      <span>{timeRemaining}s</span>
                    </div>                                                                                  
                  )}                                                                                        
                  {/* Authenticity Score */}                                                                
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${  
                    authenticityScore >= 85                                                                 
                      ? "bg-emerald-100 text-emerald-700"                                                   
                      : authenticityScore >= 60                                                             
                      ? "bg-amber-100 text-amber-700"                                                       
                      : "bg-rose-100 text-rose-700"                                                         
                  }`}>                                                                                      
                    <ShieldCheck className="w-3.5 h-3.5" />                                                 
                      <span>Authenticity: {authenticityScore}/100</span>
                  </div>                                                                                    
                  {/* Mode badge */}                                                                        
                  <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full font-bold uppercase">
                    {mode}                                                                                  
                  </span>                                                                                   
                </div>                                                                                      
              </div>                                                                                        
              {/* Timer progress bar */}                                                                    
              {timeRemaining !== null && (                                                                  
                <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">                      
                  <div                                                                                      
                    className={`h-full rounded-full transition-all duration-1000 ${                         
                      timeRemaining <= 10 ? "bg-rose-500" : timeRemaining <= 30 ? "bg-amber-400" : "bg-emerald-500"
                    }`}                                                                                     
                    style={{                                                                                
                      width: `${mode === "quiz"                                                             
                        ? (timeRemaining / 60) * 100                                                        
                        : (timeRemaining / (questions[currentQIndex]?.time_limit_sec || 120)) * 100}%`
                    }}                                                                                      
                  />                                                                                        
                </div>                                                                                      
              )}                                                                                            
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
                  {["A", "B", "C", "D"].map((opt) => {                                                      
                    const isSelected = quizAnswer === opt;                                                  
                    const isCorrectOption = opt.toUpperCase() === (activeQuestion as MCQQuestion)?.correct_answer?.toUpperCase();
                    const hasAnswered = quizAnswer !== null;                                                
                                                                                                            
                    let btnClass = "border-[#E5E5E5] hover:border-slate-400 text-[#171717]";                
                    let icon = null;                                                                        
                                                                                                            
                    if (hasAnswered) {                                                                      
                      if (isCorrectOption) {                                                                
                        btnClass = "border-green-500 bg-green-50 font-bold text-green-700";                 
                        icon = <CheckCircle2 className="w-5 h-5 text-green-600" />;                         
                      } else if (isSelected && !isCorrectOption) {                                          
                        btnClass = "border-[#C8102E] bg-[#FFF1F2] font-bold text-[#C8102E]";                
                        icon = <CheckCircle2 className="w-5 h-5 text-[#C8102E]" />;                         
                      } else {                                                                              
                        btnClass = "border-[#E5E5E5] text-slate-400 opacity-50";                            
                      }                                                                                     
                    } else if (isSelected) {                                                                
                       btnClass = "border-blue-500 bg-blue-50 font-bold text-blue-700";                     
                    }                                                                                       
                                                                                                            
                    return (                                                                                
                      <button                                                                               
                        key={opt}                                                                           
                        type="button"                                                                       
                        onClick={() => { if (!hasAnswered) setQuizAnswer(opt); }}                           
                        disabled={hasAnswered}                                                              
                      className={`w-full p-4 rounded-xl border text-left text-sm flex items-center justify-between transition ${btnClass}`}
                      >                                                                                     
                        <div className="flex items-center gap-3">                                           
                        <span className="w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold">
                            {opt}                                                                           
                          </span>                                                                           
                          <span>{(activeQuestion as MCQQuestion)?.options?.[opt as keyof MCQQuestion["options"]]}</span>
                        </div>                                                                              
                        {icon}                                                                              
                      </button>                                                                             
                    );                                                                                      
                  })}                                                                                       
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
                    {isSubmittingWritten ? (                                                                
                      <>                                                                                    
                        <RefreshCw className="w-4 h-4 animate-spin" />                                      
                        AI Evaluating...                                                                    
                      </>                                                                                   
                    ) : (                                                                                   
                      <>                                                                                    
                        <Sparkles className="w-4 h-4" />                                                    
                        Submit for AI Evaluation                                                            
                      </>                                                                                   
                    )}                                                                                      
                  </button>                                                                                 
                </div>                                                                                      
              </div>                                                                                        
            )}                                                                                              
                                                                                                            
            {/* RUNNER: Oral Viva Mode */}                                                                  
            {mode === "oral" && (                                                                           
              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-8 shadow-sm text-center space-y-6">
                <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center relative ${speaking ? "bg-rose-50 border-4 border-[#C8102E]" : joined ? "bg-emerald-50 border-4 border-emerald-500" : "bg-slate-100 border-4 border-slate-300"}`}>
                  <Mic className={`w-10 h-10 ${speaking ? "text-[#C8102E] animate-pulse" : joined ? "text-emerald-600" : "text-slate-400"}`} />
                  {speaking && (                                                                            
                    <span className="absolute -bottom-2 bg-[#C8102E] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                      Live                                                                                  
                    </span>                                                                                 
                  )}                                                                                        
                  {!joined && !speaking && (                                                                
                    <span className="absolute -bottom-2 bg-slate-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                      Connecting...                                                                         
                    </span>                                                                                 
                  )}                                                                                        
                </div>                                                                                      
                                                                                                            
                <div>                                                                                       
                  <p className="text-xs text-[#555555] font-medium">{status}</p>                            
                  {!joined && (                                                                             
                    <p className="text-[11px] text-amber-600 mt-1 animate-pulse">                           
                      🔄 Establishing audio connection... please wait.                                      
                    </p>                                                                                    
                  )}                                                                                        
                </div>                                                                                      
                                                                                                            
                <div className="flex justify-center gap-4">                                                 
                  {!joined ? (                                                                              
                    <button                                                                                 
                      type="button"                                                                         
                      onClick={() => initOralMode(sessionId)}                                               
                      className="bg-slate-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-600 transition flex items-center gap-2"
                    >                                                                                       
                      <RefreshCw className="w-4 h-4 animate-spin" /> Reconnecting...                        
                    </button>                                                                               
                  ) : !speaking ? (                                                                         
                    <button                                                                                 
                      type="button"                                                                         
                      disabled={!oralQuestionSynced}
                      onClick={startSpeaking}                                                               
                      className="bg-black text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >                                                                                       
                      <Mic className="w-4 h-4" /> {!oralQuestionSynced ? "Syncing Question..." : "Start Speaking Answer"}                                     
                    </button>                                                                               
                  ) : (                                                                                     
                    <button                                                                                 
                      type="button"                                                                         
                      onClick={stopSpeaking}                                                                
                      className="bg-[#C8102E] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-[#A00D24] transition flex items-center gap-2"
                    >                                                                                       
                      <MicOff className="w-4 h-4" /> Stop & Evaluate Answer
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={async () => {
                      if (currentQIndex < questions.length - 1) {
                        setCurrentQIndex((prev) => prev + 1);
                      } else {
                        // Oral: final score = Math.round(average of overall_score across answered questions). maxScore = 100
                        const answered = answersHistory.filter((a: any) => typeof (a.overall_score ?? a.score) === "number");
                        const finalScore = answered.length > 0
                          ? Math.round(answered.reduce((sum: number, a: any) => sum + (a.overall_score ?? a.score ?? 0), 0) / answered.length)
                          : 0;
                        setTotalScore(finalScore);
                        setMaxScore(100);

                        try {
                          await fetch(`${BACKEND_HTTP}/api/student/record-attempt`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              student_roll: rollNumber,
                              exam_id: activeExamId,
                              session_id: sessionId,
                              subject: examSubject,
                              score: finalScore,
                              max_score: 100,
                              authenticity_score: authenticityScore,
                              violations_count: fullscreenExits,
                              status: "completed"
                            }),
                          });
                        } catch (e) {}

                        try {
                          await fetch(`${BACKEND_HTTP}/api/session/end`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ session_id: sessionId }),
                          });
                        } catch {}                                                                          
                                                                                                            
                        try { if (document.fullscreenElement) await document.exitFullscreen(); } catch {}   
                        setExamFinished(true);                                                              
                        setAlreadyAttempted(true);                                                          
                      }                                                                                     
                    }}                                                                                      
                    className="border border-[#E5E5E5] px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition"
                  >                                                                                         
                    {currentQIndex < questions.length - 1 ? "Next Question" : "Finish Oral Exam"}           
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
