"use client";

import { useMemo, useState } from "react";
import Markdown from "./Markdown";
import AccessibilityCard from "./AccessibilityCard";
import { Btn, Spinner, DownloadMd } from "./ui";
import { readability, gradeBand } from "@/lib/readability";
import type { PageState } from "@/app/page";
import type { Lang } from "@/lib/builder-types";

function Row({
  title,
  desc,
  done,
  children,
  defaultOpen,
}: {
  title: string;
  desc: string;
  done?: boolean;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <span className="text-slate-400">{open ? "▾" : "▸"}</span>
        <span className="font-medium text-slate-900 dark:text-slate-100">{title}</span>
        {done && <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">done</span>}
        <span className="ml-2 hidden truncate text-xs text-slate-400 sm:inline">{desc}</span>
      </button>
      {open && <div className="border-t border-slate-100 p-4 dark:border-slate-800">{children}</div>}
    </div>
  );
}

export default function AssessPanel({
  lang,
  url,
  title,
  slug,
  activeContent,
  activeComposed,
  state,
  patch,
}: {
  lang: Lang;
  url: string;
  title: string;
  slug: string;
  activeContent: string;
  activeComposed: string;
  state: PageState;
  patch: (p: Partial<PageState>) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const hasContent = Boolean(activeContent);

  async function runLLM(
    endpoint: string,
    extra: Record<string, unknown>,
    onDone: (md: string) => void,
    setLoading: (v: boolean) => void,
  ) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          url,
          content: activeContent,
          feedbackThemes: state.feedbackAnalysis,
          analyticsThemes: state.analytics,
          lang,
          ...extra,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);
      onDone(data.markdown);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      onDone("");
    } finally {
      setLoading(false);
    }
  }

  // --- Readability (client) ---
  const rd = useMemo(() => (activeContent ? readability(activeContent) : null), [activeContent]);
  const rdBefore = useMemo(
    () => (state.content?.content ? readability(state.content.content) : null),
    [state.content?.content],
  );
  function saveReadability() {
    if (!rd) return;
    const md =
      `## Readability\n\n` +
      `| Metric | Value |\n|---|---|\n` +
      `| Reading grade (Flesch-Kincaid) | ${rd.gradeLevel} |\n` +
      `| Words | ${rd.words} |\n` +
      `| Avg words/sentence | ${rd.avgWordsPerSentence} |\n` +
      `| Complex words | ${rd.complexWordPct}% |\n` +
      `| Passive-voice hits | ${rd.passiveHits} |\n` +
      `| Reading time | ~${Math.max(1, Math.round(rd.readingSeconds / 60))} min |\n` +
      (lang === "fr" ? `\n_Flesch-Kincaid is English-calibrated; treat the grade as indicative for French._` : "");
    patch({ readability: md });
  }

  // --- Links (client extract -> server check) ---
  async function runLinks() {
    if (!activeContent) return;
    patch({ loadingLinks: true });
    setError(null);
    try {
      const links: string[] = [];
      if (typeof DOMParser !== "undefined") {
        const doc = new DOMParser().parseFromString(`<div>${activeContent}</div>`, "text/html");
        doc.querySelectorAll("a[href]").forEach((a) => {
          const href = a.getAttribute("href") || "";
          if (/^https?:\/\//i.test(href)) links.push(href);
        });
      }
      const res = await fetch("/api/check-links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ links }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);
      const broken = (data.results as { url: string; ok: boolean; status: number; note?: string; redirectedTo?: string }[])
        .filter((r) => r.note !== "skipped (external)" && !r.ok);
      const md =
        `## Link check\n\nChecked ${data.checked} on-domain link(s); ${data.skipped} external skipped.\n\n` +
        (broken.length === 0
          ? "No broken on-domain links found."
          : `Broken (${broken.length}):\n\n` +
            broken.map((b) => `- ${b.status || b.note} — ${b.url}`).join("\n"));
      patch({ linkCheck: md, loadingLinks: false });
    } catch (e) {
      patch({ loadingLinks: false });
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-3">
      {!hasContent && (
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          No page content yet. Select a crawled page, open one, or build a page first.
        </p>
      )}
      {error && <div className="rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}

      <Row title="Readability" desc="Plain-language grade & metrics" done={!!state.readability} defaultOpen>
        {rd ? (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded px-2 py-1 font-semibold ${
                  gradeBand(rd.gradeLevel).tone === "good"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                    : gradeBand(rd.gradeLevel).tone === "ok"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                }`}
              >
                Grade {rd.gradeLevel} · {gradeBand(rd.gradeLevel).label}
              </span>
              {rdBefore && rdBefore.gradeLevel !== rd.gradeLevel && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  was {rdBefore.gradeLevel} → now {rd.gradeLevel}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-slate-600 dark:text-slate-300 sm:grid-cols-3">
              <span>{rd.words} words</span>
              <span>{rd.avgWordsPerSentence} words/sentence</span>
              <span>{rd.complexWordPct}% complex</span>
              <span>{rd.passiveHits} passive hits</span>
              <span>~{Math.max(1, Math.round(rd.readingSeconds / 60))} min read</span>
            </div>
            <Btn variant="ghost" onClick={saveReadability}>Save to insights</Btn>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No content to measure.</p>
        )}
      </Row>

      <Row title="Accessibility (axe-core)" desc="Automated WCAG A/AA" done={!!state.accessibility}>
        <AccessibilityCard
          composed={activeComposed}
          result={state.accessibility}
          onResult={(md) => patch({ accessibility: md })}
        />
      </Row>

      <Row title="Link check" desc="On-domain outbound links" done={!!state.linkCheck}>
        <div className="space-y-2">
          <Btn onClick={runLinks} disabled={state.loadingLinks || !hasContent}>Check links</Btn>
          {state.loadingLinks && <Spinner label="Checking links…" />}
          {state.linkCheck && <Markdown source={state.linkCheck} />}
        </div>
      </Row>

      <Row title="User tasks" desc="Job stories & scenarios" done={!!state.userTasks}>
        <RunCard
          loading={!!state.loadingUserTasks}
          result={state.userTasks}
          fileslug={`${slug}-user-tasks`}
          onRun={() =>
            runLLM(
              "/api/user-tasks",
              { pages: [{ title, url, content: activeContent }] },
              (md) => patch({ userTasks: md }),
              (v) => patch({ loadingUserTasks: v }),
            )
          }
          disabled={!hasContent}
        />
      </Row>

      <Row title="Heuristics" desc="Balanced UX review" done={!!state.heuristics}>
        <RunCard
          loading={!!state.loadingHeuristics}
          result={state.heuristics}
          fileslug={`${slug}-heuristics`}
          onRun={() =>
            runLLM(
              "/api/heuristics",
              { userTasks: state.userTasks },
              (md) => patch({ heuristics: md }),
              (v) => patch({ loadingHeuristics: v }),
            )
          }
          disabled={!hasContent}
        />
      </Row>

      <Row title="SEO & findability" desc="Metadata, JSON-LD, gaps" done={!!state.seo}>
        <RunCard
          loading={!!state.loadingSeo}
          result={state.seo}
          fileslug={`${slug}-seo`}
          onRun={() => runLLM("/api/seo", {}, (md) => patch({ seo: md }), (v) => patch({ loadingSeo: v }))}
          disabled={!hasContent}
        />
      </Row>

      <Row title="Doormats" desc="Topic-page link titles" done={!!state.doormats}>
        <RunCard
          loading={!!state.loadingDoormats}
          result={state.doormats}
          fileslug={`${slug}-doormats`}
          onRun={() => runLLM("/api/doormats", {}, (md) => patch({ doormats: md }), (v) => patch({ loadingDoormats: v }))}
          disabled={!hasContent}
        />
      </Row>
    </div>
  );
}

function RunCard({
  loading,
  result,
  onRun,
  disabled,
  fileslug,
}: {
  loading: boolean;
  result?: string;
  onRun: () => void;
  disabled?: boolean;
  fileslug: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Btn onClick={onRun} disabled={loading || disabled}>
          {result ? "Re-run" : "Run"}
        </Btn>
        {result && <DownloadMd name={fileslug} source={result} />}
        {loading && <Spinner label="Working…" />}
      </div>
      {result && <Markdown source={result} />}
    </div>
  );
}
