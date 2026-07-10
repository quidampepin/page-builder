"use client";

import { useState } from "react";
import TreeView from "./TreeView";
import SiteMap from "./SiteMap";
import { Btn } from "./ui";
import type { CrawlResult } from "@/lib/types";
import { downloadText, treeToJson, treeToMarkdown } from "@/lib/download";

/**
 * The "Page & IA" tab: search/crawl controls, the information architecture
 * (tree + optional visual map), and a preview of the active page. Crawling is
 * OPTIONAL — you can open a single page or start a blank page to generate from
 * scratch.
 */
export default function PageAndIA({
  crawl,
  crawling,
  onCrawl,
  onStartBlank,
  selectedKey,
  onSelect,
  activeComposed,
}: {
  crawl: CrawlResult | null;
  crawling: boolean;
  onCrawl: (url: string, depth: number) => void;
  onStartBlank: () => void;
  selectedKey: string | null;
  onSelect: (url: string) => void;
  activeComposed: string;
}) {
  const [url, setUrl] = useState(
    "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada.html",
  );
  const [depth, setDepth] = useState(3);
  const [showMap, setShowMap] = useState(false);

  return (
    <div className="flex h-full flex-col">
      {/* Search / crawl bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex min-w-[280px] flex-1 items-center gap-2 rounded-lg border border-slate-300 bg-white px-2 focus-within:border-canada dark:border-slate-700 dark:bg-slate-800">
          <span className="text-slate-400">🔗</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !crawling && url.trim()) onCrawl(url.trim(), depth);
            }}
            placeholder="https://www.canada.ca/en/…"
            className="flex-1 bg-transparent py-1.5 text-sm outline-none dark:text-slate-100"
          />
        </div>
        <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
          Depth
          <select
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {[0, 1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => url.trim() && onCrawl(url.trim(), depth)}
          disabled={crawling}
          className="rounded-md bg-canada px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
        >
          {crawling ? "Crawling…" : "Crawl section"}
        </button>
        <Btn variant="ghost" onClick={() => url.trim() && onCrawl(url.trim(), 0)} disabled={crawling}>
          Open one page
        </Btn>
        <Btn variant="ghost" onClick={onStartBlank}>
          ＋ Blank page
        </Btn>
      </div>

      {/* Body: IA (tree/map) + preview */}
      <div className="flex min-h-0 flex-1">
        {crawl && (
          <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {crawl.nodes.length} page(s) · depth {crawl.depth}
                {crawl.truncated ? ` · capped ${crawl.maxPages}` : ""}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => downloadText("information-architecture.md", treeToMarkdown(crawl), "text/markdown")}
                  className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  IA .md
                </button>
                <button
                  onClick={() => downloadText("information-architecture.json", treeToJson(crawl), "application/json")}
                  className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  .json
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1 border-b border-slate-100 px-2 py-1 dark:border-slate-800">
              <button
                onClick={() => setShowMap(false)}
                className={`rounded px-2 py-0.5 text-xs ${!showMap ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "text-slate-500"}`}
              >
                Tree
              </button>
              <button
                onClick={() => setShowMap(true)}
                className={`rounded px-2 py-0.5 text-xs ${showMap ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "text-slate-500"}`}
              >
                Map
              </button>
            </div>
            {!showMap && (
              <div className="min-h-0 flex-1 overflow-auto p-2">
                <TreeView nodes={crawl.nodes} selected={selectedKey} onSelect={onSelect} />
              </div>
            )}
          </aside>
        )}

        <main className="min-w-0 flex-1 bg-slate-100 dark:bg-slate-950">
          {crawl && showMap ? (
            <SiteMap root={crawl.root} nodes={crawl.nodes} selected={selectedKey} onSelect={onSelect} />
          ) : activeComposed ? (
            <iframe
              title="page preview"
              className="h-full w-full bg-white"
              sandbox="allow-scripts allow-same-origin"
              srcDoc={activeComposed}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-400">
              {crawl
                ? "Select a page from the tree to preview it."
                : "Crawl a section, open one page, or start a blank page to begin."}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
