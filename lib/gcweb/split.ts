/**
 * Section split/join for the page content (breadcrumb + <main>).
 *
 * Smart re-translate needs to compare the current source against a snapshot
 * on a per-section basis, so we need a deterministic way to split the
 * content into translatable chunks and later reassemble them.
 *
 * A "section" for our purposes is either:
 *   - the breadcrumb (if present) — always first
 *   - a top-level child element of <main>
 *
 * Everything that isn't an element (stray text nodes, comments) stays with
 * whichever adjacent element is nearest, so round-tripping split → join is
 * lossless for the HTML your LLM actually produces.
 *
 * Why DOMParser, not regex: GCWeb markup nests deeply, and top-level
 * children inside <main> can include sections, divs, ols, and callouts.
 * Regex would be fragile — we need a real parser.
 *
 * Browser-only (uses DOMParser). Don't import this from server code.
 */

export interface SplitContent {
  /** outerHTML of the breadcrumb nav, or null if absent. */
  breadcrumb: string | null;
  /**
   * Serialized opening tag for <main>, including all attributes, e.g.
   * `<main property="mainContentOfPage" resource="#wb-main" typeof="WebPageElement" class="container">`.
   * Preserved verbatim so reassembly doesn't drift.
   */
  mainOpenTag: string;
  /** outerHTML of each top-level element inside <main>, in document order. */
  sections: string[];
}

/**
 * Split a content string into breadcrumb + main open tag + list of sections.
 *
 * Returns empty arrays / nulls for an empty or malformed content string —
 * callers should check and fall back to full-translation behaviour.
 */
export function splitContent(content: string): SplitContent {
  if (!content?.trim() || typeof DOMParser === "undefined") {
    return { breadcrumb: null, mainOpenTag: "<main>", sections: [] };
  }
  const doc = new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${content}</body></html>`,
    "text/html",
  );
  const body = doc.body;

  // Breadcrumb: the first <nav id="wb-bc"> found at the top level of body.
  // Some variants use different IDs so we fall back to any .breadcrumb nav.
  let breadcrumb: string | null = null;
  const nav = body.querySelector(
    ':scope > nav#wb-bc, :scope > nav[aria-label="Canada.ca"], :scope > nav.breadcrumb',
  );
  if (nav) breadcrumb = nav.outerHTML;

  const main = body.querySelector("main");
  if (!main) {
    return { breadcrumb, mainOpenTag: "<main>", sections: [] };
  }

  const mainOpenTag = serializeOpenTag(main);
  const sections = Array.from(main.children).map((el) => el.outerHTML);

  return { breadcrumb, mainOpenTag, sections };
}

/**
 * Rebuild a content string from the pieces. Inverse of splitContent() when
 * given the same mainOpenTag and ordering. Newlines between sections are
 * for readability only — your compose pipeline normalizes whitespace anyway.
 */
export function joinContent(parts: SplitContent): string {
  const pieces: string[] = [];
  if (parts.breadcrumb) pieces.push(parts.breadcrumb);
  pieces.push(parts.mainOpenTag);
  for (const s of parts.sections) pieces.push(s);
  pieces.push("</main>");
  return pieces.join("\n");
}

/**
 * Serialize just the opening tag of an element, preserving attributes in
 * their original order. The DOM API gives us outerHTML (full tree) or
 * attribute-by-attribute access — neither directly emits "open tag only".
 * We build it by iterating attributes.
 */
function serializeOpenTag(el: Element): string {
  const name = el.tagName.toLowerCase();
  const attrs: string[] = [];
  for (const attr of Array.from(el.attributes)) {
    // Attribute values are safe because they came from the parsed DOM.
    // Escape only the minimal set required inside a double-quoted attr value.
    const escaped = attr.value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    attrs.push(`${attr.name}="${escaped}"`);
  }
  return attrs.length > 0
    ? `<${name} ${attrs.join(" ")}>`
    : `<${name}>`;
}

/**
 * Extract the h1 text from a content string. Used by smart-translate to
 * decide whether the page title changed relative to a snapshot.
 */
export function extractTitle(content: string): string {
  if (!content || typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${content}</body></html>`,
    "text/html",
  );
  const h1 = doc.querySelector("h1");
  return (h1?.textContent || "").trim();
}

/**
 * Normalize a section's HTML for comparison. We care whether the *meaning*
 * changed, not whether whitespace did. Collapse runs of whitespace, trim,
 * and lowercase tag names (DOMParser already does the last one but defence
 * in depth is cheap).
 */
export function normalizeForDiff(html: string): string {
  return html
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim();
}
