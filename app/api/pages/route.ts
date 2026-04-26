/**
 * /api/pages — DEPRECATED.
 *
 * Save/load moved client-side: save() in app/page.tsx now downloads a
 * .gcpage.json file and load() reads one back via a file picker. That
 * change was needed so the app runs on Vercel, whose serverless
 * functions have a read-only filesystem.
 *
 * This stub is kept (rather than deleted) only because the FUSE mount
 * the agent works through wouldn't let it remove the file. It returns
 * 410 Gone for both GET and POST so any stray request from a stale
 * client gets a clear, intentional error rather than a 404 mystery.
 */

import { NextResponse } from "next/server";

const GONE = NextResponse.json(
  {
    error:
      "This endpoint has been removed. Save/load is now client-side — " +
      "the Save button downloads a .gcpage.json file and Load reads one " +
      "back via the file picker.",
  },
  { status: 410 },
);

export function GET() {
  return GONE;
}

export function POST() {
  return GONE;
}
