"use client";

import { useState } from "react";
import Markdown from "./Markdown";
import { Btn, Spinner } from "./ui";
import { readability } from "@/lib/readability";
import { a11yStatic } from "@/lib/a11y-static";
import { nodeLabel } from "@/lib/label";
import { downloadText, slugify } from "@/lib/download";
import type { CrawlResult, PageContent, Lang } from "@/lib/types";

interface Row {
  url: string;
  title: string;
  words: number;
  grade: number;
  a11yScore: number;
  a11ySummary: string;
  links: number;
  error?: string;
}

async function fetchMetrics(url: string, lang: Lang): Promise<Row> {
  try {
    const res = await fetch("/api/page", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, lang }),
    });
    const data = (await res.json()) as PageContent & { error?: string };
    if (!res.ok) throw new Error((data as { error?: string }).error || `Failed (${res.status})`);
    const rd = readability(data.main || data.content || "");
    const a = a11yStatic(data.main || data.content || "");
    const linkCount = (data.main.match(/<a\b[^>]*href=/gi) ?? []).length;
    return {
      url,
      title: data.title || nodeLabel({ url, title: url }),
      words: rd.words,
      grade: rd.gradeLevel,
      a11yScore: a.score,
      a11ySummary: a.summary,
      links: linkCount,
    };
  } catch (e) {
    return { url, title: nodeLabel({ url, title: url }), words: 0, grade: 0, a11yScore: 0, a11ySummary: "—", links: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

export default function SectionPanel({
  crawl,
  lang,
  feedbackThemes,
}: {
  crawl: CrawlResult | null;
  lang: Lang;
  feedbackThemes?: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ia, setIa] = useState<string>("");
  const [loadingIa, setLoadingIa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<keyof Row>("grade");

  async function build() {
    if (!crawl) return;
    setRunning(true);
    setError(null);
    setProgress(0);
    const urls = crawl.nodes.map((n) => n.url).filter(Boolean);
    const out: Row[] = [];
    const CONC = 4;
    let i = 0;
    let done = 0;
    async function worker() {
      while (i < urls.length) {
        const idx = i++;
        out[idx] = await fetchMetrics(urls[idx], lang);
        done += 1;
        setProgress(Math.round((done / urls.length) * 100));
      }
    }
    await Promise.all(new Array(Math.min(CONC, urls.length)).fill(0).map(worker));
    setRows(out.filter(Boolean));
    setRunning(false);
  }

  async function recommendIa() {
    if (rows.length === 0) return;
    setLoadingIa(true);
    setError(null);
    try {
      const res = await fetch("/api/section-ia", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          root: crawl?.root,
          pages: rows.map((r) => ({ title: r.title, url: r.url, wordCount: r.words, readingGrade: r.grade, issues: r.a11ySummary })),
          feedbackThemes,
          lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);
      setIa(data.markdown);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingIa(false);
    }
  }

  function exportCsv() {
    const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Title", "URL", "Words", "Reading grade", "A11y score", "A11y issues", "Links"];
    const lines = [header.map(esc).join(",")];
    for (const r of sorted) {
      lines.push([r.title, r.url, String(r.words), String(r.grade), String(r.a11yScore), r.a11ySummary, String(r.links)].map(esc).join(","));
    }
    downloadText(`${slugify(crawl?.root || "section")}-inventory.csv`, lines.join("\n"), "text/csv");
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sort];
    const bv = b[sort];
    if (typeof av === "number" && typeof bv === "number") return sort === "a11yScore" ? av - bv : bv - av;
    return String(av).localeCompare(String(bv));
  });

  if (!crawl) {
    return (
      <p className="rounded bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        Crawl a section in the Page &amp; IA tab first — the section audit runs metrics across all crawled pages.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Btn onClick={build} disabled={running}>
          {rows.length ? "Rebuild inventory" : `Build inventory (${crawl.nodes.length} pages)`}
        </Btn>
        {running && <Spinner label={`Fetching pages… ${progress}%`} />}
        {rows.length > 0 && (
          <>
            <button onClick={exportCsv} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">↓ inventory .csv</button>
            <Btn variant="ghost" onClick={recommendIa} disabled={loadingIa}>Section IA recommendation</Btn>
          </>
        )}
      </div>

      {error && <div className="rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}
      {loadingIa && <Spinner label="Analyzing section IA…" />}
      {ia && <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"><Markdown source={ia} /></div>}

      {rows.length > 0 && (
        <div className="overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left dark:bg-slate-800">
              <tr>
                {([["title", "Page"], ["words", "Words"], ["grade", "Grade"], ["a11yScore", "A11y"], ["links", "Links"]] as [keyof Row, string][]).map(([k, label]) => (
                  <th key={k} onClick={() => setSort(k)} className="cursor-pointer px-3 py-2 font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300">
                    {label}{sort === k ? " ↓" : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.url} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-1.5">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400" title={r.url}>
                      {r.title}
                    </a>
                    {r.error && <span className="ml-1 text-red-500" title={r.error}>!</span>}
                  </td>
                  <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">{r.words || "—"}</td>
                  <td className="px-3 py-1.5">
                    <span className={r.grade > 11 ? "text-red-600 dark:text-red-400" : r.grade > 8 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
                      {r.grade || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300" title={r.a11ySummary}>{r.a11yScore || "—"}</td>
                  <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">{r.links}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
