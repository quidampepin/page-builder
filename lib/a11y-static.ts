/**
 * Cheap, static accessibility signals computed from a page's <main> HTML
 * (no browser, no axe). Used for the section-level rollup where running full
 * axe on every page would be too heavy. The per-page Assess tab still runs the
 * real axe-core check for depth.
 */

export interface A11yStatic {
  images: number;
  imagesMissingAlt: number;
  hasH1: boolean;
  headingJumps: number; // times heading level skips (e.g. h2 -> h4)
  emptyLinks: number;
  score: number; // 0–100, rough
  summary: string;
}

export function a11yStatic(html: string): A11yStatic {
  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  const images = imgs.length;
  const imagesMissingAlt = imgs.filter((t) => !/\balt\s*=\s*["'][^"']*["']/i.test(t)).length;

  const hasH1 = /<h1\b/i.test(html);

  const levels = (html.match(/<h([1-6])\b/gi) ?? []).map((h) => Number(h.match(/([1-6])/)![1]));
  let headingJumps = 0;
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) headingJumps += 1;
  }

  const links = html.match(/<a\b[^>]*>([\s\S]*?)<\/a>/gi) ?? [];
  const emptyLinks = links.filter((a) => {
    const inner = a.replace(/<a\b[^>]*>/i, "").replace(/<\/a>/i, "").replace(/<[^>]+>/g, "").trim();
    const hasAria = /aria-label\s*=\s*["'][^"']+["']/i.test(a);
    return !inner && !hasAria;
  }).length;

  let score = 100;
  if (!hasH1) score -= 20;
  score -= Math.min(30, imagesMissingAlt * 6);
  score -= Math.min(25, headingJumps * 8);
  score -= Math.min(25, emptyLinks * 6);
  score = Math.max(0, score);

  const parts: string[] = [];
  if (!hasH1) parts.push("no H1");
  if (imagesMissingAlt) parts.push(`${imagesMissingAlt}/${images} img no alt`);
  if (headingJumps) parts.push(`${headingJumps} heading jump(s)`);
  if (emptyLinks) parts.push(`${emptyLinks} empty link(s)`);
  const summary = parts.length ? parts.join(", ") : "no static issues";

  return { images, imagesMissingAlt, hasH1, headingJumps, emptyLinks, score, summary };
}
