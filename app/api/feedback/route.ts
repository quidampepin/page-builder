/**
 * POST /api/feedback
 *
 * Reads the IRCC feedback CSV (path from FEEDBACK_CSV_PATH, default
 * ./data/ircc-feedback.csv) and returns the comments that match a page URL.
 * Auto-detects the URL / comment / date columns. With `subtree: true` it also
 * returns comments for pages under the given URL.
 *
 * Body: { url: string, subtree?: boolean }
 * Returns a FeedbackResult.
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { matchFeedback } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveCsvPath(): string {
  const configured = process.env.FEEDBACK_CSV_PATH?.trim();
  const rel = configured || "./data/ircc-feedback.csv";
  if (path.isAbsolute(rel)) return rel;
  const candidates = [path.join(process.cwd(), rel)];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { url?: string; subtree?: boolean };
    const url = body.url?.trim();
    if (!url) {
      return NextResponse.json({ error: "Missing `url`." }, { status: 400 });
    }
    const subtree = body.subtree === true;

    const csvPath = resolveCsvPath();
    if (!fs.existsSync(csvPath)) {
      return NextResponse.json({
        url,
        subtree,
        matched: [],
        totalRows: 0,
        columns: { url: null, comment: null, date: null },
        note:
          `No feedback CSV found. Drop your export at data/ircc-feedback.csv ` +
          `(or set FEEDBACK_CSV_PATH). Looked for: ${csvPath}`,
      });
    }

    const csvText = fs.readFileSync(csvPath, "utf8");
    const result = matchFeedback(csvText, url, subtree);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[feedback] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
