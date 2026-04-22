import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GO GROUP | 放課後等デイサービス管理",
  description: "GO GROUP 放課後等デイサービス・児童発達支援 管理システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
