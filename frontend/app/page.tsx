"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { GraduationCap, Mic, Edit3, ShieldCheck, CheckCircle, BarChart3, BookOpen, ArrowRight, UserCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Top Navbar */}
      <nav className="px-10 py-6 flex justify-between items-center border-b border-slate-800 bg-slate-900/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/30">
            <GraduationCap className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <span className="font-bold text-xl tracking-wide text-gradient-gold">VERITAS ACADEMIC</span>
            <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-400">Student Assessment & Evaluation Platform</span>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <Link
            href="/login/student"
            className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-semibold hover:bg-amber-500/20 transition flex items-center gap-1.5"
          >
            <GraduationCap className="w-4 h-4" /> Student Login
          </Link>
          <Link
            href="/login/teacher"
            className="px-4 py-2 bg-blue-600/20 border border-blue-500/30 text-blue-300 rounded-xl text-xs font-semibold hover:bg-blue-600/30 transition flex items-center gap-1.5"
          >
            <UserCheck className="w-4 h-4" /> Teacher Login
          </Link>
          <Link href="/sessions" className="text-xs uppercase tracking-wider text-slate-400 hover:text-white font-medium ml-2">
            Analytics
          </Link>
        </div>
      </nav>

      {/* Main Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center py-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium mb-8">
            <ShieldCheck className="w-4 h-4 text-amber-400" /> AI-Driven Student Testing & Teacher Evaluation System
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-extrabold leading-tight text-slate-50 tracking-tight">
            College Assessment Platform
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 italic">
              for Students & Teachers
            </span>
          </h1>

          <p className="mt-8 text-slate-400 max-w-2xl mx-auto text-lg leading-relaxed">
            A unified platform built for students to complete <strong className="text-amber-300 font-semibold">Oral or Written tests</strong> with cognitive anti-cheat tracking, and for teachers to <strong className="text-amber-300 font-semibold">manage model answer keys and evaluate student performance</strong>.
          </p>

          {/* DUAL ROLE LOGIN CHOICE CARDS */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto text-left">
            {/* Student Login Card */}
            <motion.div
              whileHover={{ y: -4 }}
              className="bg-slate-900/90 border border-amber-500/30 p-6 rounded-2xl flex flex-col justify-between space-y-4 hover:border-amber-500/60 transition shadow-xl shadow-amber-500/5 group"
            >
              <div>
                <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-xl text-slate-100">Student Portal</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Log in with your Roll Number to take AI-conducted Oral (voice) or Written (text) tests with anti-cheat monitoring.
                </p>
              </div>
              <Link
                href="/login/student"
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
              >
                Student Login <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            {/* Teacher Login Card */}
            <motion.div
              whileHover={{ y: -4 }}
              className="bg-slate-900/90 border border-blue-500/30 p-6 rounded-2xl flex flex-col justify-between space-y-4 hover:border-blue-500/60 transition shadow-xl shadow-blue-500/5 group"
            >
              <div>
                <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-center text-blue-400 mb-4 group-hover:scale-110 transition">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-xl text-slate-100">Teacher & Admin Portal</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Log in to set model reference answers, manage question banks, review student performance, and download PDF reports.
                </p>
              </div>
              <Link
                href="/login/teacher"
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
              >
                Teacher Login <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </motion.div>

        {/* Feature Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl w-full">
          {[
            {
              icon: Mic,
              title: "Oral (Voice) Tests",
              desc: "Displays text questions, captures audio answers via Whisper STT, measures speech latency & disfluencies.",
            },
            {
              icon: Edit3,
              title: "Written (Text) Tests",
              desc: "Timed rich text editor with paste-blocking, keystroke cadence analysis, and GPT-2 perplexity check.",
            },
            {
              icon: CheckCircle,
              title: "Model Answer Matching",
              desc: "Semantic AI evaluation comparing candidate responses directly against model answers and rubric criteria.",
            },
            {
              icon: BarChart3,
              title: "Teacher Evaluation Suite",
              desc: "Manage subject question banks, set model answers, review candidate submissions, and download PDF reports.",
            },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
              className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl text-left hover:border-amber-500/30 transition group"
            >
              <div className="p-3 bg-amber-500/10 rounded-xl w-fit mb-4 group-hover:scale-110 transition">
                <f.icon className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="font-bold text-lg text-slate-100 mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </main>

      <footer className="px-10 py-6 border-t border-slate-800/80 text-xs text-slate-500 text-center">
        Veritas Academic — Role-Based Assessment & Performance Evaluation Platform.
      </footer>
    </div>
  );
}
