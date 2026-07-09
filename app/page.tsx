"use client";

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import TreeView from "@/components/TreeView";
import SiteMap from "@/components/SiteMap";
import PageDetail from "@/components/PageDetail";
import type { CrawlResult, FeedbackResult, Lang, PageContent } from "@/lib/types";
import {
  seededBuilderState,
  initialBuilderHistory,
  type BuilderAppState,
  type BuilderHistory,
} from "@/lib/builder-types";
import { downloadText, treeToJson, treeToMarkdown } from "@/lib/download";

/** Everything the auditor has gathered for one page, cached by URL. */
export interface PageState {
  content?: PageContent;
  loadingContent?: boolean;
  feedback?: FeedbackResult;
  loadingFeedback?: boolean;
  feedbackAnalysis?: string;
  loadingFeedbackAnalysis?: boolean;
  userTasks?: string;
  loadingUserTasks?: boolean;
  heuristics?: string;
  loadingHeuristics?: boolean;
  /** Embedded page-builder session, seeded from the page content on load. */
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
  const [url, setUrl] = useState(
    "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada.html",
  );
  const [depth, setDepth] = useState(3);
  const [lang, setLang] = useState<Lang>("en");

  const [crawl, setCrawl] = useState<CrawlResult | null>(null);
  const [crawling, setCrawling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);

  const [pages, setPages] = useState<Record<string, PageState>>({});

  const patch = useCallback((u: string, p: Partial<PageState>) => {
    setPages((prev) => ({ ...prev, [u]: { ...prev[u], ...p } }));
  }, []);

  const selectedNode = useMemo(
    () => crawl?.nodes.find((n) => n.url === selected) ?? null,
    [crawl, selected],
  );
  const selectedState = (selected && pages[selected]) || {};

