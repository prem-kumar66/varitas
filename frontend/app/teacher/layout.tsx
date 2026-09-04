import { TeacherProvider } from "@/components/teacher/TeacherProvider";

export default function RootTeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <TeacherProvider>
      {children}
    </TeacherProvider>
  );
}
