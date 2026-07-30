"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, Brain, Clock, Download, FileText, Mic, MessageSquare,
  Play, PlayCircle, Sparkles, Target, Zap, X, Info, CheckCircle2,
  Layers, Users,
} from "lucide-react";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";
const BACKEND_WS = process.env.NEXT_PUBLIC_BACKEND_WS || "ws://localhost:8000";

type Evidence = { span: string; reason: string; weight: number };
type Analysis = {
  type: "analysis";
  transcript: string;
  question: string;
  timing: { delay_before_answer: number; answer_duration: number };
  signals: Record<string, number>;
  explanations: Record<string, string>;
  evidence: Record<string, Evidence[]>;
  risk_score: number;
  authenticity_score: number;
  follow_up: string;
  word_count: number;
  perplexity: number | null;
  calibrated: boolean;
  simulated?: boolean;
};

const SIGNAL_META: Record<string, { label: string; icon: any; description: string }> = {
  delay:       { label: "Response Delay",     icon: Clock,         description: "Time between question end and answer start" },
  fluency:     { label: "Fluency (PPL)",      icon: Brain,         description: "GPT-2 perplexity — lower = AI-like predictability" },
  hesitation:  { label: "Hesitation",         icon: Mic,           description: "Filler words and self-corrections per 100 words" },
  polish:      { label: "Textbook Phrasing",  icon: Sparkles,      description: "Count of phrases typical of LLM-generated text" },
  pacing:      { label: "Speech Pacing",      icon: Zap,           description: "Words-per-minute deviation from baseline" },
  consistency: { label: "Cross-Answer",       icon: MessageSquare, description: "Contradictions vs. earlier answers" },
};

function tierFor(score: number) {
  if (score >= 70) return { label: "HIGH RISK", color: "text-crimson-400", bg: "bg-crimson-600/20", border: "border-crimson-600/40", hex: "#DC2626" };
  if (score >= 40) return { label: "ELEVATED",  color: "text-gold-400",    bg: "bg-gold-500/15",    border: "border-gold-400/30",   hex: "#C9A961" };
  return            { label: "BASELINE",        color: "text-emerald-400", bg: "bg-emerald-600/15", border: "border-emerald-600/30", hex: "#34D399" };
}