  // --- Crawl ---
  async function runCrawl() {
    setCrawling(true);
    setError(null);
    setSelected(null);
    try {
      const result = await postJson<CrawlResult>("/api/crawl", { url, depth });
      setCrawl(result);
      setPages({});
      if (result.nodes.length) selectPage(result.nodes[0].url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCrawling(false);
    }
  }

  // --- Select a page: fetch its content once, then seed the builder session ---
  const selectPage = useCallback(
    async (u: string) => {
      setSelected(u);
      const existing = pages[u];
      if (existing?.content || existing?.loadingContent) return;
      patch(u, { loadingContent: true, error: undefined });
      try {
        const content = await postJson<PageContent>("/api/page", { url: u, lang });
        patch(u, {
          content,
          loadingContent: false,
          builder: {
            state: seededBuilderState(content.title, content.content, lang),
            history: initialBuilderHistory,
          },
        });
      } catch (e) {
        patch(u, { loadingContent: false, error: e instanceof Error ? e.message : String(e) });
      }
    },
    [pages, patch, lang],
  );

  // --- Builder session setters, bound to the selected URL ---
  const setBuilderState: Dispatch<SetStateAction<BuilderAppState>> = useCallback(
    (updater) => {
      if (!selected) return;
      setPages((prev) => {
        const cur = prev[selected]?.builder;
        if (!cur) return prev;
        const next =
          typeof updater === "function"
            ? (updater as (s: BuilderAppState) => BuilderAppState)(cur.state)
            : updater;
        return { ...prev, [selected]: { ...prev[selected], builder: { ...cur, state: next } } };
      });
    },
    [selected],
  );

  const setBuilderHistory: Dispatch<SetStateAction<BuilderHistory>> = useCallback(
    (updater) => {
      if (!selected) return;
      setPages((prev) => {
        const cur = prev[selected]?.builder;
        if (!cur) return prev;
        const next =
          typeof updater === "function"
            ? (updater as (h: BuilderHistory) => BuilderHistory)(cur.history)
            : updater;
        return { ...prev, [selected]: { ...prev[selected], builder: { ...cur, history: next } } };
      });
    },
    [selected],
  );

  // --- Feedback ---
  async function loadFeedback(subtree: boolean) {
    if (!selected) return;
    patch(selected, { loadingFeedback: true });
    try {
      const feedback = await postJson<FeedbackResult>("/api/feedback", { url: selected, subtree });
      patch(selected, { feedback, loadingFeedback: false });
    } catch (e) {
      patch(selected, {
        loadingFeedback: false,
        feedback: {
          url: selected,
          subtree,
          matched: [],
          totalRows: 0,
          columns: { url: null, comment: null, date: null },
          note: e instanceof Error ? e.message : String(e),
        },
      });
    }
  }

  async function analyzeFeedback() {
    if (!selected) return;
    const fb = pages[selected]?.feedback;
    if (!fb || fb.matched.length === 0) return;
    patch(selected, { loadingFeedbackAnalysis: true });
    try {
      const { markdown } = await postJson<{ markdown: string }>("/api/analyze-feedback", {
        comments: fb.matched.map((m) => ({ comment: m.comment, date: m.date })),
        url: selected,
        lang,
      });
      patch(selected, { feedbackAnalysis: markdown, loadingFeedbackAnalysis: false });
    } catch (e) {
      patch(selected, { loadingFeedbackAnalysis: false });
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // --- User tasks ---
  async function userTasks() {
    if (!selected) return;
    const st = pages[selected];
    if (!st?.content) return;
    patch(selected, { loadingUserTasks: true });
    try {
      const { markdown } = await postJson<{ markdown: string }>("/api/user-tasks", {
        pages: [{ title: st.content.title, url: selected, content: st.content.content }],
        feedbackThemes: st.feedbackAnalysis,
        lang,
      });
      patch(selected, { userTasks: markdown, loadingUserTasks: false });
    } catch (e) {
      patch(selected, { loadingUserTasks: false });
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // --- Heuristics ---
  async function heuristics() {
    if (!selected) return;
    const st = pages[selected];
    if (!st?.content) return;
    patch(selected, { loadingHeuristics: true });
    try {
      const { markdown } = await postJson<{ markdown: string }>("/api/heuristics", {
        title: st.content.title,
        url: selected,
        content: st.content.content,
        feedbackThemes: st.feedbackAnalysis,
        lang,
      });
      patch(selected, { heuristics: markdown, loadingHeuristics: false });
    } catch (e) {
      patch(selected, { loadingHeuristics: false });
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function downloadIa(kind: "md" | "json") {
    if (!crawl) return;
    if (kind === "md") downloadText("information-architecture.md", treeToMarkdown(crawl), "text/markdown");
    else downloadText("information-architecture.json", treeToJson(crawl), "application/json");
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-2 pr-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-canada text-[11px] font-bold text-white">
            GC
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900">Site Auditor</div>
            <div className="text-[11px] text-slate-400">crawl · analyze · rebuild</div>
          </div>
        </div>

        <div className="flex min-w-[320px] flex-1 items-center gap-2 rounded-lg border border-slate-300 bg-white px-2 focus-within:border-canada focus-within:ring-2 focus-within:ring-red-100">
          <span className="text-slate-400">🔗</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !crawling) runCrawl();
            }}
            placeholder="https://www.canada.ca/en/…"
            className="flex-1 bg-transparent py-1.5 text-sm outline-none"
          />
        </div>

        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          Depth
          <select
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            {[0, 1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <div className="flex overflow-hidden rounded-md border border-slate-300 text-sm">
          {(["en", "fr"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-2.5 py-1.5 ${lang === l ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        <button
          onClick={runCrawl}
          disabled={crawling}
          className="rounded-md bg-canada px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
        >
          {crawling ? "Crawling…" : "Crawl"}
        </button>
        {crawl && (
          <button
            onClick={() => setShowMap((s) => !s)}
            className={`rounded-md border px-3 py-1.5 text-sm transition ${
              showMap
                ? "border-slate-800 bg-slate-800 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            {showMap ? "◧ Detail" : "▤ Map"}
          </button>
        )}
      </header>

      {error && (
        <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-800">
            ×
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Left: tree */}
        <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
          {crawl ? (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
                <span className="text-xs text-slate-500">
                  {crawl.nodes.length} page(s) · depth {crawl.depth}
                  {crawl.truncated ? ` · capped ${crawl.maxPages}` : ""}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => downloadIa("md")}
                    title="Download the information architecture as a Markdown outline"
                    className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100"
                  >
                    IA .md
                  </button>
                  <button
                    onClick={() => downloadIa("json")}
                    title="Download the crawl tree as JSON"
                    className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100"
                  >
                    .json
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-2">
                <TreeView nodes={crawl.nodes} selected={selected} onSelect={selectPage} />
              </div>
            </>
          ) : (
            <div className="p-4 text-sm text-slate-500">
              <p className="mb-2 font-medium text-slate-700">Start an audit</p>
              Enter a Canada.ca URL and press <span className="font-medium">Crawl</span> to map the node
              and the pages beneath it.
            </div>
          )}
        </aside>

        {/* Middle/right */}
        <main className="min-w-0 flex-1 overflow-hidden">
          {showMap && crawl ? (
            <SiteMap root={crawl.root} nodes={crawl.nodes} selected={selected} onSelect={selectPage} />
          ) : selectedNode ? (
            <PageDetail
              key={selectedNode.url}
              node={selectedNode}
              state={selectedState}
              appLang={lang}
              builderState={selectedState.builder?.state}
              builderHistory={selectedState.builder?.history}
              onBuilderStateChange={setBuilderState}
              onBuilderHistoryChange={setBuilderHistory}
              onLoadFeedback={loadFeedback}
              onAnalyzeFeedback={analyzeFeedback}
              onUserTasks={userTasks}
              onHeuristics={heuristics}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              {crawl ? "Select a page to inspect." : "No crawl yet."}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
