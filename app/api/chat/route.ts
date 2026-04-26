/**
 * POST /api/chat
 *
 * The orchestration endpoint. Takes a user message + already-extracted
 * attachments + history + current HTML, composes the system prompt, calls
 * the LLM, and returns the new content (breadcrumb + <main>) plus the fully
 * composed page (shell-wrapped).
 *
 * Two output modes the LLM can choose:
 *
 *   1. **Edit mode** — LLM emits a <!--GCPB:EDITS--> block with a JSON op
 *      list. We apply it to the current HTML via cheerio. Cheap + targeted.
 *   2. **Full mode** — LLM emits a fresh breadcrumb + <main>. We sanitize +
 *      compose as before. Used for first-time generation and big rewrites.
 *
 * The LLM decides which mode to use; the system prompt teaches the criteria.
 * If edit mode is attempted but all ops fail, we surface an error so the
 * user can retry — we don't silently swallow the broken response.
 *
 * Request body (JSON):
 *   {
 *     message: string,
 *     history?: ChatTurn[],
 *     attachments?: Attachment[],
 *     currentContent?: string,  // previous breadcrumb + <main> (for edits)
 *     lang?: "en" | "fr",
 *     title?: string
 *   }
 *
 * Response:
 *   {
 *     content: string,    // breadcrumb + <main> (post-edit or full)
 *     composed: string,   // full HTML document ready to preview/download
 *     title: string,
 *     lang: "en" | "fr",
 *     mode: "edit" | "full",
 *     editsApplied?: number,
 *     editsFailed?: string[]
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createLLMClient, type Attachment, type ChatTurn } from "@/lib/llm";
import { getSystemPrompt } from "@/lib/gcweb/system-prompt";
import { compose, extractContent } from "@/lib/gcweb/compose";
import { applyEdits, parseEdits } from "@/lib/gcweb/edits";
import type { Lang } from "@/lib/gcweb/shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ChatRequest {
  message: string;
  history?: ChatTurn[];
  attachments?: Attachment[];
  currentContent?: string;
  lang?: Lang;
  title?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequest;

    if (!body.message || typeof body.message !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid `message`." },
        { status: 400 },
      );
    }

    const lang = body.lang ?? "en";
    const title = body.title ?? "New page";

    const systemPrompt = getSystemPrompt({
      lang,
      currentHtml: body.currentContent,
    });

    const client = createLLMClient();
    const rawHtml = await client.generateHtml({
      systemPrompt,
      userMessage: body.message,
      attachments: body.attachments,
      history: body.history,
      currentHtml: body.currentContent,
    });

    // --- Dispatch: edit mode first, fall through to full mode ---
    //
    // Edit mode only makes sense when there's a page to edit. And even if
    // there is, the model can still choose full mode for a sweeping change.
    // We only commit to edit mode when BOTH:
    //   - currentContent exists, AND
    //   - parseEdits() returns a non-empty op list.
    let content: string;
    let mode: "edit" | "full" = "full";
    let editsApplied: number | undefined;
    let editsFailed: string[] | undefined;

    if (body.currentContent) {
      const ops = parseEdits(rawHtml);
      if (ops && ops.length > 0) {
        const result = applyEdits(body.currentContent, ops);
        if (result.applied === 0) {
          // The model tried to edit but nothing landed — usually a bad
          // selector. Surface it so the user can rephrase, rather than
          // silently doing nothing.
          return NextResponse.json(
            {
              error: "Claude tried to edit the page but no selectors matched.",
              editsFailed: result.errors,
            },
            { status: 422 },
          );
        }
        mode = "edit";
        editsApplied = result.applied;
        editsFailed = result.errors.length ? result.errors : undefined;

        // Re-split breadcrumb + main from the edited HTML. extractContent
        // is tolerant enough to handle input that already has both parts.
        const split = extractContent(result.html);
        content = `${split.breadcrumb}\n${split.main}`;
      } else {
        // No edit block — treat as full regeneration.
        const split = extractContent(rawHtml);
        content = `${split.breadcrumb}\n${split.main}`;
      }
    } else {
      // No current page → always full mode.
      const split = extractContent(rawHtml);
      content = `${split.breadcrumb}\n${split.main}`;
    }

    // Best-effort title extraction: pull from the new <h1 id="wb-cont">
    const newTitle = extractH1(content) ?? title;

    const composed = compose({ title: newTitle, content, lang });

    return NextResponse.json({
      content,
      composed,
      title: newTitle,
      lang,
      mode,
      editsApplied,
      editsFailed,
    });
  } catch (err) {
    console.error("[chat] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function extractH1(main: string): string | null {
  const m = main.match(/<h1[^>]*id=["']wb-cont["'][^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return null;
  // Strip any inner tags for a plain-text title
  return m[1].replace(/<[^>]+>/g, "").trim() || null;
}
