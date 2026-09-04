"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { GraduationCap, Mic, Edit3, ShieldCheck, CheckCircle, BarChart3, BookOpen, ArrowRight, UserCheck, ListChecks } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-[#171717] font-sans">
      {/* Top Navbar */}
      <nav className="px-10 py-6 flex justify-between items-center border-b border-[#E5E5E5] bg-white/95 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#FFF1F2] rounded-lg border border-[#C8102E]/20">
            <GraduationCap className="w-6 h-6 text-[#C8102E]" />
          </div>
          <div>
            <span className="font-bold text-xl tracking-wide text-gradient-gold">VERITAS ACADEMIC</span>
            <span className="block text-[10px] uppercase tracking-[0.2em] text-[#555555]">Student Assessment &amp; Evaluation Platform</span>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <Link
            href="/login/student"
            className="px-4 py-2 bg-[#FFF1F2] border border-[#C8102E]/30 text-[#C8102E] rounded-xl text-xs font-semibold hover:bg-[#C8102E]/10 transition flex items-center gap-1.5"
          >
            <GraduationCap className="w-4 h-4" /> Student Login
          </Link>
          <Link
            href="/login/teacher"
            className="px-4 py-2 bg-[#C8102E] border border-[#C8102E] text-white rounded-xl text-xs font-semibold hover:bg-[#A50E25] transition flex items-center gap-1.5"
          >
            <UserCheck className="w-4 h-4" /> Teacher Login
          </Link>
          <Link href="/sessions" className="text-xs uppercase tracking-wider text-[#555555] hover:text-[#C8102E] font-medium ml-2">
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
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFF1F2] border border-[#C8102E]/20 text-[#C8102E] text-xs font-medium mb-8">
            <ShieldCheck className="w-4 h-4 text-[#C8102E]" /> AI-Driven Student Testing &amp; Evaluation System
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-extrabold leading-tight text-[#171717] tracking-tight">
            College Assessment Platform
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C8102E] via-[#E31B23] to-[#A50E25] italic">
              for Students
            </span>
          </h1>

          <p className="mt-8 text-[#555555] max-w-2xl mx-auto text-lg leading-relaxed">
            A unified platform built for students to complete <strong className="text-[#C8102E] font-semibold">Oral, Written, or Quiz tests</strong> with cognitive anti-cheat tracking and <strong className="text-[#C8102E] font-semibold">AI-powered evaluation of student performance</strong>.
          </p>

          {/* DUAL ROLE LOGIN CHOICE CARDS */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto text-left">
            {/* Student Login Card */}
            <motion.div
              whileHover={{ y: -4 }}
              className="bg-white border border-[#E5E5E5] p-6 rounded-2xl flex flex-col justify-between space-y-4 hover:border-[#C8102E]/40 transition shadow-sm hover:shadow-md group"
            >
              <div>
                <div className="w-12 h-12 bg-[#FFF1F2] border border-[#C8102E]/20 rounded-xl flex items-center justify-center text-[#C8102E] mb-4 group-hover:scale-110 transition">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-xl text-[#171717]">Student Portal</h3>
                <p className="text-xs text-[#555555] mt-2 leading-relaxed">
                  Log in with your Roll Number to take AI-conducted Oral (voice), Written (text), or Quiz (MCQ) tests with anti-cheat monitoring.
                </p>
              </div>
              <Link
                href="/login/student"
                className="w-full py-3 bg-[#C8102E] hover:bg-[#A50E25] text-white font-bold rounded-xl transition flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
              >
                Student Login <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            {/* Teacher Login Card */}
            <motion.div
              whileHover={{ y: -4 }}
              className="bg-white border border-[#E5E5E5] p-6 rounded-2xl flex flex-col justify-between space-y-4 hover:border-[#C8102E]/40 transition shadow-sm hover:shadow-md group"
            >
              <div>
                <div className="w-12 h-12 bg-[#FFF1F2] border border-[#C8102E]/20 rounded-xl flex items-center justify-center text-[#C8102E] mb-4 group-hover:scale-110 transition">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-xl text-[#171717]">Teacher &amp; Admin Portal</h3>
                <p className="text-xs text-[#555555] mt-2 leading-relaxed">
                  Log in to set model reference answers, manage question banks, review student performance, and download PDF reports.
                </p>
              </div>
              <Link
                href="/login/teacher"
                className="w-full py-3 bg-[#A50E25] hover:bg-[#8B0B1F] text-white font-bold rounded-xl transition flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
              >
                Teacher Login <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </motion.div>

        {/* Feature Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full">
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
              icon: ListChecks,
              title: "Quiz (MCQ) Tests",
              desc: "Multiple-choice question format with instant AI scoring and per-option analysis for quick assessments.",
            },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
              className="bg-white border border-[#E5E5E5] p-6 rounded-2xl text-left hover:border-[#C8102E]/30 hover:shadow-md transition group"
            >
              <div className="p-3 bg-[#FFF1F2] rounded-xl w-fit mb-4 group-hover:scale-110 transition">
                <f.icon className="w-6 h-6 text-[#C8102E]" />
              </div>
              <h3 className="font-bold text-lg text-[#171717] mb-2">{f.title}</h3>
              <p className="text-sm text-[#555555] leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </main>

      <footer className="px-10 py-6 border-t border-[#E5E5E5] text-xs text-[#555555] text-center">
        Veritas Academic — Role-Based Assessment &amp; Performance Evaluation Platform.
      </footer>
    </div>
  );
}
