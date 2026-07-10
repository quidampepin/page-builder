"use client";

import { useRef, useState } from "react";
import Markdown from "./Markdown";
import { Btn, Spinner, DownloadMd, Card } from "./ui";
import type { Lang } from "@/lib/types";

interface Slice {
  analyticsCsvName?: string;
  analytics?: string;
  loadingAnalytics?: boolean;
}

export default function AnalyticsPanel({
  lang,
  url,
  title,
  slug,
  feedbackThemes,
  state,
  patch,
}: {
  lang: Lang;
  url: string;
  title: string;
  slug: string;
  feedbackThemes?: string;
  state: Slice;
  patch: (p: Partial<Slice>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    const text = await file.text();
    setCsv(text);
    patch({ analyticsCsvName: file.name });
  }

  async function assess() {
    if (!csv.trim()) {
      setError("Upload an analytics CSV first.");
      return;
    }
    patch({ loadingAnalytics: true });
    try {
      const res = await fetch("/api/analyze-analytics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv, url: url || undefined, pageTitle: title, feedbackThemes, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Assess failed (${res.status})`);
      patch({ analytics: data.markdown, loadingAnalytics: false });
    } catch (e) {
      patch({ loadingAnalytics: false });
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Upload an analytics CSV for this page or section (visits, exits, time on page, internal
        search terms, task success, etc.). The tool reads whatever columns you have and returns a
        concise assessment.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <Btn onClick={() => fileRef.current?.click()}>Upload analytics CSV</Btn>
        {state.analyticsCsvName && (
          <span className="text-xs text-slate-500 dark:text-slate-400">{state.analyticsCsvName}</span>
        )}
        {csv && (
          <Btn variant="ghost" onClick={assess} disabled={state.loadingAnalytics}>
            Assess analytics
          </Btn>
        )}
        {feedbackThemes && (
          <span className="text-xs text-slate-500 dark:text-slate-400">Feedback themes folded in.</span>
        )}
      </div>

      {error && <div className="rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}
      {state.loadingAnalytics && <Spinner label="Assessing analytics…" />}
      {state.analytics && (
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Analytics assessment</span>
            <DownloadMd name={`${slug}-analytics`} source={state.analytics} />
          </div>
          <Markdown source={state.analytics} />
        </Card>
      )}
    </div>
  );
}
