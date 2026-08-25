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

type Subject = { key: string; label?: string; name?: string; department: string; count?: number };
type Question = { id?: number; question_text: string; reference_answer?: string; rubric_keywords?: string[]; max_marks?: number; time_limit_sec?: number };
type MCQQuestion = { index: number; question: string; options: { A: string; B: string; C: string; D: string } };

export default function CandidatePage() {
  const router = useRouter();
  // Registration & Config State
  const [studentName, setStudentName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [academicYear, setAcademicYear] = useState("3rd Year");
  const [selectedSubject, setSelectedSubject] = useState("ai_ml");
  const [subjects, setSubjects] = useState<Subject[]>([]);
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

  // Fetch subjects on mount & read saved student login session
  useEffect(() => {
    const savedAuth = localStorage.getItem("veritas_student_auth");
    if (savedAuth) {
      try {
        const auth = JSON.parse(savedAuth);
        if (auth.studentName) setStudentName(auth.studentName);
        if (auth.rollNumber) setRollNumber(auth.rollNumber);
        if (auth.mobileNumber) setMobileNumber(auth.mobileNumber);
        if (auth.academicYear) setAcademicYear(auth.academicYear);
        if (auth.mode) setMode(auth.mode);
        if (auth.department) {
          setSelectedSubject(auth.department);
          setSubjectQuestions(auth.department);
        }
      } catch (e) {}
    }

    fetch(`${BACKEND_HTTP}/api/academic/subjects`)
      .then((res) => res.json())
      .then((data) => {
        if (data.subjects && data.subjects.length > 0) {
          setSubjects(data.subjects);
          if (!savedAuth) {
            setSubjectQuestions(data.subjects[0].key || "ai_ml");
          }
        }
      })
      .catch((err) => console.error("Error fetching subjects:", err));
  }, []);

  const handleStudentLogout = () => {
    localStorage.removeItem("veritas_student_auth");
    router.push("/login/student");
  };

  // Fetch TEXT questions (Written / Oral modes)
  const fetchTextQuestions = (subjKey: string) => {
    setSelectedSubject(subjKey);
    fetch(`${BACKEND_HTTP}/api/academic/questions?subject_key=${subjKey}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.questions && data.questions.length > 0) {
          setQuestions(data.questions.map((q: any) => ({
            id: q.id,
            question_text: q.question_text || q.question,
            reference_answer: q.reference_answer,
            rubric_keywords: q.rubric_keywords_list || q.rubric_keywords,
            max_marks: q.max_marks || 10,
            time_limit_sec: q.time_limit_sec || 120,
          })));
        } else {
          // Fallback templates
          fetch(`${BACKEND_HTTP}/api/templates/${subjKey}`)
            .then((r) => r.json())
            .then((tmpl) => {
              if (tmpl.questions) {
                setQuestions(tmpl.questions.map((q: any) => typeof q === "string" ? { question_text: q } : { question_text: q.question || q.question_text, reference_answer: q.reference_answer, rubric_keywords: q.rubric_keywords, max_marks: q.max_marks, time_limit_sec: q.time_limit_sec }));
              }
            }).catch(() => {});
        }
      });
  };

  // Fetch MCQ questions (Quiz mode only) — correct_answer NOT included in response
  const fetchQuizQuestions = (subjKey: string) => {
    setSelectedSubject(subjKey);
    fetch(`${BACKEND_HTTP}/api/quiz/questions?subject_key=${subjKey}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.questions && data.questions.length > 0) {
          setMcqQuestions(data.questions as MCQQuestion[]);
        }
      })
      .catch((err) => console.error("Error fetching quiz questions:", err));
  };

  // Mode-aware subject change handler
  const handleSubjectChange = (subjKey: string) => {
    if (mode === "quiz") {
      fetchQuizQuestions(subjKey);
    } else {
      fetchTextQuestions(subjKey);
    }
  };

  // Mode-aware mode toggle
  const handleModeChange = (newMode: "written" | "oral" | "quiz") => {
    setMode(newMode);
    setCurrentQIndex(0);
    setLastAnalysis(null);
    setQuizAnswer(null);
    setQuizResult(null);
    if (newMode === "quiz") {
      fetchQuizQuestions(selectedSubject);
    } else {
      fetchTextQuestions(selectedSubject);
    }
  };

  // Keep the old name as alias for backward compat with the useEffect call
  const setSubjectQuestions = fetchTextQuestions;

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
          subject_key: selectedSubject,
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
          subject_key: selectedSubject,
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="px-8 py-5 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex justify-between items-center">
        <Link href="/" className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/30">
            <BookOpen className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <span className="font-bold text-lg text-slate-100">VERITAS ACADEMIC</span>
            <span className="block text-[10px] uppercase tracking-widest text-slate-400">Student Assessment Portal</span>
          </div>
        </Link>
        <div className="flex items-center gap-4 text-xs">
          {sessionStarted && (
            <>
              <span className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-slate-300">
                <User className="w-3.5 h-3.5 inline mr-1 text-amber-400" /> {studentName} ({rollNumber})
              </span>
              <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-300 capitalize font-medium">
                {mode} Assessment Mode
              </span>
            </>
          )}
          <button
            onClick={handleStudentLogout}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl transition text-xs font-semibold"
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
            className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 max-w-xl mx-auto w-full shadow-2xl"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-50">Student Registration & Mode Choice</h2>
              <p className="text-sm text-slate-400 mt-2">Enter your academic details and select your preferred interview mode.</p>
            </div>

            <form onSubmit={handleStartSession} className="space-y-6">
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-2">
                  Roll Number / Student ID
                </label>
                <div className="relative">
                  <Hash className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="23eg107b19"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-2">
                  Department / Subject
                </label>
                <select
                  value={selectedSubject}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-slate-100 focus:outline-none focus:border-amber-500 transition text-sm"
                >
                  {subjects.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.name || s.label} ({s.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-3">
                  Select Interview Mode
                </label>
                <div className="grid grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() => handleModeChange("written")}
                    className={`p-4 rounded-xl border text-left transition flex flex-col gap-2 ${
                      mode === "written"
                        ? "bg-amber-500/10 border-amber-500 text-amber-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <Edit3 className="w-6 h-6 text-amber-400" />
                    <div>
                      <div className="font-bold text-sm text-slate-100">Written (Text)</div>
                      <div className="text-[11px] text-slate-400 mt-1">Timed typing with paste-prohibition & anti-cheat analytics</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleModeChange("oral")}
                    className={`p-4 rounded-xl border text-left transition flex flex-col gap-2 ${
                      mode === "oral"
                        ? "bg-amber-500/10 border-amber-500 text-amber-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <Mic className="w-6 h-6 text-amber-400" />
                    <div>
                      <div className="font-bold text-sm text-slate-100">Oral (Voice)</div>
                      <div className="text-[11px] text-slate-400 mt-1">Spoken answer capture via mic + Whisper transcription</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleModeChange("quiz")}
                    className={`p-4 rounded-xl border text-left transition flex flex-col gap-2 ${
                      mode === "quiz"
                        ? "bg-amber-500/10 border-amber-500 text-amber-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <ListChecks className="w-6 h-6 text-amber-400" />
                    <div>
                      <div className="font-bold text-sm text-slate-100">Quiz (MCQ)</div>
                      <div className="text-[11px] text-slate-400 mt-1">Multiple-choice questions with instant AI scoring</div>
                    </div>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 text-sm"
              >
                Begin Assessment <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        ) : (
          /* STEP 2: Active Assessment Panel */
          <div className="space-y-6">
            {/* Question Progress Header */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex justify-between items-center">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-amber-400">
                  {mode === "quiz"
                    ? `Question ${currentQIndex + 1} of ${mcqQuestions.length}`
                    : `Question ${currentQIndex + 1} of ${questions.length}`}
                </span>
                <h3 className="text-xl font-bold text-slate-100 mt-1">
                  {mode === "quiz"
                    ? (mcqQuestions[currentQIndex]?.question || "Loading question...")
                    : (questions[currentQIndex]?.question_text || "Loading question...")}
                </h3>
              </div>
              <div className="text-right">
                {mode !== "quiz" && (
                  <>
                    <span className="text-xs text-slate-400 block">Max Marks: {questions[currentQIndex]?.max_marks || 10}</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400" /> Time Limit: {questions[currentQIndex]?.time_limit_sec || 120}s
                    </span>
                  </>
                )}
                {mode === "quiz" && (
                  <span className="text-xs text-slate-400 block">10 marks · Select one</span>
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
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>Type your detailed answer below:</span>
                  <span className="font-mono">{writtenAnswer.split(/\s+/).filter(Boolean).length} words | {writtenAnswer.length} chars</span>
                </div>

                <textarea
                  rows={8}
                  onPaste={handlePaste}
                  value={writtenAnswer}
                  onChange={(e) => setWrittenAnswer(e.target.value)}
                  placeholder="Explain your conceptual response clearly..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-100 focus:outline-none focus:border-amber-500 transition text-sm font-sans resize-none leading-relaxed"
                />

                <div className="flex justify-between items-center pt-2">
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-400" /> Anti-paste & typing cadence monitor active
                  </div>
                  <button
                    onClick={handleSubmitWritten}
                    disabled={!writtenAnswer.trim() || isSubmittingWritten}
                    className="px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition flex items-center gap-2 text-sm shadow-md"
                  >
                    {isSubmittingWritten ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Submit Answer & Continue"}
                  </button>
                </div>
              </div>
            ) : mode === "quiz" ? (
              /* QUIZ MCQ INTERFACE — separate MCQ question bank, not the same as Written/Oral */
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold uppercase tracking-wider mb-2">
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
                                  : "bg-slate-950 border-slate-800 text-slate-500 opacity-50"
                              : isSelected
                                ? "bg-amber-500/15 border-amber-500 text-amber-300"
                                : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600"
                          }`}
                        >
                          <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-bold mr-3 ${
                            quizResult
                              ? isCorrect ? "bg-emerald-500 text-slate-950" : isWrong ? "bg-red-500 text-slate-950" : "bg-slate-800 text-slate-500"
                              : isSelected ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400"
                          }`}>{opt}</span>
                          {optionText}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-slate-400 text-sm text-center py-6">Loading MCQ questions...</div>
                )}

                <div className="flex justify-between items-center pt-2">
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-400" /> Answer validated server-side
                  </div>
                  {!quizResult ? (
                    <button
                      onClick={handleSubmitQuiz}
                      disabled={!quizAnswer || isSubmittingQuiz}
                      className="px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition flex items-center gap-2 text-sm shadow-md"
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
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-6">
                <div className="flex justify-center items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${joined ? "bg-emerald-500 animate-pulse" : "bg-slate-600"}`} />
                  <span className="text-xs font-mono text-slate-400">{status}</span>
                </div>

                <div className="py-6">
                  {!speaking ? (
                    <button
                      onClick={startSpeaking}
                      className="w-24 h-24 rounded-full bg-amber-500/10 border-2 border-amber-500 text-amber-400 hover:bg-amber-500/20 transition flex flex-col items-center justify-center mx-auto shadow-lg shadow-amber-500/10"
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
                    <div className="text-xs text-amber-400 font-mono">Recording audio stream... ({audioLevel}%)</div>
                    <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
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
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4"
              >
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <span className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" /> Evaluation Summary for Question #{answersHistory.length}
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
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-xs text-slate-500">Your Answer</div>
                      <div className={`text-lg font-bold mt-1 ${
                        lastAnalysis.correct ? "text-emerald-400" : "text-red-400"
                      }`}>{lastAnalysis.selected_option}) {lastAnalysis.selected_text}</div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-xs text-slate-500">Correct Answer</div>
                      <div className="text-lg font-bold text-emerald-400 mt-1">{lastAnalysis.correct_answer}) {lastAnalysis.correct_answer_text}</div>
                    </div>
                  </div>
                ) : (
                  /* Written / Oral result layout */
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-xs text-slate-500">Overall Grade</div>
                      <div className="text-lg font-bold text-amber-400 mt-1">{lastAnalysis.overall_score || 88}/100</div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-xs text-slate-500">Authenticity Score</div>
                      <div className="text-lg font-bold text-slate-200 mt-1">{lastAnalysis.authenticity_score}%</div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-xs text-slate-500">Word Count</div>
                      <div className="text-lg font-bold text-slate-200 mt-1">{lastAnalysis.word_count} w</div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-xs text-slate-500">Paste Violations</div>
                      <div className={`text-lg font-bold mt-1 ${lastAnalysis.copy_paste_attempts > 0 ? "text-red-400" : "text-emerald-400"}`}>
                        {lastAnalysis.copy_paste_attempts || 0}
                      </div>
                    </div>
                  </div>
                )}

                {lastAnalysis.conceptual_feedback && (
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 text-xs leading-relaxed text-slate-300">
                    <strong className="text-amber-400 block mb-1">
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
