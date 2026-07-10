"use client";

import { useRef, useState } from "react";
import Markdown from "./Markdown";
import { Btn, Spinner, DownloadMd, Card } from "./ui";
import { matchFeedback, extractAllComments } from "@/lib/csv";
import { downloadText, feedbackToCsv } from "@/lib/download";
import type { FeedbackResult, Lang } from "@/lib/types";

interface Slice {
  feedback?: FeedbackResult;
  feedbackCsvName?: string;
  feedbackAnalysis?: string;
  loadingFeedbackAnalysis?: boolean;
}

export default function FeedbackPanel({
  lang,
  url,
  slug,
  state,
  patch,
}: {
  lang: Lang;
  url: string;
  slug: string;
  state: Slice;
  patch: (p: Partial<Slice>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rawText, setRawText] = useState<string>("");
  const [filterUrl, setFilterUrl] = useState<boolean>(Boolean(url));
  const [subtree, setSubtree] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function parse(text: string, useUrl: boolean, sub: boolean) {
    const fb = useUrl && url ? matchFeedback(text, url, sub) : extractAllComments(text);
    patch({ feedback: fb });
  }

  async function onFile(file: File) {
    setError(null);
    const text = await file.text();
    setRawText(text);
    patch({ feedbackCsvName: file.name });
    parse(text, filterUrl && Boolean(url), subtree);
  }

  async function analyze() {
    const fb = state.feedback;
    if (!fb || fb.matched.length === 0) return;
    patch({ loadingFeedbackAnalysis: true });
    try {
      const res = await fetch("/api/analyze-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          comments: fb.matched.map((m) => ({ comment: m.comment, date: m.date })),
          url: url || undefined,
          lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Analyze failed (${res.status})`);
      patch({ feedbackAnalysis: data.markdown, loadingFeedbackAnalysis: false });
    } catch (e) {
      patch({ loadingFeedbackAnalysis: false });
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const fb = state.feedback;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Upload a feedback CSV (e.g. a page-feedback export). Columns are auto-detected —
        it just needs a comment column, plus a URL column if you want to filter to this page.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <Btn onClick={() => fileRef.current?.click()}>Upload feedback CSV</Btn>
        {state.feedbackCsvName && (
          <span className="text-xs text-slate-500 dark:text-slate-400">{state.feedbackCsvName}</span>
        )}
        {url && (
          <>
            <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={filterUrl}
                onChange={(e) => {
                  setFilterUrl(e.target.checked);
                  if (rawText) parse(rawText, e.target.checked, subtree);
                }}
              />
              Filter to this page
            </label>
            {filterUrl && (
              <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={subtree}
                  onChange={(e) => {
                    setSubtree(e.target.checked);
                    if (rawText) parse(rawText, filterUrl, e.target.checked);
                  }}
                />
                Include child pages
              </label>
            )}
          </>
        )}
      </div>

      {error && <div className="rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}

      {fb && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          {fb.note ? (
            <span className="rounded bg-amber-50 p-2 text-amber-800 dark:bg-amber-950 dark:text-amber-300">{fb.note}</span>
          ) : (
            <span>
              <b>{fb.matched.length}</b> comment(s){filterUrl && url ? " for this page" : ""} out of{" "}
              {fb.totalRows} rows.
            </span>
          )}
          {fb.matched.length > 0 && (
            <>
              <Btn variant="ghost" onClick={analyze} disabled={state.loadingFeedbackAnalysis}>
                Analyze comments
              </Btn>
              <button
                onClick={() => downloadText(`${slug}-comments.csv`, feedbackToCsv(fb.matched), "text/csv")}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                ↓ comments .csv
              </button>
            </>
          )}
        </div>
      )}

      {fb && fb.matched.length > 0 && (
        <ul className="max-h-56 space-y-1.5 overflow-auto">
          {fb.matched.slice(0, 200).map((f, i) => (
            <li key={i} className="rounded-md border border-slate-200 bg-white p-2 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <span className="text-slate-800 dark:text-slate-200">{f.comment}</span>
              {f.date && <span className="ml-2 text-xs text-slate-400">{f.date}</span>}
            </li>
          ))}
        </ul>
      )}

      {state.loadingFeedbackAnalysis && <Spinner label="Analyzing feedback…" />}
      {state.feedbackAnalysis && (
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Feedback analysis</span>
            <DownloadMd name={`${slug}-feedback-analysis`} source={state.feedbackAnalysis} />
          </div>
          <Markdown source={state.feedbackAnalysis} />
        </Card>
      )}
    </div>
  );
}
