/**
 * Line-based diff for showing the "effected changes" between the original
 * page HTML and a proposed rewrite.
 *
 * HTML often comes back as very long lines, which makes a raw line diff
 * useless. So we first PRETTY-PRINT: insert a newline before each block-level
 * tag so structural changes line up. Then a classic LCS diff produces
 * unified add/remove/context rows the UI renders side by side.
 */

export type DiffKind = "same" | "add" | "del";

export interface DiffRow {
  kind: DiffKind;
  /** Text of the line (for add/del/same). */
  text: string;
}

/** Insert line breaks around tags so the diff has meaningful line units. */
export function prettyHtml(html: string): string {
  if (!html) return "";
  let out = html
    // newline before opening/closing tags of common block elements
    .replace(/>\s*</g, ">\n<")
    .replace(/\r/g, "");
  // collapse runs of blank lines
  out = out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n");
  return out;
}

/** LCS diff over two arrays of lines. */
export function diffLines(aText: string, bText: string): DiffRow[] {
  const a = prettyHtml(aText).split("\n");
  const b = prettyHtml(bText).split("\n");
  const n = a.length;
  const m = b.length;

  // DP table of LCS lengths. Guard against pathological sizes.
  const MAX = 4000;
  if (n > MAX || m > MAX) {
    // Fall back to a coarse "everything replaced" view.
    return [
      ...a.map((t) => ({ kind: "del" as DiffKind, text: t })),
      ...b.map((t) => ({ kind: "add" as DiffKind, text: t })),
    ];
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ kind: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ kind: "del", text: a[i] });
      i++;
    } else {
      rows.push({ kind: "add", text: b[j] });
      j++;
    }
  }
  while (i < n) rows.push({ kind: "del", text: a[i++] });
  while (j < m) rows.push({ kind: "add", text: b[j++] });

  return rows;
}

export interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
}

export function diffStats(rows: DiffRow[]): DiffStats {
  return rows.reduce(
    (acc, r) => {
      if (r.kind === "add") acc.added++;
      else if (r.kind === "del") acc.removed++;
      else acc.unchanged++;
      return acc;
    },
    { added: 0, removed: 0, unchanged: 0 },
  );
}
