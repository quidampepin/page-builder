/**
 * POST /api/user-tasks
 *
 * Generates realistic user tasks (job stories + usability scenarios + user
 * need statements) the given page(s) are meant to support, using the
 * job-stories-writer skill. Optionally seeded with feedback themes.
 *
 * Body: {
 *   pages: { title: string, url: string, content: string }[],
 *   feedbackThemes?: string,   // optional: a feedback analysis summary
 *   lang?: "en" | "fr"
 * }
 * Returns: { markdown: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createLLMClient } from "@/lib/llm";
import { userTasksPrompt } from "@/lib/prompts";
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
      pages?: { title: string; url: string; content: string }[];
      feedbackThemes?: string;
      analyticsThemes?: string;
      lang?: Lang;
    };
    const pages = (body.pages ?? []).filter((p) => p.content?.trim());
    if (pages.length === 0) {
      return NextResponse.json(
        { error: "No page content provided." },
        { status: 400 },
      );
    }
    const lang: Lang = body.lang === "fr" ? "fr" : "en";

    const pagesBlock = pages
      .map(
        (p) =>
          `## ${p.title}\n${p.url}\n\n${stripTags(p.content).slice(0, 6000)}`,
      )
      .join("\n\n---\n\n");

    const userMessage =
      `Generate the user tasks these Canada.ca page(s) are meant to support.\n\n` +
      (body.feedbackThemes
        ? `Real user feedback themes to ground your stories:\n${body.feedbackThemes}\n\n`
        : "") +
      (body.analyticsThemes
        ? `Analytics assessment for the same page(s):\n${body.analyticsThemes}\n\n`
        : "") +
      `Page content:\n\n${pagesBlock}`;

    const client = createLLMClient();
    const markdown = await client.generateHtml({
      systemPrompt: userTasksPrompt(lang),
      userMessage,
      purpose: "analysis",
    });

    return NextResponse.json({ markdown });
  } catch (err) {
    console.error("[user-tasks] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
