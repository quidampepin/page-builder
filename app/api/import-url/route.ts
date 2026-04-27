/**
 * POST /api/import-url
 *
 * Fetches a Canada.ca URL server-side, extracts the breadcrumb +
 * <main>, strips noise (scripts, styles, AEM author wrappers,
 * tracking comments), and resolves relative URLs to absolute so
 * images and links keep working in the iframe preview.
 *
 * Allowed domains: anything ending in canada.ca, plus
 * wet-boew.github.io (for the official GCWeb examples). Other
 * hosts are rejected to keep this from becoming a generic
 * cross-origin scraper.
 */

import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface ImportRequest {
  url: string;
}

const ALLOWED_HOST_SUFFIXES = [
  "canada.ca",
  "wet-boew.github.io",
];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ImportRequest;
    const url = body.url?.trim();

    if (!url) {
      return NextResponse.json(
        { error: "Missing or empty `url`." },
        { status: 400 },
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json(
        { error: `Invalid URL: ${url}` },
        { status: 400 },
      );
    }

    const host = parsed.hostname.toLowerCase();
    const allowed = ALLOWED_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith("." + suffix),
    );
    if (!allowed) {
      return NextResponse.json(
        {
          error:
            `URL must be on a canada.ca or wet-boew.github.io domain. Got: ${host}`,
        },
        { status: 400 },
      );
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; GC-Page-Builder/1.0; +https://github.com/quidampepin/page-builder)",
        Accept: "text/html",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          error: `Failed to fetch ${url}: ${res.status} ${res.statusText}`,
        },
        { status: 502 },
      );
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Strip noise. Scripts and styles would re-execute in the iframe
    // (we already provide our own); meta/link tags duplicate the shell;
    // comments are usually CMS tracking detritus.
    $("script, style, noscript, link, meta").remove();
    $("*")
      .contents()
      .each(function () {
        if (this.type === "comment") $(this).remove();
      });

    // Resolve site-relative URLs to absolute against the source origin
    // so images and links work when the content lands in our iframe.
    const origin = `${parsed.protocol}//${parsed.host}`;
    const resolveAttrs = ["href", "src", "data-src", "data-incl-name"];
    $("a, img, source, iframe, link").each((_, el) => {
      for (const attr of resolveAttrs) {
        const val = $(el).attr(attr);
        if (val && val.startsWith("/")) {
          $(el).attr(attr, origin + val);
        }
      }
    });

    // Extract breadcrumb. Some Canada.ca pages put it inside the
    // header rather than at the top level — find it wherever it lives.
    const $bc = $("#wb-bc, nav[property='breadcrumb']").first();
    const breadcrumb = $bc.length ? $.html($bc).trim() : "";

    // Extract <main>. This is the content area we care about.
    const $main = $("main").first();
    if (!$main.length) {
      return NextResponse.json(
        {
          error:
            "Could not find a <main> element on the page. Is this a Canada.ca content page?",
        },
        { status: 422 },
      );
    }
    const main = $.html($main).trim();

    // Extract title — prefer the page H1, fall back to the document
    // <title> with the " - Canada.ca" suffix stripped.
    const h1 = $("h1#wb-cont, h1[property='name']").first().text().trim();
    const docTitle = $("title")
      .text()
      .replace(/\s*-\s*Canada\.ca\s*$/i, "")
      .trim();
    const title = h1 || docTitle || "Imported page";

    return NextResponse.json({
      title,
      breadcrumb,
      main,
      content: breadcrumb ? `${breadcrumb}\n${main}` : main,
      sourceUrl: url,
    });
  } catch (err) {
    console.error("[import-url] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
