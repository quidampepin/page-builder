/**
 * LLMClient — the single provider-agnostic surface the rest of the app uses.
 *
 * Today we have one implementation (anthropic.ts). Swapping providers later
 * (a local LLM, OpenAI, Google, a subscription-based Claude adapter, whatever)
 * means writing another file that exports `generateHtml` with this signature
 * and updating the factory in ./index.ts.
 */

export interface Attachment {
  /** Filename used for logging and extractor dispatch. */
  filename: string;
  /** MIME type as reported by the browser or inferred from extension. */
  mimeType: string;
  /**
   * Normalized content. Exactly one of `text` or `base64` is set:
   *   - `text`  : extracted prose (docx, txt, md, html, pdf text layer, ...)
   *   - `base64`: raw bytes for LLM vision (images, scanned PDFs)
   */
  text?: string;
  base64?: string;
}

export interface GenerateHtmlOptions {
  /** System prompt — the composed GCWeb instructions. */
  systemPrompt: string;
  /** Latest user message. */
  userMessage: string;
  /** Files attached alongside the user message. */
  attachments?: Attachment[];
  /**
   * The page's current HTML (breadcrumb + <main>) if we're editing. The API
   * route injects this into the system prompt; adapters can also pass it as
   * a context message if that's more natural for the provider.
   */
  currentHtml?: string;
  /** Prior turns so the LLM has conversational context. */
  history?: ChatTurn[];
  /**
   * Coarse hint about which API route is calling. The Anthropic adapter
   * uses this to pick a model: "translate" → ANTHROPIC_TRANSLATE_MODEL
   * (defaults to fast Haiku), anything else → ANTHROPIC_MODEL.
   *
   * The purpose split exists because translate is structure-preserving
   * text swap that doesn't need a reasoning-heavy model, and translate
   * is the route most likely to bump against Vercel's 60s timeout. Using
   * a faster model just for translate is the cheapest fix.
   */
  purpose?: "chat" | "translate" | "analysis";
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface LLMClient {
  /**
   * Send the prompt and attachments to the LLM and get back raw HTML
   * (breadcrumb + <main>). Throws on API errors so the route can surface
   * them to the UI.
   */
  generateHtml(opts: GenerateHtmlOptions): Promise<string>;
}
