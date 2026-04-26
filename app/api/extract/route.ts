/**
 * POST /api/extract
 *
 * Accepts multipart/form-data with one file field named "file" and returns
 * the normalized attachment payload the chat API expects:
 *
 *   { filename, mimeType, text?: string, base64?: string }
 *
 * Dispatches on mime type:
 *   - .docx  → mammoth → markdown text
 *   - .pdf   → pdf-parse text layer
 *   - .txt/.md/.html → UTF-8 text passthrough
 *   - image/* (jpeg, png, gif, webp) → base64
 *   - other  → 415
 */

import { NextRequest, NextResponse } from "next/server";
import { extractDocx } from "@/lib/extractors/docx";
import { extractPdf } from "@/lib/extractors/pdf";
import { toBase64 } from "@/lib/extractors/image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024; // 15MB safety cap

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large (${file.size} bytes, max ${MAX_BYTES})` },
        { status: 413 },
      );
    }

    const filename =
      (file as File).name || (form.get("filename") as string) || "upload";
    const mimeType = file.type || inferMime(filename);
    const buffer = Buffer.from(await file.arrayBuffer());

    const payload: {
      filename: string;
      mimeType: string;
      text?: string;
      base64?: string;
    } = { filename, mimeType };

    if (isImage(mimeType)) {
      payload.base64 = toBase64(buffer);
    } else if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      filename.toLowerCase().endsWith(".docx")
    ) {
      payload.text = await extractDocx(buffer);
    } else if (mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) {
      const text = await extractPdf(buffer);
      // If the PDF has no text layer, fall back to sending the first page as
      // an image via base64 so Claude's vision can still read it. For v1 we
      // just send the text we got; callers can retry with an image if empty.
      payload.text = text;
    } else if (isJson(mimeType, filename)) {
      // Pretty-print so Claude sees well-structured content instead of a
      // potentially-minified blob. Fall back to raw text if it's not valid
      // JSON (e.g. JSONC or broken).
      const raw = buffer.toString("utf8");
      try {
        payload.text = JSON.stringify(JSON.parse(raw), null, 2);
      } catch {
        payload.text = raw;
      }
    } else if (isPlainText(mimeType, filename)) {
      payload.text = buffer.toString("utf8");
    } else {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${mimeType} (${filename}). Supported: .docx, .pdf, .txt, .md, .html, images.`,
        },
        { status: 415 },
      );
    }

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[extract] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isImage(mime: string): boolean {
  return ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime);
}

function isPlainText(mime: string, filename: string): boolean {
  const lower = filename.toLowerCase();
  if (mime.startsWith("text/")) return true;
  return (
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".markdown") ||
    lower.endsWith(".html") ||
    lower.endsWith(".htm")
  );
}

function isJson(mime: string, filename: string): boolean {
  return (
    mime === "application/json" || filename.toLowerCase().endsWith(".json")
  );
}

function inferMime(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".md") || lower.endsWith(".markdown"))
    return "text/markdown";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}
