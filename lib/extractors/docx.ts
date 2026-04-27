/**
 * Extract text from a .docx file.
 *
 * Mammoth used to ship a `convertToMarkdown` helper but dropped it in
 * 1.x. We use `convertToHtml` (preserves headings/lists/links) and run
 * a tiny tag→markdown transform so the output keeps useful structure
 * when the LLM ingests it as prose.
 *
 * Two extras beyond mammoth's default:
 *   1. Hyperlinks are converted to `[text](url)` markdown so URLs
 *      survive the bare-tag strip later in the pipeline. Without this,
 *      `<a href="...">text</a>` becomes just "text" and the LLM has
 *      no link target to preserve in its output.
 *   2. Word review comments are extracted from `word/comments.xml`
 *      inside the .docx zip and appended as a "Document comments"
 *      section. This lets reviewers leave guidance for the LLM
 *      directly in the source document.
 */

import mammoth from "mammoth";
import JSZip from "jszip";

export async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer });
  if (result.messages.length) {
    console.log(
      `[docx] ${result.messages.length} extraction notes:`,
      result.messages.slice(0, 3),
    );
  }

  const body = htmlToMarkdownish(result.value).trim();
  const comments = await extractComments(buffer);

  if (comments.length === 0) return body;

  // Append comments as a labeled section so the LLM can tell them
  // apart from main content and treat them as guidance.
  const commentsBlock =
    "\n\n---\n\n## Document comments (reviewer guidance)\n\n" +
    comments.map((c, i) => `${i + 1}. ${c}`).join("\n");
  return body + commentsBlock;
}

/**
 * Pull review comments out of `word/comments.xml` inside the .docx
 * zip. The format is well-known — each comment is a `<w:comment>`
 * element containing `<w:t>` runs with the visible text. We don't
 * need a full XML parser; a regex grabs the text runs in order.
 *
 * Returns [] if the file has no comments or extraction fails. We
 * never throw — comments are best-effort, not mandatory.
 */
async function extractComments(buffer: Buffer): Promise<string[]> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const file = zip.file("word/comments.xml");
    if (!file) return [];
    const xml = await file.async("text");

    // Each comment groups <w:t> runs between <w:comment> and </w:comment>.
    // Walk comment-by-comment so multi-paragraph comments stay together.
    const comments: string[] = [];
    const commentBlocks = xml.match(/<w:comment\b[\s\S]*?<\/w:comment>/g) || [];
    for (const block of commentBlocks) {
      const runs = block.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
      const text = runs
        .map((r) => r.replace(/<[^>]+>/g, ""))
        .join("")
        .trim();
      if (text) comments.push(text);
    }
    return comments;
  } catch (err) {
    console.log("[docx] failed to extract comments:", err);
    return [];
  }
}

/**
 * Mammoth's HTML output → markdown-ish plain text. Preserves heading
 * hierarchy, list shape, and hyperlinks; strips everything else.
 */
function htmlToMarkdownish(html: string): string {
  return html
    // Hyperlinks first — must run before the bare-tag strip below or
    // the href gets lost. Capture the href and inner text into a
    // `[text](url)` markdown link.
    .replace(
      /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
      "[$2]($1)",
    )
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
