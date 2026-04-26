/**
 * LLM client factory.
 *
 * Reads LLM_PROVIDER from env and returns the matching adapter. Today there's
 * only one. To add another: implement ./<name>.ts exporting a factory, import
 * it here, and add a case in the switch.
 */

import { createAnthropicClient } from "./anthropic";
import type { LLMClient } from "./types";

export function createLLMClient(): LLMClient {
  const provider = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();
  switch (provider) {
    case "anthropic":
      return createAnthropicClient();
    // case "claude-subscription":
    //   return createClaudeSubscriptionClient();
    default:
      throw new Error(
        `Unknown LLM_PROVIDER "${provider}". Set LLM_PROVIDER=anthropic in .env.local.`,
      );
  }
}

export type { LLMClient } from "./types";
export type { Attachment, ChatTurn, GenerateHtmlOptions } from "./types";
