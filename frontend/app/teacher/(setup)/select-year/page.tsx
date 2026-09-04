"use client";
import { useTeacherContext } from "@/components/teacher/TeacherProvider";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, ChevronLeft } from "lucide-react";

export default function SelectYearPage() {
  const { department, setYear } = useTeacherContext();
  const router = useRouter();

  const years = [
    { name: "1st Year", code: "1" },
    { name: "2nd Year", code: "2" },
    { name: "3rd Year", code: "3" },
    { name: "4th Year", code: "4" },
  ];

  const handleSelect = (yr: string) => {
    setYear(yr);
    router.push("/teacher/select-section");
  };

  const handleBack = () => {
    router.push("/teacher/select-department");
  };

  return (
    <div className="min-h-screen bg-[#F8F8F8] flex flex-col py-16 px-6">
      <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
        <button onClick={handleBack} className="text-sm font-semibold text-[#555555] hover:text-[#171717] flex items-center gap-1 mb-8 self-start">
          <ChevronLeft className="w-4 h-4" /> Back to Departments
        </button>

        <header className="mb-12 text-center">
          <p className="text-[#C8102E] font-bold tracking-widest uppercase text-xs mb-2">{department} • Veritas Academic</p>
          <h1 className="text-4xl font-extrabold text-[#171717]">Select Academic Year</h1>
          <p className="text-[#555555] mt-2">Choose the year you want to manage.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {years.map((yr, index) => (
            <motion.button
              key={yr.code}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleSelect(yr.name)}
              className="bg-white border border-[#E5E5E5] p-6 rounded-2xl hover:border-[#C8102E] hover:shadow-lg transition-all text-left flex items-center justify-between group"
            >
              <div>
                <h3 className="font-bold text-lg text-[#171717]">{yr.name}</h3>
              </div>
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
