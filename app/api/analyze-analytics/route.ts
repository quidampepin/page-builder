/**
 * POST /api/analyze-analytics
 *
 * Assesses an uploaded analytics CSV for a page/section and returns a concise
 * Markdown assessment (snapshot, key metrics, what the data suggests, where to
 * look next). Uses the analysis model (Opus by default).
 *
 * Body: { csv: string, url?: string, pageTitle?: string, feedbackThemes?: string, lang?: "en"|"fr" }
 * Returns: { markdown: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createLLMClient } from "@/lib/llm";
import { analyticsPrompt } from "@/lib/prompts";
import type { Lang } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      csv?: string;
      url?: string;
      pageTitle?: string;
      feedbackThemes?: string;
      lang?: Lang;
    };
    if (!body.csv?.trim()) {
      return NextResponse.json({ error: "No analytics CSV provided." }, { status: 400 });
    }
    const lang: Lang = body.lang === "fr" ? "fr" : "en";

    const userMessage =
      `Assess the following analytics data` +
      (body.pageTitle ? ` for the page "${body.pageTitle}"` : "") +
      (body.url ? ` (${body.url})` : "") +
      `.\n\n` +
      (body.feedbackThemes
        ? `For context, here are themes from real user feedback on the same page:\n${body.feedbackThemes}\n\n`
        : "") +
      `Analytics CSV:\n\n\`\`\`csv\n${body.csv.slice(0, 24000)}\n\`\`\``;

    const client = createLLMClient();
    const markdown = await client.generateHtml({
      systemPrompt: analyticsPrompt(lang),
      userMessage,
      purpose: "analysis",
    });

    return NextResponse.json({ markdown });
  } catch (err) {
    console.error("[analyze-analytics] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
