"use client";
import { useState, useRef, useEffect } from "react";
import { useTeacherContext } from "@/components/teacher/TeacherProvider";
import { Bot, Send, User, Sparkles, BarChart2, TrendingDown, HelpCircle, UserCheck, Save, Trash2, Edit3, X, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { detectMode } from "@/lib/detectMode";
import { getTeacherAuthHeaders } from "@/lib/auth";

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
  const [availableDocs, setAvailableDocs] = useState<string[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string>("all");
  const [explicitNumQuestions, setExplicitNumQuestions] = useState<string>("5");
  const [avoidQuestions, setAvoidQuestions] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editQuestionText, setEditQuestionText] = useState("");
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load indexed subject documents for strict PDF grounding
  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const subjectKey = (department && year) ? `${department}_${year}`.replace(/\s+/g, "_").toLowerCase() : "global";
        const res = await fetch(`${BACKEND_HTTP}/api/rag/documents?subject_key=${subjectKey}`, { headers: getTeacherAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          const docList: string[] = [];
          data.sources?.forEach((s: any) => {
            s.documents?.forEach((d: any) => {
              if (d.filename && !docList.includes(d.filename)) docList.push(d.filename);
            });
          });
          setAvailableDocs(docList);
          
          if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const docParam = params.get("doc");
            if (docParam && docList.includes(docParam)) {
              setSelectedDoc(docParam);
            }
          }
        }
      } catch (e) {
        console.error("Failed to load subject documents", e);
      }
    };
    fetchDocs();
  }, [department, year]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, generatedAssessment]);

  const quickActions = [
    { title: "Generate MCQ Quiz", prompt: "Generate a 5-question MCQ quiz from the uploaded PDF", icon: HelpCircle },
    { title: "Generate Oral Viva", prompt: "Generate 5 oral viva questions from the uploaded PDF", icon: UserCheck },
    { title: "Generate Written Test", prompt: "Generate 3 written questions with reference answers from the uploaded PDF", icon: FileText },
    { title: "Find Weak Topics", prompt: "Which topics are weakest in my class?", icon: TrendingDown },
  ];

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    setGeneratedAssessment(null);
    setSelectedAnswers({});
    setPublishedId(null);

    const isAssessmentRequest = text.toLowerCase().includes("generate") || text.toLowerCase().includes("quiz") || text.toLowerCase().includes("viva") || text.toLowerCase().includes("assessment") || text.toLowerCase().includes("question");

    try {
      if (isAssessmentRequest) {
        // Extract number of questions from prompt
        let finalNum = parseInt(explicitNumQuestions) || 5;
        const numMatch = text.match(/\b(\d+)\s*(?:questions?|mcqs?|items?)?\b/i);
        const singularMatch = text.match(/\b(?:a|an|one|single)\s+(?:oral\s+|written\s+|mcq\s+|quiz\s+)?question\b/i)
          || text.match(/\bgenerate\s+(?:an?\s+)?(?:oral\s+|written\s+|mcq\s+|quiz\s+)?question\b/i);

        if (numMatch) {
          finalNum = Math.max(1, parseInt(numMatch[1]));
          setExplicitNumQuestions(finalNum.toString());
        } else if (singularMatch) {
          finalNum = 1;
          setExplicitNumQuestions("1");
        }

        // Extract mode: Type dropdown (assessmentMode) is source of truth, overridden only if prompt clearly specifies
        const finalMode = detectMode(text, assessmentMode);
        if (finalMode !== assessmentMode) {
          setAssessmentMode(finalMode);
        }
        const modeDisplay = finalMode === "quiz" ? "MCQ" : finalMode === "written" ? "Written" : "Oral/Viva";

        const subjectKey = (department && year) ? `${department}_${year}`.replace(/\s+/g, "_").toLowerCase() : "global";

        const payload: any = { 
          prompt: text, 
          subject_key: subjectKey,
          mode: finalMode,
          num_questions: finalNum,
          difficulty: "medium",
          avoid_questions: avoidQuestions
        };
        if (selectedDoc && selectedDoc !== "all") {
          payload.source_filename = selectedDoc;
        }

        const res = await fetch(`${BACKEND_HTTP}/api/assessments/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getTeacherAuthHeaders() },
          body: JSON.stringify(payload),
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
          const isCustom = data.is_custom || data.questions.every((q: any) => q.source === "Teacher's Request");
          const sourceList = data.source_documents?.length ? data.source_documents.join(", ") : selectedDoc !== "all" ? selectedDoc : "uploaded subject PDF";
          
          let aiText = isCustom
            ? `Generated ${data.questions.length} ${modeDisplay} question(s) based on your custom request.\n\nPlease review the question(s) below before publishing.`
            : `Generated ${data.questions.length} ${modeDisplay} question(s) strictly grounded in: 📄 **${sourceList}**.\n\nPlease review the questions below before publishing.`;

          if (data.warning) {
            aiText += `\n\n⚠️ AI generation failed (${data.warning}). These questions came from basic text extraction and should be reviewed.`;
          }

          setMessages(prev => [...prev, { role: "ai", content: aiText }]);
        } else {
          setMessages(prev => [...prev, { role: "ai", content: "⚠️ No relevant content found in the uploaded documents. Please upload a PDF first in the Syllabus & RAG section, then try again." }]);
        }

      } else {
        const res = await fetch(`${BACKEND_HTTP}/api/teacher/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getTeacherAuthHeaders() },
          body: JSON.stringify({ query: text, context: { department, year, section } }),
        });
        const data = await res.json();
        const aiResponse = data.response || "I'm having trouble connecting to my AI backend. Please try again later.";
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
        headers: { "Content-Type": "application/json", ...getTeacherAuthHeaders() },
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

  const handleGenerateOther = () => {
    if (generatedAssessment) {
      setAvoidQuestions(prev => [...prev, ...generatedAssessment.map(q => q.question)]);
    }
    const lastPrompt = messages.filter(m => m.role === 'user').pop()?.content || "Generate more questions";
    handleSend(lastPrompt);
  };

  const startEditing = (idx: number, text: string) => {
    setEditingIndex(idx);
    setEditQuestionText(text);
  };

  const saveEdit = (idx: number) => {
    if (generatedAssessment) {
      const updated = [...generatedAssessment];
      updated[idx].question = editQuestionText;
      setGeneratedAssessment(updated);
    }
    setEditingIndex(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#171717] flex items-center gap-3">
            <Bot className="w-8 h-8 text-[#C8102E]" /> Teacher AI
          </h1>
          <p className="text-[#555555] mt-1">Your intelligent academic teaching assistant.</p>
        </div>
      </header>

      {/* Generation Controls */}
      <div className="flex flex-col gap-3 bg-white border border-[#E5E5E5] px-4 py-3 rounded-2xl mb-4 text-xs shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-[#171717] flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                PDF Source:
              </span>
              <select 
                value={selectedDoc}
                onChange={(e) => setSelectedDoc(e.target.value)}
                className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-lg px-3 py-1.5 text-xs font-semibold text-[#171717] focus:outline-none focus:border-[#C8102E]"
              >
                <option value="all">All Uploaded Subject PDFs ({availableDocs.length})</option>
                {availableDocs.map((doc, idx) => (
                  <option key={idx} value={doc}>{doc}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-[#171717]">Questions:</span>
              <select 
                value={explicitNumQuestions}
                onChange={(e) => setExplicitNumQuestions(e.target.value)}
                className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-lg px-3 py-1.5 text-xs font-semibold text-[#171717] focus:outline-none focus:border-[#C8102E]"
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="33">33</option>
                <option value="40">40</option>
              </select>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-[#171717]">Type:</span>
              <select 
                value={assessmentMode}
                onChange={(e) => setAssessmentMode(e.target.value)}
                className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-lg px-3 py-1.5 text-xs font-semibold text-[#171717] focus:outline-none focus:border-[#C8102E]"
              >
                <option value="oral">Oral / Viva</option>
                <option value="written">Written (reference answers)</option>
                <option value="quiz">MCQ Quiz</option>
              </select>
            </div>
          </div>
          {availableDocs.length === 0 ? (
            <div className="flex items-center gap-2 text-amber-700 font-medium">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span>No PDFs uploaded yet.</span>
              <Link href="/teacher/knowledge" className="underline font-bold text-[#C8102E]">
                Upload PDF
              </Link>
            </div>
          ) : (
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Strictly grounded in PDF
            </span>
          )}
        </div>
      </div>

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
              <h3 className="font-bold text-lg text-gray-900 mb-4">Review Generated Assessment</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Assessment Name</label>
                  <input 
                    value={assessmentName} 
                    onChange={e => setAssessmentName(e.target.value)}
                    className="w-full border rounded-lg p-2 text-sm text-gray-900 focus:border-black outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Mode (Student cannot change this)</label>
                  <select 
                    value={assessmentMode} 
                    onChange={e => setAssessmentMode(e.target.value)}
                    className="w-full border rounded-lg p-2 text-sm text-gray-900 focus:border-black outline-none"
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
                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                      {editingIndex !== idx && (
                        <button onClick={() => startEditing(idx, q.question)} className="text-gray-400 hover:text-blue-500">
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => removeQuestion(idx)} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="pr-16">
                      {editingIndex === idx ? (
                        <div className="flex gap-2">
                          <input 
                            value={editQuestionText} 
                            onChange={e => setEditQuestionText(e.target.value)}
                            className="flex-1 border p-1 rounded text-sm focus:outline-none focus:border-blue-500"
                          />
                          <button onClick={() => saveEdit(idx)} className="text-xs bg-blue-500 text-white px-2 py-1 rounded">Save</button>
                        </div>
                      ) : (
                        <p className="font-semibold text-sm text-gray-900">{idx + 1}. {q.question}</p>
                      )}
                      {q.source && (
                        <span className="inline-block mt-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded">
                          📄 Source: {q.source}
                        </span>
                      )}
                    </div>
                    
                    {assessmentMode === "quiz" && q.options && (
                      <div className="mt-3 text-xs text-gray-700 flex flex-col gap-2">
                        {Object.entries(q.options).map(([k, v]) => {
                          const isSelected = selectedAnswers[idx] === k;
                          const isCorrect = q.correct_answer === k;
                          const hasAnswered = selectedAnswers[idx] !== undefined;
                          
                          let bgClass = "bg-white border-gray-100 hover:bg-gray-50 cursor-pointer";
                          let textClass = "";
                          let accentClass = "";

                          if (hasAnswered) {
                            if (isCorrect) {
                              bgClass = "bg-green-50 border-green-200";
                              textClass = "text-green-800";
                              accentClass = "accent-green-600";
                            } else if (isSelected) {
                              bgClass = "bg-red-50 border-red-200";
                              textClass = "text-red-800";
                              accentClass = "accent-red-600";
                            }
                          }

                          return (
                            <label key={k} className={`flex items-start gap-2 p-2 rounded-lg border transition-colors ${bgClass} ${textClass}`}>
                              <input 
                                type="checkbox" 
                                checked={isSelected} 
                                onChange={() => setSelectedAnswers(prev => ({ ...prev, [idx]: k }))}
                                disabled={hasAnswered}
                                className={`mt-0.5 w-3.5 h-3.5 rounded-sm ${accentClass}`}
                              />
                              <span className="font-semibold">{k}:</span>
                              <span className={hasAnswered && isCorrect ? 'font-bold' : ''}>{v as string}</span>
                            </label>
                          );
                        })}
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
                  onClick={handleGenerateOther}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition border border-blue-200"
                >
                  Generate Other Questions
                </button>
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
