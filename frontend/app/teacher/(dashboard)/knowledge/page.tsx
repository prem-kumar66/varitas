"use client";
import { useState, useRef, useEffect } from "react";
import { Library, UploadCloud, FileText, CheckCircle2, RefreshCw } from "lucide-react";
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
  const [success, setSuccess] = useState<string | null>(null);
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
    setSuccess(null);
    
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
      if (res.ok) {
        setSuccess(`Successfully uploaded and indexed ${file.name}`);
        await fetchDocuments();
      } else {
        setSuccess("Error uploading document. Check console.");
      }
    } catch (err) {
      console.error(err);
      setSuccess("Error connecting to server.");
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white border border-[#E5E5E5] p-8 rounded-3xl shadow-sm text-center">
            <div className="w-16 h-16 bg-[#F8F8F8] text-[#AAAAAA] rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-[#E5E5E5]">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-lg text-[#171717] mb-2">Upload Syllabus or Notes</h3>
            <p className="text-sm text-[#555555] mb-6">PDF, DOCX, or TXT files up to 10MB.</p>
            
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
              {uploading ? "Processing & Indexing..." : "Select File"}
            </button>

            {success && (
              <div className="mt-4 p-3 bg-emerald-50 text-emerald-700 text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> {success}
              </div>
            )}
          </div>

          <div className="bg-white border border-[#E5E5E5] rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-[#E5E5E5] flex justify-between items-center bg-[#F8F8F8]">
              <h3 className="font-bold text-[#171717]">Indexed Documents</h3>
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
                  No documents indexed yet. Upload one above.
                </div>
              ) : (
                documents.map((doc, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between hover:bg-[#F8F8F8] transition">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-[#AAAAAA]" />
                      <div>
                        <p className="font-semibold text-sm text-[#171717]">{doc.name}</p>
                        <p className="text-[10px] text-[#555555] uppercase tracking-wider mt-0.5">
                          {doc.chunks} chunks • Subject: {doc.subject}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-[#171717] text-white p-6 rounded-3xl shadow-sm">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" /> RAG Status
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-gray-400">Status</span>
                <span className="font-semibold text-emerald-400">Online</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-gray-400">Documents</span>
                <span className="font-semibold">{stats.totalDocs}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-gray-400">Vector Chunks</span>
                <span className="font-semibold">{stats.totalChunks}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Last Sync</span>
                <span className="font-semibold">Just now</span>
              </div>
            </div>
            <button 
              onClick={fetchDocuments}
              className="w-full mt-6 bg-white text-[#171717] font-bold py-2 rounded-xl text-sm hover:bg-gray-200 transition"
            >
              Force Sync
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

