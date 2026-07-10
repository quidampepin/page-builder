/**
 * POST /api/improve-brief
 *
 * Distills the gathered UX evidence (feedback analysis, analytics, heuristics,
 * user tasks) into a SHORT, prioritized list of concrete edits to make to the
 * page. This keeps the builder chat prompt tiny — instead of pasting every
 * full analysis into the chat, we send this compact brief.
 *
 * Body: {
 *   content?: string, feedbackAnalysis?: string, analytics?: string,
 *   heuristics?: string, userTasks?: string, lang?: "en" | "fr"
 * }
 * Returns: { brief: string }  // markdown bullet list
 */

import { NextRequest, NextResponse } from "next/server";
import { createLLMClient } from "@/lib/llm";
import type { Lang } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      content?: string;
      feedbackAnalysis?: string;
      analytics?: string;
      heuristics?: string;
      userTasks?: string;
      lang?: Lang;
    };
    const lang: Lang = body.lang === "fr" ? "fr" : "en";

    const evidence: string[] = [];
    if (body.feedbackAnalysis?.trim()) evidence.push(`## User feedback analysis\n${body.feedbackAnalysis.trim()}`);
    if (body.analytics?.trim()) evidence.push(`## Analytics assessment\n${body.analytics.trim()}`);
    if (body.heuristics?.trim()) evidence.push(`## Heuristic evaluation\n${body.heuristics.trim()}`);
    if (body.userTasks?.trim()) evidence.push(`## User tasks\n${body.userTasks.trim()}`);

    if (evidence.length === 0) {
      return NextResponse.json(
        { error: "No evidence to distill — run Feedback, Analytics, User tasks, or Heuristics first." },
        { status: 400 },
      );
    }

    const system = `You turn UX evidence into a SHORT change brief for editing one Canada.ca page.
Read the evidence and the current page, then output ONLY a prioritized Markdown bullet list of
the concrete edits to make to THIS page — highest impact first. Rules:
- Maximum 10 bullets. Each bullet is one imperative action (e.g. "Move eligibility criteria
  above the fold", "Rewrite the intro in plain language", "Add the processing times users keep
  asking about").
- Merge overlapping issues from different sources into single actions; don't repeat.
- Only propose changes grounded in the evidence. Never invent facts, programs, dates, or figures.
- No headings, no preamble, no explanation — just the bullets. Keep the whole thing tight.
${lang === "fr" ? "Write the bullets in French." : "Write the bullets in English."}`;

    const userMessage =
      `Current page (text):\n${body.content ? stripTags(body.content).slice(0, 6000) : "(not provided)"}\n\n` +
      `Evidence:\n\n${evidence.join("\n\n")}`;

    const client = createLLMClient();
    const brief = await client.generateHtml({
      systemPrompt: system,
      userMessage,
      purpose: "analysis",
    });

    return NextResponse.json({ brief });
  } catch (err) {
    console.error("[improve-brief] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