export default function InterviewerDashboard() {
  const [sessionId] = useState("demo-session");
  const [candidateName, setCandidateName] = useState("Candidate");
  const [role, setRole] = useState("Backend Engineer");
  const [sessionStarted, setSessionStarted] = useState(false);
  const [calibrated, setCalibrated] = useState(false);

  const [connected, setConnected] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [questionInput, setQuestionInput] = useState("");
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [history, setHistory] = useState<Analysis[]>([]);
  const [candidateSpeaking, setCandidateSpeaking] = useState(false);

  const [templates, setTemplates] = useState<any[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<any>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const [demoScenarios, setDemoScenarios] = useState<any[]>([]);
  const [showDemo, setShowDemo] = useState(false);

  const [evidenceFor, setEvidenceFor] = useState<Analysis | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  
  // WebRTC State
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // WebSocket connection
  useEffect(() => {
    const ws = new WebSocket(`${BACKEND_WS}/ws/interviewer/${sessionId}`);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = async (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "analysis") {
        setHistory((h) => [msg, ...h]);
        setCandidateSpeaking(false);
        if (msg.calibrated) setCalibrated(true);
      } else if (msg.type === "question_set") {
        setCurrentQuestion(msg.question);
        setCalibrationMode(msg.is_calibration);
      } else if (msg.type === "candidate_speaking") {
        setCandidateSpeaking(true);
      } else if (msg.type === "calibration_complete") {
        const calibAnalysis: Analysis = {
          type: "analysis",
          transcript: msg.transcript || "",
          question: currentQuestion || "Tell me about yourself and your background.",
          timing: { delay_before_answer: msg.baseline?.avg_delay || 0.0, answer_duration: 0.0 },
          signals: {
            delay: 0,
            fluency: 0,
            hesitation: 0,
            polish: 0,
            pacing: 0,
            consistency: 0
          },
          explanations: {
            delay: "Calibration round established delay baseline.",
            fluency: "Calibration round established baseline.",
            hesitation: "Calibration round established baseline.",
            polish: "Calibration round established baseline.",
            pacing: "Calibration round established baseline.",
            consistency: "Calibration round established baseline."
          },
          evidence: {},
          risk_score: 0.0,
          authenticity_score: 100.0,
          follow_up: "Calibration complete! Natural baseline established. You can now ask custom or template questions.",
          word_count: msg.transcript ? msg.transcript.split(/\s+/).length : 0,
          perplexity: msg.baseline?.avg_perplexity || null,
          calibrated: true
        };
        setHistory((h) => [calibAnalysis, ...h]);
        setCalibrated(true);
        setCalibrationMode(false);
        setCandidateSpeaking(false);
      } else if (msg.type === "webrtc_from_candidate") {
        const payload = msg.payload;
        if (!pcRef.current) {
          const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
          pcRef.current = pc;
          
          const currentStream = localStreamRef.current;
          if (currentStream) {
            currentStream.getTracks().forEach(track => pc.addTrack(track, currentStream));
          }
          
          pc.ontrack = (event) => {
            if (remoteVideoRef.current && event.streams[0]) {
              remoteVideoRef.current.srcObject = event.streams[0];
              setRemoteStream(event.streams[0]);
            }
          };
          
          pc.onicecandidate = (event) => {
            if (event.candidate && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "webrtc", payload: { type: "candidate", candidate: event.candidate } }));
            }
          };
        }
        
        const pc = pcRef.current;
        if (payload.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: "webrtc", payload: { type: "answer", sdp: answer } }));
        } else if (payload.type === "candidate") {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } else if (payload.type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        }
      }
    };
    wsRef.current = ws;
    return () => ws.close();
  }, [sessionId]);

  // Fetch templates & demo scenarios on mount
  useEffect(() => {
    fetch(`${BACKEND_HTTP}/api/templates`).then((r) => r.json()).then((d) => setTemplates(d.templates || []));
    fetch(`${BACKEND_HTTP}/api/demo/scenarios`).then((r) => r.json()).then((d) => setDemoScenarios(d.scenarios || []));
  }, []);

  const startSession = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setStream(mediaStream);
      localStreamRef.current = mediaStream;
      if (pcRef.current) {
        mediaStream.getTracks().forEach(track => pcRef.current!.addTrack(track, mediaStream));
      }
    } catch (e) {
      console.warn("Interviewer media access denied or not available", e);
    }

    await fetch(`${BACKEND_HTTP}/api/session/start`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, candidate_name: candidateName, role, language: "en" }),
    });
    setSessionStarted(true);
  };

  const askQuestion = async (question?: string, isCalibration = false) => {
    const q = question || questionInput;
    if (!q.trim()) return;
    await fetch(`${BACKEND_HTTP}/api/question`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, question: q, is_calibration: isCalibration }),
    });
    if (!question) setQuestionInput("");
  };

  const loadTemplate = async (key: string) => {
    const r = await fetch(`${BACKEND_HTTP}/api/templates/${key}`);
    const data = await r.json();
    setActiveTemplate({ key, ...data, index: 0 });
    setShowTemplates(false);
  };

  const nextTemplateQuestion = () => {
    if (!activeTemplate) return;
    const q = activeTemplate.questions[activeTemplate.index];
    const isCalib = activeTemplate.index === 0;
    askQuestion(q, isCalib);
    setActiveTemplate({ ...activeTemplate, index: activeTemplate.index + 1 });
  };

  const runDemo = async (scenarioKey: string) => {
    setShowDemo(false);
    await fetch(`${BACKEND_HTTP}/api/demo/run`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, scenario_key: scenarioKey }),
    });
  };

  const downloadReport = async () => {
    await fetch(`${BACKEND_HTTP}/api/session/finalize`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
    window.open(`${BACKEND_HTTP}/api/session/${sessionId}/report`, "_blank");
  };

  const latest = history[0];
  const tier = latest ? tierFor(latest.risk_score) : null;
  const realAnswers = history.filter((h) => !h.calibrated || latest);  // simplified

  if (!sessionStarted) {
    return <SessionSetup
      candidateName={candidateName} setCandidateName={setCandidateName}
      role={role} setRole={setRole}
      onStart={startSession}
    />;
  }

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold-400/70">Interviewer Dashboard</p>
          <h1 className="font-display text-3xl text-gradient-gold">VERITAS</h1>
          <p className="text-sm text-gold-50/60 mt-1">
            {candidateName} · {role}
            {calibrated && <span className="ml-2 text-emerald-400 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Calibrated</span>}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : "bg-crimson-400"}`} />
            <span className="text-gold-50/60">{connected ? "Live" : "Offline"}</span>
          </div>
          {candidateSpeaking && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-crimson-600/20 border border-crimson-600/40 alert-pulse">
              <Mic className="w-3.5 h-3.5 text-crimson-400" />
              <span className="text-xs text-crimson-400 uppercase tracking-wider">Candidate Speaking</span>
            </div>
          )}
          <button onClick={() => setShowTemplates(true)} className="px-3 py-1.5 rounded-sm border border-gold-400/30 text-sm text-gold-200 hover:bg-gold-400/10 flex items-center gap-2">
            <Layers className="w-4 h-4" /> Templates
          </button>
          <button onClick={() => setShowDemo(true)} className="px-3 py-1.5 rounded-sm border border-gold-400/30 text-sm text-gold-200 hover:bg-gold-400/10 flex items-center gap-2">
            <PlayCircle className="w-4 h-4" /> Demo
          </button>
          <Link href="/sessions" className="px-3 py-1.5 rounded-sm border border-gold-400/30 text-sm text-gold-200 hover:bg-gold-400/10 flex items-center gap-2">
            <Users className="w-4 h-4" /> Compare
          </Link>
          <button onClick={downloadReport} className="px-3 py-1.5 rounded-sm bg-gold-500 text-ink-900 text-sm font-semibold hover:bg-gold-400 flex items-center gap-2">
            <Download className="w-4 h-4" /> Report
          </button>
        </div>
      </header>

      {/* Calibration banner */}
      {!calibrated && (
        <div className="glass p-4 rounded-sm mb-6 border-l-4 border-l-gold-400">
          <div className="flex items-start gap-3">
            <Target className="w-5 h-5 text-gold-400 mt-0.5" />
            <div>
              <p className="font-display text-lg text-gold-200">Establish Candidate Baseline</p>
              <p className="text-sm text-gold-50/60 mt-1">
                Start with an introductory question marked as Calibration. Veritas learns this candidate's natural delay, pacing, and hesitation patterns — so all subsequent scoring is fair to them, not measured against a population average.
              </p>
              <button onClick={() => askQuestion("Tell me about yourself and your background.", true)}
                      className="mt-3 px-4 py-2 bg-gold-500 text-ink-900 rounded-sm text-sm font-semibold hover:bg-gold-400">
                Ask Calibration Question
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active template progress */}
      {activeTemplate && activeTemplate.index < activeTemplate.questions.length && (
        <div className="glass p-4 rounded-sm mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold-400/70">
              {activeTemplate.label} Template · Question {activeTemplate.index + 1} of {activeTemplate.questions.length}
            </p>
            <p className="font-display text-lg text-gold-200 mt-1">
              {activeTemplate.questions[activeTemplate.index]}
            </p>
          </div>
          <button onClick={nextTemplateQuestion}
                  className="px-5 py-2.5 bg-gold-500 text-ink-900 rounded-sm font-semibold hover:bg-gold-400 flex items-center gap-2">
            <Play className="w-4 h-4" /> Ask
          </button>
        </div>
      )}

      {/* Question input */}
      <div className="glass p-5 rounded-sm mb-6">
        <label className="text-xs uppercase tracking-[0.2em] text-gold-400/70 mb-2 block">
          {calibrationMode ? "Calibration Question" : "Custom Question"}
        </label>
        <div className="flex gap-3">
          <input
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && askQuestion()}
            placeholder="Type a question or pick from a template above…"
            className="flex-1 bg-ink-700 border border-gold-400/20 px-4 py-3 rounded-sm text-gold-50 focus:border-gold-400/60 outline-none"
          />
          <button onClick={() => askQuestion()} className="px-6 py-3 bg-gold-500 text-ink-900 font-semibold rounded-sm hover:bg-gold-400">
            Ask
          </button>
        </div>
        {currentQuestion && <p className="mt-3 text-sm text-gold-50/60 italic">Current: "{currentQuestion}"</p>}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* LEFT */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <AuthenticityGauge analysis={latest} tier={tier} onClick={() => latest && setEvidenceFor(latest)} />
          <div className="glass p-6 rounded-sm">
            <h3 className="text-xs uppercase tracking-[0.2em] text-gold-400/70 mb-4">Risk Signals</h3>
            <div className="space-y-3">
              {Object.entries(SIGNAL_META).map(([key, meta]) => (
                <SignalBar
                  key={key}
                  icon={meta.icon}
                  label={meta.label}
                  value={latest?.signals[key] ?? 0}
                  explanation={latest?.explanations[key] ?? "Awaiting response…"}
                  description={meta.description}
                />
              ))}
            </div>
          </div>
        </div>

        {/* MIDDLE */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          {/* Live Video Call */}
          <div className="glass rounded-sm relative w-full aspect-video bg-ink-900 border border-gold-400/20 shadow-lg overflow-hidden flex items-center justify-center">
            {connected ? (
               <>
                 <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
                 {stream && (
                   <div className="absolute top-4 right-4 w-24 md:w-32 aspect-video rounded-sm overflow-hidden border border-gold-400/50 shadow-xl bg-ink-900">
                     <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
                   </div>
                 )}
                 {!remoteStream && (
                   <p className="text-gold-50/60 text-sm z-10 relative bg-ink-900/60 px-3 py-1.5 rounded backdrop-blur-sm border border-gold-400/20">
                     Waiting for candidate video...
                   </p>
                 )}
               </>
            ) : (
               <p className="text-gold-50/40 text-sm">Connecting to session...</p>
            )}
          </div>

          <div className="glass p-6 rounded-sm min-h-[220px]">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xs uppercase tracking-[0.2em] text-gold-400/70">Latest Response</h3>
              {latest && (
                <button onClick={() => setEvidenceFor(latest)}
                        className="text-xs text-gold-400/80 hover:text-gold-400 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Why this score?
                </button>
              )}
            </div>
            {latest ? (
              <>
                <HighlightedTranscript transcript={latest.transcript} evidence={latest.evidence} />
                <div className="mt-4 flex gap-6 text-xs text-gold-50/50 flex-wrap">
                  <span>{latest.word_count} words</span>
                  <span>{latest.timing.answer_duration.toFixed(1)}s spoken</span>
                  <span className={latest.timing.delay_before_answer > 4 ? "text-crimson-400" : ""}>
                    {latest.timing.delay_before_answer.toFixed(1)}s delay
                  </span>
                  {latest.perplexity && <span>PPL {latest.perplexity.toFixed(0)}</span>}
                  {latest.simulated && <span className="text-gold-400">DEMO</span>}
                </div>
              </>
            ) : (
              <p className="text-gold-50/40 italic">Awaiting candidate response…</p>
            )}
          </div>
          <FollowUpCard followUp={latest?.follow_up} risk={latest?.risk_score ?? 0} onAsk={askQuestion} />
        </div>

        {/* RIGHT */}
        <div className="col-span-12 lg:col-span-3">
          <div className="glass p-6 rounded-sm">
            <h3 className="text-xs uppercase tracking-[0.2em] text-gold-400/70 mb-4">Session History</h3>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              <AnimatePresence>
                {history.map((h, i) => {
                  const t = tierFor(h.risk_score);
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={() => setEvidenceFor(h)}
                      className={`p-3 rounded-sm border ${t.border} ${t.bg} cursor-pointer hover:opacity-80`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs font-mono ${t.color}`}>{t.label}</span>
                        <span className="text-xs text-gold-50/40">{h.risk_score.toFixed(0)}</span>
                      </div>
                      <p className="text-xs text-gold-50/70 line-clamp-2">{h.transcript.slice(0, 80)}…</p>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {history.length === 0 && <p className="text-gold-50/40 italic text-sm">No answers yet.</p>}
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-gold-50/30">
        Veritas surfaces behavioral signals. Final judgment remains human.
      </footer>

      {/* Modals */}
      {showTemplates && <TemplatesModal templates={templates} onPick={loadTemplate} onClose={() => setShowTemplates(false)} />}
      {showDemo && <DemoModal scenarios={demoScenarios} onPick={runDemo} onClose={() => setShowDemo(false)} />}
      {evidenceFor && <EvidenceModal analysis={evidenceFor} onClose={() => setEvidenceFor(null)} />}
    </div>
  );
}

// =============================================================================
// Components
// =============================================================================

function SessionSetup({ candidateName, setCandidateName, role, setRole, onStart }: any) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass p-10 rounded-sm max-w-md w-full">
        <p className="text-xs uppercase tracking-[0.3em] text-gold-400/70 mb-2">New Interview</p>
        <h1 className="font-display text-3xl text-gradient-gold mb-8">Session Setup</h1>
        <label className="block text-sm text-gold-50/60 mb-2">Candidate Name</label>
        <input value={candidateName} onChange={(e) => setCandidateName(e.target.value)}
               className="w-full bg-ink-700 border border-gold-400/20 px-4 py-3 rounded-sm text-gold-50 outline-none focus:border-gold-400/60 mb-4" />
        <label className="block text-sm text-gold-50/60 mb-2">Role</label>
        <input value={role} onChange={(e) => setRole(e.target.value)}
               className="w-full bg-ink-700 border border-gold-400/20 px-4 py-3 rounded-sm text-gold-50 outline-none focus:border-gold-400/60 mb-8" />
        <button onClick={onStart} className="w-full py-3 bg-gold-500 text-ink-900 font-semibold rounded-sm hover:bg-gold-400 glow-gold">
          Begin Session
        </button>
      </div>
    </div>
  );
}

function AuthenticityGauge({ analysis, tier, onClick }: any) {
  const auth = analysis?.authenticity_score ?? 100;
  const risk = analysis?.risk_score ?? 0;
  const circumference = 2 * Math.PI * 70;
  const offset = circumference - (auth / 100) * circumference;
  return (
    <div className="glass p-6 rounded-sm cursor-pointer hover:bg-ink-700/40 transition" onClick={onClick}>
      <h3 className="text-xs uppercase tracking-[0.2em] text-gold-400/70 mb-4">Authenticity Score</h3>
      <div className="flex flex-col items-center">
        <div className="relative w-44 h-44">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="70" stroke="#22201D" strokeWidth="8" fill="none" />
            <motion.circle cx="80" cy="80" r="70" stroke="url(#gradGold)" strokeWidth="8" fill="none"
              strokeLinecap="round" strokeDasharray={circumference}
              animate={{ strokeDashoffset: offset }} transition={{ duration: 0.8, ease: "easeOut" }} />
            <defs>
              <linearGradient id="gradGold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#E5D5A8" /><stop offset="100%" stopColor="#B08D3F" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-5xl text-gradient-gold">{auth.toFixed(0)}</span>
            <span className="text-xs uppercase tracking-[0.2em] text-gold-50/50">of 100</span>
          </div>
        </div>
        {tier && (
          <div className={`mt-4 px-4 py-1.5 rounded-sm ${tier.bg} border ${tier.border}`}>
            <span className={`text-xs font-mono uppercase tracking-wider ${tier.color}`}>
              {tier.label} · {risk.toFixed(0)}% RISK
            </span>
          </div>
        )}
        <p className="mt-3 text-xs text-gold-50/40 italic">Click for evidence breakdown</p>
      </div>
    </div>
  );
}

function SignalBar({ icon: Icon, label, value, explanation, description }: any) {
  const colorClass = value >= 60 ? "bg-crimson-400" : value >= 30 ? "bg-gold-400" : "bg-emerald-400";
  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-sm text-gold-50/80" title={description}>
          <Icon className="w-3.5 h-3.5 text-gold-400/70" />
          {label}
        </div>
        <span className="text-xs font-mono text-gold-50/60">{value.toFixed(0)}</span>
      </div>
      <div className="h-1 bg-ink-700 rounded-full overflow-hidden">
        <motion.div className={`h-full ${colorClass}`}
          initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.5 }} />
      </div>
      <p className="text-xs text-gold-50/40 mt-1 italic">{explanation}</p>
    </div>
  );
}

function FollowUpCard({ followUp, risk, onAsk }: any) {
  const urgent = risk >= 60;
  return (
    <motion.div key={followUp} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`glass p-6 rounded-sm ${urgent ? "border-crimson-600/40 alert-pulse" : ""}`}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className={`w-4 h-4 ${urgent ? "text-crimson-400" : "text-gold-400"}`} />
        <h3 className="text-xs uppercase tracking-[0.2em] text-gold-400/70">
          {urgent ? "Adaptive Probe Suggested" : "Follow-Up Recommendation"}
        </h3>
      </div>
      {followUp ? (
        <div className="flex flex-col gap-4 items-start">
          <p className="font-display text-xl leading-relaxed text-gold-50">"{followUp}"</p>
          <button
            onClick={() => onAsk(followUp)}
            className="px-4 py-2 bg-gold-500 text-ink-900 text-sm font-semibold rounded-sm hover:bg-gold-400 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" /> Ask Counter Question
          </button>
        </div>
      ) : (
        <p className="text-gold-50/40 italic">A follow-up will appear after the candidate answers.</p>
      )}
      {urgent && (
        <p className="mt-3 text-xs text-crimson-400/80">
          High risk detected — this probe is designed to test lived experience the candidate couldn't fake.
        </p>
      )}
    </motion.div>
  );
}

function HighlightedTranscript({ transcript, evidence }: { transcript: string; evidence: Record<string, Evidence[]> }) {
  // Collect all evidence spans to highlight
  const spans = new Set<string>();
  Object.values(evidence || {}).flat().forEach((e) => {
    if (e.span && transcript.toLowerCase().includes(e.span.toLowerCase())) spans.add(e.span.toLowerCase());
  });

  if (spans.size === 0) {
    return <p className="font-display text-lg leading-relaxed text-gold-50/90">"{transcript}"</p>;
  }

  // Split and highlight
  let segments: { text: string; highlight: boolean }[] = [{ text: transcript, highlight: false }];
  Array.from(spans).sort((a, b) => b.length - a.length).forEach((span) => {
    const next: { text: string; highlight: boolean }[] = [];
    segments.forEach((seg) => {
      if (seg.highlight) { next.push(seg); return; }
      const re = new RegExp(`(${span.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      const parts = seg.text.split(re);
      parts.forEach((p) => {
        if (!p) return;
        next.push({ text: p, highlight: p.toLowerCase() === span });
      });
    });
    segments = next;
  });

  return (
    <p className="font-display text-lg leading-relaxed text-gold-50/90">"
      {segments.map((s, i) =>
        s.highlight
          ? <span key={i} className="bg-crimson-600/30 text-crimson-200 px-1 rounded">{s.text}</span>
          : <span key={i}>{s.text}</span>
      )}"
    </p>
  );
}

function TemplatesModal({ templates, onPick, onClose }: any) {
  return (
    <Modal onClose={onClose} title="Choose Interview Template">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {templates.map((t: any) => (
          <button key={t.key} onClick={() => onPick(t.key)}
                  className="text-left p-4 rounded-sm border border-gold-400/20 hover:bg-gold-400/5 transition">
            <p className="font-display text-lg text-gold-200">{t.label}</p>
            <p className="text-xs text-gold-50/50 mt-1">{t.count} questions · first is calibration</p>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function DemoModal({ scenarios, onPick, onClose }: any) {
  return (
    <Modal onClose={onClose} title="Run Demo Scenario">
      <p className="text-sm text-gold-50/60 mb-4">
        Scripted answers replace real audio. Useful when network or mic reliability is at risk.
      </p>
      <div className="space-y-3">
        {scenarios.map((s: any) => (
          <button key={s.key} onClick={() => onPick(s.key)}
                  className="w-full text-left p-4 rounded-sm border border-gold-400/20 hover:bg-gold-400/5">
            <p className="font-display text-lg text-gold-200">{s.label}</p>
            <p className="text-xs text-gold-50/50 mt-1">{s.description} · {s.rounds} round(s)</p>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function EvidenceModal({ analysis, onClose }: { analysis: Analysis; onClose: () => void }) {
  const t = tierFor(analysis.risk_score);
  return (
    <Modal onClose={onClose} title="Why this score?">
      <div className={`p-3 rounded-sm border ${t.border} ${t.bg} mb-4`}>
        <p className={`text-xs font-mono ${t.color} uppercase tracking-wider`}>
          {t.label} · Authenticity {analysis.authenticity_score.toFixed(0)} · Risk {analysis.risk_score.toFixed(0)}
        </p>
      </div>
      <h4 className="text-xs uppercase tracking-[0.2em] text-gold-400/70 mb-2">Transcript with evidence</h4>
      <div className="p-4 rounded-sm bg-ink-700/60 mb-4">
        <HighlightedTranscript transcript={analysis.transcript} evidence={analysis.evidence} />
      </div>
      <h4 className="text-xs uppercase tracking-[0.2em] text-gold-400/70 mb-2 mt-4">Per-signal evidence</h4>
      <div className="space-y-3">
        {Object.entries(SIGNAL_META).map(([key, meta]) => {
          const score = analysis.signals[key] ?? 0;
          const explanation = analysis.explanations[key] ?? "";
          const ev = analysis.evidence[key] ?? [];
          if (score < 5 && ev.length === 0) return null;
          return (
            <div key={key} className="p-3 rounded-sm bg-ink-700/40 border border-gold-400/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <meta.icon className="w-3.5 h-3.5 text-gold-400" />
                  <span className="text-sm text-gold-200">{meta.label}</span>
                </div>
                <span className="text-xs font-mono text-gold-50/60">{score.toFixed(0)}</span>
              </div>
              <p className="text-xs text-gold-50/60 mt-1 italic">{explanation}</p>
              {ev.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {ev.map((e, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded bg-crimson-600/20 text-crimson-200" title={e.reason}>
                      {e.span}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-6 p-3 rounded-sm bg-gold-500/10 border border-gold-400/30">
        <p className="text-xs text-gold-200">
          <strong>Ethics note:</strong> Each signal is weak alone. The composite is suggestive, not conclusive.
          Use this evidence to ask sharper follow-ups — not to issue verdicts.
        </p>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose, title }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/80 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="glass max-w-2xl w-full max-h-[85vh] overflow-y-auto rounded-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-display text-2xl text-gradient-gold">{title}</h2>
          <button onClick={onClose} className="text-gold-50/60 hover:text-gold-50"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}
