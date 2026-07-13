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
    u.hostname = u.hostname.toLowerCase();
    // Drop tracking/query noise so the same page linked with different
    // campaign params doesn't show up as several nodes.
    const TRACK = /^(utm_|mc_|_ga|gclid|fbclid|mkt_tok|cmpid|wbdisable$|ga$|cid$|src$|source$|ref$|referrer$)/i;
    for (const k of [...u.searchParams.keys()]) {
      if (TRACK.test(k)) u.searchParams.delete(k);
    }
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

/**
 * Resolve a possibly-relative URL against the page it was found on. Leaves
 * data:, mailto:, tel:, javascript:, and pure #fragments untouched; returns
 * "" for empty input.
 */
function toAbsolute(val: string | undefined, pageUrl: string): string {
  if (!val) return "";
  const v = val.trim();
  if (!v || v.startsWith("#") || /^(data:|mailto:|tel:|javascript:)/i.test(v)) return v;
  try {
    return new URL(v, pageUrl).href;
  } catch {
    return v;
  }
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
    const abs = toAbsolute($(el).attr("href") || "", url);
    if (abs && /^https?:\/\//i.test(abs)) links.push(abs);
  });

  // Now strip noise for the preview/content copy.
  $("script, style, noscript, link, meta").remove();
  $("*")
    .contents()
    .each(function () {
      if (this.type === "comment") $(this).remove();
    });

  // Resolve every asset/link reference to an absolute URL against the SOURCE
  // page URL (not just the origin) so images and links using page-relative
  // paths (e.g. "images/x.jpg", "../y.png") keep working in the iframe.
  const resolveAttrs = ["href", "src", "data-src", "data-incl-name", "poster"];
  $("a, img, source, iframe, link, video, audio").each((_, el) => {
    for (const attr of resolveAttrs) {
      const val = $(el).attr(attr);
      const abs = toAbsolute(val, url);
      if (abs && abs !== val) $(el).attr(attr, abs);
    }
    // Responsive images: resolve each candidate in srcset.
    const srcset = $(el).attr("srcset");
    if (srcset) {
      const fixed = srcset
        .split(",")
        .map((part) => {
          const seg = part.trim();
          if (!seg) return seg;
          const sp = seg.split(/\s+/);
          const abs = toAbsolute(sp[0], url);
          return abs ? [abs, ...sp.slice(1)].join(" ") : seg;
        })
        .join(", ");
      $(el).attr("srcset", fixed);
    }
  });

  const $bc = $("#wb-bc, nav[property='breadcrumb']").first();
  const breadcrumb = $bc.length ? ($.html($bc) || "").trim() : "";

  const $main = $("main").first();
  const main = $main.length ? ($.html($main) || "").trim() : "";

  // Prefer the <title> tag: it's unique per page. Canada.ca subway/application
  // pages repeat a program-level H1 across every step ("Visitor visa"), so the
  // H1 doesn't distinguish them — but the <title> does. Strip the trailing
  // " - Canada.ca" (or "– Canada.ca" / "| Canada.ca") site suffix.
  const docTitle = $("title")
    .text()
    .replace(/\s*[-–|]\s*Canada\.ca\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const h1 = $("h1#wb-cont, h1[property='name'], main h1")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();
  const title = docTitle || h1 || url;

  return {
    url,
    title,
    breadcrumb,
    main,
    content: breadcrumb ? `${breadcrumb}\n${main}` : main,
    links,
  };
}
