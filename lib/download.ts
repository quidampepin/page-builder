/**
 * Client-side download helpers used across the auditor so every artifact —
 * the IA/tree, the site map, feedback analysis, user tasks, heuristics, and
 * matched comments — can be saved to disk.
 */

import type { CrawlResult, FeedbackRow, PageNode } from "./types";
import { nodeLabel } from "./label";

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "download"
  );
}

/** Trigger a browser download of arbitrary text content. */
export function downloadText(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Trigger a download from an already-built Blob (e.g. a PNG canvas export). */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Render the crawl tree as an indented Markdown outline (the IA). */
export function treeToMarkdown(result: CrawlResult): string {
  const lines: string[] = [
    `# Information architecture`,
    ``,
    `Root: ${result.root}`,
    `Crawled ${result.nodes.length} page(s), depth ${result.depth}${result.truncated ? ` (capped at ${result.maxPages})` : ""}.`,
    ``,
  ];
  for (const node of result.nodes) {
    const indent = "  ".repeat(node.depth);
    const flag = node.error ? " ⚠️" : "";
    lines.push(`${indent}- [${nodeLabel(node)}](${node.url})${flag}`);
  }
  lines.push("");
  return lines.join("\n");
}

/** The crawl tree as pretty JSON. */
export function treeToJson(result: CrawlResult): string {
  return JSON.stringify(result, null, 2);
}

/** Matched feedback comments as CSV. */
export function feedbackToCsv(rows: FeedbackRow[]): string {
  const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const header = ["URL", "Date", "Comment"];
  const out = [header.map(esc).join(",")];
  for (const r of rows) {
    out.push([esc(r.url), esc(r.date ?? ""), esc(r.comment)].join(","));
  }
  return out.join("\n");
}
