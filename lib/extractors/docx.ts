/**
 * Extract text from a .docx file.
 *
 * Mammoth used to ship a `convertToMarkdown` helper but dropped it in
 * 1.x — the typed API only exposes `convertToHtml` and
 * `extractRawText`. We use `convertToHtml` (preserves headings/lists)
 * and run a tiny tag→markdown transform so the output keeps useful
 * structure when the LLM ingests it as prose.
 *
 * The transform is intentionally crude: it covers the elements
 * mammoth typically emits (h1–h6, p, ul/ol/li, strong/em, br) and
 * strips everything else. Word documents rarely contain weirder HTML
 * than that, and the LLM is forgiving about minor noise.
 */

import mammoth from "mammoth";

export async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer });
  // Mammoth attaches warnings to result.messages; we swallow them to keep
  // the UI clean. Log them server-side for debugging.
  if (result.messages.length) {
    console.log(
      `[docx] ${result.messages.length} extraction notes:`,
      result.messages.slice(0, 3),
    );
  }
  return htmlToMarkdownish(result.value).trim();
}

/**
 * Mammoth's HTML output → markdown-ish plain text.
 *
 * Why "markdown-ish": this isn't a full HTML→MD converter (we don't
 * need that — the consumer is an LLM, not a renderer). The goal is
 * just to preserve heading hierarchy and list shape so the LLM can
 * tell sections apart.
 */
function htmlToMarkdownish(html: string): string {
  return html
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n")
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n")
    .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n##### $1\n")
    .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n###### $1\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
    .replace(/<\/(p|ul|ol|div)>/gi, "\n")
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, "*$2*")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "") // strip any remaining tags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n");
}
