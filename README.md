# GC Page Builder

Conversational prototyping for Canada.ca pages. Chat with Claude, feed it Word docs, images, or plain instructions, and watch a fully-styled Canada.ca page render live in an iframe with the real GCWeb look and feel. Iterate through chat: *"change the title"*, *"add a services-and-information section with three cards"*, *"rewrite this in plain language"*.

The tool is effectively your `canada-ca-coder` skill plus a live preview.

## Quick start

```bash
# 1. Install deps
npm install

# 2. Add your Anthropic API key
cp .env.example .env.local
# edit .env.local and paste your key from https://console.anthropic.com/

# 3. Run
npm run dev
# open http://localhost:3000
```

## How it works

Three layers, kept separate so each can move independently.

```
  ┌──────────────────────────────────────────────────────────────────┐
  │                            INPUT                                 │
  │  Chat textarea  |  File uploads (.docx .pdf .txt .md .html img) │
  └────────────────────────┬─────────────────────────────────────────┘
                           │
                           │  POST /api/extract  (per file)
                           │  → { filename, mimeType, text | base64 }
                           │
                           ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │                       ORCHESTRATION                              │
  │                                                                  │
  │  POST /api/chat                                                  │
  │    • getSystemPrompt(lang, currentHtml)                          │
  │         └─ reads lib/gcweb/skills/*.md                          │
  │    • LLMClient.generateHtml(...)  ← single interface             │
  │         └─ adapter: lib/llm/anthropic.ts                         │
  │    • extractContent(rawHtml)  → { breadcrumb, main }             │
  │    • compose({title, content, lang}) → full page                 │
  │                                                                  │
  └────────────────────────┬─────────────────────────────────────────┘
                           │
                           │  { content, composed, title, lang }
                           │
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
  │  They are never regenerated. That saves tokens, prevents visual  │
  │  drift, and mirrors how real Canada.ca pages are built.          │
  └──────────────────────────────────────────────────────────────────┘
```

**The LLM only produces two things:** a `<nav id="wb-bc">` breadcrumb and a `<main>`. Everything else — the HTML head, Google Fonts, Canada.ca signature, search bar, menu, footer, WET-BOEW scripts — lives in [`lib/gcweb/shell.ts`](lib/gcweb/shell.ts) and gets wrapped around the LLM output by [`lib/gcweb/compose.ts`](lib/gcweb/compose.ts).

### Bilingual pages

Every page has two independent slots: `pages.en` and `pages.fr`. Each slot holds its own `{title, content}` — the breadcrumb + `<main>` in that language.

