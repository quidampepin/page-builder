# Canada.ca UX tool

A local-first Next.js app for assessing **and rebuilding** Canada.ca pages.
Crawl a section (or skip the crawl entirely), analyze real user feedback and
analytics, generate the user tasks a page should support, run a balanced
heuristic review, propose GCWeb-compliant fixes with the embedded page builder,
and export a full report as HTML or PDF.

## Run locally

```bash
npm install
cp .env.example .env.local        # add your ANTHROPIC_API_KEY
npm run dev                       # http://localhost:3000
```

## The tabs

Everything works on a **current page**, which can come from a crawl, a single
URL, or a blank page you generate from scratch.

- **Page & IA** — where you search/crawl. Enter a Canada.ca URL and *Crawl
  section* (depth 0–5), *Open one page*, or *＋ Blank page* to build from
  nothing. Shows the information architecture as a tree or a visual map (export
  SVG/PNG), plus a live preview. The IA only appears in this tab.
- **Feedback** — **upload** a feedback CSV (columns auto-detected). Optionally
  filter to the current page's URL (and its children), then analyze the comments
  (issues, sentiment, key phrases, recommendations). Download comments + analysis.
- **Analytics** — **upload** an analytics CSV (visits, exits, time on page,
  internal search, task success — whatever you have) and get a concise
  assessment. Download it.
- **User tasks** — job stories, usability scenarios, and user-need statements,
  automatically grounded in your feedback and analytics when present.
- **Heuristics** — a balanced, concise heuristic review (calm rating, a few
  real findings with severity + a fix, and what's working) that uses your
  feedback, analytics, and user tasks as evidence.
- **Build** — the full GC Page Builder seeded with the current page: chat to
  create/improve/edit, component palette, HTML editor, EN/FR translate,
  undo/redo, save/load. **✨ Improve from evidence** feeds all gathered insight
  into one rewrite. **Compare with original** shows before/after side by side
  with a plain-language change summary.
- **Report** — assembles everything (optional AI executive summary + feedback +
  analytics + user tasks + heuristics) into a polished report. **Download HTML**
  or **Download PDF** (opens the print dialog → Save as PDF).

## Theme

Light/dark toggle in the top bar (☾ / ☀), remembered between visits and matched
to your OS preference on first load.

## Models

Model choice is per task, for the best results:

- **Analysis** (feedback, analytics, user tasks, heuristics, change summaries,
  report synthesis, page rewrites) → **Opus 4.8** (`claude-opus-4-8`).
- **Page generation / edits** (Build chat) → Sonnet, for responsiveness.
- **Translate** → Haiku.

Override any of these with `ANTHROPIC_ANALYSIS_MODEL`, `ANTHROPIC_MODEL`, and
`ANTHROPIC_TRANSLATE_MODEL`. Opus is slower: on Vercel Hobby the 60s function
limit can cause 504s on large inputs — locally it's fine. If you hit timeouts,
set `ANTHROPIC_ANALYSIS_MODEL=claude-sonnet-4-6`. Analysis routes request up to
`maxDuration = 300` (needs a plan that allows it).

## Notes

- Feedback and analytics are uploaded in the browser per session — nothing is
  read from disk, so no data files need to live in the repo.
- The standalone `/builder` route was retired; the builder is embedded in the
  Build tab.
