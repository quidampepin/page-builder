"use client";

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import PageDetail from "@/components/PageDetail";
import AutoMode from "@/components/AutoMode";
import ThemeToggle from "@/components/ThemeToggle";
import type { Action, CrawlResult, FeedbackResult, Lang, PageContent } from "@/lib/types";
import {
  seededBuilderState,
  initialBuilderState,
  initialBuilderHistory,
  type BuilderAppState,
  type BuilderHistory,
} from "@/lib/builder-types";
import type { PageNode } from "@/lib/types";

const SCRATCH = "__scratch__";

/** Everything the tool has gathered for one page, cached by key (URL or scratch). */
export interface PageState {
  content?: PageContent;
  loadingContent?: boolean;
  feedback?: FeedbackResult;
  feedbackCsvName?: string;
  feedbackAnalysis?: string;
  loadingFeedbackAnalysis?: boolean;
  analyticsCsvName?: string;
  analytics?: string;
  loadingAnalytics?: boolean;
  userTasks?: string;
  loadingUserTasks?: boolean;
  heuristics?: string;
  loadingHeuristics?: boolean;
  reportSummary?: string;
  loadingReport?: boolean;
  seo?: string;
  loadingSeo?: boolean;
  doormats?: string;
  loadingDoormats?: boolean;
  accessibility?: string;
  a11yData?: { critical: number; serious: number; moderate: number; minor: number; total: number };
  loadingAccessibility?: boolean;
  readability?: string;
  linkCheck?: string;
  loadingLinks?: boolean;
  actions?: Action[];
  loadingActions?: boolean;
  actionsChecked?: Record<number, boolean>;
  builder?: { state: BuilderAppState; history: BuilderHistory };
  error?: string;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `${res.status} ${res.statusText}`);
  return data as T;
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("en");
  const [crawl, setCrawl] = useState<CrawlResult | null>(null);
  const [crawling, setCrawling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [pages, setPages] = useState<Record<string, PageState>>({});
  const [mode, setMode] = useState<"manual" | "auto">("manual");

  const patch = useCallback((key: string, p: Partial<PageState>) => {
    setPages((prev) => ({ ...prev, [key]: { ...prev[key], ...p } }));
  }, []);

  const patchActive = useCallback(
    (p: Partial<PageState>) => {
      if (activeKey) patch(activeKey, p);
    },
    [activeKey, patch],
  );

  const activeState: PageState = (activeKey && pages[activeKey]) || {};

  const selectedNode: PageNode | null = useMemo(() => {
    if (!activeKey) return null;
    if (activeKey === SCRATCH) {
      const bs = pages[SCRATCH]?.builder?.state;
      const title = bs ? bs.pages[bs.lang]?.title || "New page" : "New page";
      return { url: "", title, depth: 0, parentUrl: null, children: [] };
    }
    return crawl?.nodes.find((n) => n.url === activeKey) ?? null;
  }, [activeKey, crawl, pages]);

  const selectNode = useCallback(
    async (url: string) => {
      setActiveKey(url);
      const existing = pages[url];
      if (existing?.content || existing?.loadingContent) return;
      patch(url, { loadingContent: true, error: undefined });
      try {
        const content = await postJson<PageContent>("/api/page", { url, lang });
        patch(url, {
          content,
          loadingContent: false,
          builder: {
            state: seededBuilderState(content.title, content.content, lang),
            history: initialBuilderHistory,
          },
        });
      } catch (e) {
        patch(url, { loadingContent: false, error: e instanceof Error ? e.message : String(e) });
      }
    },
    [pages, patch, lang],
  );

  async function runCrawl(url: string, depth: number) {
    setCrawling(true);
    setError(null);
    try {
      const result = await postJson<CrawlResult>("/api/crawl", { url, depth });
      setCrawl(result);
      setPages((prev) => {
        const next: Record<string, PageState> = {};
        if (prev[SCRATCH]) next[SCRATCH] = prev[SCRATCH];
        return next;
      });
      if (result.nodes.length) selectNode(result.nodes[0].url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCrawling(false);
    }
  }

  function startBlank() {
    setPages((prev) => ({
      ...prev,
      [SCRATCH]: { builder: { state: initialBuilderState(lang), history: initialBuilderHistory } },
    }));
    setActiveKey(SCRATCH);
  }

  const setBuilderState: Dispatch<SetStateAction<BuilderAppState>> = useCallback(
    (updater) => {
      if (!activeKey) return;
      setPages((prev) => {
        const cur = prev[activeKey]?.builder;
        if (!cur) return prev;
        const next =
          typeof updater === "function"
            ? (updater as (s: BuilderAppState) => BuilderAppState)(cur.state)
            : updater;
        return { ...prev, [activeKey]: { ...prev[activeKey], builder: { ...cur, state: next } } };
      });
    },
    [activeKey],
  );

  const setBuilderHistory: Dispatch<SetStateAction<BuilderHistory>> = useCallback(
    (updater) => {
      if (!activeKey) return;
      setPages((prev) => {
        const cur = prev[activeKey]?.builder;
        if (!cur) return prev;
        const next =
          typeof updater === "function"
            ? (updater as (h: BuilderHistory) => BuilderHistory)(cur.history)
            : updater;
        return { ...prev, [activeKey]: { ...prev[activeKey], builder: { ...cur, history: next } } };
      });
    },
    [activeKey],
  );

  return (
    <div className="flex h-screen flex-col bg-slate-100 dark:bg-slate-950">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <span className="flex h-6 items-center justify-center rounded-md bg-canada px-1.5 text-[11px] font-bold text-white">
            Canada.ca
          </span>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">UX tool</div>
        </div>
        <div className="ml-2 flex overflow-hidden rounded-md border border-slate-300 text-sm dark:border-slate-700">
          {(["manual", "auto"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 ${
                mode === m
                  ? "bg-canada text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {m === "manual" ? "Manual" : "Auto"}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex overflow-hidden rounded-md border border-slate-300 text-sm dark:border-slate-700">
          {(["en", "fr"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-2.5 py-1.5 ${
                lang === l
                  ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                  : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <ThemeToggle />
      </header>

      {error && (
        <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-800">
            ×
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1">
        {mode === "auto" ? (
          <AutoMode lang={lang} />
        ) : (
          <PageDetail
            crawl={crawl}
            crawling={crawling}
            onCrawl={runCrawl}
            onStartBlank={startBlank}
            selectedKey={activeKey}
            onSelect={selectNode}
            node={selectedNode}
            state={activeState}
            patch={patchActive}
            lang={lang}
            builderState={activeState.builder?.state}
            builderHistory={activeState.builder?.history}
            onBuilderStateChange={setBuilderState}
            onBuilderHistoryChange={setBuilderHistory}
          />
        )}
      </div>
    </div>
  );
}
