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
  // No fetched title (page cut by the cap / crawl edge): show the honest URL
  // path rather than a fabricated title.
  try {
    const u = new URL(node.url);
    return u.pathname === "/" ? node.url : u.pathname;
  } catch {
    return node.url;
  }
}
