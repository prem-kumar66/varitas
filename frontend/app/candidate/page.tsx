"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, Radio, AlertTriangle, ShieldCheck, CheckCircle2,
  Edit3, ArrowRight, RefreshCw, User, Hash, BookOpen, Clock, AlertCircle, Sparkles, ListChecks
} from "lucide-react";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";
const BACKEND_WS = process.env.NEXT_PUBLIC_BACKEND_WS || "ws://localhost:8000";

type Assessment = {
  exam_id: string;
  name: string;
  mode: string;
  department: string;
  year: string;
  questions: any[];
};

type Question = { id?: number; question_text: string; reference_answer?: string; rubric_keywords?: string[]; max_marks?: number; time_limit_sec?: number };
type MCQQuestion = { index: number; question: string; options: { A: string; B: string; C: string; D: string } };

export default function CandidatePage() {
  const router = useRouter();
  // Registration & Config State
  const [studentName, setStudentName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [academicYear, setAcademicYear] = useState("3rd Year");
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [mode, setMode] = useState<"oral" | "written" | "quiz">("written");
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);
  const [mcqQuestions, setMcqQuestions] = useState<MCQQuestion[]>([]);
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState<any>(null);

  // Flow State
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);

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

  useEffect(() => {
    const savedAuth = localStorage.getItem("veritas_student_auth");
    let savedDept = "";
    let savedYear = "";
    if (savedAuth) {
      try {
        const auth = JSON.parse(savedAuth);
        if (auth.studentName) setStudentName(auth.studentName);
        if (auth.rollNumber) setRollNumber(auth.rollNumber);
        if (auth.mobileNumber) setMobileNumber(auth.mobileNumber);
        if (auth.academicYear) {
          setAcademicYear(auth.academicYear);
          savedYear = auth.academicYear;
        }
        if (auth.department) {
          savedDept = auth.department;
        }
      } catch (e) {}
    }

    fetch(`${BACKEND_HTTP}/api/assessments`)
      .then((res) => res.json())
      .then((data) => {
        if (data.assessments && data.assessments.length > 0) {
          setAssessments(data.assessments);
          handleAssessmentSelect(data.assessments[0].exam_id, data.assessments);
        }
      })
      .catch((err) => console.error("Error fetching assessments:", err));
  }, []);

  const handleStudentLogout = () => {
    localStorage.removeItem("veritas_student_auth");
    router.push("/login/student");
  };

  const handleAssessmentSelect = (examId: string, allAssessments = assessments) => {
    setSelectedAssessmentId(examId);
    const assessment = allAssessments.find((a) => a.exam_id === examId);
    if (assessment) {
      setMode(assessment.mode as "oral" | "written" | "quiz");
      if (assessment.mode === "quiz") {
        setMcqQuestions(assessment.questions.map((q, idx) => ({
          index: idx,
          question: q.question,
          options: q.options || { A: "", B: "", C: "", D: "" }
        })));
        setQuestions([]);
      } else {
        setQuestions(assessment.questions.map((q, idx) => ({
          id: idx,
          question_text: q.question,
          reference_answer: q.reference_answer,
          rubric_keywords: q.rubric_keywords || [],
          max_marks: 10,
          time_limit_sec: 120
        })));
        setMcqQuestions([]);
      }
    }
  };

  // Start Assessment Session
  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !rollNumber.trim()) return;

    const newSid = `stud-${Date.now().toString(36)}`;
    setSessionId(newSid);

    try {
      await fetch(`${BACKEND_HTTP}/api/session/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: newSid,
          candidate_name: studentName,
          roll_number: rollNumber,
          mobile_number: mobileNumber,
          academic_year: academicYear,
          subject_key: selectedAssessmentId,
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
        await fetch(`${BACKEND_HTTP}/api/session/finalize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
      }
    } catch (err) {
      console.error("Written submission error:", err);
    } finally {
      setIsSubmittingWritten(false);
    }
  };

  // Submit Quiz (MCQ) Answer
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
          subject_key: selectedAssessmentId,
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
        }, 2000);
      } else {
        await fetch(`${BACKEND_HTTP}/api/session/finalize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
      }
    } catch (err) {
      console.error("Quiz submission error:", err);
    } finally {
      setIsSubmittingQuiz(false);
    }
  };

  // Oral Microphone Control
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
          sum += inputData[i] * inputData[i];
        }
        setAudioLevel(Math.min(100, Math.round(Math.sqrt(sum / inputData.length) * 400)));

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
    } catch (e: any) {
      console.error("Mic error:", e);
    }
  };

  const stopSpeaking = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "answer_end", ts: Date.now() }));
    }
    setSpeaking(false);
    setAudioLevel(0);
  };

  return (
    <div className="min-h-screen bg-[#F8F8F8] text-[#171717] flex flex-col font-sans">
      {/* Header */}
      <header className="px-8 py-5 border-b border-[#E5E5E5] bg-white backdrop-blur-md flex justify-between items-center">
        <Link href="/" className="flex items-center gap-3">
          <div className="p-2 bg-[#FFF1F2] rounded-lg border border-[#C8102E]/30">
            <BookOpen className="w-5 h-5 text-[#C8102E]" />
          </div>
          <div>
            <span className="font-bold text-lg text-[#171717]">VERITAS ACADEMIC</span>
            <span className="block text-[10px] uppercase tracking-widest text-[#555555]">Student Assessment Portal</span>
          </div>
        </Link>
        <div className="flex items-center gap-4 text-xs">
          {sessionStarted && (
            <>
              <span className="px-3 py-1 bg-[#E5E5E5] border border-[#D4D4D4] rounded-full text-[#555555]">
                <User className="w-3.5 h-3.5 inline mr-1 text-[#C8102E]" /> {studentName} ({rollNumber})
              </span>
              <span className="px-3 py-1 bg-[#FFF1F2] border border-[#C8102E]/30 rounded-full text-[#C8102E] capitalize font-medium">
                {mode} Assessment Mode
              </span>
            </>
          )}
          <button
            onClick={handleStudentLogout}
            className="px-3.5 py-1.5 bg-[#E5E5E5] hover:bg-[#D4D4D4] text-[#555555] border border-[#D4D4D4] rounded-xl transition text-xs font-semibold"
          >
            Log Out
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full flex flex-col justify-center">
        {!sessionStarted ? (
          /* STEP 1: Student Registration Form */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-[#E5E5E5] rounded-2xl p-8 max-w-xl mx-auto w-full shadow-2xl"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-[#171717]">Student Registration & Mode Choice</h2>
              <p className="text-sm text-[#555555] mt-2">Enter your academic details and select your preferred interview mode.</p>
            </div>

            <form onSubmit={handleStartSession} className="space-y-6">
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-5 h-5 absolute left-3.5 top-3.5 text-[#555555]" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-3 pl-11 pr-4 text-[#171717] placeholder-slate-600 focus:outline-none focus:border-[#C8102E] transition text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-2">
                  Roll Number / Student ID
                </label>
                <div className="relative">
                  <Hash className="w-5 h-5 absolute left-3.5 top-3.5 text-[#555555]" />
                  <input
                    type="text"
                    required
                    placeholder="23eg107b19"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-3 pl-11 pr-4 text-[#171717] placeholder-slate-600 focus:outline-none focus:border-[#C8102E] transition text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#555555] mb-2">
                  Select Published Assessment
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {assessments.length === 0 && (
                    <div className="col-span-2 p-4 text-sm text-center text-gray-500 border rounded-xl">
                      No published assessments found.
                    </div>
                  )}
                  {assessments.map((assessment) => (
                    <button
                      key={assessment.exam_id}
                      type="button"
                      onClick={() => handleAssessmentSelect(assessment.exam_id)}
                      className={`text-left p-4 rounded-xl border transition flex flex-col ${
                        selectedAssessmentId === assessment.exam_id
                          ? "border-[#C8102E] bg-[#FFF1F2]"
                          : "border-[#E5E5E5] bg-white hover:border-[#A3A3A3]"
                      }`}
                    >
                      <span className={`font-bold text-sm ${
                        selectedAssessmentId === assessment.exam_id ? "text-[#C8102E]" : "text-[#171717]"
                      }`}>
                        {assessment.name}
                      </span>
                      <span className="text-xs text-[#555555] mt-1 capitalize">
                        Mode: {assessment.mode}
                      </span>
                      <span className="text-xs text-[#555555]">
                        Questions: {assessment.questions.length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-[#C8102E] to-[#A50E25] hover:from-[#A50E25] hover:to-[#8B0B1F] text-slate-950 font-bold rounded-xl transition shadow-lg shadow-sm flex items-center justify-center gap-2 text-sm"
              >
                Begin Assessment <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        ) : (
          /* STEP 2: Active Assessment Panel */
          <div className="space-y-6">
            {/* Question Progress Header */}
            <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 flex justify-between items-center">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-[#C8102E]">
                  {mode === "quiz"
                    ? `Question ${currentQIndex + 1} of ${mcqQuestions.length}`
                    : `Question ${currentQIndex + 1} of ${questions.length}`}
                </span>
                <h3 className="text-xl font-bold text-[#171717] mt-1">
                  {mode === "quiz"
                    ? (mcqQuestions[currentQIndex]?.question || "Loading question...")
                    : (questions[currentQIndex]?.question_text || "Loading question...")}
                </h3>
              </div>
              <div className="text-right">
                {mode !== "quiz" && (
                  <>
                    <span className="text-xs text-[#555555] block">Max Marks: {questions[currentQIndex]?.max_marks || 10}</span>
                    <span className="text-xs text-[#555555] flex items-center gap-1 mt-1">
                      <Clock className="w-3.5 h-3.5 text-[#C8102E]" /> Time Limit: {questions[currentQIndex]?.time_limit_sec || 120}s
                    </span>
                  </>
                )}
                {mode === "quiz" && (
                  <span className="text-xs text-[#555555] block">10 marks · Select one</span>
                )}
              </div>
            </div>

            {/* Paste Violation Alert Banner */}
            <AnimatePresence>
              {pasteWarning && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3 text-red-300 text-sm"
                >
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                  <div>
                    <strong>Anti-Cheat Security Alert:</strong> Copy-pasting is strictly prohibited! Paste attempt #{pasteAttempts} has been logged in your audit report.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {mode === "written" ? (
              /* WRITTEN TEXT AREA — open-ended subjective questions */
              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center text-xs text-[#555555]">
                  <span>Type your detailed answer below:</span>
                  <span className="font-mono">{writtenAnswer.split(/\s+/).filter(Boolean).length} words | {writtenAnswer.length} chars</span>
                </div>

                <textarea
                  rows={8}
                  onPaste={handlePaste}
                  value={writtenAnswer}
                  onChange={(e) => setWrittenAnswer(e.target.value)}
                  placeholder="Explain your conceptual response clearly..."
                  className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl p-4 text-[#171717] focus:outline-none focus:border-[#C8102E] transition text-sm font-sans resize-none leading-relaxed"
                />

                <div className="flex justify-between items-center pt-2">
                  <div className="text-xs text-[#555555] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#C8102E]" /> Anti-paste & typing cadence monitor active
                  </div>
                  <button
                    onClick={handleSubmitWritten}
                    disabled={!writtenAnswer.trim() || isSubmittingWritten}
                    className="px-6 py-3 bg-[#C8102E] hover:bg-[#A50E25] disabled:opacity-50 text-slate-950 font-bold rounded-xl transition flex items-center gap-2 text-sm shadow-md"
                  >
                    {isSubmittingWritten ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Submit Answer & Continue"}
                  </button>
                </div>
              </div>
            ) : mode === "quiz" ? (
              /* QUIZ MCQ INTERFACE — separate MCQ question bank, not the same as Written/Oral */
              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2 text-xs text-[#C8102E] font-semibold uppercase tracking-wider mb-2">
                  <ListChecks className="w-4 h-4" /> Multiple Choice — Select one answer
                </div>

                {mcqQuestions[currentQIndex] ? (
                  <div className="grid grid-cols-1 gap-3">
                    {(["A", "B", "C", "D"] as const).map((opt) => {
                      const optionText = mcqQuestions[currentQIndex].options[opt];
                      const isSelected = quizAnswer === opt;
                      const isCorrect = quizResult?.correct_answer === opt;
                      const isWrong = quizResult && quizAnswer === opt && !quizResult.correct;
                      return (
                        <button
                          key={opt}
                          type="button"
                          disabled={!!quizResult}
                          onClick={() => !quizResult && setQuizAnswer(opt)}
                          className={`w-full text-left p-4 rounded-xl border text-sm font-medium transition ${
                            quizResult
                              ? isCorrect
                                ? "bg-emerald-500/15 border-emerald-500 text-emerald-300"
                                : isWrong
                                  ? "bg-red-500/15 border-red-500 text-red-300"
                                  : "bg-[#F8F8F8] border-[#E5E5E5] text-[#555555] opacity-50"
                              : isSelected
                                ? "bg-[#FFF1F2] border-[#C8102E] text-[#C8102E]"
                                : "bg-[#F8F8F8] border-[#E5E5E5] text-[#555555] hover:border-slate-600"
                          }`}
                        >
                          <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-bold mr-3 ${
                            quizResult
                              ? isCorrect ? "bg-emerald-500 text-slate-950" : isWrong ? "bg-red-500 text-slate-950" : "bg-[#E5E5E5] text-[#555555]"
                              : isSelected ? "bg-[#C8102E] text-slate-950" : "bg-[#E5E5E5] text-[#555555]"
                          }`}>{opt}</span>
                          {optionText}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[#555555] text-sm text-center py-6">Loading MCQ questions...</div>
                )}

                <div className="flex justify-between items-center pt-2">
                  <div className="text-xs text-[#555555] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#C8102E]" /> Answer validated server-side
                  </div>
                  {!quizResult ? (
                    <button
                      onClick={handleSubmitQuiz}
                      disabled={!quizAnswer || isSubmittingQuiz}
                      className="px-6 py-3 bg-[#C8102E] hover:bg-[#A50E25] disabled:opacity-50 text-slate-950 font-bold rounded-xl transition flex items-center gap-2 text-sm shadow-md"
                    >
                      {isSubmittingQuiz ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Submit & Check Answer"}
                    </button>
                  ) : (
                    <span className={`text-sm font-bold px-4 py-2 rounded-xl ${
                      quizResult.correct ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-red-500/15 text-red-400 border border-red-500/30"
                    }`}>
                      {quizResult.correct ? "✓ Correct! Next question loading..." : `✗ Incorrect — Answer: ${quizResult.correct_answer}`}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              /* ORAL VOICE INTERFACE */
              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-8 text-center space-y-6">
                <div className="flex justify-center items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${joined ? "bg-emerald-500 animate-pulse" : "bg-slate-600"}`} />
                  <span className="text-xs font-mono text-[#555555]">{status}</span>
                </div>

                <div className="py-6">
                  {!speaking ? (
                    <button
                      onClick={startSpeaking}
                      className="w-24 h-24 rounded-full bg-[#FFF1F2] border-2 border-[#C8102E] text-[#C8102E] hover:bg-[#FFF1F2] transition flex flex-col items-center justify-center mx-auto shadow-lg shadow-sm"
                    >
                      <Mic className="w-8 h-8" />
                      <span className="text-[10px] font-bold uppercase mt-1">Start Speaking</span>
                    </button>
                  ) : (
                    <button
                      onClick={stopSpeaking}
                      className="w-24 h-24 rounded-full bg-red-500/20 border-2 border-red-500 text-red-400 animate-pulse flex flex-col items-center justify-center mx-auto shadow-lg shadow-red-500/20"
                    >
                      <MicOff className="w-8 h-8" />
                      <span className="text-[10px] font-bold uppercase mt-1">Stop & Submit</span>
                    </button>
                  )}
                </div>

                {/* Audio Level Waveform Meter */}
                {speaking && (
                  <div className="max-w-md mx-auto space-y-2">
                    <div className="text-xs text-[#C8102E] font-mono">Recording audio stream... ({audioLevel}%)</div>
                    <div className="h-2 bg-[#F8F8F8] rounded-full overflow-hidden border border-[#E5E5E5]">
                      <div className="h-full bg-amber-400 transition-all duration-75" style={{ width: `${audioLevel}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* INSTANT EVALUATION RESULT CARD */}
            {lastAnalysis && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-[#E5E5E5] rounded-2xl p-6 space-y-4"
              >
                <div className="flex justify-between items-center border-b border-[#E5E5E5] pb-3">
                  <span className="text-sm font-bold text-[#171717] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#C8102E]" /> Evaluation Summary for Question #{answersHistory.length}
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                    mode === "quiz"
                      ? lastAnalysis.correct
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  }`}>
                    {mode === "quiz"
                      ? (lastAnalysis.correct ? "✓ Correct" : "✗ Incorrect")
                      : `Accuracy: ${lastAnalysis.accuracy_score || 85}%`}
                  </span>
                </div>

                {mode === "quiz" ? (
                  /* Quiz result layout */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
                    <div className="bg-[#F8F8F8] p-3 rounded-xl border border-[#E5E5E5]">
                      <div className="text-xs text-[#555555]">Your Answer</div>
                      <div className={`text-lg font-bold mt-1 ${
                        lastAnalysis.correct ? "text-emerald-400" : "text-red-400"
                      }`}>{lastAnalysis.selected_option}) {lastAnalysis.selected_text}</div>
                    </div>
                    <div className="bg-[#F8F8F8] p-3 rounded-xl border border-[#E5E5E5]">
                      <div className="text-xs text-[#555555]">Correct Answer</div>
                      <div className="text-lg font-bold text-emerald-400 mt-1">{lastAnalysis.correct_answer}) {lastAnalysis.correct_answer_text}</div>
                    </div>
                  </div>
                ) : (
                  /* Written / Oral result layout */
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div className="bg-[#F8F8F8] p-3 rounded-xl border border-[#E5E5E5]">
                      <div className="text-xs text-[#555555]">Overall Grade</div>
                      <div className="text-lg font-bold text-[#C8102E] mt-1">{lastAnalysis.overall_score || 88}/100</div>
                    </div>
                    <div className="bg-[#F8F8F8] p-3 rounded-xl border border-[#E5E5E5]">
                      <div className="text-xs text-[#555555]">Authenticity Score</div>
                      <div className="text-lg font-bold text-[#171717] mt-1">{lastAnalysis.authenticity_score}%</div>
                    </div>
                    <div className="bg-[#F8F8F8] p-3 rounded-xl border border-[#E5E5E5]">
                      <div className="text-xs text-[#555555]">Word Count</div>
                      <div className="text-lg font-bold text-[#171717] mt-1">{lastAnalysis.word_count} w</div>
                    </div>
                    <div className="bg-[#F8F8F8] p-3 rounded-xl border border-[#E5E5E5]">
                      <div className="text-xs text-[#555555]">Paste Violations</div>
                      <div className={`text-lg font-bold mt-1 ${lastAnalysis.copy_paste_attempts > 0 ? "text-red-400" : "text-emerald-400"}`}>
                        {lastAnalysis.copy_paste_attempts || 0}
                      </div>
                    </div>
                  </div>
                )}

                {lastAnalysis.conceptual_feedback && (
                  <div className="bg-[#F8F8F8]/60 p-4 rounded-xl border border-[#E5E5E5] text-xs leading-relaxed text-[#555555]">
                    <strong className="text-[#C8102E] block mb-1">
                      {mode === "quiz" ? "Explanation:" : "Conceptual Feedback:"}
                    </strong>
                    {lastAnalysis.conceptual_feedback}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
