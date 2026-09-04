"use client";
import { useTeacherContext } from "@/components/teacher/TeacherProvider";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Laptop, BrainCircuit, Database, Cpu, Zap, Settings, Building2 } from "lucide-react";

export default function SelectDepartmentPage() {
  const { setDepartment } = useTeacherContext();
  const router = useRouter();

  const departments = [
    { name: "Computer Science & Engineering", code: "CSE", icon: Laptop },
    { name: "Artificial Intelligence & Machine Learning", code: "AI & ML", icon: BrainCircuit },
    { name: "Computer Science & Data Science", code: "CSE-DS", icon: Database },
    { name: "Electronics & Communication Engineering", code: "ECE", icon: Cpu },
    { name: "Electrical & Electronics Engineering", code: "EEE", icon: Zap },
    { name: "Mechanical Engineering", code: "ME", icon: Settings },
    { name: "Civil Engineering", code: "CE", icon: Building2 },
  ];

  const handleSelect = (dept: string) => {
    setDepartment(dept);
    router.push("/teacher/select-year");
  };

  return (
    <div className="min-h-screen bg-[#F8F8F8] flex flex-col py-16 px-6">
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
        <header className="mb-12 text-center">
          <p className="text-[#C8102E] font-bold tracking-widest uppercase text-xs mb-2">Veritas Academic • Teacher Portal</p>
          <h1 className="text-4xl font-extrabold text-[#171717]">Select Your Department</h1>
          <p className="text-[#555555] mt-2">Choose the department you want to manage.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept, index) => (
            <motion.button
              key={dept.code}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleSelect(dept.code)}
              className="bg-white border border-[#E5E5E5] p-6 rounded-2xl hover:border-[#C8102E] hover:shadow-lg transition-all text-left group relative"
            >
              <div className="w-12 h-12 bg-[#FFF1F2] rounded-xl flex items-center justify-center mb-4 text-[#C8102E] group-hover:scale-110 transition-transform">
                <dept.icon className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-[#171717] leading-tight mb-1">{dept.name}</h3>
              <p className="text-xs font-semibold text-[#555555] group-hover:text-[#C8102E] transition-colors">{dept.code}</p>
              
              <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight className="w-5 h-5 text-[#C8102E]" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
