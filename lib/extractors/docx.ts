/**
 * Extract text from a .docx file. Mammoth returns markdown-ish output that
 * preserves structure (headings, lists) without all the Word XML noise.
 */

import mammoth from "mammoth";

export async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToMarkdown({ buffer });
  // Mammoth attaches warnings to result.messages; we swallow them to keep
  // the UI clean. Log them server-side for debugging.
  if (result.messages.length) {
    console.log(
      `[docx] ${result.messages.length} extraction notes:`,
      result.messages.slice(0, 3),
    );
  }
  return result.value.trim();
}
