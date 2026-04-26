/**
 * POST /api/compose
 *
 * Deterministic shell wrap — no LLM call. Used by:
 *   - EN/FR toggle (swaps shell language around the same content)
 *   - Load flow (rebuilds composed HTML after reading saved content)
 *
 * Body: { content, title, lang }
 * Response: { composed }
 */

import { NextRequest, NextResponse } from "next/server";
import { compose } from "@/lib/gcweb/compose";
import type { Lang } from "@/lib/gcweb/shell";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      content: string;
      title?: string;
      lang?: Lang;
    };
    const composed = compose({
      content: body.content,
      title: body.title || "New page",
      lang: body.lang || "en",
    });
    return NextResponse.json({ composed });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
