"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTeacherContext } from "./TeacherProvider";
import { 
  LayoutDashboard, 
  Users, 
  Bot, 
  ClipboardList, 
  Database, 
  Library, 
  BarChart3, 
  Settings,
  LogOut,
  GraduationCap,
  ShieldCheck
} from "lucide-react";

export function TeacherSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { clearContext } = useTeacherContext();

  const handleLogout = () => {
    clearContext();
    localStorage.removeItem("veritas_teacher_auth");
    router.push("/login/teacher");
  };

  const isAdmin = typeof window !== "undefined" && (() => {
    try {
      const a = JSON.parse(localStorage.getItem("veritas_teacher_auth") || "{}");
      return a.is_admin || a.email?.toLowerCase() === "admin@anurag.edu.in";
    } catch (e) { return false; }
  })();

  const navItems = [
    { name: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
    { name: "Students", href: "/teacher/students", icon: Users },
    { name: "Teacher AI", href: "/teacher/ai", icon: Bot },
    { name: "Evaluations", href: "/teacher/evaluations", icon: ClipboardList },
    { name: "Question Bank", href: "/teacher/questions", icon: Database },
    { name: "Syllabus & RAG", href: "/teacher/knowledge", icon: Library },
    { name: "Analytics", href: "/teacher/analytics", icon: BarChart3 },
    { name: "Domain Queries", href: "/teacher/queries", icon: ClipboardList },
    { name: "Settings", href: "/teacher/settings", icon: Settings },
    ...(isAdmin ? [{ name: "Admin Panel", href: "/teacher/admin", icon: ShieldCheck }] : []),
  ];

  return (
    <aside className="w-64 bg-white border-r border-[#E5E5E5] h-screen flex flex-col fixed left-0 top-0">
      <div className="p-6 border-b border-[#E5E5E5]">
        <Link href="/teacher/dashboard" className="flex items-center gap-2 text-[#171717]">
          <GraduationCap className="w-8 h-8 text-[#C8102E]" />
          <div>
            <h1 className="font-extrabold text-lg leading-tight">VERITAS</h1>
            <p className="text-[10px] uppercase tracking-widest text-[#555555]">Teacher Portal</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-semibold ${
                isActive
                  ? "bg-[#FFF1F2] text-[#C8102E]"
                  : "text-[#555555] hover:bg-[#F8F8F8] hover:text-[#171717]"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "text-[#C8102E]" : "text-[#AAAAAA]"}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#E5E5E5]">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl transition-all text-sm font-semibold text-[#555555] hover:bg-red-50 hover:text-[#C8102E]"
        >
          <LogOut className="w-5 h-5 text-[#AAAAAA] group-hover:text-[#C8102E]" />
          Logout
        </button>
      </div>
    </aside>
  );
}
