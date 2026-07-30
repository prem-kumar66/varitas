import "./globals.css";

export const metadata = {
  title: "Veritas — Interview Authenticity Intelligence",
  description: "Real-time cognitive authenticity verification for remote interviews",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
