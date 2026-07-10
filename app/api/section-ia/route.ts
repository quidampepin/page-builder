/**
 * POST /api/section-ia
 *
 * Given a per-page metrics inventory for a crawled section (plus optional
 * feedback themes), recommend information-architecture changes: pages to merge,
 * split, retire, reorder, or rewrite, and gaps to fill.
 *
 * Body: { root?, pages: {title,url,wordCount,readingGrade,issues}[], feedbackThemes?, lang? }
 * Returns: { markdown }
 */

import { NextRequest, NextResponse } from "next/server";
import { createLLMClient } from "@/lib/llm";
import type { Lang } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      root?: string;
      pages?: { title: string; url: string; wordCount?: number; readingGrade?: number; issues?: string }[];
      feedbackThemes?: string;
      lang?: Lang;
    };
    const pages = body.pages ?? [];
    if (pages.length === 0) {
      return NextResponse.json({ error: "No section inventory provided." }, { status: 400 });
    }
    const lang: Lang = body.lang === "fr" ? "fr" : "en";

    const system = `You are an information architect for Canada.ca. Given an inventory of the pages
in one section (with rough metrics), recommend concrete IA improvements for the section as a whole.
Consider: pages to merge (overlap/thin), split (too long/multi-task), retire, or reorder; navigation
and doormat gaps; and topics users clearly want that are missing or buried. Use feedback themes when
provided. Be specific and reference pages by title/URL. Keep it practical and prioritized.

Output Markdown: a short "## Section read" (2–3 sentences), then "## Recommendations" as a prioritized
bullet list, then "## Quick wins" (2–4 bullets). Markdown only, no preamble.
${lang === "fr" ? "Respond in French." : "Respond in English."}`;

    const inventory = pages
      .map(
        (p) =>
          `- ${p.title} — ${p.url}${p.wordCount != null ? ` · ${p.wordCount} words` : ""}${
            p.readingGrade != null ? ` · grade ${p.readingGrade}` : ""
          }${p.issues ? ` · ${p.issues}` : ""}`,
      )
      .join("\n");

    const userMessage =
      `Section root: ${body.root ?? "(unknown)"}\n\n` +
      (body.feedbackThemes ? `Feedback themes across the section:\n${body.feedbackThemes}\n\n` : "") +
      `Page inventory (${pages.length} pages):\n${inventory}`;

    const client = createLLMClient();
    const markdown = await client.generateHtml({
      systemPrompt: system,
      userMessage,
      purpose: "analysis",
    });
    return NextResponse.json({ markdown });
  } catch (err) {
    console.error("[section-ia] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
