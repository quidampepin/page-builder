/**
 * Client-side component insertion.
 *
 * Takes the current page content (breadcrumb + <main>), parses it with the
 * browser's native DOMParser, inserts the component HTML at the chosen
 * location, and returns the updated content string.
 *
 * This is the sibling of the server-side applyEdits() in edits.ts. That
 * one runs cheerio on the server for LLM-generated diffs. This one runs
 * in the browser for user-driven palette insertions. Keeping them
 * separate means the palette doesn't need a round-trip to the server —
 * insertion is instant, no LLM call, no network.
 *
 * Insertions always land inside <main>. The breadcrumb and any shell-level
 * elements are never touched.
 */

export type InsertKind = "top" | "bottom" | "before" | "after";

export interface InsertLocation {
  kind: InsertKind;
  /**
   * For "before" / "after" only — index into the flat list of h2 elements
   * found inside <main>, in document order. Must match the index used in
   * the option produced by getInsertLocations() so the two stay in sync.
   */
  sectionIndex?: number;
}

export interface InsertLocationOption {
  /** Human-readable label for the dropdown. */
  label: string;
  /** Stable value for a <select> — "top" / "bottom" / "before-2" / "after-0". */
  value: string;
  location: InsertLocation;
}

/**
 * Scan the current content for h2s inside <main> and return the list of
 * insertion points to offer in the dropdown.
 *
 * Always includes "At the top" and "At the bottom". For each h2, adds
 * "Before <section title>" and "After <section title>" entries so the
 * user can target a specific section by name, not index.
 *
 * Safe to call with empty content — returns just top/bottom.
 */
export function getInsertLocations(content: string): InsertLocationOption[] {
  const options: InsertLocationOption[] = [
    { label: "At the top (after H1)", value: "top", location: { kind: "top" } },
    { label: "At the bottom", value: "bottom", location: { kind: "bottom" } },
  ];
  if (!content) return options;
  // Guard for non-browser contexts (e.g. SSR). The palette is a client-only
  // component, but this file might get imported at module graph boundaries.
  if (typeof DOMParser === "undefined") return options;

  const doc = new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${content}</body></html>`,
    "text/html",
  );
  const main = doc.querySelector("main");
  if (!main) return options;

  const h2s = Array.from(main.querySelectorAll("h2"));
  h2s.forEach((h2, i) => {
    // Skip the invisible "Services and information" heading — targeting
    // "Before/After" it is confusing because there's nothing visible there.
    // Still include it though, because insertion logic uses the full list.
    const raw = (h2.textContent || "").trim();
    const text = raw.slice(0, 40) || `Section ${i + 1}`;
    const label = raw.length > 40 ? `${text}…` : text;
    options.push({
      label: `Before "${label}"`,
      value: `before-${i}`,
      location: { kind: "before", sectionIndex: i },
    });
    options.push({
      label: `After "${label}"`,
      value: `after-${i}`,
      location: { kind: "after", sectionIndex: i },
    });
  });
  return options;
}

/**
 * Insert a component's HTML into the current content at the chosen location.
 *
 * - top:     after the H1 if present, otherwise as the first child of main.
 * - bottom:  before <dl id="wb-dtmd"> (date modified) if present, else appended.
 * - before:  before the <section> containing the nth h2 (or the h2 itself if
 *            not wrapped in a section).
 * - after:   after that same block.
 *
 * If content is empty, seeds a minimal <main> wrapper so the palette can
 * bootstrap the page without requiring the user to run chat first.
 *
 * Returns the updated content string. The breadcrumb (if any) is preserved.
 */
export function insertComponent(
  content: string,
  componentHtml: string,
  location: InsertLocation,
): string {
  if (!content.trim()) {
    // Seed an empty page. Minimal main with an editable h1. User will
    // replace the h1 via chat or inline edit after.
    return `<main property="mainContentOfPage" resource="#wb-main" typeof="WebPageElement" class="container">
<h1 property="name" id="wb-cont">New page</h1>
${componentHtml}
</main>`;
  }

  if (typeof DOMParser === "undefined") {
    // Non-browser fallback: just append. Shouldn't happen in practice.
    return `${content}\n${componentHtml}`;
  }

  const doc = new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${content}</body></html>`,
    "text/html",
  );
  const main = doc.querySelector("main");
  if (!main) {
    // No main in the content — fall back to appending. The LLM should
    // always produce a main, but defensively we don't break here.
    return `${content}\n${componentHtml}`;
  }

  // Parse the component HTML into DOM nodes. Using a throwaway div keeps
  // the implementation simple — document fragments with innerHTML work
  // identically across all browsers.
  const holder = doc.createElement("div");
  holder.innerHTML = componentHtml;
  const nodes = Array.from(holder.childNodes);
  if (nodes.length === 0) return content;

  const insertBefore = (ref: Node) => {
    for (const n of nodes) ref.parentNode?.insertBefore(n, ref);
  };
  const insertAfter = (ref: Node) => {
    // Iterate in reverse so nodes end up in original order when each is
    // inserted immediately after the ref.
    for (const n of [...nodes].reverse()) {
      ref.parentNode?.insertBefore(n, ref.nextSibling);
    }
  };

  switch (location.kind) {
    case "top": {
      const h1 = main.querySelector(":scope > h1");
      if (h1) {
        insertAfter(h1);
      } else {
        for (const n of [...nodes].reverse()) {
          main.insertBefore(n, main.firstChild);
        }
      }
      break;
    }

    case "bottom": {
      const dtmd = main.querySelector(":scope > dl#wb-dtmd");
      if (dtmd) {
        insertBefore(dtmd);
      } else {
        for (const n of nodes) main.appendChild(n);
      }
      break;
    }

    case "before":
    case "after": {
      const h2s = Array.from(main.querySelectorAll("h2"));
      const target = h2s[location.sectionIndex ?? 0];
      if (!target) {
        // Index out of range — degrade to appending at the bottom rather
        // than throwing. The user experience is "component appeared at
        // the end" which is recoverable via undo.
        for (const n of nodes) main.appendChild(n);
        break;
      }
      // If the h2 is wrapped in a <section>, operate on the whole section.
      // Otherwise operate on the h2 itself (plain heading layout).
      const section = target.closest("section");
      const refBlock: Element =
        section && main.contains(section) ? section : target;
      if (location.kind === "before") insertBefore(refBlock);
      else insertAfter(refBlock);
      break;
    }
  }

  return doc.body.innerHTML;
}
