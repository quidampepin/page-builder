/**
 * Extract text from a PDF. Uses pdf-parse which pulls the text layer — this
 * works for most government PDFs (they're born-digital, not scanned). For
 * scanned PDFs we'd need OCR, which v1 doesn't bother with; the base64 path
 * in the API route passes the raw bytes as an image attachment so Claude's
 * vision model can read it.
 */

// Dynamic import — pdf-parse has a module-level side effect that scans for
// test files on `require`, which Next dev trips over. Lazy-import inside the
// function so bundling behaves.
export async function extractPdf(buffer: Buffer): Promise<string> {
  const { default: pdfParse } = await import("pdf-parse");
  const res = await pdfParse(buffer);
  return (res.text || "").trim();
}
