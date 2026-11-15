import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="dark">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
