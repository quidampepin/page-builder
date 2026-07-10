import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Canada.ca UX tool",
  description:
    "Audit and rebuild Canada.ca pages — crawl or start blank, analyze feedback and analytics, generate user tasks, run heuristics, propose fixes, and export a report.",
};

// Applied before hydration so there's no light/dark flash on load.
const noFlashTheme = `(function(){try{var t=localStorage.getItem('ccuxt-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
      </head>
      <body className="h-screen overflow-hidden font-sans text-neutral-900 antialiased dark:text-neutral-100">
        {children}
      </body>
    </html>
  );
}
