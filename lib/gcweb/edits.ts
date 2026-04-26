/**
 * Diff-based edit protocol for page builder.
 *
 * Why this exists:
 *   Regenerating the full breadcrumb + <main> on every turn is wasteful and
 *   drifty. For an edit like "change the title", the LLM should emit a tiny
 *   edit script, not re-render 10KB of HTML. This module is the other half
 *   of that deal — it parses the script out of the LLM response and applies
 *   it to the current page with cheerio.
 *
 * The protocol:
 *
 *   The LLM emits, as the entire response, a block like this:
 *
 *     <!--GCPB:EDITS-->
 *     [
 *       { "op": "replace", "selector": "h1#wb-cont",
 *         "html": "<h1 property=\"name\" id=\"wb-cont\">New title</h1>" },
 *       { "op": "remove", "selector": "section#intro-alert" }
 *     ]
 *     <!--/GCPB:EDITS-->
 *
 *   The chat route detects the block, calls parseEdits() to pull the ops out,
 *   then applyEdits() against the current HTML. If no block is present, the
 *   response is treated as full HTML via the existing path — so a major
 *   rewrite still works.
 *
 *   The selectors are CSS selectors against the current breadcrumb + <main>.
 *   They're applied by cheerio, which is jQuery-flavoured — so `#foo`,
 *   `.well:first-of-type`, `section[id="cards"] > h2`, etc. all work.
 *
 * Failure mode:
 *   Ops that don't match a selector are collected into `errors`. The caller
 *   decides what to do with them — usually: if at least one op succeeded,
 *   return the partially-edited HTML plus the error list so the UI can warn.
 *   If zero ops succeeded, the caller should surface a retry message.
 */

import * as cheerio from "cheerio";

export type EditOp =
  | { op: "replace"; selector: string; html: string }
  | { op: "insertBefore"; selector: string; html: string }
  | { op: "insertAfter"; selector: string; html: string }
  | { op: "append"; selector: string; html: string }
  | { op: "prepend"; selector: string; html: string }
  | { op: "remove"; selector: string }
  | { op: "setAttr"; selector: string; attr: string; value: string };

export interface EditResult {
  /** Resulting HTML after every successful op was applied. */
  html: string;
  /** How many ops matched and were applied. */
  applied: number;
  /** Human-readable errors — one per op that didn't match / threw. */
  errors: string[];
}

/**
 * Look for a <!--GCPB:EDITS--> block anywhere in `raw` and return the parsed
 * op list. Returns null when:
 *   - the marker isn't present (→ caller uses the full-HTML path), OR
 *   - the JSON inside is malformed (→ caller falls back to full-HTML; we
 *     don't want a bad op list to kill the turn).
 *
 * We tolerate the LLM emitting `<!--/GCPB:EDITS-->` or the cleaner
 * `<!-- /GCPB:EDITS -->` — both variants are accepted.
 */
export function parseEdits(raw: string): EditOp[] | null {
  // Non-greedy, multiline; tolerate whitespace and both close-marker forms.
  const match = raw.match(
    /<!--\s*GCPB:EDITS\s*-->([\s\S]*?)<!--\s*\/?\s*GCPB:EDITS\s*-->/i,
  );
  if (!match) return null;

  const jsonText = match[1].trim();
  if (!jsonText) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    console.warn("[edits] failed to parse JSON block:", err);
    return null;
  }

  if (!Array.isArray(parsed)) return null;

  // Very light shape-check. We don't want to be draconian — cheerio will tell
  // us if a selector is bad, and missing fields become "errors" entries.
  const ops: EditOp[] = [];
  for (const item of parsed) {
    if (item && typeof item === "object" && "op" in item && "selector" in item) {
      ops.push(item as EditOp);
    }
  }
  return ops.length ? ops : null;
}

/**
 * Apply a list of ops to the given HTML, returning the new HTML plus a
 * summary. `currentHtml` is the breadcrumb + <main> string (the "content"
 * field in the chat response), not the full document.
 *
 * Cheerio notes:
 *   - We use xmlMode:false so it tolerates <main> / <section> / etc. as
 *     normal HTML5. The serialized output keeps the original structure.
 *   - Cheerio wraps the input in <html><head/><body/></html>. We peel that
 *     back off at the end by returning $.root().html(), which on the body
 *     equivalent gives us what we fed in (minus the wrapper cheerio added).
 *   - html() on a match returns inner HTML; we use $.html(sel) for outer.
 */
export function applyEdits(currentHtml: string, ops: EditOp[]): EditResult {
  const $ = cheerio.load(currentHtml, null, false);
  // `false` = fragment mode; keeps cheerio from wrapping in <html><body>.
  // See https://cheerio.js.org/docs/basics/loading for the fragment API.

  const errors: string[] = [];
  let applied = 0;

  for (const op of ops) {
    try {
      const nodes = $(op.selector);
      if (nodes.length === 0) {
        errors.push(
          `No match for selector "${op.selector}" (op: ${op.op})`,
        );
        continue;
      }

      switch (op.op) {
        case "replace":
          nodes.replaceWith(op.html);
          break;
        case "insertBefore":
          nodes.first().before(op.html);
          break;
        case "insertAfter":
          nodes.first().after(op.html);
          break;
        case "append":
          nodes.append(op.html);
          break;
        case "prepend":
          nodes.prepend(op.html);
          break;
        case "remove":
          nodes.remove();
          break;
        case "setAttr":
          nodes.attr(op.attr, op.value);
          break;
        default:
          errors.push(`Unknown op: ${(op as { op: string }).op}`);
          continue;
      }
      applied++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Op "${op.op}" on "${op.selector}" threw: ${message}`);
    }
  }

  // In fragment mode, $.html() serializes the whole fragment.
  const html = $.html();

  return { html, applied, errors };
}
