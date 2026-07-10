/**
 * A consistent, human-readable label for a crawled node.
 *
 * Fetched pages carry a real page title. Pages that couldn't be fetched (hit
 * the page cap, errored, or sit at the crawl's edge) only have a URL. To avoid
 * a jarring mix of titles and raw URL slugs in the tree/map, we derive a
 * title-like label from the last URL path segment: drop the extension, turn
 * hyphens/underscores into spaces, and sentence-case it.
 *
 * e.g. ".../visit-canada/eta.html" (no title) -> "Eta"
 *      ".../super-visa.html"       (no title) -> "Super visa"
 */
export function nodeLabel(node: { url: string; title: string }): string {
  if (node.title && node.title !== node.url) return node.title;
  try {
    const segs = new URL(node.url).pathname.split("/").filter(Boolean);
    let last = segs[segs.length - 1] || "";
    last = last
      .replace(/\.(html?|php|aspx?)$/i, "")
      .replace(/[-_]+/g, " ")
      .trim();
    if (!last) return node.url;
    return last.charAt(0).toUpperCase() + last.slice(1);
  } catch {
    return node.url;
  }
}
