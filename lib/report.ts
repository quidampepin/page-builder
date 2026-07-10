/**
 * Build a self-contained UX assessment report as a printable HTML document,
 * assembled client-side from the insights already gathered (each a Markdown
 * string rendered to HTML). Offers HTML download and print-to-PDF.
 */

import { renderMarkdown } from "./markdown";

export interface ReportSection {
  heading: string;
  markdown: string;
}

export interface ReportInput {
  title: string;
  url?: string;
  lang: "en" | "fr";
  generatedAt: string;
  sections: ReportSection[];
}

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; line-height: 1.5; margin: 0; }
  .wrap { max-width: 820px; margin: 0 auto; padding: 48px 40px 64px; }
  .brand { display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: .04em; color: #fff; background: #EA2D37; padding: 4px 8px; border-radius: 4px; }
  h1.doc { font-size: 26px; margin: 16px 0 4px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 8px; }
  .meta a { color: #1d4ed8; }
  hr.rule { border: none; border-top: 2px solid #EA2D37; margin: 16px 0 28px; }
  section.block { margin: 0 0 30px; }
  section.block > h2.sec { font-size: 18px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin: 0 0 12px; }
  h1 { font-size: 20px; margin: 16px 0 8px; }
  h2 { font-size: 17px; margin: 14px 0 8px; }
  h3 { font-size: 15px; margin: 12px 0 6px; }
  h4 { font-size: 14px; margin: 10px 0 4px; }
  p { margin: 8px 0; }
  ul, ol { margin: 8px 0 8px 22px; }
  li { margin: 3px 0; }
  code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-size: .9em; }
  blockquote { border-left: 3px solid #cbd5e1; padding-left: 12px; color: #475569; margin: 8px 0; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 13px; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 9px; text-align: left; vertical-align: top; }
  th { background: #f8fafc; }
  footer.doc { margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 12px; color: #888; font-size: 12px; }
  @media print {
    .wrap { padding: 0 8px; max-width: none; }
    section.block { break-inside: avoid; }
    a { color: #1a1a1a; text-decoration: none; }
  }
`;

export function buildReportHtml(input: ReportInput): string {
  const sectionsHtml = input.sections
    .filter((s) => s.markdown && s.markdown.trim())
    .map(
      (s) =>
        `<section class="block"><h2 class="sec">${escapeHtml(s.heading)}</h2>${renderMarkdown(
          s.markdown,
        )}</section>`,
    )
    .join("\n");

  const title = input.lang === "fr" ? "Évaluation UX" : "UX assessment";
  const forLabel = input.lang === "fr" ? "Page évaluée" : "Page assessed";
  const genLabel = input.lang === "fr" ? "Généré le" : "Generated";

  return `<!DOCTYPE html>
<html lang="${input.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — ${escapeHtml(input.title)}</title>
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
  <span class="brand">Canada.ca UX tool</span>
  <h1 class="doc">${escapeHtml(title)}: ${escapeHtml(input.title)}</h1>
  <div class="meta">
    ${input.url ? `${forLabel}: <a href="${escapeAttr(input.url)}">${escapeHtml(input.url)}</a><br>` : ""}
    ${genLabel}: ${escapeHtml(input.generatedAt)}
  </div>
  <hr class="rule">
  ${sectionsHtml}
  <footer class="doc">Produced with the Canada.ca UX tool.</footer>
</div>
</body>
</html>`;
}

/** Open the report in a new window and invoke the browser's print → Save as PDF. */
export function printReport(html: string) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("Please allow pop-ups to export the PDF.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Give the new document a tick to lay out before printing.
  w.onload = () => {
    setTimeout(() => w.print(), 300);
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
