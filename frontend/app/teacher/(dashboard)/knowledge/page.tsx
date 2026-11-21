"use client";
import { useState, useRef, useEffect } from "react";
import { 
  Library, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  RefreshCw, 
  AlertTriangle, 
  Sparkles, 
  ArrowRight, 
  Trash2, 
  Plus, 
  AlertCircle, 
  FileUp, 
  HardDrive 
} from "lucide-react";
import Link from "next/link";
import { useTeacherContext } from "@/components/teacher/TeacherProvider";
import { getTeacherAuthHeaders } from "@/lib/auth";

const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_HTTP || "http://localhost:8000";

interface DocumentMeta {
  name: string;
  chunks: number;
  subject: string;
}

export default function KnowledgePage() {
  const { department, year } = useTeacherContext();
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "warning" | "error";
    message: string;
  } | null>(null);
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [stats, setStats] = useState({ totalDocs: 0, totalChunks: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [docToDelete, setDocToDelete] = useState<DocumentMeta | null>(null);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const getCleanSubjectKey = () => {
    return (department && year) ? `${department}_${year}`.replace(/\s+/g, "_").toLowerCase() : "global";
  };

  const fetchDocuments = async () => {
    setRefreshing(true);
    try {
      const subjectKey = getCleanSubjectKey();
      const res = await fetch(`${BACKEND_HTTP}/api/rag/documents?subject_key=${subjectKey}`, {
        headers: getTeacherAuthHeaders()
      });
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

  const uploadFile = async (file: File) => {
    setUploading(true);
    setNotification(null);

    const formData = new FormData();
    formData.append("file", file);
    const subjectKey = getCleanSubjectKey();
    formData.append("subject_key", subjectKey);

    try {
      const res = await fetch(`${BACKEND_HTTP}/api/rag/upload`, {
        method: "POST",
        headers: getTeacherAuthHeaders(),
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 409 || (data.detail && data.detail.toLowerCase().includes("already present"))) {
        setNotification({
          type: "warning",
          message: `PDF "${file.name}" is already present in this subject knowledge base.`
        });
      } else if (res.ok) {
        setNotification({
          type: "success",
          message: `Knowledge base built successfully from "${file.name}" (${data.chunks_added || "all"} chunks indexed).`
        });
        await fetchDocuments();
      } else {
        setNotification({
          type: "error",
          message: data.detail || `Error uploading and indexing "${file.name}".`
        });
      }
    } catch (err) {
      console.error(err);
      setNotification({
        type: "error",
        message: "Error connecting to backend server during upload."
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    for (const file of files) {
      await uploadFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        await uploadFile(file);
      }
    }
  };

  const handleDeletePermanent = async () => {
    if (!docToDelete) return;
    setDeleting(true);
    try {
      const subjectKey = getCleanSubjectKey();
      const res = await fetch(
        `${BACKEND_HTTP}/api/rag/document?filename=${encodeURIComponent(docToDelete.name)}&subject_key=${encodeURIComponent(subjectKey)}`,
        { method: "DELETE", headers: getTeacherAuthHeaders() }
      );
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setNotification({
          type: "success",
          message: `Permanently deleted "${docToDelete.name}" (${data.deleted_chunks ?? docToDelete.chunks} chunks removed).`
        });
        setDocToDelete(null);
        await fetchDocuments();
      } else {
        setNotification({
          type: "error",
          message: data.detail || "Failed to permanently delete document."
        });
      }
    } catch (err) {
      console.error("Delete error:", err);
      setNotification({
        type: "error",
        message: "Error communicating with server while deleting document."
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleClearKnowledgeBase = async () => {
    setDeleting(true);
    try {
      const subjectKey = getCleanSubjectKey();
      const res = await fetch(`${BACKEND_HTTP}/api/rag/clear/${encodeURIComponent(subjectKey)}`, {
        method: "DELETE",
        headers: getTeacherAuthHeaders()
      });
      if (res.ok) {
        setNotification({
          type: "success",
          message: `Permanently cleared all documents and knowledge base for ${department} • ${year}.`
        });
        setClearModalOpen(false);
        await fetchDocuments();
      } else {
        setNotification({
          type: "error",
          message: "Failed to clear knowledge base."
        });
      }
    } catch (err) {
      console.error("Clear error:", err);
      setNotification({
        type: "error",
        message: "Error communicating with server while clearing knowledge base."
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-[#171717] flex items-center gap-3">
            <Library className="w-8 h-8 text-[#C8102E]" /> Syllabus & RAG Hub
          </h1>
          <p className="text-[#555555] mt-1">Manage, upload, and permanently remove knowledge base materials for {department} • {year}.</p>
        </div>
      </header>

      {/* Notifications */}
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
          {/* Upload / Add PDF Card */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`bg-white border-2 border-dashed p-8 rounded-3xl shadow-sm text-center transition-all ${
              isDragging 
                ? "border-[#C8102E] bg-rose-50/50 scale-[1.01]" 
                : "border-[#E5E5E5] hover:border-gray-300"
            }`}
          >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed transition ${
              isDragging ? "bg-rose-100 text-[#C8102E] border-[#C8102E]" : "bg-[#F8F8F8] text-[#888888] border-[#E5E5E5]"
            }`}>
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-lg text-[#171717] mb-1">Upload Subject Material (PDF)</h3>
            <p className="text-sm text-[#555555] mb-6 max-w-md mx-auto">
              Drag and drop your PDF here, or click below. The vector knowledge base builds automatically and assessments are generated exclusively from your uploaded materials.
            </p>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileInputChange} 
              accept=".pdf,.txt,.docx"
              multiple
            />
            
            <div className="flex items-center justify-center gap-3">
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="bg-[#171717] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-black transition shadow-sm disabled:opacity-50"
              >
                {uploading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5 text-emerald-400" />}
                {uploading ? "Building Knowledge Base..." : "Add Subject PDF"}
              </button>
            </div>
          </div>

          {/* Indexed Subject Material List */}
          <div className="bg-white border border-[#E5E5E5] rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-[#E5E5E5] flex justify-between items-center bg-[#F8F8F8]">
              <div>
                <h3 className="font-bold text-[#171717] flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-gray-500" />
                  Indexed Subject Material
                </h3>
                <p className="text-xs text-gray-500">Only questions from these documents will be generated for exams.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="text-xs font-bold text-white bg-[#C8102E] hover:bg-rose-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
                  title="Add new PDF"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add PDF
                </button>
                <button 
                  onClick={fetchDocuments}
                  disabled={refreshing}
                  className="text-xs font-bold text-[#555555] bg-white px-2.5 py-1.5 rounded-lg border border-[#E5E5E5] flex items-center gap-1 hover:bg-gray-50 transition"
                  title="Refresh document list"
                >
                  <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>
            </div>

            <div className="divide-y divide-[#E5E5E5]">
              {documents.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  No subject PDFs indexed yet. Click <strong>Add Subject PDF</strong> above to automatically build the knowledge base.
                </div>
              ) : (
                documents.map((doc, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between hover:bg-[#F8F8F8] transition group">
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-[#C8102E]" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-[#171717] truncate">{doc.name}</p>
                        <p className="text-[10px] text-[#737373] uppercase tracking-wider mt-0.5">
                          {doc.chunks} chunks • Subject: {doc.subject}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/teacher/ai?doc=${encodeURIComponent(doc.name)}`}
                        className="text-xs font-bold text-[#C8102E] bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Generate Questions</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>

                      <button
                        onClick={() => setDocToDelete(doc)}
                        title="Delete PDF permanently"
                        aria-label={`Permanently delete ${doc.name}`}
                        className="text-xs font-bold text-gray-400 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition"
                      >
                        <Trash2 className="w-4 h-4 text-gray-400 group-hover:text-gray-500 hover:!text-rose-600" />
                        <span className="hidden md:inline">Delete</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar RAG Info */}
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
            
            <div className="mt-6 space-y-2">
              <button 
                onClick={fetchDocuments}
                className="w-full bg-white text-[#171717] font-bold py-2 rounded-xl text-sm hover:bg-gray-200 transition"
              >
                Sync Index
              </button>

              {documents.length > 0 && (
                <button 
                  onClick={() => setClearModalOpen(true)}
                  className="w-full bg-red-950/40 text-rose-300 border border-rose-900/50 font-bold py-2 rounded-xl text-xs hover:bg-red-900/60 transition flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Entire Knowledge Base
                </button>
              )}
            </div>
          </div>

          <div className="bg-white border border-[#E5E5E5] p-5 rounded-3xl text-xs space-y-2 text-gray-600">
            <p className="font-bold text-[#171717] flex items-center gap-1">
              💡 Grounding Guarantee
            </p>
            <p>
              When a subject PDF is uploaded, all assessments (MCQ, Oral Viva, Written Text) are restricted <strong>exclusively</strong> to that document's content.
            </p>
            <p>
              Deleting a document <strong>permanently wipes</strong> its chunks from the FAISS vector database and deletes the physical file. If you ever need it back, simply re-upload it.
            </p>
          </div>
        </div>
      </div>

      {/* Delete Single PDF Confirmation Modal */}
      {docToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-[#C8102E] flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Delete PDF Permanently?</h3>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                Are you sure you want to permanently delete <strong className="text-gray-900">{docToDelete.name}</strong>?
              </p>
              <div className="mt-3 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 space-y-1">
                <p className="font-semibold flex items-center gap-1.5 text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  Permanent Removal
                </p>
                <p>
                  This action will permanently remove all <strong>{docToDelete.chunks} indexed chunks</strong> from the FAISS vectorstore and erase the document file. Questions will no longer be generated from this material.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                disabled={deleting}
                className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePermanent}
                disabled={deleting}
                className="px-5 py-2.5 text-sm font-bold text-white bg-[#C8102E] hover:bg-rose-700 rounded-xl transition flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Entire Knowledge Base Modal */}
      {clearModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-[#C8102E] flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Clear Entire Knowledge Base?</h3>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                This will delete <strong>ALL {stats.totalDocs} uploaded PDFs</strong> and clear all {stats.totalChunks} indexed chunks for <strong>{department} • {year}</strong>.
              </p>
              <div className="mt-3 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-1">
                <p className="font-semibold flex items-center gap-1.5 text-rose-900">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  Irreversible Action
                </p>
                <p>
                  All embeddings and indexed vectors will be wiped from disk. You will need to re-upload subject materials to ground upcoming exams.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setClearModalOpen(false)}
                disabled={deleting}
                className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearKnowledgeBase}
                disabled={deleting}
                className="px-5 py-2.5 text-sm font-bold text-white bg-[#C8102E] hover:bg-rose-700 rounded-xl transition flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? "Clearing..." : "Clear Everything"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
