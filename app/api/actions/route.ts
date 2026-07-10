/**
 * POST /api/actions — synthesize all gathered evidence into a prioritized,
 * de-duplicated action backlog (strict JSON, parsed here).
 *
 * Body: {
 *   title?, url?,
 *   feedbackAnalysis?, analytics?, userTasks?, heuristics?, seo?, doormats?,
 *   accessibility?, readability?, lang?
 * }
 * Returns: { actions: Action[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { createLLMClient } from "@/lib/llm";
import { actionsPrompt } from "@/lib/prompts";
import type { Action, Lang } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function parseJsonLoose(raw: string): { actions?: unknown } | null {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1);
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, string | undefined> & { lang?: Lang };
    const lang: Lang = body.lang === "fr" ? "fr" : "en";

    const map: [string, string | undefined][] = [
      ["User feedback analysis", body.feedbackAnalysis],
      ["Analytics assessment", body.analytics],
      ["User tasks", body.userTasks],
      ["Heuristic evaluation", body.heuristics],
      ["SEO review", body.seo],
      ["Doormat review", body.doormats],
      ["Accessibility findings", body.accessibility],
      ["Readability metrics", body.readability],
    ];
    const evidence = map
      .filter(([, v]) => v && v.trim())
      .map(([k, v]) => `# ${k}\n\n${v}`);

    if (evidence.length === 0) {
      return NextResponse.json(
        { error: "No evidence yet — run at least one assessment first." },
        { status: 400 },
      );
    }

    const userMessage =
      `Page: ${body.title ?? "(untitled)"}${body.url ? ` (${body.url})` : ""}\n\n` +
      `Evidence:\n\n${evidence.join("\n\n---\n\n")}`;

    const client = createLLMClient();
    const raw = await client.generateHtml({
      systemPrompt: actionsPrompt(lang),
      userMessage,
      purpose: "analysis",
    });

    const parsed = parseJsonLoose(raw);
    const actions = Array.isArray(parsed?.actions) ? (parsed!.actions as Action[]) : [];
    if (actions.length === 0) {
      return NextResponse.json({ error: "Could not produce a backlog from the evidence." }, { status: 422 });
    }
    return NextResponse.json({ actions });
  } catch (err) {
    console.error("[actions] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
