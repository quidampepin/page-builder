import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GC Site Auditor",
  description: "Crawl a Canada.ca node, map it, analyze feedback, run heuristics, and rebuild pages with the embedded GC Page Builder.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-screen overflow-hidden font-sans text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
