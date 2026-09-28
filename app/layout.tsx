import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "مُحسّن البرومبت العربي",
  description: "نموذج أولي لتحليل وتحسين تكلفة البرومبتات العربية",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
