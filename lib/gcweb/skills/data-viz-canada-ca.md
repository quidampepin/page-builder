---
name: data-viz-canada-ca
description: Create compelling, accessible, responsive data visualizations (charts, graphs, maps) that land cleanly in a Canada.ca / GCWeb environment. Use this skill whenever the user wants to add a chart, graph, data visualization, infographic, or interactive data display to a Government of Canada web page — including bar charts, line charts, stacked or grouped bars, pie/donut charts, area charts, and choropleth maps. Trigger on any mention of "chart", "graph", "data viz", "visualization", "plot", "d3", "wb-charts", "data-charts", "Infobase-style", "dataviz", or when the user shares data (a table, CSV, or numbers) and wants to display it visually on Canada.ca or in a GC context. Also trigger when the user asks to make data "easier to understand", "more visual", or "interactive" on a government page. Always pair this skill with canada-ca-coder for the surrounding page structure — this skill owns only the chart component. Use it even if the user just says "turn this table into a chart" in a Canada.ca context.
---

# Data visualization for Canada.ca

Your job is to produce data visualizations that are **accessible first, attractive second, and never accessible-second**. On a Government of Canada page, an inaccessible chart is a defect, not a stylistic choice. The good news: the pattern that makes charts accessible is also the one that makes them robust, printable, and easy to maintain.

## The one rule everything hangs on: table-first progressive enhancement

**Never render a chart without first emitting the accessible HTML data table it is built from.** This is the architecture WET-BOEW's `wb-charts` got right, and it is non-negotiable here regardless of which renderer you choose.

```
HTML data table (source of truth)
        │
        ├── works with no JS, in print, for screen readers, at 400% zoom
        │
        └── chart = a visual enhancement rendered FROM the table,
            wrapped so the table stays in the DOM (inside <details>)
```

Why this wins:

- The real content (the numbers) is never trapped inside an SVG or canvas. Screen readers, search engines, and print get the table for free.
- You get most of WCAG compliance structurally, not by bolting ARIA onto every bar.
- If the JS fails to load, the user still has the data. Progressive enhancement, not graceful degradation.

So the chart's `aria` story is simple: **treat the whole chart as one captioned image** (`role="img"` + a real `aria-label` that states the takeaway), and let the `<details>` table carry the detail. Resist per-bar/per-point ARIA — it is fragile, verbose, and redundant with the table.

## Decision tree — read this before writing any code

### Step 1: Is a chart even warranted?

A chart should reveal a pattern the table alone hides (a trend, a comparison, a shape). If the data is a handful of numbers a reader scans just as fast in a table, **ship the table and stop**. Don't add a chart for decoration. Saying "a table is enough here" is a valid, often correct, answer.

### Step 2: Which renderer tier? (tiered by need, not by default)

Pick the **lightest tool that does the job.** d3 is powerful but heavy — most Canada.ca pages need a few bars or one line, and pulling in d3 for that is overkill.

| Tier | Use when | Tooling | Template |
|------|----------|---------|----------|
| **1 — CSS/SVG, no library** | Simple static bar or line, a handful of values, no interactivity needed | Hand-rolled HTML/CSS bars or a small static SVG built from the table | `references/templates/bar.html`, `line.html` |
| **2 — d3 static** | More than ~8 categories, grouped/stacked series, donut, area, or you need crisp axis/label layout that adapts to width | d3 v7, SVG, rendered once, no hover-only interactions | `grouped-stacked-bar.html`, `donut.html`, `area.html` |
| **3 — d3 interactive** | The user genuinely needs filtering, toggling series, tooltips, or a map the user explores (Infobase-style) | d3 v7 + keyboard-equivalent interactions, focus rings, ARIA live region for updates | `choropleth-map.html` and the interactivity notes in `references/a11y-checklist.md` |

When in doubt, drop a tier. Interactivity is opt-in and risky (see the gate). A static chart with good direct labels avoids an entire class of failures.

### Step 3: Which chart type?

