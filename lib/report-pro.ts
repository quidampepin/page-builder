/**
 * Polished, editorial UX-assessment report — self-contained HTML with Chart.js.
 *
 * When pages carry applied changes (before/after), the report tells the full
 * story: user pain points -> what could help -> what we did -> new scores ->
 * what to look for next. Without changes it degrades to a clean assessment
 * (current scores + recommendations). One standalone .html: Inter + Chart.js
 * from a CDN, prints cleanly to PDF.
 */

import { renderMarkdown } from "./markdown";
import type { Readability } from "./readability";
import type { Action, Lang } from "./types";

export interface PageReportData {
  title: string;
  url: string;
  readability?: Readability; // current / after
  beforeGrade?: number; // original grade (present when a change was applied)
  a11y?: { critical: number; serious: number; moderate: number; minor: number; total: number }; // current / after
  a11yBefore?: number; // original a11y total (present when applied)
  feedbackCount?: number;
  feedbackQuotes?: string[];
  brokenLinks?: number;
  actions?: Action[]; // all proposed (what could help)
  appliedActions?: Action[]; // approved + applied (what we did)
  sections?: { heading: string; markdown: string }[];
}

export interface ReportInput {
  title: string;
  subtitle?: string;
  generatedAt: string;
  lang: Lang;
  execSummary?: string;
  painPoints?: string;
  nextSteps?: string;
  pages: PageReportData[];
}

const NAVY = "#284162";
const INK = "#22384f";
const OKABE = ["#0072B2", "#D55E00", "#117733", "#882255", "#E69F00", "#56B4E9", "#CC79A7", "#6F6F6F"];
const SEV = { high: "#D55E00", medium: "#E69F00", low: "#6F6F6F" };
const IMPACT = { critical: "#af3c43", serious: "#D55E00", moderate: "#E69F00", minor: "#9fb3c8" };
const GREEN = "#117733";
const GREY = "#9fb3c8";

function esc(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function gradeColor(g: number): string {
  return g <= 8 ? GREEN : g <= 11 ? "#E69F00" : "#af3c43";
}
function shortUrl(u: string): string {
  try { return new URL(u).pathname; } catch { return u; }
}
function r1(n: number): number { return Math.round(n * 10) / 10; }

interface ChartSpec { id: string; config: unknown }

function doughnut(id: string, labels: string[], data: number[], colors: string[]): ChartSpec {
  return { id, config: { type: "doughnut", data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: "#fff" }] }, options: { responsive: true, maintainAspectRatio: false, cutout: "58%", plugins: { legend: { position: "bottom", labels: { boxWidth: 12, padding: 12 } } } } } };
}
function bar(id: string, labels: string[], data: number[], colors: string[], horizontal = false): ChartSpec {
  return { id, config: { type: "bar", data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 4, maxBarThickness: 34 }] }, options: { responsive: true, maintainAspectRatio: false, indexAxis: horizontal ? "y" : "x", plugins: { legend: { display: false } }, scales: { x: { grid: { display: !horizontal, color: "#eef1f4" }, beginAtZero: true }, y: { grid: { display: horizontal, color: "#eef1f4" }, beginAtZero: true } } } } };
}
function grouped(id: string, labels: string[], datasets: { label: string; data: number[]; color: string }[], horizontal = false): ChartSpec {
  return { id, config: { type: "bar", data: { labels, datasets: datasets.map((d) => ({ label: d.label, data: d.data, backgroundColor: d.color, borderRadius: 3, maxBarThickness: 22 })) }, options: { responsive: true, maintainAspectRatio: false, indexAxis: horizontal ? "y" : "x", plugins: { legend: { position: "bottom", labels: { boxWidth: 12, padding: 12 } } }, scales: { x: { grid: { color: "#eef1f4" }, beginAtZero: true }, y: { grid: { display: false }, beginAtZero: true } } } } };
}

interface Kpi { num: string; label: string; sub?: string; tone?: string }

