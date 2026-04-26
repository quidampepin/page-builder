/**
 * Pull the h1 text out of the page content (breadcrumb + main).
 *
 * GCWeb pages always have an <h1 id="wb-cont"> as the page heading. The
 * matching `<title>` in the shell head should mirror it. This helper is
 * used after manual edits and translations to keep the two in sync.
 *
 * Returns null when:
 *   - no matching <h1 id="wb-cont"> is found, OR
 *   - the h1 is empty after stripping inner tags.
 *
 * Callers usually fall back to the previous title in that case.
 */
export function extractTitle(content: string): string | null {
  const m = content.match(/<h1[^>]*id=["']wb-cont["'][^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return null;
  // Strip any inline tags inside the h1 (e.g. <span class="wb-inv">),
  // collapse whitespace, return null on empty.
  const text = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return text || null;
}
