"use client";

import type { DiffRow, DiffStats } from "@/lib/diff";

/** Unified line diff of the current vs proposed HTML. */
export default function DiffView({
  rows,
  stats,
}: {
  rows: DiffRow[];
  stats: DiffStats;
}) {
  return (
    <div className="rounded border border-slate-200 bg-white">
      <div className="flex items-center gap-3 border-b border-slate-200 px-3 py-2 text-xs">
        <span className="font-medium text-slate-600">Changes</span>
        <span className="rounded bg-green-100 px-1.5 py-0.5 font-mono text-green-700">
          +{stats.added}
        </span>
        <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-red-700">
          −{stats.removed}
        </span>
        <span className="font-mono text-slate-400">{stats.unchanged} unchanged</span>
      </div>
      <div className="max-h-[420px] overflow-auto font-mono text-[11px] leading-relaxed">
        {rows.map((r, idx) => (
          <div
            key={idx}
            className={
              r.kind === "add"
                ? "bg-green-50 text-green-900"
                : r.kind === "del"
                  ? "bg-red-50 text-red-900"
                  : "text-slate-500"
            }
          >
            <span className="inline-block w-5 select-none text-center text-slate-400">
              {r.kind === "add" ? "+" : r.kind === "del" ? "−" : ""}
            </span>
            <span className="whitespace-pre-wrap break-all">{r.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
