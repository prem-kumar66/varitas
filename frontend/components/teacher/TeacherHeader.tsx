"use client";
import { useTeacherContext } from "./TeacherProvider";
import { Bell, UserCircle, ChevronRight, RefreshCcw, Lock, ShieldAlert, FileText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function TeacherHeader() {
  const { department, year, section, isGuest, assignedDepartment } = useTeacherContext();
  const router = useRouter();
  const [teacherName, setTeacherName] = useState("Professor");
  const [teacherEmail, setTeacherEmail] = useState("");

  useEffect(() => {
    const auth = localStorage.getItem("veritas_teacher_auth");
    if (auth) {
      try {
        const parsed = JSON.parse(auth);
        if (parsed.teacherName || parsed.name) setTeacherName(parsed.teacherName || parsed.name);
        if (parsed.teacherId || parsed.email) setTeacherEmail(parsed.teacherId || parsed.email);
      } catch (e) {}
    }
  }, []);

  const handleChangeClass = () => {
    if (isGuest) {
      router.push("/teacher/select-department");
    } else {
      router.push("/teacher/select-year");
    }
  };

  return (
    <header className="h-16 bg-white border-b border-[#E5E5E5] flex items-center justify-between px-8 sticky top-0 z-10">
      <div className="flex items-center gap-3 text-sm">
        {department ? (
          <>
            <div className="flex items-center gap-1.5 bg-[#F8F8F8] border border-[#E5E5E5] px-2.5 py-1 rounded-lg">
              <span className="font-bold text-[#171717] uppercase">{department}</span>
              {!isGuest && (
                <span className="flex items-center gap-1 text-[10px] text-[#555555] bg-white border border-[#E5E5E5] px-1.5 py-0.5 rounded font-medium">
                  <Lock className="w-2.5 h-2.5 text-emerald-600" /> Assigned Dept
                </span>
              )}
            </div>

            <ChevronRight className="w-4 h-4 text-[#AAAAAA]" />
            <span className="font-semibold text-[#171717]">{year || "All Years"}</span>
            <ChevronRight className="w-4 h-4 text-[#AAAAAA]" />
            <span className="font-semibold text-[#C8102E]">{section ? `Sec ${section}` : "All Sec"}</span>
            
            <button 
              onClick={handleChangeClass}
              title={isGuest ? "Change Department / Year / Section" : "Change Year / Section (Department is locked to your assignment)"}
              className="ml-2 flex items-center gap-1.5 text-xs font-medium text-[#555555] hover:text-[#171717] bg-[#F8F8F8] px-2.5 py-1 rounded-md border border-[#E5E5E5] transition hover:border-[#171717]"
            >
              <RefreshCcw className="w-3 h-3" /> Change {isGuest ? "Class" : "Year/Sec"}
            </button>
          </>
        ) : (
          <span className="text-[#555555]">No Class Selected</span>
        )}

        {isGuest && (
          <span className="ml-3 inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-2.5 py-1 rounded-full font-semibold">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> Guest Mode (Limited View)
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/teacher/queries"
          className="flex items-center gap-1.5 text-xs font-semibold text-[#555555] hover:text-[#C8102E] bg-[#F8F8F8] hover:bg-rose-50 px-3 py-1.5 rounded-lg border border-[#E5E5E5] hover:border-[#C8102E]/30 transition"
        >
          <FileText className="w-3.5 h-3.5 text-[#C8102E]" /> Domain Shift Queries
        </Link>

        <button className="p-2 text-[#555555] hover:text-[#171717] hover:bg-[#F8F8F8] rounded-full transition">
          <Bell className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 pl-4 border-l border-[#E5E5E5]">
          <UserCircle className="w-8 h-8 text-[#AAAAAA]" />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-[#171717] leading-none">{teacherName}</span>
            <span className="text-[10px] text-[#555555] truncate max-w-[130px]">
              {isGuest ? "Guest Faculty" : teacherEmail || `${department?.toUpperCase()} Faculty`}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
