import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GC Page Builder",
  description: "Conversational prototyping for Canada.ca pages.",
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
