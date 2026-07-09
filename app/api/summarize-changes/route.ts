/**
 * POST /api/summarize-changes
 *
 * Produces a plain-language, reader-friendly summary of what changed between
 * the original page and an edited/proposed version — a better illustration of
 * "what did the suggestions actually do" than a raw HTML line diff. Groups the
 * changes by theme (content, structure, plain language, accessibility, etc.).
 *
 * Body: { before: string, after: string, lang?: "en" | "fr" }
 * Returns: { markdown: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createLLMClient } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM = `You compare two versions of a Canada.ca page (the ORIGINAL and the REVISED)
and explain what changed, for a content owner who is not technical.

Rules:
- Only describe REAL differences between the two versions. Do not invent changes.
- Ignore trivial whitespace/attribute noise. Focus on what a reader or user would notice.
- Group changes under short bold headings by theme, e.g.: **Structure**, **Plain language**,
  **Content added**, **Content removed**, **Accessibility**, **Calls to action**, **Metadata**.
- Under each heading, use concise bullet points. Quote short before -> after snippets when useful.
- Start with a one-sentence summary of the overall change.
- If the two versions are essentially identical, say so plainly.
- Return GitHub-flavored Markdown only. No preamble, no code fences around the whole answer.`;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { before?: string; after?: string; lang?: "en" | "fr" };
    if (!body.before?.trim() || !body.after?.trim()) {
      return NextResponse.json({ error: "Both `before` and `after` are required." }, { status: 400 });
    }
    const langLine =
      body.lang === "fr" ? "\nRespond in French." : "\nRespond in English.";

    const userMessage =
      `## ORIGINAL\n\n\`\`\`html\n${body.before.slice(0, 18000)}\n\`\`\`\n\n` +
      `## REVISED\n\n\`\`\`html\n${body.after.slice(0, 18000)}\n\`\`\`\n\n` +
      `Summarize the changes.`;

    const client = createLLMClient();
    const markdown = await client.generateHtml({
      systemPrompt: SYSTEM + langLine,
      userMessage,
    });

    return NextResponse.json({ markdown });
  } catch (err) {
    console.error("[summarize-changes] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
