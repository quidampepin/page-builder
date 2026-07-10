/**
 * POST /api/report-summary
 *
 * Synthesizes an executive summary for the full report from whatever insights
 * have been gathered (feedback analysis, analytics assessment, user tasks,
 * heuristics). Uses the analysis model (Opus by default).
 *
 * Body: {
 *   pageTitle?: string, url?: string,
 *   feedbackAnalysis?: string, analytics?: string, userTasks?: string, heuristics?: string,
 *   lang?: "en" | "fr"
 * }
 * Returns: { markdown: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createLLMClient } from "@/lib/llm";
import { reportSummaryPrompt } from "@/lib/prompts";
import type { Lang } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      pageTitle?: string;
      url?: string;
      feedbackAnalysis?: string;
      analytics?: string;
      userTasks?: string;
      heuristics?: string;
      lang?: Lang;
    };
    const lang: Lang = body.lang === "fr" ? "fr" : "en";

    const parts: string[] = [];
    if (body.feedbackAnalysis?.trim()) parts.push(`# User feedback analysis\n\n${body.feedbackAnalysis.trim()}`);
    if (body.analytics?.trim()) parts.push(`# Analytics assessment\n\n${body.analytics.trim()}`);
    if (body.userTasks?.trim()) parts.push(`# User tasks\n\n${body.userTasks.trim()}`);
    if (body.heuristics?.trim()) parts.push(`# Heuristic evaluation\n\n${body.heuristics.trim()}`);

    if (parts.length === 0) {
      return NextResponse.json(
        { error: "No insights gathered yet — run at least one analysis before generating a report summary." },
        { status: 400 },
      );
    }

    const userMessage =
      `Page: ${body.pageTitle ?? "(untitled)"}${body.url ? ` (${body.url})` : ""}\n\n` +
      `Here are the gathered insights:\n\n${parts.join("\n\n---\n\n")}`;

    const client = createLLMClient();
    const markdown = await client.generateHtml({
      systemPrompt: reportSummaryPrompt(lang),
      userMessage,
      purpose: "analysis",
    });

    return NextResponse.json({ markdown });
  } catch (err) {
    console.error("[report-summary] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
