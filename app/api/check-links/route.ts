/**
 * POST /api/check-links
 *
 * Checks a page's outbound links. For SSRF safety this only requests links on
 * the allow-list (canada.ca / wet-boew.github.io) — the vast majority of
 * "broken link" feedback is internal reorganization anyway. Off-list links are
 * returned as "skipped (external)" without being fetched.
 *
 * Body: { links: string[] }
 * Returns: { results: { url, status, ok, note?, redirectedTo? }[], checked, skipped }
 */

import { NextRequest, NextResponse } from "next/server";
import { isAllowedHost } from "@/lib/fetch-page";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface LinkResult {
  url: string;
  status: number;
  ok: boolean;
  note?: string;
  redirectedTo?: string;
}

const MAX = 100;
const CONCURRENCY = 6;

async function checkOne(url: string): Promise<LinkResult> {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return { url, status: 0, ok: false, note: "invalid URL" };
  }
  if (!isAllowedHost(host)) {
    return { url, status: 0, ok: false, note: "skipped (external)" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "GC-UX-Tool-LinkCheck/1.0", Accept: "text/html" },
      redirect: "follow",
      signal: controller.signal,
    });
    const redirectedTo = res.url && res.url !== url ? res.url : undefined;
    return { url, status: res.status, ok: res.ok, redirectedTo };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { url, status: 0, ok: false, note: aborted ? "timed out" : "fetch failed" };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { links?: string[] };
    const all = Array.from(new Set((body.links ?? []).filter((l) => typeof l === "string")));
    const links = all.slice(0, MAX);

    const results: LinkResult[] = [];
    let i = 0;
    const workers = new Array(Math.min(CONCURRENCY, links.length)).fill(0).map(async () => {
      while (i < links.length) {
        const idx = i++;
        results[idx] = await checkOne(links[idx]);
      }
    });
    await Promise.all(workers);

    const checked = results.filter((r) => r.note !== "skipped (external)").length;
    const skipped = results.length - checked;
    return NextResponse.json({ results, checked, skipped, truncated: all.length > MAX });
  } catch (err) {
    console.error("[check-links] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
