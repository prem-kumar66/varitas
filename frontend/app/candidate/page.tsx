"use client";
import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Radio, AlertCircle } from "lucide-react";

const BACKEND_WS = process.env.NEXT_PUBLIC_BACKEND_WS || "ws://localhost:8000";

export default function CandidatePage() {
  const [sessionId, setSessionId] = useState("demo-session");
  const [joined, setJoined] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const join = async () => {
    try {
      // Request both camera and microphone as soon as they log in
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
        video: true
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);

      const ws = new WebSocket(`${BACKEND_WS}/ws/candidate/${sessionId}`);
      ws.binaryType = "arraybuffer";
      ws.onopen = async () => {
        setStatus("Connected to Veritas");
        setJoined(true);
        setError(null);

        // Setup WebRTC
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });
        pcRef.current = pc;

        if (mediaStream) {
          mediaStream.getTracks().forEach(track => pc.addTrack(track, mediaStream));
        }

        pc.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: "webrtc",
              payload: { type: "candidate", candidate: event.candidate }
            }));
          }
        };

        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          ws.send(JSON.stringify({
            type: "webrtc",
            payload: { type: "offer", sdp: offer }
          }));
        } catch (e) {
          console.error("WebRTC Error:", e);
        }
      };
      
      ws.onmessage = async (e) => {
        if (typeof e.data === "string") {
          try {
            const data = JSON.parse(e.data);
            if (data.type === "webrtc_from_interviewer") {
              const payload = data.payload;
              const pc = pcRef.current;
              if (!pc) return;
              if (payload.type === "answer") {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              } else if (payload.type === "candidate") {
                await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
              } else if (payload.type === "offer") {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                wsRef.current?.send(JSON.stringify({
                  type: "webrtc",
                  payload: { type: "answer", sdp: answer }
                }));
              }
            } else if (data.type === "question_set") {
              setCurrentQuestion(data.question);
            }
          } catch(err) {}
        }
      };
      ws.onclose = () => {
        setStatus("Disconnected");
        setJoined(false);
      };
      ws.onerror = () => {
        setError("Could not connect to Veritas backend.");
        setStatus("Connection error");
      };
      wsRef.current = ws;
    } catch (e: any) {
      setError(`Camera/Mic access denied: ${e?.message || "unknown"}`);
    }
  };

  const startSpeaking = async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    try {
      let currentStream = streamRef.current;
      if (!currentStream) {
        currentStream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
          video: true
        });
        streamRef.current = currentStream;
        setStream(currentStream);
      }

      // Create AudioContext without forcing sample rate (Safari hates that)
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const actualRate = ctx.sampleRate;

      // Send handshake telling backend the real rate
      wsRef.current.send(JSON.stringify({ type: "hello", sample_rate: actualRate }));
      wsRef.current.send(JSON.stringify({ type: "answer_start", ts: Date.now() }));

      const source = ctx.createMediaStreamSource(currentStream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      source.connect(processor);
      processor.connect(ctx.destination);

      setSpeaking(true);
      setStatus(`Recording at ${actualRate} Hz…`);

      let levelSum = 0, levelCount = 0;
      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const float32 = e.inputBuffer.getChannelData(0);

        // Compute simple RMS for level meter
        let s = 0;
        for (let i = 0; i < float32.length; i++) s += float32[i] * float32[i];
        const rms = Math.sqrt(s / float32.length);
        levelSum += rms; levelCount++;
        if (levelCount > 5) {
          setAudioLevel(Math.min(1, (levelSum / levelCount) * 8));
          levelSum = 0; levelCount = 0;
        }

        // PCM16
        const pcm16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const v = Math.max(-1, Math.min(1, float32[i]));
          pcm16[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
        }
        wsRef.current.send(pcm16.buffer);
      };
    } catch (e: any) {
      setError(`Mic access denied: ${e?.message || "unknown"}`);
      setSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "answer_end" }));
    }
    processorRef.current?.disconnect();
    audioCtxRef.current?.close().catch(() => {});
    processorRef.current = null;
    audioCtxRef.current = null;
    setSpeaking(false);
    setAudioLevel(0);
    setStatus("Sent for analysis");
  };

  useEffect(() => {
    return () => {
      stopSpeaking();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="glass p-12 rounded-sm max-w-3xl w-full relative">
        <p className="text-xs uppercase tracking-[0.3em] text-gold-400/70 mb-2">Candidate Console</p>
        <h1 className="font-display text-4xl mb-8">Veritas Session</h1>

        {error && (
          <div className="mb-4 p-3 rounded-sm bg-crimson-600/15 border border-crimson-600/40 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-crimson-400 mt-0.5" />
            <p className="text-sm text-crimson-200">{error}</p>
          </div>
        )}

        {!joined ? (
          <>
            <label className="block text-sm text-gold-50/60 mb-2">Session ID</label>
            <input value={sessionId} onChange={(e) => setSessionId(e.target.value)}
                   className="w-full bg-ink-700 border border-gold-400/20 px-4 py-3 rounded-sm text-gold-50 focus:border-gold-400/60 outline-none" />
            <button onClick={join} className="mt-6 w-full py-3 bg-gold-500 text-ink-900 font-semibold rounded-sm hover:bg-gold-400">
              Join Interview
            </button>
          </>
        ) : (
          <>
            {stream && (
              <div className="mb-8 rounded-sm overflow-hidden border border-gold-400/20 w-full aspect-video mx-auto bg-ink-900 relative shadow-lg">
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                
                <div className="absolute top-4 right-4 w-32 md:w-48 aspect-video rounded-sm overflow-hidden border border-gold-400/50 shadow-xl bg-ink-900">
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
                </div>

                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-ink-900/70 px-2 py-0.5 rounded backdrop-blur-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                  <span className="text-[9px] text-emerald-400 uppercase tracking-widest font-mono">Live Call</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 text-sm text-gold-50/60 mb-8">
              <Radio className={`w-4 h-4 ${joined ? "text-emerald-400" : "text-gold-50/30"}`} />
              {status}
            </div>

            {currentQuestion && (
              <div className="mb-8 p-6 glass rounded-sm border border-gold-400/20 text-center relative max-w-xl mx-auto">
                <p className="text-xs uppercase tracking-[0.2em] text-gold-400/70 mb-2">Current Question</p>
                <p className="font-display text-xl text-gold-200">"{currentQuestion}"</p>
              </div>
            )}
            
            <div className="flex flex-col items-center gap-6">
              <button onClick={speaking ? stopSpeaking : startSpeaking}
                className={`w-32 h-32 rounded-full flex items-center justify-center transition-all relative ${
                  speaking ? "bg-crimson-600 alert-pulse" : "bg-gold-500 hover:bg-gold-400 glow-gold"
                }`}>
                {speaking ? <MicOff className="w-12 h-12 text-ink-900" /> : <Mic className="w-12 h-12 text-ink-900" />}
                {speaking && (
                  <div className="absolute -inset-2 rounded-full border-2 border-crimson-400/40 pointer-events-none"
                       style={{ transform: `scale(${1 + audioLevel * 0.3})`, transition: "transform 0.1s" }} />
                )}
              </button>
              <p className="text-sm text-gold-50/50">
                {speaking ? "Tap to stop answer" : "Tap to begin answer"}
              </p>
              {speaking && (
                <div className="w-48 h-1 bg-ink-700 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 transition-all" style={{ width: `${audioLevel * 100}%` }} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <p className="mt-8 text-xs text-gold-50/30 max-w-md text-center">
        Audio is processed for behavioral signals. Not a verdict — data to support fairer decisions.
      </p>
    </div>
  );
}
