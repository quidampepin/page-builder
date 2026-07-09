/**
 * POST /api/crawl
 *
 * Body: { url: string, depth?: number, maxPages?: number }
 * Returns a CrawlResult: the node and its descendants (up to `depth`
 * levels, default 3), bounded by `maxPages`.
 */

import { NextRequest, NextResponse } from "next/server";
import { crawl } from "@/lib/crawl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      url?: string;
      depth?: number;
      maxPages?: number;
    };
    const url = body.url?.trim();
    if (!url) {
      return NextResponse.json({ error: "Missing `url`." }, { status: 400 });
    }
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: `Invalid URL: ${url}` }, { status: 400 });
    }

    const result = await crawl({
      root: url,
      depth: body.depth,
      maxPages: body.maxPages,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[crawl] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
