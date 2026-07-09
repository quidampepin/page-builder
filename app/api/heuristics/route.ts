/**
 * POST /api/heuristics
 *
 * Runs a heuristic evaluation of a single page (ux-reviewer skill) against its
 * rendered <main> HTML. Optionally seeded with feedback themes so the review
 * can corroborate findings with real user signal.
 *
 * Body: { title: string, url: string, content: string, feedbackThemes?: string, lang?: "en"|"fr" }
 * Returns: { markdown: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createLLMClient } from "@/lib/llm";
import { heuristicsPrompt } from "@/lib/prompts";
import type { Lang } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      title?: string;
      url?: string;
      content?: string;
      feedbackThemes?: string;
      lang?: Lang;
    };
    if (!body.content?.trim()) {
      return NextResponse.json(
        { error: "No page content provided." },
        { status: 400 },
      );
    }
    const lang: Lang = body.lang === "fr" ? "fr" : "en";

    const userMessage =
      `Evaluate this Canada.ca page.\n\nTitle: ${body.title ?? "(unknown)"}\n` +
      `URL: ${body.url ?? "(unknown)"}\n\n` +
      (body.feedbackThemes
        ? `Real user feedback themes (corroborate findings against these where relevant):\n${body.feedbackThemes}\n\n`
        : "") +
      `Rendered content (breadcrumb + <main> HTML):\n\n\`\`\`html\n${body.content.slice(0, 24000)}\n\`\`\``;

    const client = createLLMClient();
    const markdown = await client.generateHtml({
      systemPrompt: heuristicsPrompt(lang),
      userMessage,
    });

    return NextResponse.json({ markdown });
  } catch (err) {
    console.error("[heuristics] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