function chartBox(id: string, title: string, caption: string, tall = false): string {
  return `<figure class="chartbox reveal${tall ? " tall" : ""}"><figcaption><h3>${esc(title)}</h3><p class="cap">${esc(caption)}</p></figcaption><div class="canvaswrap"><canvas id="${id}"></canvas></div></figure>`;
}
function dchip(label: string, before: number, after: number, lowerBetter = true): string {
  const improved = lowerBetter ? after < before : after > before;
  const worse = lowerBetter ? after > before : after < before;
  const col = improved ? GREEN : worse ? "#af3c43" : GREY;
  const arrow = improved ? "▼" : worse ? "▲" : "→";
  return `<span class="dchip" style="--dc:${col}">${esc(label)} ${r1(before)} <span class="arr">${arrow}</span> ${r1(after)}</span>`;
}

export function buildProReport(input: ReportInput): string {
  const pages = input.pages;
  const batch = pages.length > 1;
  const applied = pages.some((p) => (p.appliedActions?.length ?? 0) > 0 || p.beforeGrade != null);
  const charts: ChartSpec[] = [];

  // ---- aggregates ----
  const grades = pages.map((p) => p.readability?.gradeLevel).filter((g): g is number => typeof g === "number" && g > 0);
  const avgGrade = grades.length ? r1(grades.reduce((a, b) => a + b, 0) / grades.length) : null;
  const beforeGrades = pages.map((p) => p.beforeGrade).filter((g): g is number => typeof g === "number" && g > 0);
  const avgBefore = beforeGrades.length ? r1(beforeGrades.reduce((a, b) => a + b, 0) / beforeGrades.length) : null;
  const totalA11y = pages.reduce((n, p) => n + (p.a11y?.total ?? 0), 0);
  const totalA11yBefore = pages.reduce((n, p) => n + (p.a11yBefore ?? 0), 0);
  const totalProposed = pages.reduce((n, p) => n + (p.actions?.length ?? 0), 0);
  const totalApplied = pages.reduce((n, p) => n + (p.appliedActions?.length ?? 0), 0);
  const totalFeedback = pages.reduce((n, p) => n + (p.feedbackCount ?? 0), 0);

  // ---- KPIs ----
  const kpis: Kpi[] = [];
  if (batch) kpis.push({ num: String(pages.length), label: "Pages" });
  if (avgGrade != null) kpis.push({ num: String(avgGrade), label: applied ? "Reading grade (after)" : "Reading grade", sub: avgBefore != null ? `was ${avgBefore}` : avgGrade <= 8 ? "plain" : "", tone: gradeColor(avgGrade) });
  if (applied && totalApplied) kpis.push({ num: String(totalApplied), label: "Improvements applied" });
  else if (totalProposed) kpis.push({ num: String(totalProposed), label: "Suggested actions" });
  if (totalA11y || totalA11yBefore) kpis.push({ num: String(totalA11y), label: applied ? "A11y issues (after)" : "A11y issues", sub: applied ? `was ${totalA11yBefore}` : undefined, tone: totalA11y ? IMPACT.serious : GREEN });
  if (totalFeedback) kpis.push({ num: totalFeedback.toLocaleString(), label: "Feedback comments" });

  // ---- Charts ----
  if (applied) {
    // New scores: before vs after.
    charts.push(grouped("c_grade", pages.map((p) => p.title.slice(0, 36)), [
      { label: "Before", data: pages.map((p) => p.beforeGrade ?? p.readability?.gradeLevel ?? 0), color: GREY },
      { label: "After", data: pages.map((p) => p.readability?.gradeLevel ?? 0), color: NAVY },
    ], batch));
    if (totalA11y || totalA11yBefore) {
      charts.push(grouped("c_a11y", pages.map((p) => p.title.slice(0, 36)), [
        { label: "Before", data: pages.map((p) => p.a11yBefore ?? p.a11y?.total ?? 0), color: GREY },
        { label: "After", data: pages.map((p) => p.a11y?.total ?? 0), color: NAVY },
      ], batch));
    }
  } else if (batch) {
    if (grades.length) charts.push(bar("c_grade", pages.map((p) => p.title.slice(0, 40)), pages.map((p) => p.readability?.gradeLevel ?? 0), pages.map((p) => gradeColor(p.readability?.gradeLevel ?? 0)), true));
    if (totalA11y) charts.push(bar("c_a11y", pages.map((p) => p.title.slice(0, 40)), pages.map((p) => p.a11y?.total ?? 0), pages.map(() => IMPACT.serious), true));
    if (totalProposed) charts.push(bar("c_act", pages.map((p) => p.title.slice(0, 40)), pages.map((p) => p.actions?.length ?? 0), pages.map(() => NAVY), true));
    if (totalFeedback) charts.push(bar("c_fb", pages.map((p) => p.title.slice(0, 40)), pages.map((p) => p.feedbackCount ?? 0), pages.map(() => NAVY), true));
  } else {
    const p = pages[0];
    if (p.readability) charts.push(bar("c_grade", ["This page", "Plain-language target"], [p.readability.gradeLevel, 8], [gradeColor(p.readability.gradeLevel), GREEN]));
    if (p.a11y && p.a11y.total) charts.push(doughnut("c_a11y", ["Critical", "Serious", "Moderate", "Minor"], [p.a11y.critical, p.a11y.serious, p.a11y.moderate, p.a11y.minor], [IMPACT.critical, IMPACT.serious, IMPACT.moderate, IMPACT.minor]));
    if (p.actions && p.actions.length) charts.push(doughnut("c_act", ["High", "Medium", "Low"], ["high", "medium", "low"].map((s) => p.actions!.filter((a) => a.severity === s).length), [SEV.high, SEV.medium, SEV.low]));
  }

  const has = (id: string) => charts.some((c) => c.id === id);
  const chartCards: string[] = [];
  if (has("c_grade")) chartCards.push(chartBox("c_grade", applied ? "Reading grade — before vs. after" : batch ? "Reading grade by page" : "Reading grade vs. plain-language target", "Lower is easier. Canada.ca aims for roughly grade 6–8.", batch));
  if (has("c_a11y")) chartCards.push(chartBox("c_a11y", applied ? "Accessibility issues — before vs. after" : batch ? "Accessibility issues by page" : "Accessibility issues by impact", "Fewer is better (automated checks — some issues still need hands-on testing).", batch));
  if (has("c_act")) chartCards.push(chartBox("c_act", batch ? "Suggested actions by page" : "Suggested actions by severity", "Prioritized fixes synthesized from all the evidence.", batch));
  if (has("c_fb")) chartCards.push(chartBox("c_fb", "Feedback comments by page", "Volume of matched user comments per page.", true));

  // ---- What could help (proposed actions) ----
  const allProposed = pages.flatMap((p) => (p.actions ?? []).map((a) => ({ ...a, page: p.title })));
  const rank = { high: 0, medium: 1, low: 2 } as Record<string, number>;
  allProposed.sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3));
  const recs = allProposed.slice(0, 6);
  const recHtml = recs.length
    ? `<section class="reveal"><span class="eyebrow">What could help</span><h2>The highest-value moves</h2><div class="recs">${recs
        .map((a, i) => `<article class="rec" style="--accent:${SEV[a.severity as keyof typeof SEV] || SEV.low}"><div class="rechd"><span class="rnum">${i + 1}</span><span class="pill" style="background:${SEV[a.severity as keyof typeof SEV] || SEV.low}">${esc(a.severity)}</span><span class="effort">effort: ${esc(a.effort)}</span></div><h4>${esc(a.title)}</h4><p>${esc(a.fix)}</p>${batch ? `<p class="recpage">${esc(a.page)}</p>` : ""}</article>`)
        .join("")}</div></section>`
    : "";

  // ---- What we did ----
  const didHtml = applied
    ? `<section class="reveal"><span class="eyebrow">What we did</span><h2>Changes applied, page by page</h2><div class="didgrid">${pages
        .filter((p) => (p.appliedActions?.length ?? 0) > 0 || p.beforeGrade != null)
        .map((p) => {
          const deltas: string[] = [];
          if (p.beforeGrade != null && p.readability) deltas.push(dchip("grade", p.beforeGrade, p.readability.gradeLevel, true));
          if (p.a11yBefore != null && p.a11y) deltas.push(dchip("a11y", p.a11yBefore, p.a11y.total, true));
          const acts = (p.appliedActions ?? []).map((a) => `<li>${esc(a.title)}</li>`).join("");
          return `<article class="did"><h4>${esc(p.title)}</h4>${acts ? `<ul>${acts}</ul>` : `<p class="cap">Refined by hand.</p>`}${deltas.length ? `<div class="deltas">${deltas.join("")}</div>` : ""}</article>`;
        })
        .join("")}</div></section>`
    : "";

  // ---- Quotes ----
  const quotes = pages.flatMap((p) => p.feedbackQuotes ?? []).slice(0, 6);
  const quoteHtml = quotes.length
    ? `<section class="reveal"><span class="eyebrow">In their words</span><h2>The voices behind the numbers</h2><div class="quotes">${quotes.map((q, i) => `<blockquote class="qcard" style="--qc:${OKABE[i % OKABE.length]}">${esc(q)}</blockquote>`).join("")}</div></section>`
    : "";

  // ---- Batch table ----
  const tableHtml = batch
    ? `<section class="reveal"><span class="eyebrow">Page-level detail</span><h2>Every page at a glance</h2><div class="tblwrap"><table class="tbl"><thead><tr><th>Page</th><th>Grade${applied ? " (was→now)" : ""}</th><th>A11y${applied ? " (was→now)" : ""}</th><th>${applied ? "Applied" : "Actions"}</th><th>Feedback</th></tr></thead><tbody>${pages
        .map((p) => `<tr><td><strong>${esc(p.title)}</strong><br><span class="murl">${esc(shortUrl(p.url))}</span></td><td><span class="gr" style="color:${gradeColor(p.readability?.gradeLevel ?? 0)}">${applied && p.beforeGrade != null ? `${r1(p.beforeGrade)}→${p.readability ? r1(p.readability.gradeLevel) : "—"}` : p.readability ? r1(p.readability.gradeLevel) : "—"}</span></td><td>${applied && p.a11yBefore != null ? `${p.a11yBefore}→${p.a11y?.total ?? "—"}` : p.a11y?.total ?? "—"}</td><td>${applied ? p.appliedActions?.length ?? 0 : p.actions?.length ?? "—"}</td><td>${p.feedbackCount ?? "—"}</td></tr>`)
        .join("")}</tbody></table></div></section>`
    : "";

  const sectionsHtml = !batch && pages[0].sections
    ? pages[0].sections.filter((s) => s.markdown && s.markdown.trim()).map((s) => `<section class="reveal prose"><span class="eyebrow">Detail</span><h2>${esc(s.heading)}</h2><div class="md">${renderMarkdown(s.markdown)}</div></section>`).join("")
    : "";

  const narr = (eyebrow: string, heading: string, md?: string) =>
    md && md.trim() ? `<section class="reveal"><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(heading)}</h2><div class="md">${renderMarkdown(md)}</div></section>` : "";

  const execHtml = input.execSummary && input.execSummary.trim() ? `<section class="reveal callout"><span class="eyebrow">Executive summary</span><div class="md">${renderMarkdown(input.execSummary)}</div></section>` : "";
  const painHtml = narr("What we found", "The user pain points", input.painPoints);
  const nextHtml = narr("What's next", "What to look for next", input.nextSteps);

  const kpiHtml = kpis.length
    ? `<div class="kpis">${kpis.map((k) => `<div class="kpi reveal"><div class="num" ${k.tone ? `style="color:${k.tone}"` : ""}>${esc(k.num)}</div><div class="klbl">${esc(k.label)}</div>${k.sub ? `<div class="ksub">${esc(k.sub)}</div>` : ""}</div>`).join("")}</div>`
    : "";

  const scoresHtml = chartCards.length ? `<section class="reveal"><span class="eyebrow">${applied ? "New scores" : "The numbers"}</span><h2>${applied ? "Where the scores landed" : "What the assessment shows"}</h2><div class="grid2">${chartCards.join("")}</div></section>` : "";

  const dataJson = JSON.stringify({ charts }).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="${input.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(input.title)} — UX assessment</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
