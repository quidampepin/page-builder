/**
 * Minimal, dependency-free CSV parsing + IRCC feedback matching.
 *
 * The feedback CSV is maintained by hand and its exact columns aren't known
 * ahead of time, so we AUTO-DETECT which column holds the page URL, which
 * holds the comment, and which holds the date. Detection is by header-name
 * heuristics with a content-based fallback (a column that mostly looks like
 * URLs wins the URL slot).
 *
 * Matching a page to its comments is by URL. We compare normalized paths so
 * trailing slashes, protocol, and the ?/# tails don't cause misses. For a
 * subtree match we also include any row whose URL path starts with the
 * page's path.
 */

import type { FeedbackRow, FeedbackResult } from "./types";

/** RFC-4180-ish parser: handles quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  // Strip a UTF-8 BOM if present.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      // swallow — \n handles the row break
    } else {
      field += ch;
    }
  }
  // Last field/row (if the file doesn't end in a newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function normPath(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://x${s.startsWith("/") ? "" : "/"}${s}`);
    let p = u.pathname.toLowerCase();
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    return p;
  } catch {
    return null;
  }
}

function looksLikeUrl(s: string): boolean {
  const t = s.trim();
  return /^https?:\/\//i.test(t) || (t.startsWith("/") && t.length > 1);
}

const URL_HINTS = ["url", "page", "link", "adresse", "lien", "uri"];
const COMMENT_HINTS = [
  "comment",
  "commentaire",
  "feedback",
  "details",
  "détails",
  "what",
  "problem",
  "problème",
  "text",
  "message",
  "reason",
  "raison",
  "tell us",
];
const DATE_HINTS = ["date", "time", "timestamp", "day", "jour", "when"];

function pickColumn(
  headers: string[],
  hints: string[],
): number | null {
  const lower = headers.map((h) => h.toLowerCase().trim());
  // Exact-ish hint match, longest hint first for specificity.
  for (const hint of [...hints].sort((a, b) => b.length - a.length)) {
    const idx = lower.findIndex((h) => h.includes(hint));
    if (idx !== -1) return idx;
  }
  return null;
}

export interface DetectedColumns {
  url: number | null;
  comment: number | null;
  date: number | null;
  headers: string[];
}

export function detectColumns(rows: string[][]): DetectedColumns {
  const headers = rows[0] ?? [];
  const body = rows.slice(1);

  let url = pickColumn(headers, URL_HINTS);
  let comment = pickColumn(headers, COMMENT_HINTS);
  const date = pickColumn(headers, DATE_HINTS);

  // Content fallback for URL: the column whose cells most look like URLs.
  if (url === null && body.length) {
    let best = -1;
    let bestScore = 0;
    for (let c = 0; c < headers.length; c++) {
      let hits = 0;
      let seen = 0;
      for (const r of body.slice(0, 50)) {
        if (r[c] === undefined) continue;
        seen++;
        if (looksLikeUrl(r[c])) hits++;
      }
      const score = seen ? hits / seen : 0;
      if (score > bestScore && score >= 0.5) {
        bestScore = score;
        best = c;
      }
    }
    if (best !== -1) url = best;
  }

  // Content fallback for comment: the non-url column with the longest avg text.
  if (comment === null && body.length) {
    let best = -1;
    let bestLen = 0;
    for (let c = 0; c < headers.length; c++) {
      if (c === url || c === date) continue;
      let total = 0;
      let seen = 0;
      for (const r of body.slice(0, 50)) {
        if (r[c] === undefined) continue;
        seen++;
        total += r[c].trim().length;
      }
      const avg = seen ? total / seen : 0;
      if (avg > bestLen) {
        bestLen = avg;
        best = c;
      }
    }
    if (best !== -1) comment = best;
  }

  return { url, comment, date, headers };
}

/**
 * Match feedback rows to a page URL.
 * @param subtree include rows whose path starts with the page path.
 */
export function matchFeedback(
  csvText: string,
  pageUrl: string,
  subtree: boolean,
): FeedbackResult {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return {
      url: pageUrl,
      subtree,
      matched: [],
      totalRows: 0,
      columns: { url: null, comment: null, date: null },
      note: "CSV appears empty or has no data rows.",
    };
  }

  const det = detectColumns(rows);
  const headers = det.headers;
  const body = rows.slice(1);

  const columns = {
    url: det.url !== null ? headers[det.url] : null,
    comment: det.comment !== null ? headers[det.comment] : null,
    date: det.date !== null ? headers[det.date] : null,
  };

  if (det.url === null) {
    return {
      url: pageUrl,
      subtree,
      matched: [],
      totalRows: body.length,
      columns,
      note:
        "Could not find a URL column in the CSV. Add a column named 'URL' (or 'Page') so comments can be matched to pages.",
    };
  }

  const target = normPath(pageUrl);
  // Section prefix for subtree matching: strip the page extension so a
  // landing page (…/visit-canada.html) also matches its children, which
  // live under the extension-less directory (…/visit-canada/eta.html).
  const prefix = target ? target.replace(/\.(html?|php|aspx?)$/i, "") : target;
  const matched: FeedbackRow[] = [];

  for (const r of body) {
    const rowUrl = det.url !== null ? r[det.url] ?? "" : "";
    const rowPath = normPath(rowUrl);
    if (!rowPath || !target) continue;

    const hit = subtree
      ? rowPath === target || rowPath.startsWith(prefix + "/")
      : rowPath === target;
    if (!hit) continue;

    const comment = det.comment !== null ? (r[det.comment] ?? "").trim() : "";
    if (!comment) continue;

    const extra: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      if (c === det.url || c === det.comment || c === det.date) continue;
      const v = (r[c] ?? "").trim();
            if (v) extra[headers[c] || `col${c}`] = v;
    }

    matched.push({
      url: rowUrl.trim(),
      comment,
      date: det.date !== null ? (r[det.date] ?? "").trim() || undefined : undefined,
      extra,
    });
  }

  return { url: pageUrl, subtree, matched, totalRows: body.length, columns };
}

/**
 * Extract every comment from an uploaded feedback CSV, without URL filtering.
 * Used when the page has no URL (blank/generated page) or the user opts to
 * analyze the whole file. Runs client-side (pure).
 */
export function extractAllComments(csvText: string): FeedbackResult {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return {
      url: "",
      subtree: false,
      matched: [],
      totalRows: 0,
      columns: { url: null, comment: null, date: null },
      note: "CSV appears empty or has no data rows.",
    };
  }
  const det = detectColumns(rows);
  const headers = det.headers;
  const body = rows.slice(1);
  const columns = {
    url: det.url !== null ? headers[det.url] : null,
    comment: det.comment !== null ? headers[det.comment] : null,
    date: det.date !== null ? headers[det.date] : null,
  };
  if (det.comment === null) {
    return {
      url: "",
      subtree: false,
      matched: [],
      totalRows: body.length,
      columns,
      note: "Could not find a comment column. Add a column named 'Comment' or 'Details'.",
    };
  }
  const matched: FeedbackRow[] = [];
  for (const r of body) {
    const comment = (r[det.comment] ?? "").trim();
    if (!comment) continue;
    matched.push({
      url: det.url !== null ? (r[det.url] ?? "").trim() : "",
      comment,
      date: det.date !== null ? (r[det.date] ?? "").trim() || undefined : undefined,
      extra: {},
    });
  }
  return { url: "", subtree: false, matched, totalRows: body.length, columns };
}
