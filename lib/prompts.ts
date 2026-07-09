/**
 * System-prompt builders for each on-demand analysis the auditor runs.
 * Each wraps the relevant skill markdown with an output contract tuned for
 * this tool (plain markdown back, no preamble) — except `proposePrompt`,
 * which reuses the GCWeb HTML output contract so its result can be composed
 * and previewed like any builder page.
 */

import { readOwnSkill, readSharedSkill } from "./skills";
import type { Lang } from "./types";

function langLine(lang: Lang): string {
  return lang === "fr"
    ? "Répondez en français."
    : "Respond in English.";
}

/** Feedback analysis — canada-ca-feedback-analyst. */
export function feedbackAnalysisPrompt(lang: Lang): string {
  const skill = readOwnSkill("canada-ca-feedback-analyst");
  return `You are analyzing real user feedback comments collected from a Canada.ca page.
Follow the skill below exactly. Produce the default output (issue summary table +
sensitive-information check), then ALSO include the "Key insights and improvement
recommendations", "Key phrases", and "Sentiment analysis" sections — the auditor
always wants the full picture.

Return GitHub-flavored Markdown only. No preamble, no code fences around the whole
answer. ${langLine(lang)}

---

${skill}`;
}

/** User tasks — job-stories-writer. */
export function userTasksPrompt(lang: Lang): string {
  const skill = readOwnSkill("job-stories-writer");
  return `You are generating a realistic set of user tasks for the Canada.ca page(s)
provided. Infer who the users are and what they are trying to accomplish from the
page content (and any feedback themes given). Follow the skill below.

Produce:
1. Top job stories organized by the logical flow of the service/program.
2. One usability-testing scenario per top job story (follow the scenario rules —
   answerable, verifiable tasks; never "where would you find" questions).
3. A short list of user need statements.

Return GitHub-flavored Markdown only. No preamble. ${langLine(lang)}

---

${skill}`;
}

/** Heuristic evaluation — ux-reviewer. */
export function heuristicsPrompt(lang: Lang): string {
  const skill = readOwnSkill("ux-reviewer");
  return `You are conducting a professional heuristic evaluation of the Canada.ca page
provided (its rendered <main> HTML is given). Apply the framework in the skill below.
Note explicitly anything that can't be judged from static HTML (keyboard order, screen
reader output, live responsive behaviour).

Use the skill's output format: Summary verdict, Score (letter grade, be a harsh grader),
Findings (ordered Critical -> Major -> Minor, each with What / Why it matters / Heuristic /
Recommendation), What's working, Priority next step.

Return GitHub-flavored Markdown only. No preamble. ${langLine(lang)}

---

${skill}`;
}

/**
 * Propose changes — canada-ca-coder + canada-ca-writer, GCWeb HTML contract.
 * Output is breadcrumb + <main> so the caller can compose() and preview it,
 * and diff it against the original.
 */
export function proposePrompt(lang: Lang): string {
  const coder = readSharedSkill("canada-ca-coder");
  const writer = readSharedSkill("canada-ca-writer");
  const mapping = readSharedSkill("gc-component-mapping");
  const langDirective =
    lang === "fr"
      ? "Write the page in French. Follow https://conception.canada.ca/guide-redaction/ for all style decisions."
      : "Write the page in English. Follow https://design.canada.ca/style-guide/ for all style decisions.";

  return `You are improving an existing Canada.ca page. You are given the page's current
HTML plus, when available, an analysis of real user feedback and a heuristic evaluation.
Rewrite the page to fix the problems surfaced — improving findability, plain language,
task focus, and structure — while keeping the page's real purpose and factual content.

# Rules

- Base your changes on the EVIDENCE provided (feedback themes + heuristic findings) and
  the user's extra instructions. Do not invent new programs, dates, dollar figures, or
  policies. If information is missing, keep the existing wording rather than fabricating.
- Follow the Canada.ca Content Style Guide and plain-language rules from the skills below.
- ${langDirective}

# Output contract (STRICT)

Return ONLY two pieces of HTML, in order, with NO markdown fences, NO preamble, NO
explanation:

1. A breadcrumb: \`<nav id="wb-bc" property="breadcrumb">…</nav>\` (reuse the existing one
   unless the page's place in the hierarchy is clearly wrong).
2. A \`<main property="mainContentOfPage" resource="#wb-main" typeof="WebPageElement"
   class="container">…</main>\` containing \`<h1 property="name" id="wb-cont">\`, the content
   sections, and a \`<dl id="wb-dtmd">\` date-modified block at the end.

Do NOT emit \`<!DOCTYPE>\`, \`<html>\`, \`<head>\`, \`<body>\`, the global header, or the global
footer — those are added by the tool. Stay inside the documented GCWeb / WET-BOEW
Bootstrap-3 vocabulary (see the coder skill). For images use placehold.co URLs only.

---

# Primary reference: canada-ca-coder

${coder}

---

# Voice and tone reference: canada-ca-writer

${writer}

---

# Component reference: gc-component-mapping

${mapping}`;
}
