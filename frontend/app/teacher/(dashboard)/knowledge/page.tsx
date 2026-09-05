"use client";
import { useState, useRef, useEffect } from "react";
import { Library, UploadCloud, FileText, CheckCircle2, RefreshCw, AlertTriangle, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTeacherContext } from "@/components/teacher/TeacherProvider";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";

interface DocumentMeta {
  name: string;
  chunks: number;
  subject: string;
}

export default function KnowledgePage() {
  const { department, year } = useTeacherContext();
  const [uploading, setUploading] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "warning" | "error";
    message: string;
  } | null>(null);
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [stats, setStats] = useState({ totalDocs: 0, totalChunks: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    setRefreshing(true);
    try {
      const subjectKey = (department && year) ? `${department}_${year}`.replace(/\s+/g, "_").toLowerCase() : "global";
      const res = await fetch(`${BACKEND_HTTP}/api/rag/documents?subject_key=${subjectKey}`);
      if (res.ok) {
        const data = await res.json();
        let allDocs: DocumentMeta[] = [];
        let totalChunks = 0;
        let totalDocs = 0;
        
        data.sources.forEach((source: any) => {
          totalChunks += source.total_chunks;
          source.documents.forEach((doc: any) => {
            totalDocs += 1;
            allDocs.push({
              name: doc.filename,
              chunks: doc.chunks_count,
              subject: source.subject
            });
          });
        });
        
        setDocuments(allDocs);
        setStats({ totalDocs, totalChunks });
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [department, year]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setUploading(true);
    setNotification(null);
    
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);
    const subjectKey = (department && year) ? `${department}_${year}`.replace(/\s+/g, "_").toLowerCase() : "global";
    formData.append("subject_key", subjectKey);

    try {
      const res = await fetch(`${BACKEND_HTTP}/api/rag/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 409 || (data.detail && data.detail.toLowerCase().includes("already present"))) {
        setNotification({
          type: "warning",
          message: "PDF already present"
        });
      } else if (res.ok) {
        setNotification({
          type: "success",
          message: `Knowledge base built automatically from "${file.name}" (${data.chunks_added || "all"} chunks indexed).`
        });
        await fetchDocuments();
      } else {
        setNotification({
          type: "error",
          message: data.detail || "Error uploading and indexing document."
        });
      }
    } catch (err) {
      console.error(err);
      setNotification({
        type: "error",
        message: "Error connecting to backend server."
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-[#171717] flex items-center gap-3">
            <Library className="w-8 h-8 text-[#C8102E]" /> Syllabus & RAG Hub
          </h1>
          <p className="text-[#555555] mt-1">Manage the knowledge base for {department} • {year}.</p>
        </div>
      </header>

      {notification && (
        <div className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-sm font-semibold transition-all ${
          notification.type === "warning" 
            ? "bg-amber-50 text-amber-800 border border-amber-200" 
            : notification.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
            : "bg-rose-50 text-rose-800 border border-rose-200"
        }`}>
          <div className="flex items-center gap-2.5">
            {notification.type === "warning" && <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />}
            {notification.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
            {notification.type === "error" && <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />}
            <span>{notification.message}</span>
          </div>
          <button 
            onClick={() => setNotification(null)}
            className="text-xs opacity-60 hover:opacity-100 uppercase tracking-wider font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white border border-[#E5E5E5] p-8 rounded-3xl shadow-sm text-center">
            <div className="w-16 h-16 bg-[#F8F8F8] text-[#AAAAAA] rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-[#E5E5E5]">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-lg text-[#171717] mb-2">Upload Subject PDF</h3>
            <p className="text-sm text-[#555555] mb-6">
              When uploaded, the knowledge base builds automatically and assessments are generated exclusively from this PDF.
            </p>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleUpload} 
              accept=".pdf,.txt,.docx"
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-[#171717] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-black transition mx-auto disabled:opacity-50"
            >
              {uploading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
              {uploading ? "Building Knowledge Base..." : "Upload Subject PDF"}
            </button>
          </div>

          <div className="bg-white border border-[#E5E5E5] rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-[#E5E5E5] flex justify-between items-center bg-[#F8F8F8]">
              <div>
                <h3 className="font-bold text-[#171717]">Indexed Subject Material</h3>
                <p className="text-xs text-gray-500">Only questions from these documents will be generated for exams.</p>
              </div>
              <button 
                onClick={fetchDocuments}
                disabled={refreshing}
                className="text-xs font-bold text-[#555555] bg-white px-2 py-1 rounded border border-[#E5E5E5] flex items-center gap-1 hover:bg-gray-50"
              >
                {refreshing ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                Refresh
              </button>
            </div>
            <div className="divide-y divide-[#E5E5E5]">
              {documents.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  No subject PDFs indexed yet. Upload one above to automatically build the knowledge base.
                </div>
              ) : (
                documents.map((doc, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between hover:bg-[#F8F8F8] transition">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-[#C8102E]" />
                      <div>
                        <p className="font-semibold text-sm text-[#171717]">{doc.name}</p>
                        <p className="text-[10px] text-[#555555] uppercase tracking-wider mt-0.5">
                          {doc.chunks} chunks • Subject: {doc.subject}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/teacher/ai?doc=${encodeURIComponent(doc.name)}`}
                      className="text-xs font-bold text-[#C8102E] bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Generate Questions
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-[#171717] text-white p-6 rounded-3xl shadow-sm">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" /> RAG Knowledge Base
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-gray-400">Status</span>
                <span className="font-semibold text-emerald-400">Auto-Indexed</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-gray-400">Uploaded PDFs</span>
                <span className="font-semibold">{stats.totalDocs}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-gray-400">Knowledge Chunks</span>
                <span className="font-semibold">{stats.totalChunks}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Duplicate Guard</span>
                <span className="font-semibold text-amber-400">Active</span>
              </div>
            </div>
            <button 
              onClick={fetchDocuments}
              className="w-full mt-6 bg-white text-[#171717] font-bold py-2 rounded-xl text-sm hover:bg-gray-200 transition"
            >
              Sync Index
            </button>
          </div>

          <div className="bg-white border border-[#E5E5E5] p-5 rounded-3xl text-xs space-y-2 text-gray-600">
            <p className="font-bold text-[#171717] flex items-center gap-1">
              💡 Grounding Guarantee
            </p>
            <p>
              When a subject PDF is uploaded, all assessments (MCQ, Oral Viva, Written Text) are restricted <strong>exclusively</strong> to that document's content.
            </p>
            <p>
              Uploading an identical PDF will trigger a duplicate check and report <strong>PDF already present</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
