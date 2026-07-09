/**
 * Shared types for the GC Site Auditor.
 */

export type Lang = "en" | "fr";

/** One page discovered during a crawl. Forms a tree via parentUrl/children. */
export interface PageNode {
  url: string;
  title: string;
  depth: number;
  /** URL of the page that linked to this one (null for the root). */
  parentUrl: string | null;
  /** Child URLs discovered under this node (same path prefix). */
  children: string[];
  /** Set if the fetch failed, so the UI can flag it. */
  error?: string;
}

export interface CrawlResult {
  root: string;
  depth: number;
  /** Flat list of nodes, root first. The tree is rebuilt from parentUrl. */
  nodes: PageNode[];
  truncated: boolean;
  maxPages: number;
}

/** A single crawled page's extracted content, fetched on demand. */
export interface PageContent {
  url: string;
  title: string;
  breadcrumb: string;
  main: string;
  /** breadcrumb + main, ready to feed the LLM or compose. */
  content: string;
  /** Full GCWeb-shell-wrapped document for the preview iframe. */
  composed: string;
}

/** One matched feedback row for a page. */
export interface FeedbackRow {
  url: string;
  comment: string;
  date?: string;
  /** Any extra columns, kept verbatim for display. */
  extra: Record<string, string>;
}

export interface FeedbackResult {
  /** The page (or subtree root) the comments were matched against. */
  url: string;
  /** Whether children were included (subtree match) or exact-URL only. */
  subtree: boolean;
  matched: FeedbackRow[];
  totalRows: number;
  /** Which CSV columns were auto-detected. */
  columns: { url: string | null; comment: string | null; date: string | null };
  /** Human-readable note if the CSV was missing or unusable. */
  note?: string;
}