:root{--navy:${NAVY};--ink:${INK};--line:#e6ebf0;--muted:#5a6573;--tint:#f5f7fa}
*{box-sizing:border-box}html,body{margin:0}
body{font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:#fff;line-height:1.55;-webkit-font-smoothing:antialiased}
.wrap{max-width:960px;margin:0 auto;padding:0 28px}
.eyebrow{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8598ad}
h1,h2,h3,h4{color:var(--navy);line-height:1.18;margin:.2em 0 .4em}
h1{font-size:clamp(30px,5vw,52px);font-weight:900;letter-spacing:-.02em}
h2{font-size:clamp(21px,3vw,30px);font-weight:800;letter-spacing:-.01em}
h3{font-size:16px;font-weight:700}p{margin:.5em 0}
.cover{background:linear-gradient(160deg,#0b1626,var(--navy) 55%,#22384f);color:#fff;padding:64px 0 40px}
.cover .wrap>.eyebrow{color:#9fb3c8}.cover h1{color:#fff;max-width:20ch}.cover .sub{color:#cdddee;font-size:18px;max-width:60ch}
.cover .meta{color:#9fb3c8;font-size:13px;margin-top:14px}.cover a{color:#cdddee}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:26px 0 4px}
.kpi{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:16px}
.kpi .num{font-size:34px;font-weight:900;color:#fff;letter-spacing:-.02em}.kpi .klbl{color:#cdddee;font-size:12.5px;font-weight:600;margin-top:2px}.kpi .ksub{color:#9fb3c8;font-size:11.5px;margin-top:2px}
section{padding:34px 0;border-bottom:1px solid var(--line)}section:last-child{border-bottom:0}
.callout{background:var(--tint)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px}@media(max-width:720px){.grid2{grid-template-columns:1fr}}
.chartbox{margin:0;background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px 18px 8px;box-shadow:0 1px 3px rgba(16,32,56,.05)}
.chartbox figcaption h3{margin:0}.chartbox .cap{color:var(--muted);font-size:12.5px;margin:.2em 0 .6em}
.canvaswrap{position:relative;height:230px}.chartbox.tall .canvaswrap{height:340px}
.recs,.didgrid{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:720px){.recs,.didgrid{grid-template-columns:1fr}}
.rec{border:1px solid var(--line);border-left:5px solid var(--accent);border-radius:12px;padding:16px;background:#fff}
.rechd{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.rnum{width:22px;height:22px;border-radius:50%;background:var(--navy);color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center}
.pill{color:#fff;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:2px 7px;border-radius:999px}
.effort{color:var(--muted);font-size:11.5px;margin-left:auto}
.rec h4,.did h4{margin:.1em 0 .3em;font-size:15.5px}.rec p{font-size:13.5px;color:#3d4c5c;margin:.2em 0}.recpage{color:#8598ad;font-size:11.5px;font-style:italic}
.did{border:1px solid var(--line);border-radius:12px;padding:16px;background:#fff}
.did ul{margin:.3em 0 .5em 1.1em;padding:0}.did li{font-size:13.5px;color:#3d4c5c;margin:.15em 0}
.deltas{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.dchip{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--dc);color:var(--dc);border-radius:999px;padding:2px 9px;font-size:11.5px;font-weight:700}
.dchip .arr{font-size:10px}
.quotes{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:720px){.quotes{grid-template-columns:1fr}}
.qcard{margin:0;background:var(--tint);border-left:4px solid var(--qc);border-radius:10px;padding:14px 16px;font-size:14px;color:#33424f;font-style:italic}
.tblwrap{overflow:auto;border:1px solid var(--line);border-radius:12px}
.tbl{border-collapse:collapse;width:100%;font-size:13.5px}
.tbl th{background:var(--tint);text-align:left;padding:10px 12px;color:var(--navy);font-weight:700;border-bottom:1px solid var(--line)}
.tbl td{padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}.tbl tr:last-child td{border-bottom:0}
.murl{color:#8598ad;font-size:11.5px}.gr{font-weight:800}
.prose .md{max-width:70ch}
.md h1{font-size:20px}.md h2{font-size:17px}.md h3{font-size:15px}
.md table{border-collapse:collapse;width:100%;font-size:13px;margin:10px 0}.md th,.md td{border:1px solid var(--line);padding:6px 9px;text-align:left}.md th{background:var(--tint)}
.md code{background:var(--tint);padding:1px 4px;border-radius:3px;font-size:.9em}.md blockquote{border-left:3px solid #cbd5e1;padding-left:12px;color:var(--muted);margin:.5em 0}
.reveal{opacity:0;transform:translateY(10px);transition:opacity .5s ease,transform .5s ease}.reveal.in{opacity:1;transform:none}
footer{padding:26px 0;color:#8598ad;font-size:12px}
@media print{.reveal{opacity:1;transform:none}.cover{background:var(--navy)!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}section,.rec,.did,.qcard,.chartbox{break-inside:avoid}}
</style>
</head>
<body>
<header class="cover"><div class="wrap">
  <span class="eyebrow">Canada.ca UX tool — ${applied ? "improvement report" : "assessment report"}</span>
  <h1>${esc(input.title)}</h1>
  ${input.subtitle ? `<p class="sub">${esc(input.subtitle)}</p>` : ""}
  <p class="meta">Generated ${esc(input.generatedAt)}${!batch && pages[0] ? ` · <a href="${esc(pages[0].url)}">${esc(shortUrl(pages[0].url))}</a>` : ""}</p>
  ${kpiHtml}
</div></header>
<main class="wrap">
  ${execHtml}
  ${painHtml}
  ${recHtml}
  ${didHtml}
  ${scoresHtml}
  ${nextHtml}
  ${tableHtml}
  ${quoteHtml}
  ${sectionsHtml}
  <footer>Produced with the Canada.ca UX tool. Charts render live from the assessment data embedded in this file.</footer>
</main>
<script id="__reportdata" type="application/json">${dataJson}</script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<script>
(function(){
  function draw(){
    if(!window.Chart){return setTimeout(draw,120);}
    Chart.defaults.font.family='Inter, system-ui, sans-serif';Chart.defaults.font.size=12;Chart.defaults.color='#5a6573';
    var el=document.getElementById('__reportdata');var payload={};try{payload=JSON.parse(el.textContent);}catch(e){return;}
    (payload.charts||[]).forEach(function(c){var cv=document.getElementById(c.id);if(cv){try{new Chart(cv,c.config);}catch(e){console.error('chart',c.id,e);}}});
  }
  draw();
  try{var obs=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');obs.unobserve(e.target);}});},{threshold:0.06});document.querySelectorAll('.reveal').forEach(function(n){obs.observe(n);});}catch(e){document.querySelectorAll('.reveal').forEach(function(n){n.classList.add('in');});}
})();
</script>
</body>
</html>`;
}

/** Open the report in a new window and print (Save as PDF). Waits for charts. */
export function printProReport(html: string) {
  const w = window.open("", "_blank");
  if (!w) { alert("Please allow pop-ups to export the PDF."); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.onload = () => setTimeout(() => w.print(), 900);
}
