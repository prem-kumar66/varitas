"use client";
import { useTeacherContext } from "./TeacherProvider";
import { Bell, UserCircle, ChevronRight, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function TeacherHeader() {
  const { department, year, section } = useTeacherContext();
  const router = useRouter();
  const [teacherName, setTeacherName] = useState("Professor");

  useEffect(() => {
    const auth = localStorage.getItem("veritas_teacher_auth");
    if (auth) {
      try {
        const parsed = JSON.parse(auth);
        if (parsed.teacherName) setTeacherName(parsed.teacherName);
      } catch (e) {}
    }
  }, []);

  const handleChangeClass = () => {
    router.push("/teacher/select-department");
  };

  return (
    <header className="h-16 bg-white border-b border-[#E5E5E5] flex items-center justify-between px-8 sticky top-0 z-10">
      <div className="flex items-center gap-2 text-sm">
        {department ? (
          <>
            <span className="font-semibold text-[#171717]">{department}</span>
            <ChevronRight className="w-4 h-4 text-[#AAAAAA]" />
            <span className="font-semibold text-[#171717]">{year}</span>
            <ChevronRight className="w-4 h-4 text-[#AAAAAA]" />
            <span className="font-semibold text-[#C8102E]">Section {section}</span>
            
            <button 
              onClick={handleChangeClass}
              className="ml-4 flex items-center gap-1.5 text-xs font-medium text-[#555555] hover:text-[#171717] bg-[#F8F8F8] px-2.5 py-1 rounded-md border border-[#E5E5E5]"
            >
              <RefreshCcw className="w-3 h-3" /> Change
            </button>
          </>
        ) : (
          <span className="text-[#555555]">No Class Selected</span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 text-[#555555] hover:text-[#171717] hover:bg-[#F8F8F8] rounded-full transition">
          <Bell className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 pl-4 border-l border-[#E5E5E5]">
          <UserCircle className="w-8 h-8 text-[#AAAAAA]" />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-[#171717] leading-none">{teacherName}</span>
            <span className="text-[10px] text-[#555555]">Faculty</span>
          </div>
        </div>
      </div>
    </header>
  );
}
