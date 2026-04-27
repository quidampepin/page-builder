"use client";

import { useEffect, useMemo, useState } from "react";
import { ChatPanel, type ChatMessage } from "@/components/ChatPanel";
import { PreviewPane } from "@/components/PreviewPane";
import { ComponentPalette } from "@/components/ComponentPalette";
import type { PendingAttachment } from "@/components/FileAttachments";
import { compose, extractContent } from "@/lib/gcweb/compose";
import {
  insertComponent,
  type InsertLocation,
} from "@/lib/gcweb/insert-client";
import type { PaletteComponent } from "@/lib/gcweb/components";
import {
  planTranslate,
  executePlan,
  fullTranslate,
  makeSnapshot,
  type TranslationSnapshot,
} from "@/lib/gcweb/smart-translate";
import { extractTitle } from "@/lib/gcweb/extract-title";
import { blankScaffold } from "@/lib/gcweb/scaffold";

const LS_KEY = "gc-page-builder:state:v3";
const LS_HISTORY_KEY = "gc-page-builder:history:v3";
/** Previous keys — read on hydrate for migration. v3 adds snapshots. */
const LS_KEY_V2 = "gc-page-builder:state:v2";
const LS_HISTORY_KEY_V2 = "gc-page-builder:history:v2";
const LS_KEY_V1 = "gc-page-builder:state:v1";

/** How many history snapshots to keep. Oldest-first trimming. */
const HISTORY_CAP = 30;

/**
 * Canonical per-language slot. "content" is the breadcrumb + <main> exactly
 * as the LLM/editor produced it (no shell). "title" is the h1 text, cached
 * here so we don't have to re-parse it every render.
 */
interface PageData {
  title: string;
  content: string;
}

/**
 * Bilingual state. Both slots exist at all times; an empty slot has
 * title === "New page" and content === "". The EN/FR toggle just picks
 * which slot feeds the preview. The two slots drift independently — a
 * chat edit only changes the currently-active slot. Use the Translate
 * button to sync them.
 */
interface AppState {
  lang: "en" | "fr";
  pages: {
    en: PageData;
    fr: PageData;
  };
  /**
   * Last-translate snapshots, keyed by SOURCE language. If
   * snapshots.en is set, it means "last time EN→FR ran, this was the EN
   * and this was the FR we produced." Smart re-translate uses this to
   * diff the current EN against the snapshot EN and only re-translate
   * the sections that changed.
   */
  snapshots: {
    en?: TranslationSnapshot;
    fr?: TranslationSnapshot;
  };
  messages: ChatMessage[];
}

const emptyPage: PageData = { title: "New page", content: "" };

const initialState: AppState = {
  lang: "en",
  pages: { en: { ...emptyPage }, fr: { ...emptyPage } },
  snapshots: {},
  messages: [],
};

interface History {
  past: AppState[];
  future: AppState[];
}
const initialHistory: History = { past: [], future: [] };

/**
 * Migrate the flat v1 shape into the bilingual shape (and up to v3). The
 * v1 blob has {title, lang, content, composed, messages} — no pages dict,
 * no snapshots.
 */
function migrateV1(raw: unknown): AppState | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.content !== "string" || typeof obj.title !== "string") {
    return null;
  }
  const lang = obj.lang === "fr" ? "fr" : "en";
  const pages: AppState["pages"] = {
    en: { ...emptyPage },
    fr: { ...emptyPage },
  };
  pages[lang] = { title: obj.title, content: obj.content };
  const messages = Array.isArray(obj.messages) ? (obj.messages as ChatMessage[]) : [];
  return { lang, pages, snapshots: {}, messages };
}

/**
 * Migrate v2 (bilingual, no snapshots) up to v3. Just backfills an empty
 * snapshots dict — existing content is preserved. The next translate will
 * seed a fresh snapshot naturally, so there's no data loss, just a
 * one-time full translate the next time the user presses Translate.
 */
function migrateV2(raw: unknown): AppState | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!obj.pages || typeof obj.pages !== "object") return null;
  return {
    lang: obj.lang === "fr" ? "fr" : "en",
    pages: obj.pages as AppState["pages"],
    snapshots: {},
    messages: Array.isArray(obj.messages) ? (obj.messages as ChatMessage[]) : [],
  };
}