- **Bar** — comparing categories. Default workhorse. Horizontal bars when category labels are long.
- **Line** — change over time, continuous. Direct-label the end of each line instead of a legend where it fits.
- **Grouped bar** — comparing a few series across categories. Stops working past ~3 series × ~6 categories — switch to small multiples or a table.
- **Stacked bar** — part-to-whole that also sums to a meaningful total. Hard to compare inner segments; only the bottom segment and the total read accurately.
- **Donut/pie** — a single part-to-whole snapshot, ≤5 slices, with direct labels. Past 5 slices use a bar chart. Never two pies side by side for comparison.
- **Area** — magnitude of a trend, or stacked composition over time. One series, or stacked with restraint.
- **Choropleth map** — values by province/territory. Always pair with the table; maps read poorly for exact values and small regions (PEI, the territories' label crowding).

## The accessibility gate — output must pass every line

This is where the skill earns its keep: encoding the discipline that's easy to skip under deadline. Run this as a pass/fail checklist on every chart you emit. The full annotated version with code snippets is in `references/a11y-checklist.md` — read it when generating Tier 2/3 charts.

1. **Source table emitted and retained** inside a `<details><summary>` so it stays in the DOM (not regenerated from JS and discarded). The `<summary>` names the dataset, e.g. "Data table: permanent residents admitted, 2015–2024".
2. **Chart is one image to AT**: container has `role="img"` and an `aria-label` that states the *takeaway* ("Admissions rose steadily from X in 2015 to Y in 2024"), plus `<title>`/`<desc>` in the SVG. Decorative inner elements get `aria-hidden="true"` or are simply not exposed.
3. **No colour-only encoding** (WCAG 1.4.1): distinguish series by direct labels, text, position, or pattern/shape — not hue alone. Critical for lines and stacked bars.
4. **Contrast**: 3:1 minimum for graphical objects and their boundaries (1.4.11); 4.5:1 for text labels (1.4.3). Use the vetted palette in `references/gc-tokens.md`.
5. **Respect `prefers-reduced-motion`**: no entry animations or transitions when the user has asked for reduced motion. (Tier 1 has none anyway — good.)
6. **Reflow & zoom** (1.4.10): SVG uses `viewBox` + relative sizing; no fixed-pixel font sizes; the layout survives 400% zoom and a 320px-wide viewport (collapsing to just the table on very narrow screens is acceptable).
7. **Responsive labelling**: text legibility and tick density don't scale with `viewBox`. Tier 2/3 templates ship a `ResizeObserver` harness that re-runs axis/label layout on resize — fewer ticks, rotated or simplified labels on narrow screens.
8. **Interactivity (Tier 3 only)**: every hover behaviour has a keyboard equivalent (2.1.1), visible focus indicators, and dynamic updates announced via an `aria-live="polite"` region. Tooltips reachable by keyboard and dismissible (1.4.13). If you can't meet all of this, drop to a static chart.
9. **Bilingual**: this is a GC page. Every label, title, `aria-label`, caption, and tooltip must exist in both official languages, driven by the page's `lang`. Numbers use locale formatting (`fr-CA` uses a space as thousands separator and a comma as decimal). Never hard-code one language.

If any line fails and you can't fix it, say so explicitly rather than shipping a chart that looks fine but excludes people.

## Looking good, the GC way: restraint

"Attractive" in a Government of Canada context means *restraint and clarity*, not flourish. Pull specifics from `references/gc-tokens.md`, but the principles:

- Use the Canada.ca palette and a colourblind-safe categorical sequence within it. Lead with GC blues so charts feel native to the page.
- Respect GCWeb's type scale and spacing; don't introduce a new font.
- Prefer **direct labelling** over legends where it fits — it cuts the eye-travel and the colour dependency at once.
- Kill chartjunk: no gridline clutter, no 3D, no drop shadows, no redundant axes. Start bar axes at zero.
- One clear takeaway per chart. If you're explaining three things, you probably need three charts or a table.

## How this skill composes (don't reinvent the page)

This skill owns **only the chart component.** Defer everything around it:

- **Page structure, headings, GCWeb scaffolding, WET-BOEW includes** → that's `canada-ca-coder`. Always pair the two: this skill produces the chart block; `canada-ca-coder` places it in a valid Canada.ca page.
- **Component naming / Figma parity** → `gc-component-mapping` (note: it has no canonical chart pattern today, which is exactly the gap this skill fills).
- **Content/SEO around the chart** → `canada-ca-writer`, `canada-ca-seo`.

When asked for "a chart on a Canada.ca page," generate the chart block here and hand the surrounding page to `canada-ca-coder` rather than duplicating page chrome.

## Workflow when invoked

1. Get the data (table, CSV, or numbers) and confirm the **takeaway** the chart should make obvious. The takeaway drives the chart type and the `aria-label`.
2. Run the decision tree: warranted? → tier → type. State your choice and the one-line reason.
3. Read the matching template in `references/templates/` and `references/a11y-checklist.md` (for Tier 2/3). Adapt it — don't hand-write a chart from scratch; the templates already wire the table-first pattern, ARIA scaffolding, palette, and resize harness.
4. Fill in the real data and bilingual labels.
5. Self-check against the accessibility gate before returning. Call out any line you couldn't satisfy.

## Reference files

- `references/a11y-checklist.md` — the gate in full, with code snippets and the interactivity rules. A standalone artifact you can also hand to reviewers.
- `references/gc-tokens.md` — palette (incl. colourblind-safe sequence), type scale, spacing, number formatting.
- `references/templates/` — one vetted, table-first, accessible template per chart type: `bar.html`, `line.html`, `grouped-stacked-bar.html`, `donut.html`, `area.html`, `choropleth-map.html`. Each is runnable and commented; copy and adapt.
