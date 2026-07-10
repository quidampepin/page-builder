"use client";

import { useState } from "react";
import { Btn, Spinner } from "./ui";
import { downloadText, slugify } from "@/lib/download";
import type { PageState } from "@/app/page";
import type { Action, Lang } from "@/lib/types";

const SEV: Record<string, { dot: string; cls: string }> = {
  high: { dot: "🔴", cls: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  medium: { dot: "🟠", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  low: { dot: "🟡", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
};

export default function ActionsPanel({
  lang,
  title,
  url,
  state,
  patch,
  onApplyFix,
}: {
  lang: Lang;
  title: string;
  url: string;
  state: PageState;
  patch: (p: Partial<PageState>) => void;
  onApplyFix: (fix: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const available = [
    state.feedbackAnalysis && "feedback",
    state.analytics && "analytics",
    state.userTasks && "tasks",
    state.heuristics && "heuristics",
    state.seo && "SEO",
    state.doormats && "doormats",
    state.accessibility && "accessibility",
    state.readability && "readability",
  ].filter(Boolean) as string[];

  async function generate() {
    patch({ loadingActions: true });
    setError(null);
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          url,
          feedbackAnalysis: state.feedbackAnalysis,
          analytics: state.analytics,
          userTasks: state.userTasks,
          heuristics: state.heuristics,
          seo: state.seo,
          doormats: state.doormats,
          accessibility: state.accessibility,
          readability: state.readability,
          lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);
      patch({ actions: data.actions as Action[], actionsChecked: {}, loadingActions: false });
    } catch (e) {
      patch({ loadingActions: false });
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const actions = state.actions ?? [];
  const checked = state.actionsChecked ?? {};
  const doneCount = Object.values(checked).filter(Boolean).length;

  function toggle(i: number) {
    patch({ actionsChecked: { ...checked, [i]: !checked[i] } });
  }

  function exportCsv() {
    const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["Done", "Severity", "Effort", "Action", "Sources", "Rationale", "Fix"].map(esc).join(",")];
    actions.forEach((a, i) => {
      rows.push(
        [checked[i] ? "yes" : "", a.severity, a.effort, a.title, (a.sources || []).join("; "), a.rationale, a.fix]
          .map((x) => esc(String(x)))
          .join(","),
      );
    });
    downloadText(`${slugify(title || "page")}-actions.csv`, rows.join("\n"), "text/csv");
  }

  function exportMd() {
    const md =
      `# Action backlog — ${title}\n\n` +
      actions
        .map(
          (a, i) =>
            `${i + 1}. **[${a.severity}/${a.effort}] ${a.title}**\n   - ${a.rationale}\n   - Fix: ${a.fix}\n   - Sources: ${(a.sources || []).join(", ")}`,
        )
        .join("\n");
    downloadText(`${slugify(title || "page")}-actions.md`, md, "text/markdown");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Btn onClick={generate} disabled={state.loadingActions || available.length === 0}>
          {actions.length ? "Regenerate backlog" : "Generate action backlog"}
        </Btn>
        {actions.length > 0 && (
          <>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {doneCount}/{actions.length} done
            </span>
            <button onClick={exportCsv} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">↓ .csv</button>
            <button onClick={exportMd} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">↓ .md</button>
          </>
        )}
        <span className="text-xs text-slate-400">
          {available.length ? `From: ${available.join(", ")}` : "Run assessments first (Feedback, Analytics, Assess)."}
        </span>
      </div>

      {error && <div className="rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}
      {state.loadingActions && <Spinner label="Building the backlog…" />}

      <ul className="space-y-2">
        {actions.map((a, i) => (
          <li
            key={i}
            className={`rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${checked[i] ? "opacity-60" : ""}`}
          >
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={!!checked[i]} onChange={() => toggle(i)} className="mt-1" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${SEV[a.severity]?.cls || SEV.low.cls}`}>
                    {SEV[a.severity]?.dot} {a.severity}
                  </span>
                  <span className="text-[11px] text-slate-400">effort: {a.effort}</span>
                  <span className={`font-medium text-slate-900 dark:text-slate-100 ${checked[i] ? "line-through" : ""}`}>
                    {a.title}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{a.rationale}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400"><span className="font-medium">Fix:</span> {a.fix}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-slate-400">{(a.sources || []).join(" · ")}</span>
                  <button
                    onClick={() => onApplyFix(`${a.title}. ${a.fix}`)}
                    className="rounded-full bg-canada px-2.5 py-0.5 text-[11px] font-medium text-white hover:opacity-90"
                  >
                    Apply this fix →
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
