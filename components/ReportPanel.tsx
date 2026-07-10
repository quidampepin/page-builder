"use client";

import { useMemo, useState } from "react";
import { Btn, Spinner } from "./ui";
import { buildReportHtml, printReport, type ReportSection } from "@/lib/report";
import { downloadText, slugify } from "@/lib/download";
import type { Lang } from "@/lib/types";

interface Slice {
  feedbackAnalysis?: string;
  analytics?: string;
  userTasks?: string;
  heuristics?: string;
  reportSummary?: string;
  loadingReport?: boolean;
}

export default function ReportPanel({
  lang,
  title,
  url,
  state,
  patch,
}: {
  lang: Lang;
  title: string;
  url: string;
  state: Slice;
  patch: (p: Partial<Slice>) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const available = [
    state.feedbackAnalysis && "feedback analysis",
    state.analytics && "analytics",
    state.userTasks && "user tasks",
    state.heuristics && "heuristics",
  ].filter(Boolean) as string[];

  const sections = useMemo<ReportSection[]>(() => {
    const s: ReportSection[] = [];
    if (state.reportSummary) s.push({ heading: "Executive summary", markdown: state.reportSummary });
    if (state.feedbackAnalysis) s.push({ heading: "User feedback analysis", markdown: state.feedbackAnalysis });
    if (state.analytics) s.push({ heading: "Analytics assessment", markdown: state.analytics });
    if (state.userTasks) s.push({ heading: "User tasks", markdown: state.userTasks });
    if (state.heuristics) s.push({ heading: "Heuristic evaluation", markdown: state.heuristics });
    return s;
  }, [state.reportSummary, state.feedbackAnalysis, state.analytics, state.userTasks, state.heuristics]);

  const html = useMemo(
    () =>
      sections.length
        ? buildReportHtml({
            title: title || "Page",
            url: url || undefined,
            lang,
            generatedAt: new Date().toLocaleString(),
            sections,
          })
        : "",
    [sections, title, url, lang],
  );

  const slug = slugify(title || "page");

  async function genSummary() {
    patch({ loadingReport: true });
    setError(null);
    try {
      const res = await fetch("/api/report-summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pageTitle: title,
          url: url || undefined,
          feedbackAnalysis: state.feedbackAnalysis,
          analytics: state.analytics,
          userTasks: state.userTasks,
          heuristics: state.heuristics,
          lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Summary failed (${res.status})`);
      patch({ reportSummary: data.markdown, loadingReport: false });
    } catch (e) {
      patch({ loadingReport: false });
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-600 dark:text-slate-300">
          {available.length ? `Includes: ${available.join(", ")}.` : "No insights gathered yet — run Feedback, Analytics, User tasks, or Heuristics first."}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Btn onClick={genSummary} disabled={state.loadingReport || available.length === 0}>
          {state.reportSummary ? "Regenerate summary" : "Generate executive summary"}
        </Btn>
        <Btn variant="ghost" onClick={() => html && downloadText(`${slug}-ux-report.html`, html, "text/html")} disabled={!html}>
          Download HTML
        </Btn>
        <Btn variant="ghost" onClick={() => html && printReport(html)} disabled={!html}>
          Download PDF
        </Btn>
      </div>

      {error && <div className="rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}
      {state.loadingReport && <Spinner label="Writing executive summary…" />}

      {html ? (
        <iframe
          title="report preview"
          className="min-h-0 w-full flex-1 rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700"
          srcDoc={html}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
          The report preview will appear here once you have at least one insight.
        </div>
      )}
    </div>
  );
}
