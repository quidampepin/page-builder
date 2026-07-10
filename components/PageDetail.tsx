"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import Markdown from "./Markdown";
import BuilderPanel from "./BuilderPanel";
import PageAndIA from "./PageAndIA";
import FeedbackPanel from "./FeedbackPanel";
import AnalyticsPanel from "./AnalyticsPanel";
import ReportPanel from "./ReportPanel";
import { Btn, Spinner, DownloadMd, Card } from "./ui";
import { compose } from "@/lib/gcweb/compose";
import { slugify } from "@/lib/download";
import type { CrawlResult, PageNode } from "@/lib/types";
import type { PageState } from "@/app/page";
import type { BuilderAppState, BuilderHistory, Lang } from "@/lib/builder-types";

type Tab = "pageia" | "feedback" | "analytics" | "tasks" | "heuristics" | "build" | "report";

const TABS: { id: Tab; label: string }[] = [
  { id: "pageia", label: "Page & IA" },
  { id: "feedback", label: "Feedback" },
  { id: "analytics", label: "Analytics" },
  { id: "tasks", label: "User tasks" },
  { id: "heuristics", label: "Heuristics" },
  { id: "build", label: "Build" },
  { id: "report", label: "Report" },
];

export default function PageDetail({
  crawl,
  crawling,
  onCrawl,
  onStartBlank,
  selectedKey,
  onSelect,
  node,
  state,
  patch,
  lang,
  builderState,
  builderHistory,
  onBuilderStateChange,
  onBuilderHistoryChange,
}: {
  crawl: CrawlResult | null;
  crawling: boolean;
  onCrawl: (url: string, depth: number) => void;
  onStartBlank: () => void;
  selectedKey: string | null;
  onSelect: (url: string) => void;
  node: PageNode | null;
  state: PageState;
  patch: (p: Partial<PageState>) => void;
  lang: Lang;
  builderState?: BuilderAppState;
  builderHistory?: BuilderHistory;
  onBuilderStateChange: Dispatch<SetStateAction<BuilderAppState>>;
  onBuilderHistoryChange: Dispatch<SetStateAction<BuilderHistory>>;
}) {
  const [tab, setTab] = useState<Tab>("pageia");
  const [error, setError] = useState<string | null>(null);

  // The "current working page" = the builder's active content when present,
  // else the fetched page. This is what all analysis runs against.
  const bLang = builderState?.lang ?? lang;
  const activeContent =
    builderState?.pages[bLang]?.content || state.content?.content || "";
  const activeTitle =
    builderState?.pages[bLang]?.title || state.content?.title || node?.title || "New page";
  const activeUrl = node?.url || "";
  const slug = slugify(activeTitle);

  const activeComposed = useMemo(() => {
    if (activeContent) return compose({ title: activeTitle, content: activeContent, lang: bLang });
    return state.content?.composed || "";
  }, [activeContent, activeTitle, bLang, state.content?.composed]);

  async function runUserTasks() {
    if (!activeContent) return;
    patch({ loadingUserTasks: true });
    setError(null);
    try {
      const res = await fetch("/api/user-tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pages: [{ title: activeTitle, url: activeUrl, content: activeContent }],
          feedbackThemes: state.feedbackAnalysis,
          analyticsThemes: state.analytics,
          lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);
      patch({ userTasks: data.markdown, loadingUserTasks: false });
    } catch (e) {
      patch({ loadingUserTasks: false });
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function runHeuristics() {
    if (!activeContent) return;
    patch({ loadingHeuristics: true });
    setError(null);
    try {
      const res = await fetch("/api/heuristics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: activeTitle,
          url: activeUrl,
          content: activeContent,
          feedbackThemes: state.feedbackAnalysis,
          analyticsThemes: state.analytics,
          userTasks: state.userTasks,
          lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);
      patch({ heuristics: data.markdown, loadingHeuristics: false });
    } catch (e) {
      patch({ loadingHeuristics: false });
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const hasPage = Boolean(node);

  return (
    <div className="flex h-full flex-col">
      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 dark:border-slate-700 dark:bg-slate-900">
        {TABS.map((t) => {
          const disabled = t.id !== "pageia" && !hasPage;
          return (
            <button
              key={t.id}
              onClick={() => !disabled && setTab(t.id)}
              disabled={disabled}
              className={`relative whitespace-nowrap px-3 py-2.5 text-sm transition ${
                tab === t.id
                  ? "font-semibold text-slate-900 after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-canada dark:text-white"
                  : "text-slate-500 hover:text-slate-800 disabled:opacity-30 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Panels */}
      {tab === "pageia" ? (
        <div className="min-h-0 flex-1">
          <PageAndIA
            crawl={crawl}
            crawling={crawling}
            onCrawl={onCrawl}
            onStartBlank={onStartBlank}
            selectedKey={selectedKey}
            onSelect={onSelect}
            activeComposed={activeComposed}
          />
        </div>
      ) : tab === "build" ? (
        <div className="min-h-0 flex-1">
          {builderState && builderHistory ? (
            <BuilderPanel
              state={builderState}
              setState={onBuilderStateChange}
              history={builderHistory}
              setHistory={onBuilderHistoryChange}
              originalTitle={state.content?.title ?? activeTitle}
              originalContent={state.content?.content ?? ""}
              originalLang={lang}
              evidence={{
                feedbackAnalysis: state.feedbackAnalysis,
                heuristics: state.heuristics,
                userTasks: state.userTasks,
                analytics: state.analytics,
              }}
            />
          ) : (
            <div className="p-4"><Spinner label="Preparing the builder…" /></div>
          )}
        </div>
      ) : tab === "report" ? (
        <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-4 dark:bg-slate-950">
          <ReportPanel lang={lang} title={activeTitle} url={activeUrl} state={state} patch={patch} />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-4 dark:bg-slate-950">
          {tab === "feedback" && (
            <FeedbackPanel lang={lang} url={activeUrl} slug={slug} state={state} patch={patch} />
          )}
          {tab === "analytics" && (
            <AnalyticsPanel
              lang={lang}
              url={activeUrl}
              title={activeTitle}
              slug={slug}
              feedbackThemes={state.feedbackAnalysis}
              state={state}
              patch={patch}
            />
          )}
          {tab === "tasks" && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Btn onClick={runUserTasks} disabled={state.loadingUserTasks || !activeContent}>
                  Generate user tasks
                </Btn>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {[state.feedbackAnalysis && "feedback", state.analytics && "analytics"].filter(Boolean).join(" + ") || "no evidence yet"}{" "}
                  folded in.
                </span>
              </div>
              {state.loadingUserTasks && <Spinner label="Writing job stories…" />}
              {state.userTasks && (
                <Card>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">User tasks</span>
                    <DownloadMd name={`${slug}-user-tasks`} source={state.userTasks} />
                  </div>
                  <Markdown source={state.userTasks} />
                </Card>
              )}
            </div>
          )}
          {tab === "heuristics" && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Btn onClick={runHeuristics} disabled={state.loadingHeuristics || !activeContent}>
                  Run heuristic evaluation
                </Btn>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Uses {[state.feedbackAnalysis && "feedback", state.analytics && "analytics", state.userTasks && "user tasks"].filter(Boolean).join(", ") || "the page only"}.
                </span>
              </div>
              {state.loadingHeuristics && <Spinner label="Evaluating…" />}
              {state.heuristics && (
                <Card>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Heuristic evaluation</span>
                    <DownloadMd name={`${slug}-heuristics`} source={state.heuristics} />
                  </div>
                  <Markdown source={state.heuristics} />
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
