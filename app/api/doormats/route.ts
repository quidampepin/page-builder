/**
 * POST /api/doormats — review/generate Canada.ca doormats (canada-ca-doormat
 * skill), grounded in feedback + analytics when provided.
 *
 * Body: { title, url, content, feedbackThemes?, analyticsThemes?, lang? }
 * Returns: { markdown }
 */

import { NextRequest, NextResponse } from "next/server";
import { createLLMClient } from "@/lib/llm";
import { doormatsPrompt } from "@/lib/prompts";
import type { Lang } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      title?: string;
      url?: string;
      content?: string;
      feedbackThemes?: string;
      analyticsThemes?: string;
      lang?: Lang;
    };
    if (!body.content?.trim()) {
      return NextResponse.json({ error: "No page content provided." }, { status: 400 });
    }
    const lang: Lang = body.lang === "fr" ? "fr" : "en";

    const userMessage =
      `Page: ${body.title ?? "(untitled)"}\nURL: ${body.url ?? "(unknown)"}\n\n` +
      (body.feedbackThemes ? `User feedback themes:\n${body.feedbackThemes}\n\n` : "") +
      (body.analyticsThemes ? `Analytics assessment (mind internal search terms):\n${body.analyticsThemes}\n\n` : "") +
      `Rendered content (breadcrumb + <main> HTML):\n\n\`\`\`html\n${body.content.slice(0, 20000)}\n\`\`\``;

    const client = createLLMClient();
    const markdown = await client.generateHtml({
      systemPrompt: doormatsPrompt(lang),
      userMessage,
      purpose: "analysis",
    });
    return NextResponse.json({ markdown });
  } catch (err) {
    console.error("[doormats] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
