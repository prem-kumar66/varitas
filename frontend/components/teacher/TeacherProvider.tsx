"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type TeacherContextType = {
  department: string | null;
  year: string | null;
  section: string | null;
  isGuest: boolean;
  isAdmin: boolean;
  assignedDepartment: string | null;
  setDepartment: (dept: string) => void;
  setYear: (yr: string) => void;
  setSection: (sec: string) => void;
  clearContext: () => void;
};

const TeacherContext = createContext<TeacherContextType | undefined>(undefined);

export function TeacherProvider({ children }: { children: ReactNode }) {
  const [department, setDepartmentState] = useState<string | null>(null);
  const [year, setYearState] = useState<string | null>(null);
  const [section, setSectionState] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [assignedDepartment, setAssignedDepartment] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const authStr = localStorage.getItem("veritas_teacher_auth");
      let facultyDept: string | null = null;
      let facultyGuest = false;

      if (authStr) {
        try {
          const auth = JSON.parse(authStr);
          if (auth.department) {
            facultyDept = auth.department.toLowerCase();
            setAssignedDepartment(facultyDept);
          }
          if (auth.is_guest) {
            facultyGuest = true;
            setIsGuest(true);
          }
          if (auth.is_admin || auth.email?.toLowerCase() === "admin@anurag.edu.in") {
            setIsAdmin(true);
          }
        } catch (e) {}
      }

      const storedDept = localStorage.getItem("veritas_teacher_dept");
      const storedYear = localStorage.getItem("veritas_teacher_year");
      const storedSection = localStorage.getItem("veritas_teacher_section");
      
      // If regular faculty, lock department to assigned facultyDept
      if (facultyDept && !facultyGuest) {
        setDepartmentState(facultyDept);
        localStorage.setItem("veritas_teacher_dept", facultyDept);
      } else if (storedDept) {
        setDepartmentState(storedDept);
      }

      if (storedYear) setYearState(storedYear);
      if (storedSection) setSectionState(storedSection);
    }
  }, []);

  const setDepartment = (dept: string) => {
    // Admin and guests can switch freely. Regular faculty is locked to assigned department.
    if (!isAdmin && !isGuest && assignedDepartment && assignedDepartment !== "all" && assignedDepartment.toLowerCase() !== dept.toLowerCase()) {
      console.warn(`Department locked to assigned department: ${assignedDepartment}`);
      return;
    }
    const cleanDept = dept.toLowerCase();
    setDepartmentState(cleanDept);
    localStorage.setItem("veritas_teacher_dept", cleanDept);
  };

  const setYear = (yr: string) => {
    setYearState(yr);
    localStorage.setItem("veritas_teacher_year", yr);
  };

  const setSection = (sec: string) => {
    setSectionState(sec);
    localStorage.setItem("veritas_teacher_section", sec);
  };

  const clearContext = () => {
    setDepartmentState(null);
    setYearState(null);
    setSectionState(null);
    setIsGuest(false);
    setAssignedDepartment(null);
    localStorage.removeItem("veritas_teacher_dept");
    localStorage.removeItem("veritas_teacher_year");
    localStorage.removeItem("veritas_teacher_section");
    localStorage.removeItem("veritas_teacher_auth");
  };

  return (
    <TeacherContext.Provider
      value={{
        department,
        year,
        section,
        isGuest,
        isAdmin,
        assignedDepartment,
        setDepartment,
        setYear,
        setSection,
        clearContext,
      }}
    >
      {children}
    </TeacherContext.Provider>
  );
}

export function useTeacherContext() {
  const context = useContext(TeacherContext);
  if (context === undefined) {
    throw new Error("useTeacherContext must be used within a TeacherProvider");
  }
  return context;
}
