# GC Page Builder 

A local-first web app for prototyping Canada.ca pages by chatting with Claude. Describe the page in the left panel, attach a Word doc or screenshot if you have one, and a real GCWeb-themed page renders live in the iframe on the right. Iterate through chat — *"add three feature cards"*, *"rewrite this in plain language"*, *"translate to French"* — or insert components from a palette, or edit the HTML by hand.

It's effectively the `canada-ca-coder` skill, plus a live preview, edit ops, undo, a component palette, bilingual support, and a manual HTML editor.

## Run locally

```bash
npm install
cp .env.example .env.local        # paste your Anthropic API key
npm run dev                       # http://localhost:3000
```

Get a key from <https://console.anthropic.com/>. The only required env var is `ANTHROPIC_API_KEY`; everything else has defaults.

## Deploy to Vercel

1. Push the repo to GitHub.
2. Vercel → **Add New → Project → Import** the repo. Next.js is auto-detected; keep all defaults.
3. **Settings → Environment Variables** → add `ANTHROPIC_API_KEY` (Production scope, at minimum).
4. **Deploy.** First build runs `npm install` + `next build`.

**Optional basic-auth gate.** Set `BASIC_AUTH_USER` and `BASIC_AUTH_PASS` env vars on Vercel and the `middleware.ts` at the project root will return 401 + `WWW-Authenticate: Basic` for unauthenticated requests — your browser shows its native sign-in dialog. Leave both unset for local dev so `npm run dev` doesn't prompt. Worth turning on for any public deployment so random URL-finders can't burn your Anthropic credits.

**Save/load is browser-side.** Save downloads a `.gcpage.json` file; Load reads one back via a file picker. Same JSON shape as the previous server-side save flow (older saves still load), with no filesystem dependency — runs identically in dev and on serverless.

## How it works

```
  ┌──────────────────────────────────────────────────────────────────┐
  │                            INPUT                                 │
  │  Chat textarea  |  File uploads (.docx .pdf .txt .md .html img)  │
  └────────────────────────┬─────────────────────────────────────────┘
                           │  POST /api/extract  (per file)
                           │  → { filename, mimeType, text | base64 }
                           ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │                       ORCHESTRATION                              │
  │                                                                  │
  │  POST /api/chat                                                  │
  │    • getSystemPrompt(lang, currentHtml)                          │
  │         └─ reads lib/gcweb/skills/*.md                           │
  │    • LLMClient.generateHtml(...)  ← single interface             │
  │         └─ adapter: lib/llm/anthropic.ts                         │
  │    • extractContent(rawHtml)  → { breadcrumb, main }             │
  │    • compose({title, content, lang}) → full page                 │
  └────────────────────────┬─────────────────────────────────────────┘
                           │  { content, composed, title, lang }
                           ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │                          PREVIEW                                 │
  │                                                                  │
  │  iframe (sandbox="allow-scripts allow-same-origin")              │
  │    srcDoc = composed                                             │
  │                                                                  │
  │  composed = [DOCTYPE + head + header]                            │
  │           + LLM-generated breadcrumb                             │
  │           + LLM-generated <main>                                 │
  │           + [footer + scripts]                                   │
  │                                                                  │
  │  The "[...]" bits are constants in lib/gcweb/shell.ts.           │
  │  Never regenerated — saves tokens, prevents drift.               │
  └──────────────────────────────────────────────────────────────────┘
```

**The LLM only produces two things:** a `<nav id="wb-bc">` breadcrumb and a `<main>`. Everything else — HTML head, Canada.ca signature, search bar, menu, footer, WET-BOEW scripts — lives in [`lib/gcweb/shell.ts`](lib/gcweb/shell.ts) and is wrapped around the LLM output by [`lib/gcweb/compose.ts`](lib/gcweb/compose.ts). That keeps token costs down and prevents the chrome drifting visually from real Canada.ca.

The system prompt is composed at request time from five markdown files in [`lib/gcweb/skills/`](lib/gcweb/skills/) — copies of your Claude Code skills (`canada-ca-coder`, `canada-ca-writer`, `canada-ca-seo`, `canada-ca-doormat`, `gc-component-mapping`). Edit any of them and the next chat turn picks up the change. Re-sync from `~/.claude/skills/` with `npm run sync-skill`.

The CDN assets (`wet-boew.github.io/themes-dist/GCWeb/...`) are the same ones real Canada.ca pages load, so the preview matches production pixel-for-pixel.

## Features

**Two output modes.** After the first turn, Claude can return either a `<!--GCPB:EDITS-->` block of targeted CSS-selector ops (`replace`, `insertBefore`, `setAttr`, etc.) for narrow changes — applied with cheerio in [`lib/gcweb/edits.ts`](lib/gcweb/edits.ts) — or a full breadcrumb + `<main>` regeneration for sweeping rewrites. Claude picks; the chat UI shows a chip on each turn (`N edits applied` / `Full rewrite`) so you can see which path ran.

**Bilingual EN/FR.** State has two independent slots, `pages.en` and `pages.fr`. The EN/FR toggle picks which feeds the preview — no API call, `compose()` is pure. Chat edits only affect the active slot. The **Translate** button fills the other slot via [`/api/translate`](app/api/translate/route.ts) using a narrower prompt that preserves every tag, class, ID, and RDFa attribute and swaps only the visible text.

