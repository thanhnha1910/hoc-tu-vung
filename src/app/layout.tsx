import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import "./globals.css";

// Variable display serif with Vietnamese diacritics + optical-size axis
const fraunces = Fraunces({
  subsets: ["latin", "vietnamese"],
  variable: "--font-display",
  display: "swap",
  axes: ["SOFT", "opsz"],
});

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
    <html lang="vi" className={fraunces.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
