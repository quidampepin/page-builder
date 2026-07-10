"use client";

import { useRef, useState } from "react";
import { Btn, Spinner } from "./ui";

interface AxeNode { target: string[] }
interface AxeViolation {
  id: string;
  impact?: string;
  help: string;
  description: string;
  helpUrl: string;
  nodes: AxeNode[];
}

const IMPACT_ORDER: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };
const IMPACT_DOT: Record<string, string> = { critical: "🔴", serious: "🟠", moderate: "🟡", minor: "⚪" };

function toMarkdown(v: AxeViolation[]): string {
  if (v.length === 0)
    return "## Accessibility (axe-core)\n\nNo automated WCAG 2.0/2.1 A/AA violations detected. (Automated checks catch ~30–50% of issues — keyboard and screen-reader testing still needed.)";
  const lines = ["## Accessibility (axe-core)", "", `${v.length} rule(s) with violations:`, ""];
  for (const x of v) {
    lines.push(`- **${(x.impact || "n/a").toUpperCase()}** — ${x.help} (${x.nodes.length} element${x.nodes.length === 1 ? "" : "s"}). ${x.description}`);
  }
  lines.push("", "_Automated checks catch ~30–50% of issues — keyboard and screen-reader testing still needed._");
  return lines.join("\n");
}

/** Minimal shape of the axe object we use. */
interface AxeLike {
  run: (ctx: Document, opts: unknown) => Promise<{ violations: AxeViolation[] }>;
}

export default function AccessibilityCard({
  composed,
  result,
  onResult,
}: {
  composed: string;
  result?: string;
  onResult: (markdown: string, violations: AxeViolation[]) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [violations, setViolations] = useState<AxeViolation[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const iframe = iframeRef.current;
      const win = iframe?.contentWindow as (Window & { axe?: AxeLike }) | undefined;
      const doc = iframe?.contentDocument;
      if (!win || !doc) throw new Error("Cannot access the preview document.");

      // Let external CSS (GCWeb theme) load so colour-contrast is meaningful.
      await new Promise((r) => setTimeout(r, 500));

      // axe validates its context with `instanceof Document`, which fails across
      // realms — so axe must run INSIDE the iframe. Load it into the frame from
      // a CDN (same place the preview already loads the GCWeb theme) and wait
      // for it before running.
      if (!win.axe) {
        await new Promise<void>((resolve, reject) => {
          const sc = doc.createElement("script");
          sc.src = "https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js";
          sc.crossOrigin = "anonymous";
          sc.onload = () => resolve();
          sc.onerror = () => reject(new Error("Could not load axe-core from the CDN (network blocked?)."));
          (doc.head || doc.documentElement).appendChild(sc);
        });
        // Give the just-evaluated library a tick to attach to the frame window.
        await new Promise((r) => setTimeout(r, 50));
      }
      if (!win.axe) throw new Error("axe-core loaded but did not attach to the preview frame.");

      const res = await win.axe.run(doc, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
        resultTypes: ["violations"],
      });
      const v = [...res.violations].sort(
        (a, b) => (IMPACT_ORDER[a.impact || "minor"] ?? 9) - (IMPACT_ORDER[b.impact || "minor"] ?? 9),
      );
      setViolations(v);
      onResult(toMarkdown(v), v);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Btn onClick={run} disabled={running || !composed}>
          {violations || result ? "Re-run check" : "Run check"}
        </Btn>
        {running && <Spinner label="Running axe-core…" />}
      </div>
      {error && <div className="rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}

      {violations && violations.length === 0 && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          No automated WCAG A/AA violations detected. (Automated checks catch ~30–50% — keyboard and
          screen-reader testing still needed.)
        </p>
      )}

      {violations && violations.length > 0 && (
        <ul className="space-y-1.5">
          {violations.map((x) => (
            <li key={x.id} className="rounded-md border border-slate-200 bg-white p-2 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-start gap-2">
                <span>{IMPACT_DOT[x.impact || "minor"] || "⚪"}</span>
                <div>
                  <a href={x.helpUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                    {x.help}
                  </a>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {x.impact} · {x.nodes.length} element{x.nodes.length === 1 ? "" : "s"}
                    {x.nodes[0] ? ` · e.g. ${x.nodes[0].target.join(" ")}` : ""}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Same-origin frame axe is injected into and inspects. Page scripts are
          stripped by sanitizeContent, so the only script that runs is axe. */}
      <iframe
        ref={iframeRef}
        title="a11y-scan"
        aria-hidden
        tabIndex={-1}
        sandbox="allow-scripts allow-same-origin"
        srcDoc={composed}
        style={{ position: "absolute", width: 1024, height: 1, left: -99999, top: -99999, border: 0 }}
      />
    </div>
  );
}
