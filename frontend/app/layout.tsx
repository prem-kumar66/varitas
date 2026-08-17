import "./globals.css";

export const metadata = {
  title: "Veritas Academic — Student Assessment & Evaluation Platform",
  description: "AI-conducted oral & written student testing with anti-cheat cognitive authenticity verification",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}
