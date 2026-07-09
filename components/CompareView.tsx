"use client";

import { useMemo, useState } from "react";
import Markdown from "./Markdown";
import DiffView from "./DiffView";
import { diffLines, diffStats } from "@/lib/diff";
import type { Lang } from "@/lib/builder-types";

/**
 * A reader-friendly illustration of "what the suggestions changed": the
 * original and revised pages rendered side by side, a plain-language change
 * summary (generated on request), and — for those who want it — the raw code
 * diff tucked behind a toggle.
 */
export default function CompareView({
  beforeComposed,
  afterComposed,
  beforeContent,
  afterContent,
  lang,
}: {
  beforeComposed: string;
  afterComposed: string;
  beforeContent: string;
  afterContent: string;
  lang: Lang;
}) {
  const [summary, setSummary] = useState<string>("");
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const { rows, stats } = useMemo(() => {
    const r = diffLines(beforeContent, afterContent);
    return { rows: r, stats: diffStats(r) };
  }, [beforeContent, afterContent]);

  const identical = beforeContent.trim() === afterContent.trim();

  async function summarize() {
    setSummarizing(true);
    setError(null);
    try {
      const res = await fetch("/api/summarize-changes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ before: beforeContent, after: afterContent, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Summarize failed (${res.status})`);
      setSummary(data.markdown);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSummarizing(false);
    }
  }

  return (
    <div className="h-full overflow-auto bg-slate-100 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded bg-green-100 px-1.5 py-0.5 font-mono text-green-700">
            +{stats.added}
          </span>
          <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-red-700">
            −{stats.removed}
          </span>
          <span className="text-slate-500">lines changed</span>
        </div>
        <button
          onClick={summarize}
          disabled={summarizing || identical}
          className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
        >
          {summarizing ? "Summarizing…" : "Explain the changes"}
        </button>
        <button
          onClick={() => setShowDiff((s) => !s)}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          {showDiff ? "Hide code diff" : "Show code diff"}
        </button>
        {identical && (
          <span className="text-sm text-slate-500">
            No changes yet — edit the page to compare.
          </span>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>
      )}

      {summary && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <Markdown source={summary} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <figure className="m-0">
          <figcaption className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-500">
            <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
            Original
          </figcaption>
          <iframe
            title="before"
            className="h-[62vh] w-full rounded-lg border border-slate-200 bg-white shadow-sm"
            sandbox="allow-same-origin"
            srcDoc={beforeComposed || "<p style='padding:1rem;font-family:sans-serif;color:#888'>No original content.</p>"}
          />
        </figure>
        <figure className="m-0">
          <figcaption className="mb-1 flex items-center gap-2 text-xs font-medium text-emerald-600">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Revised
          </figcaption>
          <iframe
            title="after"
            className="h-[62vh] w-full rounded-lg border border-emerald-200 bg-white shadow-sm"
            sandbox="allow-scripts allow-same-origin"
            srcDoc={afterComposed || "<p style='padding:1rem;font-family:sans-serif;color:#888'>No revised content.</p>"}
          />
        </figure>
      </div>

      {showDiff && (
        <div className="mt-4">
          <DiffView rows={rows} stats={stats} />
        </div>
      )}
    </div>
  );
}
