"use client";
import { useTeacherContext } from "@/components/teacher/TeacherProvider";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, ChevronLeft } from "lucide-react";

export default function SelectSectionPage() {
  const { department, year, setSection } = useTeacherContext();
  const router = useRouter();

  const sections = ["A", "B", "C", "D"];

  const handleSelect = (sec: string) => {
    setSection(sec);
    router.push("/teacher/dashboard");
  };

  const handleBack = () => {
    router.push("/teacher/select-year");
  };

  return (
    <div className="min-h-screen bg-[#F8F8F8] flex flex-col py-16 px-6">
      <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
        <button onClick={handleBack} className="text-sm font-semibold text-[#555555] hover:text-[#171717] flex items-center gap-1 mb-8 self-start">
          <ChevronLeft className="w-4 h-4" /> Back to Years
        </button>

        <header className="mb-12 text-center">
          <p className="text-[#C8102E] font-bold tracking-widest uppercase text-xs mb-2">{department} • {year}</p>
          <h1 className="text-4xl font-extrabold text-[#171717]">Select Section</h1>
          <p className="text-[#555555] mt-2">Choose the section you want to manage.</p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {sections.map((sec, index) => (
            <motion.button
              key={sec}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleSelect(sec)}
              className="bg-white border border-[#E5E5E5] p-6 rounded-2xl hover:border-[#C8102E] hover:shadow-lg transition-all text-center group flex flex-col items-center justify-center gap-3 aspect-square"
            >
              <h3 className="font-extrabold text-3xl text-[#171717]">Section {sec}</h3>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight className="w-5 h-5 text-[#C8102E]" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
