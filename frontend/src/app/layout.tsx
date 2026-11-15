import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FlowTrace — Graph AML Intelligence",
  description:
    "High-Speed Anti-Money Laundering Graph Intelligence Platform. Reduce false positives by 85%+ while maintaining 90%+ illicit recall.",
  keywords: [
    "AML",
    "Anti-Money Laundering",
    "Graph ML",
    "FinTech",
    "Compliance",
    "XAI",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}

