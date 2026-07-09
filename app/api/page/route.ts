/**
 * POST /api/page
 *
 * Fetch a single crawled page on demand and return its extracted content plus
 * a fully composed GCWeb document for the preview iframe. Reuses the sibling
 * builder's compose() so the preview matches exactly what the builder renders.
 *
 * Body: { url: string, lang?: "en" | "fr" }
 * Returns a PageContent.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchPage } from "@/lib/fetch-page";
import { compose } from "@/lib/gcweb/compose";
import type { Lang, PageContent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { url?: string; lang?: Lang };
    const url = body.url?.trim();
    const lang: Lang = body.lang === "fr" ? "fr" : "en";
    if (!url) {
      return NextResponse.json({ error: "Missing `url`." }, { status: 400 });
    }

    const page = await fetchPage(url);
    const composed = compose({
      title: page.title,
      content: page.content,
      lang,
    });

    const payload: PageContent = {
      url: page.url,
      title: page.title,
      breadcrumb: page.breadcrumb,
      main: page.main,
      content: page.content,
      composed,
    };
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[page] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