- The **EN/FR toggle** in the preview toolbar picks which slot drives the preview. No API call, no re-render — `compose()` runs client-side since the shell is pure string constants.
- **Chat edits only affect the active slot.** If you're in EN and ask for a change, FR stays exactly as it was. This is deliberate — auto-translating every edit would double your token bill and produce stale French.
- The empty-slot indicator `∅` on a toggle button means "flipping here would show an empty state." Switch is still allowed.
- The **Translate button** takes the active slot and fills the other slot via [`/api/translate`](app/api/translate/route.ts) — a narrower LLM call using [`lib/gcweb/translate-prompt.ts`](lib/gcweb/translate-prompt.ts) that preserves every tag, class, ID, and RDFa attribute while swapping the visible text.
- **Smart re-translate**: after your first translate in a direction, subsequent translates only re-translate the sections you changed. The app stores a snapshot of what the source looked like when it was last translated, then diffs it against the current source on a per-section basis (top-level children of `<main>`). Unchanged sections are kept verbatim in the target slot — including any manual FR edits you made. Details in [Smart re-translate](#smart-re-translate) below.
- After a translate, the toggle auto-flips to the target language so you see the result immediately.
- Saved pages store both slots in `meta.json` along with translate snapshots so smart re-translate survives reloads. Older saves with the flat `content` field still load — they're treated as the active-language slot, with the other slot empty.

### Smart re-translate

The first time you press Translate in a given direction (say EN → FR), the app does a full-page translation: one LLM call, whole page in, whole page out. At the moment it succeeds, a snapshot is captured: `{source, target, title, ts}` stored under `state.snapshots.en`.

The next time you press Translate in the same direction, the app takes the **smart path**:

1. Parse current EN into sections (top-level children of `<main>`, treating each as one unit).
2. Parse snapshot EN into sections.
3. Parse current FR into sections.
4. Classify each position:
   - Source unchanged → keep the current FR section verbatim. Your manual FR edits survive.
   - Source changed, FR untouched since snapshot → re-translate just that section.
   - Source changed AND FR changed since snapshot → **conflict**. Flagged per position.
5. If there are any conflicts, you get one confirm: **OK** overwrites FR conflicts with fresh translations; **Cancel** keeps your FR edits and skips those sections.
6. Only the sections to translate are sent to the LLM (as a JSON array of chunks), along with the title if it changed. Everything else is stitched back together locally.

Token savings compound: a typical single-section edit goes from ~2000 tokens per translate to ~200. And because untranslated sections are kept byte-for-byte, your FR text only changes where you intended it to.

Snapshots are per source language, so EN → FR and FR → EN each get their own. They're persisted to `localStorage` and to `meta.json` on save, so reloads don't trigger an unnecessary full translate.

Languages drift as you work. That's fine — hit Translate when you need to re-sync.

### Two output modes: diff-based edits + full rewrites

On every turn after the first, the LLM can emit either:

- **Edit ops** — a `<!--GCPB:EDITS-->` block containing a JSON list of targeted operations (`replace`, `insertBefore`, `insertAfter`, `append`, `prepend`, `remove`, `setAttr`) that apply to the existing HTML via CSS selectors. Used for narrow changes like "change the title", "add a card", "remove the warning".
- **Full HTML** — the whole breadcrumb + `<main>` regenerated. Used for the first page, for sweeping rewrites, or when more than ~30% of the page is changing.

Claude picks. The system prompt teaches the criteria. The server ([`lib/gcweb/edits.ts`](lib/gcweb/edits.ts)) parses the edit block, applies ops with cheerio, and returns the new HTML plus a summary (`{ applied, errors }`). The chat UI shows a small badge on each assistant turn (`N edits applied` / `Full rewrite`) so you can see which path ran.

If the LLM tries edit mode but every selector misses, the server returns a 422 with the failed selectors so you can rephrase. Partial failures (some ops matched, some didn't) apply the good ones and flag the bad ones amber in the UI.

The shell pulls CSS/JS/SVGs from the official `wet-boew.github.io` CDN, so the preview matches production Canada.ca pixel-for-pixel.

### Component palette (click-to-insert)

A **+ Component** button in the preview toolbar opens a modal with ~20 GCWeb patterns organized into four categories:

- **Callouts**: alert (info/warning/danger/success), well, CTA band (full-width coloured)
- **Layout**: feature cards, doormat grid, two-column, image + text promo, icon grid
- **Content**: numbered steps, pull quote, stat row, timeline, news list
- **Interactive**: accordion (`<details>/<summary>`), tabs (`wb-tabs`), CTA button

Pick one, choose where to drop it ("At the top", "At the bottom", or before/after a specific `<h2>` by title), and it's inserted **client-side** via the browser's native `DOMParser`. No LLM call, no network round-trip, no cheerio in the client bundle — just DOM parse, node insert, serialize back.

**Live visual previews.** Each card shows a scaled-down render of the actual component in a sandboxed iframe with GCWeb CSS loaded. The preview is the same HTML you'd insert — no separate screenshot to maintain. The trick: `transform: scale(0.3)` on the iframe body plus a matching width bump so the layout fills the card. Scripts are blocked (`sandbox=""`) so interactive components (accordion, tabs) render their static state.

The palette's canonical HTML lives in [`lib/gcweb/components.ts`](lib/gcweb/components.ts) and is copy-pasted verbatim from the `gc-component-mapping` skill. That means a palette-inserted alert and a Claude-generated alert are byte-identical — diffs, edit ops, and Figma round-trips work without special cases.

Insertion goes through [`lib/gcweb/insert-client.ts`](lib/gcweb/insert-client.ts), which mirrors `applyEdits()` on the server: one is an LLM-driven diff applier (cheerio, server), the other is a user-driven palette inserter (DOMParser, browser). Placeholder content in inserted components is short and generic on purpose — fill in real copy via chat ("make the feature cards about our sign-up flow") after dropping.

Every palette insert pushes an undo snapshot and appends an assistant message to the transcript, so the chat history stays coherent when you mix palette and chat edits.

## The system prompt

The LLM's behaviour is shaped by [`lib/gcweb/system-prompt.ts`](lib/gcweb/system-prompt.ts), which reads five markdown files in [`lib/gcweb/skills/`](lib/gcweb/skills/) and stitches them into a single prompt:

- `canada-ca-coder.md` — HTML output rules, page patterns, WET utility classes (the **primary** reference)
- `canada-ca-writer.md` — plain-language, active voice, sentence case headings
- `canada-ca-seo.md` — metadata and JSON-LD patterns
- `canada-ca-doormat.md` — doormat title + description conventions
- `gc-component-mapping.md` — canonical component HTML

Edit any of these files directly and the next request will pick up the change (`getSystemPrompt` re-reads them per call).

## Syncing your Claude Code skills

The skills in this repo were copied from your `~/.claude/skills/` at build time. Re-sync any time you update them:

```bash
npm run sync-skill               # syncs all five
npm run sync-skill -- coder      # syncs just canada-ca-coder
```

The script looks in `~/.claude/skills/<name>/SKILL.md` by default. Override the source directory:

```bash
SKILLS_SRC=/path/to/your/skills/repo npm run sync-skill
```

## Architecture notes

### LLM adapter

Everything LLM-related sits behind `LLMClient` in [`lib/llm/types.ts`](lib/llm/types.ts). The v1 implementation is `lib/llm/anthropic.ts` (API key via `ANTHROPIC_API_KEY`).

**Swapping providers later** means writing a sibling file (e.g. `lib/llm/openai.ts`) exporting `createOpenAIClient(): LLMClient` and adding a case in the factory at [`lib/llm/index.ts`](lib/llm/index.ts). No other code changes.

**Why not the Claude subscription?** Using your Claude.ai account from a local Next.js app requires shelling out to the `claude` CLI and plumbing its OAuth through the Node process. It works but it's finicky. We went with the API key path for v1 because it's 15 minutes of setup and behaves predictably. When you want the subscription path, drop in a `lib/llm/claude-subscription.ts` adapter and set `LLM_PROVIDER=claude-subscription` in `.env.local`.

### The preview shell

`lib/gcweb/shell.ts` exports `head()`, `header()`, `footer()`, and `scripts()` for both English and French. `compose.ts` glues them around the LLM content. All CDN asset URLs point at `wet-boew.github.io/themes-dist/GCWeb/...` — the same assets real Canada.ca pages use.

The iframe sandbox is `allow-scripts allow-same-origin` because WET-BOEW's JS needs same-origin to bind to the inline `<script src=...>` loads.

### Storage

- **Conversation state** (messages, bilingual slots, translate snapshots, language) → `localStorage` under key `gc-page-builder:state:v3`. Survives reloads, lost on clear. v1 and v2 keys are auto-migrated on first load.
- **Undo/redo history** → `localStorage` under key `gc-page-builder:history:v3`. Capped at 30 snapshots. Persists across reloads. If the quota is blown the oldest half is dropped automatically.
- **Saved pages** → `./saved-pages/<slug>/page.html` (composed) + `meta.json` (bilingual content + translate snapshots + conversation history). Gitignored by default.

## File map

```
app/
├── layout.tsx               Root layout (Tailwind CSS, lang="en")
├── page.tsx                 Main UI — chat panel + preview pane
└── api/
    ├── chat/route.ts        LLM orchestration endpoint (edit + full modes)
    ├── extract/route.ts     File extraction (docx/pdf/text/image/json)
    ├── compose/route.ts     Deterministic shell wrap (no LLM)
    ├── translate/route.ts   EN ↔ FR translation (narrow LLM prompt)
    └── pages/route.ts       Save/load/delete saved pages

components/
├── ChatPanel.tsx            Left pane — messages + textarea + attachments
├── PreviewPane.tsx          Right pane — iframe + HTML view + toolbar
├── ComponentPalette.tsx     Click-to-insert modal (palette of GCWeb patterns)
├── ComponentPreview.tsx     Sandboxed iframe showing a scaled-down render
└── FileAttachments.tsx      File picker + chip list

lib/
├── gcweb/
│   ├── shell.ts             Head/header/footer/scripts constants (EN + FR)
│   ├── compose.ts           Wraps content in shell; extracts breadcrumb/main
│   ├── edits.ts             Parses + applies GCPB:EDITS op blocks (diff mode)
│   ├── components.ts        Palette catalog (canonical GCWeb HTML, by category)
│   ├── insert-client.ts     Browser-side component inserter (DOMParser)
│   ├── split.ts             Section split/join for smart re-translate
│   ├── smart-translate.ts   Diff-and-patch re-translation orchestrator
│   ├── system-prompt.ts     Reads ./skills/*.md, composes the system prompt
│   ├── translate-prompt.ts  Narrow system prompt for EN↔FR translation
│   └── skills/              Embedded copies of your Claude Code skills
│       ├── canada-ca-coder.md
│       ├── canada-ca-writer.md
│       ├── canada-ca-seo.md
│       ├── canada-ca-doormat.md
│       └── gc-component-mapping.md
├── llm/
│   ├── types.ts             LLMClient interface
│   ├── anthropic.ts         Anthropic API adapter
│   └── index.ts             Factory (reads LLM_PROVIDER env)
└── extractors/
    ├── docx.ts              mammoth wrapper
    ├── pdf.ts               pdf-parse wrapper
    └── image.ts             base64 helper

scripts/
└── sync-skill.mjs           Re-pulls your skills from ~/.claude/skills/

saved-pages/                 Your saved work (gitignored)
```

## What's in v1 and what's stubbed

**Works end-to-end:**
- Chat interface with textarea + multi-file attachments
- Live preview iframe with full GCWeb shell
- Preview / HTML toggle + Download + Copy-HTML
- Reset / new page
- Save and Load pages to `./saved-pages/`
- EN/FR shell swap (rewraps existing content)
- File extraction: .docx (mammoth), .pdf (pdf-parse), .txt/.md/.html/.json, images (base64)
- Diff-based edits: Claude emits either a `<!--GCPB:EDITS-->` op list (applied with cheerio) or a full rewrite. Most single-line changes travel as a few bytes of JSON instead of re-rendering the whole page.
- Undo/redo: linear history stack capped at 30 entries, persisted to `localStorage` under `gc-page-builder:history:v2`. Snapshots before every mutation (send, EN/FR swap, Load, New page, Translate). Sending a new message wipes the redo stack. Try wild rewrites — you can always get back.
- Bilingual pages: the EN/FR toggle is a real bilingual workflow now. Each page has two independent slots (`pages.en` / `pages.fr`); the toggle picks which slot drives the preview. Content drifts between languages as you edit — hit "Translate → FR" (or EN) to sync the other slot. Empty slots are marked ∅ on the toggle.
- Smart re-translate: after the first full translate, subsequent translates only re-translate the sections you changed. Unchanged sections (including manual FR edits) stay byte-identical. Conflicts — sections edited in both languages — prompt for overwrite/keep. Typical single-section re-translate drops from ~2000 to ~200 tokens.
- Component palette: click-to-insert modal with ~20 GCWeb patterns grouped by category, each card showing a live scaled-down preview in a sandboxed iframe. Drop them anywhere on the page — top, bottom, or before/after a specific section — without a round-trip to the LLM. Inserted blocks live in history like any other edit, so undo rolls them back cleanly.

**Stubbed or simplified:**
- Load flow uses `prompt()` — fine for v1, deserves a proper modal.
- No streaming — the chat endpoint waits for the full response. Easy to upgrade: Anthropic SDK has `.stream()` and Next 14 supports `ReadableStream` responses.
- No OCR for scanned PDFs — we send the text layer only. If a PDF has no text, the attachment is empty; upload it as an image instead.
- Error handling is minimal — errors alert or show a banner. Good enough to debug.

## Upgrade path to phase 2

- **Component tree intermediate representation**. Instead of HTML strings, have the LLM emit JSON (`{ type: "alert", variant: "warning", heading, body }`) and render to HTML server-side. Cleaner editing, easier undo.
- **Streaming**. Anthropic's `.stream()` + Next `ReadableStream` response + progressive iframe update.
- **True drag-and-drop palette** (Tier 2). The click-to-insert modal covers most needs; a draggable overlay with drop zones rendered on the preview iframe would be the next step. Requires postMessage between iframe and parent plus drop-zone indicators, so it's a non-trivial bump from Tier 1.
- **Figma MCP integration** (`gc-figma-bridge` skill). Bidirectional sync with the IRCC design library — design in Figma, render to GCWeb; edit in GCWeb, push to Figma.
- **Multi-provider LLM**. Add `lib/llm/claude-subscription.ts` (OAuth via Claude Agent SDK) and/or `lib/llm/openai.ts`.
- **Proper saved-pages UI**. Modal with previews, delete, rename, export bundle.

## Git / deploy

```bash
git init
git add .
git commit -m "Initial commit: GC Page Builder v1"
# push to your GitHub remote
```

`.env.local` is gitignored. `/saved-pages/*` is gitignored too — it's a
leftover from the old server-side save flow and isn't used at runtime
anymore (see below).

## Deploy to Vercel

The app is Vercel-ready. The only thing that wouldn't have worked on
serverless was disk-based save/load, so save/load was moved to the
browser:

- **Save** downloads a `.gcpage.json` file to your machine.
- **Load** opens a file picker; pick a previously-downloaded file.

Same JSON shape as the old `/api/pages` files, so anything saved
previously still loads. The old route at `/api/pages` is now a 410 Gone
stub — nothing in the UI calls it.

Steps:

1. Push this repo to GitHub (already wired to
   `https://github.com/quidampepin/page-builder.git`).
2. In Vercel: **Add New… → Project → Import** that repo. Framework
   preset auto-detects as Next.js — leave the defaults.
3. **Environment Variables**: add `ANTHROPIC_API_KEY` (production
   scope). Don't commit `.env.local` — it's gitignored.
4. **Deploy**. First build runs `npm install` + `next build`.
5. Open the deployment URL and try a chat prompt. The chat and
   translate routes call Anthropic from the server, so the API key
   never reaches the browser.

A few things worth knowing:

- **No persistence between deploys.** All saved work lives in your
  browser's localStorage and the `.gcpage.json` files you download.
  Clearing site data wipes the in-progress page (but not your saved
  files on disk).
- **Anyone with the URL can use it** — unless you turn on the basic-auth
  gate. Set `BASIC_AUTH_USER` and `BASIC_AUTH_PASS` in Vercel's
  environment variables and the `middleware.ts` at the project root
  will return 401 + `WWW-Authenticate: Basic` for unauthenticated
  requests, which makes the browser show its native sign-in dialog.
  Leave both vars unset to disable the gate (e.g. for local dev).
- **Function timeouts.** Hobby plan caps serverless functions at 60s.
  Long translates of very large pages may bump up against this; the
  smart-translate path keeps each call narrow so it's usually fine.

## Licence

Treat it as personal / prototype code for now. Decide on a licence before the repo goes public.