**Smart re-translate.** After the first translate in a given direction, subsequent translates diff the current source against a snapshot from the last translate, classify each top-level section as unchanged / source-edited / both-edited (conflict), and only re-translate sections that need it. Unchanged sections stay byte-identical — including any manual edits you made on the target side. A typical single-section edit goes from ~2000 tokens to ~200.

**Component palette.** The **+ Component** button opens a modal with ~20 GCWeb patterns (alerts, feature cards, doormat grids, accordions, tabs, …) each shown as a live scaled-down preview in a sandboxed iframe. Pick one, choose where (top / bottom / before or after a specific section), and it's inserted client-side via `DOMParser` — no LLM, no network. The catalogue's HTML is byte-identical to what Claude generates for the same component, so edit ops and Figma round-trips work without special cases.

**Manual HTML editing.** The Preview pane has an **HTML** toggle that turns the iframe into a textarea editing the raw breadcrumb + `<main>`. Save HTML commits the edit (it's run through `extractContent()` to normalize, the title is re-derived from the new h1, undo snapshot pushed). The toolbar's **Save** / **Copy HTML** / **Download** buttons auto-commit any pending HTML edits before running so you never lose unsaved work.

**Undo / redo.** Linear stack capped at 30 entries, persisted to localStorage. Snapshots before every mutation — chat send, EN/FR swap, translate, palette insert, manual HTML edit, load. Try wild rewrites; you can always get back.

**File attachments.** `.docx` (mammoth → markdown-ish text), `.pdf` (pdf-parse text layer), `.txt` / `.md` / `.html` / `.json` (passed through), images (base64 → Claude vision).

## File map

```
app/
├── layout.tsx               Root layout (Tailwind CSS)
├── page.tsx                 Main UI — chat panel + preview pane
└── api/
    ├── chat/route.ts        LLM orchestration (edit + full modes)
    ├── extract/route.ts     File extraction (docx/pdf/text/image/json)
    ├── compose/route.ts     Deterministic shell wrap (no LLM)
    ├── translate/route.ts   EN ↔ FR translation (narrow LLM prompt)
    └── pages/route.ts       Deprecated 410 stub (save/load is client-side)

components/
├── ChatPanel.tsx            Left pane — messages + textarea + attachments
├── PreviewPane.tsx          Right pane — iframe + HTML editor + toolbar
├── ComponentPalette.tsx     Click-to-insert modal
├── ComponentPreview.tsx     Sandboxed iframe rendering a scaled palette tile
└── FileAttachments.tsx      File picker + chip list

lib/
├── gcweb/
│   ├── shell.ts             Head/header/footer/scripts (EN + FR)
│   ├── compose.ts           Wraps content in shell; extracts breadcrumb/main
│   ├── extract-title.ts     Pulls h1 text for shell <title> sync
│   ├── edits.ts             Parses + applies GCPB:EDITS op blocks
│   ├── components.ts        Palette catalogue (canonical GCWeb HTML)
│   ├── insert-client.ts     Browser-side component inserter (DOMParser)
│   ├── split.ts             Section split/join for smart re-translate
│   ├── smart-translate.ts   Diff-and-patch re-translation orchestrator
│   ├── system-prompt.ts     Composes the system prompt from skills/*.md
│   ├── translate-prompt.ts  Narrower system prompt for EN ↔ FR
│   └── skills/              Embedded copies of your Claude Code skills
├── llm/
│   ├── types.ts             LLMClient interface
│   ├── anthropic.ts         Anthropic API adapter
│   └── index.ts             Factory (reads LLM_PROVIDER env)
└── extractors/
    ├── docx.ts              mammoth → markdown-ish text
    ├── pdf.ts               pdf-parse wrapper
    └── image.ts             base64 helper

middleware.ts                Optional HTTP basic-auth gate (env-driven)
scripts/sync-skill.mjs       Re-pulls skills from ~/.claude/skills/
```

## Limitations

- **No streaming.** Chat waits for the full response. Upgrade is straightforward: Anthropic's `.stream()` + Next `ReadableStream`.
- **No OCR for scanned PDFs.** Text layer only — upload as an image instead.
- **Vercel Hobby caps serverless functions at 60s.** Smart re-translate keeps each call narrow so it's usually fine; full translates of very large pages may bump up against this.
- **Public deployments without the basic-auth gate are open to anyone with the URL** and any guest can spend your Anthropic credits.

## Roadmap

- Streaming chat responses.
- Component-tree IR (LLM emits JSON, server renders to HTML — cleaner editing, easier undo).
- Drag-and-drop palette overlay rendered on the preview iframe (postMessage between iframe and parent).
- Figma MCP integration (`gc-figma-bridge`) for bidirectional sync with the IRCC design library.
- Multi-provider LLM (OpenAI, Claude subscription via OAuth).
- Proper saved-pages library UI (in-app list, rename, delete, export bundle).

## Licence

Personal / prototype code for now. Decide on a licence before the repo goes public.
