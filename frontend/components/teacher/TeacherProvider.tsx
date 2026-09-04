"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type TeacherContextType = {
  department: string | null;
  year: string | null;
  section: string | null;
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedDept = localStorage.getItem("veritas_teacher_dept");
      const storedYear = localStorage.getItem("veritas_teacher_year");
      const storedSection = localStorage.getItem("veritas_teacher_section");
      
      if (storedDept) setDepartmentState(storedDept);
      if (storedYear) setYearState(storedYear);
      if (storedSection) setSectionState(storedSection);
    }
  }, []);

  const setDepartment = (dept: string) => {
    setDepartmentState(dept);
    localStorage.setItem("veritas_teacher_dept", dept);
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
    localStorage.removeItem("veritas_teacher_dept");
    localStorage.removeItem("veritas_teacher_year");
    localStorage.removeItem("veritas_teacher_section");
  };

  return (
    <TeacherContext.Provider
      value={{
        department,
        year,
        section,
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
