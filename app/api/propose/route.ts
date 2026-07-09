/**
 * POST /api/propose
 *
 * Proposes and implements changes to a page, grounded in the feedback analysis
 * and heuristic findings, using the shared canada-ca-coder + writer skills.
 * Returns the new content (breadcrumb + <main>), the composed before/after
 * documents for preview, a line diff, and a ready-to-load .gcpage.json payload
 * so the change can be opened in the sibling Page Builder for manual tweaking.
 *
 * Body: {
 *   title: string,
 *   currentContent: string,      // breadcrumb + <main>
 *   url?: string,
 *   feedbackAnalysis?: string,   // markdown from /api/analyze-feedback
 *   heuristics?: string,         // markdown from /api/heuristics
 *   instructions?: string,       // extra user direction
 *   lang?: "en" | "fr"
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { createLLMClient } from "@/lib/llm";
import { compose, extractContent } from "@/lib/gcweb/compose";
import { proposePrompt } from "@/lib/prompts";
import { diffLines, diffStats } from "@/lib/diff";
import type { Lang } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function extractH1(main: string): string | null {
  const m = main.match(/<h1[^>]*id=["']wb-cont["'][^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, "").trim() || null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      title?: string;
      currentContent?: string;
      url?: string;
      feedbackAnalysis?: string;
      heuristics?: string;
      instructions?: string;
      lang?: Lang;
    };
    if (!body.currentContent?.trim()) {
      return NextResponse.json(
        { error: "Missing `currentContent`." },
        { status: 400 },
      );
    }
    const lang: Lang = body.lang === "fr" ? "fr" : "en";
    const title = body.title ?? "Page";

    const evidence: string[] = [];
    if (body.feedbackAnalysis?.trim()) {
      evidence.push(`# User feedback analysis\n\n${body.feedbackAnalysis.trim()}`);
    }
    if (body.heuristics?.trim()) {
      evidence.push(`# Heuristic evaluation\n\n${body.heuristics.trim()}`);
    }
    if (body.instructions?.trim()) {
      evidence.push(`# Additional instructions from the content owner\n\n${body.instructions.trim()}`);
    }
    const evidenceBlock = evidence.length
      ? evidence.join("\n\n---\n\n")
      : "(No feedback or heuristic analysis was provided — improve the page using plain-language and Canada.ca design best practices only, and be conservative.)";

    const userMessage =
      `Improve the following Canada.ca page based on the evidence.\n\n` +
      `## Evidence\n\n${evidenceBlock}\n\n` +
      `## Current page HTML (breadcrumb + main)\n\n\`\`\`html\n${body.currentContent}\n\`\`\`\n\n` +
      `Now output the improved breadcrumb + <main> per the output contract.`;

    const client = createLLMClient();
    const raw = await client.generateHtml({
      systemPrompt: proposePrompt(lang),
      userMessage,
    });

    const split = extractContent(raw);
    const newContent = `${split.breadcrumb}\n${split.main}`;
    const newTitle = extractH1(newContent) ?? title;

    const composedBefore = compose({ title, content: body.currentContent, lang });
    const composedAfter = compose({ title: newTitle, content: newContent, lang });

    const diff = diffLines(body.currentContent, newContent);
    const stats = diffStats(diff);

    // Builder-compatible save payload (.gcpage.json v3 shape) so the user can
    // Load it straight into GC Page Builder and keep tweaking.
    const other = lang === "en" ? "fr" : "en";
    const gcpage = {
      version: 3 as const,
      savedAt: new Date().toISOString(),
      title: newTitle,
      lang,
      pages: {
        [lang]: { title: newTitle, content: newContent },
        [other]: { title: "", content: "" },
      },
      snapshots: {},
      composed: composedAfter,
      history: [],
    };

    return NextResponse.json({
      title: newTitle,
      newContent,
      composedBefore,
      composedAfter,
      diff,
      stats,
      gcpage,
    });
  } catch (err) {
    console.error("[propose] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
