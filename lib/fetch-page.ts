/**
 * Fetch a single Canada.ca page and extract the pieces we care about:
 * title, breadcrumb, <main>, and the in-content links (used by the crawler
 * to discover child pages).
 *
 * This mirrors the extraction the sibling page-builder does in
 * app/api/import-url, but adds link harvesting and keeps the raw <main>
 * so we can both preview it and feed it to the LLM.
 */

import * as cheerio from "cheerio";

export const ALLOWED_HOST_SUFFIXES = ["canada.ca", "wet-boew.github.io"];

export function isAllowedHost(host: string): boolean {
  host = host.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith("." + suffix),
  );
}

/** Strip fragments + trailing slash so two spellings of a URL dedupe. */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    // Drop tracking-ish query params but keep meaningful ones untouched —
    // for Canada.ca content pages query strings are rare, so just clear the
    // hash and normalize a trailing slash on the path.
    let path = u.pathname;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    u.pathname = path;
    return u.toString();
  } catch {
    return raw;
  }
}

export interface FetchedPage {
  url: string;
  title: string;
  breadcrumb: string;
  main: string;
  content: string;
  /** Absolute, same-host links found inside <main>. */
  links: string[];
}

const UA =
  "Mozilla/5.0 (compatible; GC-Site-Auditor/1.0; +https://github.com/quidampepin/page-builder)";

export async function fetchPage(url: string): Promise<FetchedPage> {
  const parsed = new URL(url);
  if (!isAllowedHost(parsed.hostname)) {
    throw new Error(
      `URL must be on a canada.ca or wet-boew.github.io domain. Got: ${parsed.hostname}`,
    );
  }

  // Bound the request so a slow/hanging origin can't tie up a serverless
  // function until the platform timeout.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      redirect: "follow",
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Timed out fetching ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }

  // SSRF guard: if the origin redirected us off the allow-list, refuse.
  try {
    const finalHost = new URL(res.url).hostname;
    if (finalHost && !isAllowedHost(finalHost)) {
      throw new Error(`Refused: ${url} redirected to a disallowed host (${finalHost}).`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Refused:")) throw e;
  }

  // Cap the body so a pathologically large page can't exhaust memory.
  const lenHeader = Number(res.headers.get("content-length") || 0);
  if (lenHeader && lenHeader > 8_000_000) {
    throw new Error(`Refused: ${url} is too large (${lenHeader} bytes).`);
  }
  const html = (await res.text()).slice(0, 8_000_000);
  const $ = cheerio.load(html);

  const origin = `${parsed.protocol}//${parsed.host}`;

  // Harvest in-content links BEFORE we strip anything, resolving relative
  // hrefs to absolute against the source origin.
  const links: string[] = [];
  const $mainForLinks = $("main").first();
  $mainForLinks.find("a[href]").each((_, el) => {
    let href = $(el).attr("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return;
    }
    if (href.startsWith("/")) href = origin + href;
    if (!/^https?:\/\//i.test(href)) return;
    links.push(href);
  });

  // Now strip noise for the preview/content copy.
  $("script, style, noscript, link, meta").remove();
  $("*")
    .contents()
    .each(function () {
      if (this.type === "comment") $(this).remove();
    });

  const resolveAttrs = ["href", "src", "data-src", "data-incl-name"];
  $("a, img, source, iframe, link").each((_, el) => {
    for (const attr of resolveAttrs) {
      const val = $(el).attr(attr);
      if (val && val.startsWith("/")) $(el).attr(attr, origin + val);
    }
  });

  const $bc = $("#wb-bc, nav[property='breadcrumb']").first();
  const breadcrumb = $bc.length ? ($.html($bc) || "").trim() : "";

  const $main = $("main").first();
  const main = $main.length ? ($.html($main) || "").trim() : "";

  const h1 = $("h1#wb-cont, h1[property='name'], main h1").first().text().trim();
  const docTitle = $("title")
    .text()
    .replace(/\s*-\s*Canada\.ca\s*$/i, "")
    .trim();
  const title = h1 || docTitle || url;

  return {
    url,
    title,
    breadcrumb,
    main,
    content: breadcrumb ? `${breadcrumb}\n${main}` : main,
    links,
  };
}
