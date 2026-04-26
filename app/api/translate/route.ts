/**
 * POST /api/translate
 *
 * Translate a Canada.ca page's content between EN and FR while preserving
 * structure. This is a narrower sibling of /api/chat — no compose step, no
 * diff protocol, no attachments — just one LLM call with a focused prompt.
 *
 * Two modes:
 *
 * 1. Full-page (original):
 *    {
 *      content: string,   // the current breadcrumb + <main>
 *      title: string,
 *      from: "en" | "fr",
 *      to:   "en" | "fr"
 *    }
 *    → { content, title }
 *
 * 2. Chunk mode (used by smart-translate):
 *    {
 *      chunks: string[],  // outerHTML of N sections
 *      title?: string,    // if provided, also translates the title
 *      from: "en" | "fr",
 *      to:   "en" | "fr"
 *    }
 *    → { translatedChunks: string[], title?: string }
 *
 *    In chunk mode, each chunk is a standalone HTML fragment that was a
 *    top-level child of <main>. The LLM translates all of them in a single
 *    turn using a JSON protocol so we can reassemble precisely.
 *
 * Error cases:
 *   - 400 on missing/invalid body
 *   - 500 on upstream LLM errors
 */

import { NextRequest, NextResponse } from "next/server";
import { createLLMClient } from "@/lib/llm";
import { getTranslatePrompt } from "@/lib/gcweb/translate-prompt";
import { extractContent } from "@/lib/gcweb/compose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface FullTranslateRequest {
  content: string;
  title: string;
  from: "en" | "fr";
  to: "en" | "fr";
}

interface ChunkTranslateRequest {
  chunks: string[];
  title?: string;
  from: "en" | "fr";
  to: "en" | "fr";
}

type TranslateRequest = FullTranslateRequest | ChunkTranslateRequest;

function isChunkMode(body: TranslateRequest): body is ChunkTranslateRequest {
  return Array.isArray((body as ChunkTranslateRequest).chunks);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TranslateRequest;

    if (!["en", "fr"].includes(body.from) || !["en", "fr"].includes(body.to)) {
      return NextResponse.json(
        { error: "`from` and `to` must be 'en' or 'fr'." },
        { status: 400 },
      );
    }
    if (body.from === body.to) {
      return NextResponse.json(
        { error: "`from` and `to` must differ." },
        { status: 400 },
      );
    }

    const client = createLLMClient();
    const systemPrompt = getTranslatePrompt({ from: body.from, to: body.to });

    if (isChunkMode(body)) {
      return await handleChunkMode(body, client, systemPrompt);
    }

    // Full-page mode (original behaviour).
    if (!body.content || typeof body.content !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid `content`." },
        { status: 400 },
      );
    }

    const userMessage =
      `Translate the following page from ${body.from.toUpperCase()} to ${body.to.toUpperCase()}.\n\n` +
      body.content;

    const rawHtml = await client.generateHtml({
      systemPrompt,
      userMessage,
    });

    const { breadcrumb, main } = extractContent(rawHtml);
    const content = `${breadcrumb}\n${main}`;
    const newTitle = extractH1(main) ?? body.title;

    return NextResponse.json({ content, title: newTitle });
  } catch (err) {
    console.error("[translate] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Chunk-mode handler.
 *
 * Strategy: pass all chunks in a single LLM turn using a JSON input/output
 * contract. This is cheaper than N round-trips and gives the model the full
 * set of fragments as context (helps with consistent terminology across
 * sections). The model returns a strict JSON array; we parse, validate
 * length, and return.
 *
 * If the model misbehaves (returns wrong length, non-JSON), we throw — the
 * caller's error path shows the message to the user.
 */
async function handleChunkMode(
  body: ChunkTranslateRequest,
  client: ReturnType<typeof createLLMClient>,
  systemPrompt: string,
) {
  if (!Array.isArray(body.chunks) || body.chunks.length === 0) {
    return NextResponse.json(
      { error: "Missing or empty `chunks` array." },
      { status: 400 },
    );
  }

  const payload = {
    title: body.title ?? null,
    sections: body.chunks,
  };

  // Override the output contract: instead of "return raw HTML", ask for a
  // JSON envelope. We append to the standard translate system prompt rather
  // than building a new one from scratch — keeps style/terminology rules in
  // one place.
  const chunkInstructions = `

# CHUNK MODE

You will receive a JSON object with:
  - title: a string to translate (or null to skip)
  - sections: an array of HTML fragments to translate

Each fragment is a standalone top-level element (a section, div, ol, etc.).
Translate each independently following the rules above. You MUST respond
with a JSON object of this exact shape:

{
  "title": "<translated title or null if the input title was null>",
  "sections": [
    "<translated fragment 1>",
    "<translated fragment 2>",
    ...
  ]
}

The sections array must have the EXACT SAME LENGTH as the input. Do not
merge, split, or drop fragments. Do not wrap the JSON in markdown fences.
Return ONLY the JSON object — no preamble, no postscript.`;

  const userMessage =
    `Translate from ${body.from.toUpperCase()} to ${body.to.toUpperCase()}.\n\n` +
    `Input:\n${JSON.stringify(payload, null, 2)}`;

  const raw = await client.generateHtml({
    systemPrompt: systemPrompt + chunkInstructions,
    userMessage,
  });

  const parsed = parseJsonLoose(raw);
  if (
    !parsed ||
    !Array.isArray(parsed.sections) ||
    parsed.sections.length !== body.chunks.length
  ) {
    throw new Error(
      `Translate model returned malformed JSON or wrong section count (expected ${body.chunks.length}).`,
    );
  }

  return NextResponse.json({
    translatedChunks: parsed.sections as string[],
    title: typeof parsed.title === "string" ? parsed.title : undefined,
  });
}

/**
 * Tolerant JSON parser: strips ```json ... ``` fences if the model leaked
 * them, then tries to find the outermost { ... } block. Returns null on
 * total failure — caller throws a friendlier error.
 */
function parseJsonLoose(raw: string): { title?: unknown; sections?: unknown } | null {
  let s = raw.trim();
  // Strip fences if any.
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  // Grab the outermost object if there's chatter around it.
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    s = s.slice(start, end + 1);
  }
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function extractH1(main: string): string | null {
  const m = main.match(/<h1[^>]*id=["']wb-cont["'][^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, "").trim() || null;
}
