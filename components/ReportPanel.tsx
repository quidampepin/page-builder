"use client";

import { useMemo, useState } from "react";
import { Btn, Spinner } from "./ui";
import { buildProReport, printProReport, type PageReportData, type ReportInput } from "@/lib/report-pro";
import { readability } from "@/lib/readability";
import { downloadText, slugify } from "@/lib/download";
import type { PageState } from "@/app/page";
import type { Lang } from "@/lib/builder-types";

export default function ReportPanel({
  lang,
  title,
  url,
  content,
  state,
  patch,
}: {
  lang: Lang;
  title: string;
  url: string;
  content: string;
  state: PageState;
  patch: (p: Partial<PageState>) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const available = [
    state.feedbackAnalysis && "feedback",
    state.analytics && "analytics",
    state.userTasks && "user tasks",
    state.heuristics && "heuristics",
    state.seo && "SEO",
    state.doormats && "doormats",
    state.accessibility && "accessibility",
    content && "readability",
    state.linkCheck && "links",
  ].filter(Boolean) as string[];

  const pageData = useMemo<PageReportData>(() => {
    const brokenMatch = state.linkCheck?.match(/Broken \((\d+)\)/);
    const sections = [
      state.feedbackAnalysis && { heading: "User feedback analysis", markdown: state.feedbackAnalysis },
      state.analytics && { heading: "Analytics assessment", markdown: state.analytics },
      state.userTasks && { heading: "User tasks", markdown: state.userTasks },
      state.heuristics && { heading: "Heuristic evaluation", markdown: state.heuristics },
      state.seo && { heading: "SEO & findability", markdown: state.seo },
      state.doormats && { heading: "Doormats", markdown: state.doormats },
      state.linkCheck && { heading: "Link check", markdown: state.linkCheck },
    ].filter(Boolean) as { heading: string; markdown: string }[];

    return {
      title: title || "Page",
      url,
      readability: content ? readability(content) : undefined,
      beforeGrade: state.content?.content ? readability(state.content.content).gradeLevel : undefined,
      a11y: state.a11yData,
      feedbackCount: state.feedback?.matched.length,
      feedbackQuotes: state.feedback?.matched.slice(0, 6).map((m) => m.comment),
      brokenLinks: brokenMatch ? Number(brokenMatch[1]) : undefined,
      actions: state.actions,
      sections,
    };
  }, [title, url, content, state]);

  const hasAnything = available.length > 0 || Boolean(content);

  const html = useMemo<string>(() => {
    if (!hasAnything) return "";
    const input: ReportInput = {
      title: title || "Page",
      subtitle: url ? `Assessment of ${new URL(url, "https://x").pathname}` : undefined,
      generatedAt: new Date().toLocaleString(),
      lang,
      execSummary: state.reportSummary,
      pages: [pageData],
    };
    return buildProReport(input);
  }, [pageData, title, url, lang, state.reportSummary, hasAnything]);

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
          seo: state.seo,
          doormats: state.doormats,
          accessibility: state.accessibility,
          readability: content ? `Reading grade ${readability(content).gradeLevel}` : undefined,
          links: state.linkCheck,
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
          {available.length ? `Includes: ${available.join(", ")}.` : "Run assessments (Feedback, Analytics, Assess) to fill the report."}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Btn onClick={genSummary} disabled={state.loadingReport || available.length === 0}>
          {state.reportSummary ? "Regenerate summary" : "Generate executive summary"}
        </Btn>
        <Btn variant="ghost" onClick={() => html && downloadText(`${slug}-ux-report.html`, html, "text/html")} disabled={!html}>
          Download HTML
        </Btn>
        <Btn variant="ghost" onClick={() => html && printProReport(html)} disabled={!html}>
          Download PDF
        </Btn>
      </div>

      {error && <div className="rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}
      {state.loadingReport && <Spinner label="Writing executive summary…" />}

      {html ? (
        <iframe
          title="report preview"
          className="min-h-0 w-full flex-1 rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700"
          sandbox="allow-scripts allow-same-origin"
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
