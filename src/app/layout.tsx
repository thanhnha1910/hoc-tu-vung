import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Học Từ Vựng",
  description:
    "Học từ vựng tiếng Anh với spaced repetition (FSRS) và nhiều dạng học vui như Quizlet.",
  applicationName: "Học Từ Vựng",
  appleWebApp: { capable: true, title: "Học Từ Vựng" },
};

export const viewport: Viewport = {
  themeColor: "#0e1129",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
