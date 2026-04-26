/**
 * Anthropic API adapter — uses @anthropic-ai/sdk with an API key from env.
 *
 * Reads ANTHROPIC_API_KEY and ANTHROPIC_MODEL from process.env. Supports
 * text + image attachments via Claude's vision input.
 *
 * Design note: the subscription path (OAuth via Claude Agent SDK) would be
 * a sibling file — e.g. claude-subscription.ts — that exports the same
 * `generateHtml` function. The factory in ./index.ts picks which to load.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  Attachment,
  ChatTurn,
  GenerateHtmlOptions,
  LLMClient,
} from "./types";

const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 8192;

export function createAnthropicClient(): LLMClient {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example → .env.local and add your key from https://console.anthropic.com/.",
    );
  }
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey });

  return {
    async generateHtml({
      systemPrompt,
      userMessage,
      attachments = [],
      history = [],
    }: GenerateHtmlOptions): Promise<string> {
      const messages: Anthropic.Messages.MessageParam[] = [];

      // Prior conversation turns (kept short by the caller — full transcript
      // isn't necessary since the current HTML is injected via systemPrompt).
      for (const turn of history) {
        messages.push({
          role: turn.role,
          content: turn.content,
        });
      }

      // Build the latest user turn as a multimodal content array.
      const userContent: Anthropic.Messages.ContentBlockParam[] = [];
      for (const att of attachments) {
        userContent.push(...attachmentToBlocks(att));
      }
      userContent.push({ type: "text", text: userMessage });

      messages.push({ role: "user", content: userContent });

      const res = await client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages,
      });

      // Concatenate all text blocks in the response.
      const html = res.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();

      if (!html) {
        throw new Error("LLM returned no text content.");
      }
      return html;
    },
  };
}

function attachmentToBlocks(
  att: Attachment,
): Anthropic.Messages.ContentBlockParam[] {
  if (att.base64 && isSupportedImage(att.mimeType)) {
    return [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: att.mimeType as
            | "image/jpeg"
            | "image/png"
            | "image/gif"
            | "image/webp",
          data: att.base64,
        },
      },
      { type: "text", text: `[Image attached: ${att.filename}]` },
    ];
  }

  if (att.text) {
    return [
      {
        type: "text",
        text: `[File: ${att.filename}]\n\n${att.text}`,
      },
    ];
  }

  // Fallback: acknowledge the attachment so the LLM knows something was sent.
  return [
    {
      type: "text",
      text: `[File attached but could not be extracted: ${att.filename} (${att.mimeType})]`,
    },
  ];
}

function isSupportedImage(mime: string): boolean {
  return ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime);
}

// Re-export for convenience
export type { ChatTurn, GenerateHtmlOptions, LLMClient, Attachment };
