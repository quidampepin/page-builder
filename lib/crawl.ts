/**
 * Breadth-first crawler for a Canada.ca node and the pages "under" it.
 *
 * "Under" is defined by URL path prefix: a child must live on the same host
 * and its path must start with the root's section path. That matches how
 * Canada.ca organizes a topic and its subpages, and keeps the crawl from
 * wandering into the whole site.
 *
 * Bounded three ways so it can't run away:
 *   - depth   (default 3 levels below the root)
 *   - maxPages (hard cap on total pages fetched)
 *   - allowed hosts only (canada.ca / wet-boew.github.io)
 *
 * Each BFS level is fetched with limited concurrency to be polite.
 */

import { fetchPage, isAllowedHost, normalizeUrl } from "./fetch-page";
import type { CrawlResult, PageNode } from "./types";

export interface CrawlOptions {
  root: string;
  depth?: number;
  maxPages?: number;
  concurrency?: number;
}

/**
 * "Section prefix" of a URL — the path all children live under.
 *
 * Canada.ca landing pages end in `.html` (…/visit-canada.html) but their
 * child pages live in a matching directory WITHOUT the extension
 * (…/visit-canada/eta.html). So we strip a trailing page extension to get
 * the directory the children hang off. Example:
 *   …/services/visit-canada.html  ->  …/services/visit-canada
 * Children like …/services/visit-canada/eta.html then match, while siblings
 * like …/services/visit-canada-guide.html correctly do not.
 */
function pathPrefix(url: string): string {
  try {
    const u = new URL(url);
    let p = u.pathname;
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    p = p.replace(/\.(html?|php|aspx?)$/i, "");
    return `${u.protocol}//${u.host}${p}`;
  } catch {
    return url;
  }
}

/** Is `candidate` a descendant page of `rootPrefix`? */
function isUnder(candidate: string, rootPrefix: string): boolean {
  const c = normalizeUrl(candidate);
  if (c === rootPrefix) return false;
  // Must start with the root prefix followed by a path separator, so
  // /en/visit doesn't wrongly match /en/visiting.
  return c.startsWith(rootPrefix + "/");
}

/** Skip obvious non-content links (files, anchors, language toggles to self). */
function looksLikeContentPage(url: string): boolean {
  const lower = url.toLowerCase();
  if (/\.(pdf|zip|jpg|jpeg|png|gif|svg|csv|xlsx?|docx?|pptx?|json|xml)(\?|$)/.test(lower)) {
    return false;
  }
  return true;
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function crawl(opts: CrawlOptions): Promise<CrawlResult> {
  const depth = Math.max(0, Math.min(opts.depth ?? 3, 5));
  const maxPages = Math.max(1, Math.min(opts.maxPages ?? 40, 120));
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 4, 6));

  const root = normalizeUrl(opts.root);
  const rootPrefix = pathPrefix(root);

  const nodes = new Map<string, PageNode>();
  const visited = new Set<string>();

  // Level 0 is the root itself.
  let frontier: string[] = [root];
  visited.add(root);

  for (let level = 0; level <= depth; level++) {
    if (frontier.length === 0) break;
    if (nodes.size >= maxPages) break;

    // Respect the page cap within the level.
    const room = maxPages - nodes.size;
    const batch = frontier.slice(0, room);

    const fetched = await mapLimit(batch, concurrency, async (url) => {
      try {
        const page = await fetchPage(url);
        return { url, page, error: undefined as string | undefined };
      } catch (err) {
        return {
          url,
          page: null,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    });

    const nextFrontier: string[] = [];

    for (const { url, page, error } of fetched) {
      const node: PageNode = nodes.get(url) ?? {
        url,
        title: url,
        depth: level,
        parentUrl: null,
        children: [],
      };
      node.depth = level;

      if (error || !page) {
        node.error = error ?? "fetch failed";
        nodes.set(url, node);
        continue;
      }

      node.title = page.title;
      nodes.set(url, node);

      if (level < depth) {
        // Discover children: same host, under the root prefix, content-y,
        // not already seen.
        const childCandidates = new Set<string>();
        for (const link of page.links) {
          const norm = normalizeUrl(link);
          let host: string;
          try {
            host = new URL(norm).hostname;
          } catch {
            continue;
          }
          if (!isAllowedHost(host)) continue;
          if (!looksLikeContentPage(norm)) continue;
          if (!isUnder(norm, rootPrefix)) continue;
          if (visited.has(norm)) continue;
          childCandidates.add(norm);
        }

        for (const child of childCandidates) {
          node.children.push(child);
          if (!visited.has(child)) {
            visited.add(child);
            nextFrontier.push(child);
            // Pre-register the child node with its parent link.
            nodes.set(child, {
              url: child,
              title: child,
              depth: level + 1,
              parentUrl: url,
              children: [],
            });
          }
        }
        nodes.set(url, node);
      }
    }

    frontier = nextFrontier;
  }

  // Root node has no parent by definition.
  const rootNode = nodes.get(root);
  if (rootNode) rootNode.parentUrl = null;

  // Title backfill: nodes cut by the page cap (or the crawl edge) were only
  // ever registered by URL, so they'd show as a URL in the IA. Fetch their real
  // <h1>/title, bounded so a huge section can't explode the request count.
  const titleless = [...nodes.values()].filter((n) => !n.error && n.title === n.url);
  const BACKFILL_BUDGET = 60;
  if (titleless.length > 0) {
    await mapLimit(titleless.slice(0, BACKFILL_BUDGET), concurrency, async (n) => {
      try {
        const page = await fetchPage(n.url);
        n.title = page.title;
      } catch {
        /* leave the URL as the label */
      }
    });
  }

  const ordered = orderNodes(root, nodes);
  const truncated = frontier.length > 0 && nodes.size >= maxPages;

  return { root, depth, nodes: ordered, truncated, maxPages };
}

/** Depth-first flatten so the flat list reads like the tree (root first). */
function orderNodes(root: string, nodes: Map<string, PageNode>): PageNode[] {
  const out: PageNode[] = [];
  const seen = new Set<string>();
  const walk = (url: string) => {
    const node = nodes.get(url);
    if (!node || seen.has(url)) return;
    seen.add(url);
    out.push(node);
    for (const c of node.children) walk(c);
  };
  walk(root);
  // Append any orphans (shouldn't happen, but be safe).
  for (const [url, node] of nodes) {
    if (!seen.has(url)) {
      seen.add(url);
      out.push(node);
    }
  }
  return out;
}
