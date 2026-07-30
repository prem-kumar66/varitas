"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, Mic, Activity, Shield } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="px-10 py-6 flex justify-between items-center">
        <div className="font-display text-2xl tracking-wider text-gradient-gold">
          VERITAS
        </div>
        <div className="text-xs uppercase tracking-[0.3em] text-gold-400/60">
          Authenticity Intelligence
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <p className="text-xs uppercase tracking-[0.4em] text-gold-400/70 mb-6">
            Real-Time Cognitive Authenticity Verification
          </p>
          <h1 className="font-display text-6xl md:text-7xl leading-tight max-w-4xl">
            See the answers
            <br />
            <span className="text-gradient-gold italic">behind</span> the answers.
          </h1>
          <p className="mt-8 text-gold-50/60 max-w-xl mx-auto text-lg">
            Veritas listens, analyzes, and surfaces behavioral risk signals during
            remote interviews — so you can ask better follow-ups, not louder accusations.
          </p>

          <div className="mt-12 flex gap-4 justify-center">
            <Link
              href="/interviewer"
              className="px-8 py-4 bg-gold-500 text-ink-900 font-semibold rounded-sm hover:bg-gold-400 transition glow-gold"
            >
              Open Interviewer Dashboard
            </Link>
            <Link
              href="/candidate"
              className="px-8 py-4 border border-gold-400/30 text-gold-200 rounded-sm hover:bg-gold-400/5 transition"
            >
              Join as Candidate
            </Link>
          </div>
        </motion.div>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-4 gap-6 max-w-5xl w-full">
          {[
            { icon: Mic, label: "Speech Capture", desc: "Whisper STT, sub-second" },
            { icon: Activity, label: "6 Risk Signals", desc: "Delay, polish, pacing, more" },
            { icon: Eye, label: "Adaptive Probes", desc: "AI-generated follow-ups" },
            { icon: Shield, label: "Explainable", desc: "No black-box verdicts" },
          ].map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
              className="glass p-6 rounded-sm text-left"
            >
              <f.icon className="w-5 h-5 text-gold-400 mb-3" />
              <div className="font-display text-lg">{f.label}</div>
              <div className="text-sm text-gold-50/50 mt-1">{f.desc}</div>
            </motion.div>
          ))}
        </div>
      </main>

      <footer className="px-10 py-6 text-xs text-gold-50/30 text-center">
        Behavioral risk estimation — not detection. Always combine with human judgment.
      </footer>
    </div>
  );
}
