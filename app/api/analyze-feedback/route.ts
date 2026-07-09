/**
 * POST /api/analyze-feedback
 *
 * Runs the canada-ca-feedback-analyst skill over a set of matched comments and
 * returns a Markdown analysis (issue table, sensitive-info check, insights,
 * key phrases, sentiment).
 *
 * Body: { comments: { comment: string, date?: string }[], url?: string, lang?: "en"|"fr" }
 * Returns: { markdown: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createLLMClient } from "@/lib/llm";
import { feedbackAnalysisPrompt } from "@/lib/prompts";
import type { Lang } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      comments?: { comment: string; date?: string }[];
      url?: string;
      lang?: Lang;
    };
    const comments = (body.comments ?? []).filter((c) => c.comment?.trim());
    if (comments.length === 0) {
      return NextResponse.json(
        { error: "No comments to analyze." },
        { status: 400 },
      );
    }
    const lang: Lang = body.lang === "fr" ? "fr" : "en";

    const list = comments
      .map((c, idx) => {
        const d = c.date ? ` (${c.date})` : "";
        return `${idx + 1}.${d} ${c.comment.trim()}`;
      })
      .join("\n");

    const userMessage =
      `Here are ${comments.length} real user feedback comments` +
      (body.url ? ` from ${body.url}` : "") +
      `. Analyze them per the skill. Every quote in your tables must be copied` +
      ` verbatim from this list.\n\n${list}`;

    const client = createLLMClient();
    const markdown = await client.generateHtml({
      systemPrompt: feedbackAnalysisPrompt(lang),
      userMessage,
    });

    return NextResponse.json({ markdown });
  } catch (err) {
    console.error("[analyze-feedback] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
