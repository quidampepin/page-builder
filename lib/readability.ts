/**
 * Readability metrics for a page's visible text — computed client-side, no LLM.
 *
 * Canada.ca aims for a low reading grade (roughly grade 6–8). This gives an
 * objective, before/after number as you edit. Flesch-Kincaid is English-
 * calibrated; for French we still report the structural metrics (sentence
 * length, long-word %, passive voice) which remain useful, and flag the caveat.
 */

export interface Readability {
  words: number;
  sentences: number;
  avgWordsPerSentence: number;
  complexWordPct: number; // % words with 3+ syllables
  passiveHits: number;
  gradeLevel: number; // Flesch-Kincaid grade
  readingSeconds: number;
}

/** Strip HTML to visible text (drops script/style, decodes a few entities). */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return word.length ? 1 : 0;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const m = word.match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}

const PASSIVE =
  /\b(?:am|is|are|was|were|be|been|being|get|got|gets)\b\s+(?:\w+ly\s+)?(?:\w+ed|written|done|made|given|taken|seen|known|shown|held|found|sent|kept|built|paid|met|read|set|put|told|left)\b/gi;

export function readability(html: string): Readability {
  const text = htmlToText(html);
  const wordTokens = text.match(/[A-Za-zÀ-ÿ'’-]+/g) ?? [];
  const words = wordTokens.length;
  const sentenceTokens = text.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().length > 0);
  const sentences = Math.max(1, sentenceTokens.length);

  let syllables = 0;
  let complex = 0;
  for (const w of wordTokens) {
    const syl = countSyllables(w);
    syllables += syl;
    if (syl >= 3) complex += 1;
  }

  const avgWordsPerSentence = words ? words / sentences : 0;
  const gradeLevel = words
    ? 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59
    : 0;
  const passiveHits = (text.match(PASSIVE) ?? []).length;

  return {
    words,
    sentences,
    avgWordsPerSentence: round1(avgWordsPerSentence),
    complexWordPct: words ? round1((complex / words) * 100) : 0,
    passiveHits,
    gradeLevel: round1(Math.max(0, gradeLevel)),
    readingSeconds: Math.round((words / 200) * 60),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** A friendly band for a grade level, for a badge colour. */
export function gradeBand(grade: number): { label: string; tone: "good" | "ok" | "high" } {
  if (grade <= 8) return { label: "Plain (grade ≤ 8)", tone: "good" };
  if (grade <= 11) return { label: "Moderate", tone: "ok" };
  return { label: "Complex", tone: "high" };
}
