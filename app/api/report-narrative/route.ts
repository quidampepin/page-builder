/**
 * POST /api/report-narrative
 *
 * Produces the prose blocks for the polished report: executive summary, the
 * user pain points revealed by the assessment, and what to look for next.
 * "What we did" and the before/after scores are built deterministically by the
 * report engine, so this only returns the narrative JSON.
 *
 * Body: {
 *   name?, lang?,
 *   pages: {
 *     title, url,
 *     feedback?, analytics?, heuristics?, seo?, doormats?,
 *     appliedActions?: string[],
 *     gradeBefore?, gradeAfter?, a11yBefore?, a11yAfter?
 *   }[]
 * }
 * Returns: { execSummary, painPoints, nextSteps }
 */

import { NextRequest, NextResponse } from "next/server";
import { createLLMClient } from "@/lib/llm";
import { reportNarrativePrompt } from "@/lib/prompts";
import type { Lang } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface NarrPage {
  title?: string;
  url?: string;
  feedback?: string;
  analytics?: string;
  heuristics?: string;
  seo?: string;
  doormats?: string;
  appliedActions?: string[];
  gradeBefore?: number;
  gradeAfter?: number;
  a11yBefore?: number;
  a11yAfter?: number;
}

function parseJsonLoose(raw: string): Record<string, unknown> | null {
  let s = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a !== -1 && b !== -1 && b > a) s = s.slice(a, b + 1);
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { name?: string; lang?: Lang; pages?: NarrPage[] };
    const pages = body.pages ?? [];
    const lang: Lang = body.lang === "fr" ? "fr" : "en";
    if (pages.length === 0) {
      return NextResponse.json({ error: "No pages provided." }, { status: 400 });
    }

    const block = pages
      .map((p, i) => {
        const parts: string[] = [`## Page ${i + 1}: ${p.title ?? p.url ?? "(untitled)"}${p.url ? ` (${p.url})` : ""}`];
        if (p.feedback) parts.push(`Feedback analysis:\n${p.feedback.slice(0, 3500)}`);
        if (p.analytics) parts.push(`Analytics:\n${p.analytics.slice(0, 2500)}`);
        if (p.heuristics) parts.push(`Heuristics:\n${p.heuristics.slice(0, 3000)}`);
        if (p.seo) parts.push(`SEO:\n${p.seo.slice(0, 1500)}`);
        if (p.doormats) parts.push(`Doormats:\n${p.doormats.slice(0, 1500)}`);
        if (p.appliedActions?.length) parts.push(`Changes applied:\n- ${p.appliedActions.join("\n- ")}`);
        const scores: string[] = [];
        if (p.gradeBefore != null || p.gradeAfter != null) scores.push(`reading grade ${p.gradeBefore ?? "?"} -> ${p.gradeAfter ?? "?"}`);
        if (p.a11yBefore != null || p.a11yAfter != null) scores.push(`accessibility issues ${p.a11yBefore ?? "?"} -> ${p.a11yAfter ?? "?"}`);
        if (scores.length) parts.push(`Scores: ${scores.join("; ")}`);
        return parts.join("\n\n");
      })
      .join("\n\n---\n\n");

    const userMessage = `Report: ${body.name ?? "UX assessment"} (${pages.length} page(s)).\n\n${block}`;

    const client = createLLMClient();
    const raw = await client.generateHtml({
      systemPrompt: reportNarrativePrompt(lang),
      userMessage,
      purpose: "analysis",
    });
    const parsed = parseJsonLoose(raw) || {};
    return NextResponse.json({
      execSummary: typeof parsed.execSummary === "string" ? parsed.execSummary : "",
      painPoints: typeof parsed.painPoints === "string" ? parsed.painPoints : "",
      nextSteps: typeof parsed.nextSteps === "string" ? parsed.nextSteps : "",
    });
  } catch (err) {
    console.error("[report-narrative] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
