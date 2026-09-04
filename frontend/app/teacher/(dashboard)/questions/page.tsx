"use client";
import { useState, useEffect } from "react";
import { Database, Plus, Search, Filter, Sparkles } from "lucide-react";
import { useTeacherContext } from "@/components/teacher/TeacherProvider";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";

export default function QuestionsPage() {
  const { department, year } = useTeacherContext();
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`${BACKEND_HTTP}/api/academic/questions?department=${department || "CSE"}`)
      .then((r) => r.json())
      .then((d) => {
        setQuestions(d.questions || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [department]);

  const filtered = questions.filter(q => 
    (q.question_text || "").toLowerCase().includes(search.toLowerCase()) ||
    (q.subject_key || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-[#171717] flex items-center gap-3">
            <Database className="w-8 h-8 text-[#C8102E]" /> Question Bank
          </h1>
          <p className="text-[#555555] mt-1">Manage and generate evaluation questions for {department}.</p>
        </div>
        
        <div className="flex gap-3">
          <button className="bg-[#FFF1F2] text-[#C8102E] border border-[#C8102E]/20 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#C8102E] hover:text-white transition">
            <Sparkles className="w-4 h-4" /> AI Generate
          </button>
          <button className="bg-[#171717] text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-black transition">
            <Plus className="w-4 h-4" /> Add Question
          </button>
        </div>
      </header>

      <div className="flex items-center justify-between bg-white border border-[#E5E5E5] p-4 rounded-2xl shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#AAAAAA]" />
          <input 
            type="text" 
            placeholder="Search questions..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-[#C8102E] transition w-80"
          />
        </div>
        
        <div className="flex gap-2">
          <select className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-[#C8102E]">
            <option>All Subjects</option>
            <option>Computer Science</option>
            <option>Mathematics</option>
          </select>
          <select className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-[#C8102E]">
            <option>All Difficulties</option>
            <option>Easy</option>
            <option>Medium</option>
            <option>Hard</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <p className="text-[#555555]">Loading questions...</p>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-[#E5E5E5] p-12 rounded-3xl text-center">
            <p className="text-xl font-bold text-[#171717]">No questions found</p>
            <p className="text-[#555555] mt-2">Try adjusting your filters or use AI to generate some.</p>
          </div>
        ) : (
          filtered.map((q, idx) => (
            <div key={idx} className="bg-white border border-[#E5E5E5] p-5 rounded-2xl shadow-sm hover:border-[#C8102E] transition-colors group">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#C8102E] bg-[#FFF1F2] px-2 py-1 rounded">
                  {q.subject_key || "General"}
                </span>
                <span className={`text-xs font-semibold px-2 py-1 rounded border ${
                  q.difficulty === "hard" ? "bg-red-50 text-red-700 border-red-200" : 
                  q.difficulty === "medium" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                  "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}>
                  {q.difficulty ? q.difficulty.toUpperCase() : "MEDIUM"}
                </span>
              </div>
              <h3 className="font-semibold text-[#171717]">{q.question_text || q.text}</h3>
              {q.reference_answer && (
                <p className="text-sm text-[#555555] mt-2 bg-[#F8F8F8] p-3 rounded-lg border border-[#E5E5E5]">
                  <strong className="text-[#171717]">Ref:</strong> {q.reference_answer}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
