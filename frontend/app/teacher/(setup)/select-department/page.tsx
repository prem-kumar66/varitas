"use client";
import { useEffect } from "react";
import { useTeacherContext } from "@/components/teacher/TeacherProvider";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Laptop, BrainCircuit, Database, Cpu, Zap, Settings, Building2, Network, Cog, ShieldAlert } from "lucide-react";

export default function SelectDepartmentPage() {
  const { setDepartment, assignedDepartment, isGuest } = useTeacherContext();
  const router = useRouter();

  // If regular faculty already has an assigned department, lock and forward directly to year selection
  useEffect(() => {
    if (!isGuest && assignedDepartment) {
      setDepartment(assignedDepartment);
      router.replace("/teacher/select-year");
    }
  }, [assignedDepartment, isGuest, router, setDepartment]);

  // Strictly 10 Allowed Departments: ai, aiml, it, cse, ece, eee, civil, mech, data science, ecm
  const departments = [
    { name: "Computer Science & Engineering", code: "cse", display: "CSE", icon: Laptop },
    { name: "Artificial Intelligence", code: "ai", display: "AI", icon: BrainCircuit },
    { name: "AI & Machine Learning", code: "aiml", display: "AIML", icon: Network },
    { name: "Data Science", code: "data science", display: "Data Science", icon: Database },
    { name: "Information Technology", code: "it", display: "IT", icon: Laptop },
    { name: "Electronics & Communication", code: "ece", display: "ECE", icon: Cpu },
    { name: "Electrical & Electronics", code: "eee", display: "EEE", icon: Zap },
    { name: "Mechanical Engineering", code: "mech", display: "MECH", icon: Cog },
    { name: "Civil Engineering", code: "civil", display: "CIVIL", icon: Building2 },
    { name: "Electronics & Computer Eng.", code: "ecm", display: "ECM", icon: Cpu },
  ];

  const handleSelect = (deptCode: string) => {
    setDepartment(deptCode);
    router.push("/teacher/select-year");
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-4">
      <div className="text-center space-y-2">
        {isGuest && (
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-1 rounded-full font-semibold mb-2">
            <ShieldAlert className="w-4 h-4 text-amber-600" /> Guest Mode: Choose an exploratory department
          </div>
        )}
        <h1 className="text-3xl font-extrabold text-[#171717]">Select Department</h1>
        <p className="text-sm text-[#555555]">
          Select the engineering department you wish to monitor.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {departments.map((dept, idx) => {
          const Icon = dept.icon;
          return (
            <motion.div
              key={dept.code}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              onClick={() => handleSelect(dept.code)}
              className="bg-white border border-[#E5E5E5] hover:border-[#C8102E] p-6 rounded-3xl cursor-pointer hover:shadow-lg transition-all group relative overflow-hidden"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#FFF1F2] text-[#C8102E] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-[#C8102E] tracking-wider uppercase">{dept.display}</span>
              <h3 className="text-lg font-bold text-[#171717] mt-1 group-hover:text-[#C8102E] transition-colors">{dept.name}</h3>
              <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#555555] group-hover:text-[#171717] transition-colors">
                Select Domain <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-[#C8102E]" />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
