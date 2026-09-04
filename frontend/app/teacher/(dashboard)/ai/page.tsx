"use client";
import { useState, useRef, useEffect } from "react";
import { useTeacherContext } from "@/components/teacher/TeacherProvider";
import { Bot, Send, User, Sparkles, BarChart2, TrendingDown, HelpCircle, UserCheck, Save, Trash2, Edit3, X } from "lucide-react";
import { motion } from "framer-motion";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";

type Message = {
  role: "user" | "ai";
  content: string;
};

export default function TeacherAIPage() {
  const { department, year, section } = useTeacherContext();
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", content: `Hello Professor! I am your Teacher AI. How can I assist you with ${department} • ${year} • Section ${section} today?\n\nYou can ask me to "Generate an assessment from this document" or "Generate a quiz from Unit 2".` }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Assessment Generation State
  const [generatedAssessment, setGeneratedAssessment] = useState<any[] | null>(null);
  const [assessmentMode, setAssessmentMode] = useState("oral");
  const [assessmentName, setAssessmentName] = useState("New Assessment");
  const [publishing, setPublishing] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, generatedAssessment]);

  const quickActions = [
    { title: "Generate Quiz", prompt: "Generate a quiz from the uploaded PDF", icon: HelpCircle },
    { title: "Generate Viva", prompt: "Generate 5 viva questions on NLP Unit 2", icon: UserCheck },
    { title: "Analyze Class", prompt: "Analyze my overall class performance.", icon: BarChart2 },
    { title: "Find Weak Topics", prompt: "Which topics are weakest in my class?", icon: TrendingDown },
  ];

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    setGeneratedAssessment(null);
    setPublishedId(null);

    const isAssessmentRequest = text.toLowerCase().includes("generate") || text.toLowerCase().includes("quiz") || text.toLowerCase().includes("viva") || text.toLowerCase().includes("assessment") || text.toLowerCase().includes("question");

    try {
      if (isAssessmentRequest) {
        const inferredMode = text.toLowerCase().includes("quiz") ? "quiz" : text.toLowerCase().includes("written") ? "written" : "oral";
        setAssessmentMode(inferredMode);
        
        const subjectKey = (department && year) ? `${department}_${year}`.replace(/\s+/g, "_").toLowerCase() : "global";
        const numMatch = text.match(/\b(\d+)\b/);
        const numQ = numMatch ? parseInt(numMatch[1]) : 5;

        const res = await fetch(`${BACKEND_HTTP}/api/assessments/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            prompt: text, 
            subject_key: subjectKey,
            mode: inferredMode,
            num_questions: Math.min(numQ, 15),
            difficulty: "medium"
          }),
        });
        
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ detail: "Unknown error" }));
          const errMsg = errData.detail || `Generation failed (${res.status})`;
          setMessages(prev => [...prev, { role: "ai", content: `⚠️ ${errMsg}` }]);
          setLoading(false);
          return;
        }

        const data = await res.json();
        if (data.questions && data.questions.length > 0) {
          setGeneratedAssessment(data.questions);
          const sourceNote = data.questions[0]?.question?.includes("Mock") 
            ? "\n\n⚠️ Warning: These appear to be generated without PDF context."
            : `\n\n✅ Generated ${data.questions.length} question(s) from your uploaded documents.`;
          setMessages(prev => [...prev, { role: "ai", content: `I've generated the assessment based on the RAG context. Please review the questions below.${sourceNote}` }]);
        } else {
          setMessages(prev => [...prev, { role: "ai", content: "⚠️ No relevant content found in the uploaded documents. Please upload a PDF first in the Syllabus & RAG section, then try again." }]);
        }

      } else {
        const res = await fetch(`${BACKEND_HTTP}/api/demo/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario: "teacher_ai", query: text, context: { department, year, section } }),
        });
        const data = await res.json();
        const aiResponse = data.response || "I am analyzing the data. Based on current records, your students need more focus on Clustering and Neural Networks.";
        setMessages(prev => [...prev, { role: "ai", content: aiResponse }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: "ai", content: "I encountered an error analyzing your request. Please try again later." }]);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!generatedAssessment) return;
    setPublishing(true);
    
    try {
      const examId = `exam-${Date.now().toString(36)}`;
      const payload = {
        exam_id: examId,
        name: assessmentName,
        mode: assessmentMode,
        department: department || "",
        year: year || "",
        section: section || "",
        questions: generatedAssessment
      };

      const res = await fetch(`${BACKEND_HTTP}/api/assessments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setPublishedId(examId);
        setGeneratedAssessment(null);
        setMessages(prev => [...prev, { role: "ai", content: `Assessment "${assessmentName}" published successfully! Students can now take it in the Student Portal.` }]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPublishing(false);
    }
  };

  const removeQuestion = (idx: number) => {
    if (generatedAssessment) {
      setGeneratedAssessment(generatedAssessment.filter((_, i) => i !== idx));
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold text-[#171717] flex items-center gap-3">
          <Bot className="w-8 h-8 text-[#C8102E]" /> Teacher AI
        </h1>
        <p className="text-[#555555] mt-1">Your intelligent academic teaching assistant.</p>
      </header>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {quickActions.map((action, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(action.prompt)}
            className="bg-white border border-[#E5E5E5] p-4 rounded-2xl hover:border-[#C8102E] hover:shadow-md transition-all text-left group flex flex-col justify-between min-h-[100px]"
          >
            <action.icon className="w-5 h-5 text-[#555555] group-hover:text-[#C8102E] transition-colors mb-2" />
            <span className="font-bold text-sm text-[#171717]">{action.title}</span>
          </button>
        ))}
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-white border border-[#E5E5E5] rounded-3xl flex flex-col overflow-hidden shadow-sm">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, idx) => (
            <motion.div 
              key={idx} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === "user" ? "bg-[#171717] text-white" : "bg-[#FFF1F2] text-[#C8102E]"
              }`}>
                {msg.role === "user" ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              <div className={`max-w-[80%] rounded-2xl p-4 text-sm ${
                msg.role === "user" 
                  ? "bg-[#171717] text-white rounded-tr-none" 
                  : "bg-[#F8F8F8] text-[#171717] border border-[#E5E5E5] rounded-tl-none whitespace-pre-line"
              }`}>
                {msg.content}
              </div>
            </motion.div>
          ))}
          
          {loading && (
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-[#FFF1F2] text-[#C8102E] flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-2xl rounded-tl-none p-4 text-sm text-[#555555]">
                Analyzing data and generating...
              </div>
            </div>
          )}

          {generatedAssessment && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="ml-14 max-w-3xl border-2 border-[#E5E5E5] rounded-2xl p-6 bg-white shadow-lg"
            >
              <h3 className="font-bold text-lg mb-4">Review Generated Assessment</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Assessment Name</label>
                  <input 
                    value={assessmentName} 
                    onChange={e => setAssessmentName(e.target.value)}
                    className="w-full border rounded-lg p-2 text-sm focus:border-black outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Mode (Student cannot change this)</label>
                  <select 
                    value={assessmentMode} 
                    onChange={e => setAssessmentMode(e.target.value)}
                    className="w-full border rounded-lg p-2 text-sm focus:border-black outline-none"
                  >
                    <option value="oral">Oral / Viva</option>
                    <option value="written">Written</option>
                    <option value="quiz">Quiz (MCQ)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {generatedAssessment.map((q, idx) => (
                  <div key={idx} className="bg-gray-50 p-4 rounded-xl border relative group">
                    <button 
                      onClick={() => removeQuestion(idx)}
                      className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <p className="font-semibold text-sm pr-6">{idx + 1}. {q.question}</p>
                    
                    {assessmentMode === "quiz" && q.options && (
                      <div className="mt-2 text-xs text-gray-600 grid grid-cols-2 gap-2">
                        {Object.entries(q.options).map(([k, v]) => (
                          <div key={k} className={`p-1 ${q.correct_answer === k ? 'font-bold text-green-700' : ''}`}>
                            {k}: {v as string}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {(assessmentMode === "oral" || assessmentMode === "written") && q.reference_answer && (
                      <div className="mt-2 text-xs text-gray-600 border-t pt-2">
                        <span className="font-bold text-gray-800">Ref: </span>{q.reference_answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button 
                  onClick={() => setGeneratedAssessment(null)}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition"
                >
                  Discard
                </button>
                <button 
                  onClick={handlePublish}
                  disabled={publishing}
                  className="px-6 py-2 text-sm font-bold bg-[#C8102E] text-white rounded-lg hover:bg-[#A50E25] transition flex items-center gap-2"
                >
                  {publishing ? <Sparkles className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Publish to Student Portal
                </button>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-[#E5E5E5] bg-white">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
            className="relative flex items-center"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Teacher AI (e.g. Generate a quiz from Unit 2)..."
              className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-full py-4 pl-6 pr-14 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#C8102E] transition disabled:opacity-50"
            />
            <button 
              type="submit" 
              disabled={loading || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#C8102E] text-white rounded-full flex items-center justify-center hover:bg-[#A50E25] transition disabled:opacity-50 disabled:hover:bg-[#C8102E]"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