export default function Home() {
  const [state, setState] = useState<AppState>(initialState);
  const [history, setHistory] = useState<History>(initialHistory);
  const [pending, setPending] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Hydrate from localStorage on mount. Walk v3 → v2 → v1, migrating as
  // needed. Old keys are kept in place so a buggy migration can be rolled
  // back without data loss.
  useEffect(() => {
    try {
      const savedV3 = localStorage.getItem(LS_KEY);
      if (savedV3) {
        setState(JSON.parse(savedV3));
      } else {
        const savedV2 = localStorage.getItem(LS_KEY_V2);
        if (savedV2) {
          const migrated = migrateV2(JSON.parse(savedV2));
          if (migrated) setState(migrated);
        } else {
          const savedV1 = localStorage.getItem(LS_KEY_V1);
          if (savedV1) {
            const migrated = migrateV1(JSON.parse(savedV1));
            if (migrated) setState(migrated);
          }
        }
      }
    } catch {
      /* ignore malformed state */
    }
    try {
      const savedHist = localStorage.getItem(LS_HISTORY_KEY);
      if (savedHist) {
        setHistory(JSON.parse(savedHist));
      } else {
        // v2 history snapshots are AppState-shaped without .snapshots.
        // Backfill the missing field so they hydrate cleanly.
        const v2Hist = localStorage.getItem(LS_HISTORY_KEY_V2);
        if (v2Hist) {
          const parsed = JSON.parse(v2Hist) as History;
          const upgrade = (s: AppState) =>
            ({ ...s, snapshots: s.snapshots ?? {} }) as AppState;
          setHistory({
            past: parsed.past.map(upgrade),
            future: parsed.future.map(upgrade),
          });
        }
      }
    } catch {
      /* ignore malformed history */
    }
  }, []);

  // Persist state on every change
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      /* quota — ignore for v1 */
    }
  }, [state]);

  // Persist history on every change
  useEffect(() => {
    try {
      localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(history));
    } catch {
      try {
        const trimmed: History = {
          past: history.past.slice(Math.floor(history.past.length / 2)),
          future: history.future,
        };
        localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(trimmed));
      } catch {
        /* drop */
      }
    }
  }, [history]);

  // Derive composed HTML from the active slot. No /api/compose round-trip —
  // compose() is pure and bundles fine into the client since shell.ts has
  // no Node-only imports.
  const activePage = state.pages[state.lang];
  const composed = useMemo(() => {
    if (!activePage.content) return "";
    return compose({
      title: activePage.title,
      content: activePage.content,
      lang: state.lang,
    });
  }, [activePage.title, activePage.content, state.lang]);

  const otherLang: "en" | "fr" = state.lang === "en" ? "fr" : "en";
  const otherPage = state.pages[otherLang];

  function pushHistory(current: AppState) {
    setHistory((h) => {
      const past = [...h.past, current];
      if (past.length > HISTORY_CAP) {
        past.splice(0, past.length - HISTORY_CAP);
      }
      return { past, future: [] };
    });
  }

  function undo() {
    if (history.past.length === 0) return;
    const prev = history.past[history.past.length - 1];
    setHistory({
      past: history.past.slice(0, -1),
      future: [state, ...history.future],
    });
    setState(prev);
  }

  function redo() {
    if (history.future.length === 0) return;
    const next = history.future[0];
    setHistory({
      past: [...history.past, state],
      future: history.future.slice(1),
    });
    setState(next);
  }

  async function send(message: string, attachments: PendingAttachment[]) {
    setPending(true);
    setError(null);
    pushHistory(state);

    const userMsg: ChatMessage = {
      role: "user",
      content: message || "(attachments only)",
      attachments,
    };
    const newMessages = [...state.messages, userMsg];
    setState((s) => ({ ...s, messages: newMessages }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: message || "Please generate the page from the attachments.",
          attachments,
          currentContent: activePage.content || undefined,
          history: state.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          lang: state.lang,
          title: activePage.title,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Chat API returned ${res.status}`);
      }

      const data = (await res.json()) as {
        content: string;
        composed: string; // no longer used — we derive client-side
        title: string;
        lang: "en" | "fr";
        mode?: "edit" | "full";
        editsApplied?: number;
        editsFailed?: string[];
      };

      const confirmationText =
        data.mode === "edit"
          ? `Applied ${data.editsApplied} targeted edit${data.editsApplied === 1 ? "" : "s"}.`
          : "Updated the page. See the preview on the right.";

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: confirmationText,
        mode: data.mode,
        editsApplied: data.editsApplied,
        editsFailed: data.editsFailed,
      };

      // Write into the currently-active slot. The other language is untouched.
      setState((s) => ({
        ...s,
        pages: {
          ...s.pages,
          [s.lang]: {
            title: data.title,
            content: data.content,
          },
        },
        messages: [...newMessages, assistantMsg],
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  /**
   * Flip the active language. No API call — the other slot's content is
   * already in memory, and compose() runs client-side to produce the
   * shell-wrapped preview.
   *
   * Important: we push history so the user can undo the toggle. If they
   * flipped by accident, one Undo brings them back.
   */
  function changeLang(lang: "en" | "fr") {
    if (lang === state.lang) return;
    pushHistory(state);
    setState((s) => ({ ...s, lang }));
  }

  /**
   * Translate the active-language slot INTO the other slot.
   *
   * Two paths:
   *   • Full translate — when there's no snapshot for this direction, or
   *     the target slot is empty. Single LLM call on the whole page.
   *   • Smart re-translate — diff current source against the last-translated
   *     source snapshot. Only re-translate sections that changed, preserve
   *     target-only edits, prompt on conflicts.
   *
   * Either way, we stash a fresh snapshot after success so the NEXT call
   * can go smart. The snapshot lives per source language under
   * state.snapshots[lang].
   */
  async function translate() {
    if (!activePage.content) {
      setError("Nothing to translate — the current language is empty.");
      return;
    }

    const snapshot = state.snapshots[state.lang] ?? null;

    // Plan first. The plan function returns fallbackFull=true when smart
    // mode can't apply (no snapshot, empty target, shape mismatch).
    const plan = planTranslate({
      currentSource: activePage.content,
      currentTarget: otherPage.content,
      snapshot,
    });

    // Decide on the path + any user confirmations up front, so the async
    // block below has no branching questions to answer.
    let conflictResolution: "overwrite" | "keep" = "overwrite";

    if (plan.fallbackFull) {
      if (
        otherPage.content &&
        !confirm(
          `This will replace the existing ${otherLang.toUpperCase()} version with a full translation from ${state.lang.toUpperCase()}. Continue?`,
        )
      ) {
        return;
      }
    } else if (plan.conflicts.length > 0) {
      // Smart path with conflicts — ask once for the whole batch.
      const ok = confirm(
        `${plan.conflicts.length} section${plan.conflicts.length === 1 ? "" : "s"} ` +
          `were edited in BOTH languages since the last translate.\n\n` +
          `OK  → overwrite the ${otherLang.toUpperCase()} edits with fresh translations.\n` +
          `Cancel → keep the ${otherLang.toUpperCase()} edits, skip those sections.`,
      );
      conflictResolution = ok ? "overwrite" : "keep";
    }

    setTranslating(true);
    setError(null);
    pushHistory(state);

    try {
      const result = plan.fallbackFull
        ? await fullTranslate({
            content: activePage.content,
            title: activePage.title,
            from: state.lang,
            to: otherLang,
          })
        : await executePlan({
            plan,
            currentTitle: activePage.title,
            from: state.lang,
            to: otherLang,
            conflictResolution,
          });

      // Stash a fresh snapshot for NEXT translate (this direction only).
      const newSnapshot = makeSnapshot(
        activePage.content,
        result.content,
        activePage.title,
      );

      setState((s) => ({
        ...s,
        // Fill the OTHER slot, then flip to it so the user sees the result.
        lang: otherLang,
        pages: {
          ...s.pages,
          [otherLang]: {
            title: result.title,
            content: result.content,
          },
        },
        snapshots: {
          ...s.snapshots,
          [s.lang]: newSnapshot,
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTranslating(false);
    }
  }

  /**
   * Save the current state as a JSON file the user downloads.
   *
   * We used to POST to /api/pages and let the server write into
   * ./saved-pages/. That assumed a writable filesystem, which Vercel
   * serverless functions don't have (/tmp is the only writable path
   * and it's ephemeral per-invocation). Doing the save client-side as
   * a download removes the dependency on disk and works identically in
   * dev and on Vercel — no API route, no /tmp, no two code paths.
   *
   * The on-wire shape is unchanged from the old server format, so JSON
   * files saved by the previous /api/pages route load via load() below.
   */
  function save() {
    if (!activePage.content && !otherPage.content) return;
    try {
      const payload = {
        // savedAt + version make the file self-describing if the user
        // opens it in a text editor or shares it with someone else.
        version: 3 as const,
        savedAt: new Date().toISOString(),
        title: activePage.title,
        lang: state.lang,
        pages: state.pages,
        snapshots: state.snapshots,
        composed, // snapshot of the currently-active composed preview
        history: state.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slugify(activePage.title || "page")}.gcpage.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * Load state from a JSON file the user picks from disk.
   *
   * Accepts either the new client-download shape (saved by save()
   * above) or the old server shape from the previous /api/pages route —
   * the fields overlap. The v1 flat shape (single `content` string
   * instead of `pages`) is also tolerated so older saves still load.
   */
  function load() {
    const input = document.createElement("input");
    input.type = "file";
    // Browsers don't honor compound extensions like .gcpage.json in the
    // accept filter — list both .json and the bare extension to widen
    // the file picker's match list.
    input.accept = ".json,.gcpage.json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const meta = JSON.parse(text) as {
          title: string;
          lang: "en" | "fr";
          // New shape: both slots saved.
          pages?: { en: PageData; fr: PageData };
          // Old (v1) shape: single content string.
          content?: string;
          // v3+ saves also carry snapshots so smart-translate survives reloads.
          snapshots?: AppState["snapshots"];
          history?: Array<{ role: "user" | "assistant"; content: string }>;
        };

        // Figure out the bilingual shape. If the saved page has .pages,
        // use it. If not, treat .content as the saved language's
        // content and leave the other slot empty.
        let loadedPages: AppState["pages"];
        if (meta.pages) {
          loadedPages = meta.pages;
        } else {
          loadedPages = { en: { ...emptyPage }, fr: { ...emptyPage } };
          const savedLang = meta.lang === "fr" ? "fr" : "en";
          loadedPages[savedLang] = {
            title: meta.title,
            content: meta.content || "",
          };
        }

        pushHistory(state);
        setState({
          lang: meta.lang,
          pages: loadedPages,
          snapshots: meta.snapshots ?? {},
          messages: (meta.history || []).map((h) => ({
            role: h.role,
            content: h.content,
          })),
        });
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? `Load failed: ${err.message}`
            : `Load failed: ${String(err)}`,
        );
      }
    };
    input.click();
  }

  // Used by save() to derive a default download filename from the page
  // title. Kept inline rather than imported so this file doesn't grow
  // a new util dependency just for one caller. Mirrors the slugify in
  // PreviewPane.tsx.
  function slugify(s: string): string {
    return (
      s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "page"
    );
  }

  /**
   * Palette insert handler. Applies the insertion client-side via DOMParser
   * and pushes an undo snapshot so the user can back out. No network call,
   * no LLM — fully deterministic.
   *
   * A chat message is also appended so the transcript reflects the change.
   * This keeps the chat history readable when the user later reviews what
   * happened, and gives the LLM context on a follow-up turn (e.g. "fill in
   * real copy for the feature cards I just added").
   */
  function handleInsertComponent(
    component: PaletteComponent,
    location: InsertLocation,
  ) {
    pushHistory(state);
    const nextContent = insertComponent(
      activePage.content,
      component.html,
      location,
    );

    const locationLabel =
      location.kind === "top"
        ? "at the top"
        : location.kind === "bottom"
        ? "at the bottom"
        : location.kind === "before"
        ? `before section ${(location.sectionIndex ?? 0) + 1}`
        : `after section ${(location.sectionIndex ?? 0) + 1}`;

    const paletteMsg: ChatMessage = {
      role: "assistant",
      content: `Inserted component: **${component.label}** ${locationLabel}.`,
      mode: "edit",
      editsApplied: 1,
    };

    setState((s) => ({
      ...s,
      pages: {
        ...s.pages,
        [s.lang]: {
          // If the page was empty, the inserter seeded a minimal main with
          // a "New page" h1 — keep the title in sync so the preview matches.
          title: activePage.content ? activePage.title : "New page",
          content: nextContent,
        },
      },
      messages: [...s.messages, paletteMsg],
    }));
  }

  /**
   * Apply a manual HTML edit to the active language slot.
   *
   * The textarea in the PreviewPane edits the raw `content` (breadcrumb +
   * <main>), not the composed shell. We run it through extractContent() to
   * normalize — strip stray DOCTYPE/html/body tags, scaffold a default
   * breadcrumb if missing, etc. — so the saved value is always in the
   * canonical shape that compose(), the LLM editor, and the palette all
   * expect.
   *
   * If a new <h1 id="wb-cont"> heading is present, we sync the page title
   * to it so the shell's <title> tag matches what the user sees. If no h1
   * is found, we keep the current title rather than blanking it out.
   *
   * Pushes an undo snapshot before applying — Undo will revert manual edits
   * exactly like it reverts LLM edits and palette inserts.
   */
  function updateContent(newContent: string) {
    pushHistory(state);

    const { breadcrumb, main } = extractContent(newContent);
    const normalized = `${breadcrumb}\n${main}`;

    const heading = extractTitle(normalized);
    const nextTitle = heading ?? activePage.title;

    const editMsg: ChatMessage = {
      role: "assistant",
      content: "Applied manual HTML edit.",
      mode: "edit",
      editsApplied: 1,
    };

    setState((s) => ({
      ...s,
      pages: {
        ...s.pages,
        [s.lang]: {
          title: nextTitle,
          content: normalized,
        },
      },
      messages: [...s.messages, editMsg],
    }));
  }

  function reset() {
    if (
      (activePage.content || otherPage.content) &&
      !confirm("Start a new page? Current work will be lost (unless saved).")
    ) {
      return;
    }
    pushHistory(state);
    setState(initialState);
    setError(null);
  }

  /**
   * Import a Canada.ca URL into the active slot. Calls /api/import-url
   * which fetches server-side (avoids CORS), strips noise, resolves
   * relative URLs, and returns the breadcrumb + main. We feed it through
   * the same updateContent path as a manual edit so the title gets
   * synced from the new h1 and an undo snapshot is pushed.
   */
  async function importUrl() {
    const url = prompt(
      "Paste a Canada.ca URL to import (only canada.ca and wet-boew.github.io domains allowed):",
    );
    if (!url) return;
    if (
      activePage.content &&
      !confirm(
        "Importing will replace the current page content. Continue?",
      )
    ) {
      return;
    }
    try {
      const res = await fetch("/api/import-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Import failed: ${res.status}`);
      }
      const data = (await res.json()) as {
        title: string;
        content: string;
        sourceUrl?: string;
      };
      updateContent(data.content);
      const importMsg: ChatMessage = {
        role: "assistant",
        content: `Imported page from ${data.sourceUrl ?? url}.`,
        mode: "edit",
        editsApplied: 1,
      };
      setState((s) => ({ ...s, messages: [...s.messages, importMsg] }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * Replace the active slot's content with a blank Canada.ca scaffold —
   * canonical breadcrumb, h1, page-details footer. Useful as a starting
   * point when the user wants to build from a known structure.
   */
  function startBlankScaffold() {
    if (
      activePage.content &&
      !confirm(
        "Replace current content with a blank Canada.ca scaffold? Current work will be lost (unless saved).",
      )
    ) {
      return;
    }
    updateContent(blankScaffold(state.lang));
    const msg: ChatMessage = {
      role: "assistant",
      content: "Started from a blank Canada.ca scaffold.",
      mode: "edit",
      editsApplied: 1,
    };
    setState((s) => ({ ...s, messages: [...s.messages, msg] }));
  }

  return (
    <main className="flex h-screen w-screen">
      <div className="w-[400px] flex-shrink-0">
        <ChatPanel
          messages={state.messages}
          pending={pending}
          onSend={send}
          onReset={reset}
          error={error}
          onDismissError={() => setError(null)}
        />
      </div>
      <div className="flex-1">
        <PreviewPane
          composed={composed}
          content={activePage.content}
          title={activePage.title}
          lang={state.lang}
          otherLangHasContent={Boolean(otherPage.content)}
          onLangChange={changeLang}
          onTranslate={translate}
          translating={translating}
          canTranslate={Boolean(activePage.content) && !translating}
          onSave={save}
          onLoad={load}
          canSave={Boolean(activePage.content || otherPage.content)}
          canUndo={history.past.length > 0}
          canRedo={history.future.length > 0}
          onUndo={undo}
          onRedo={redo}
          onOpenPalette={() => setPaletteOpen(true)}
          onImportUrl={importUrl}
          onBlankScaffold={startBlankScaffold}
          onUpdateContent={updateContent}
        />
      </div>
      <ComponentPalette
        open={paletteOpen}
        currentContent={activePage.content}
        onClose={() => setPaletteOpen(false)}
        onInsert={handleInsertComponent}
      />
    </main>
  );
}
