"use client";

import {
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { ChatPanel, type ChatMessage } from "./ChatPanel";
import { PreviewPane } from "./PreviewPane";
import { ComponentPalette } from "./ComponentPalette";
import CompareView from "./CompareView";
import type { PendingAttachment } from "./FileAttachments";
import { compose, extractContent } from "@/lib/gcweb/compose";
import { insertComponent, type InsertLocation } from "@/lib/gcweb/insert-client";
import type { PaletteComponent } from "@/lib/gcweb/components";
import {
  planTranslate,
  executePlan,
  fullTranslate,
  makeSnapshot,
} from "@/lib/gcweb/smart-translate";
import { extractTitle } from "@/lib/gcweb/extract-title";
import { blankScaffold } from "@/lib/gcweb/scaffold";
import {
  emptyPage,
  initialBuilderState,
  type BuilderAppState,
  type BuilderHistory,
  type Lang,
} from "@/lib/builder-types";

const HISTORY_CAP = 30;

interface Evidence {
  feedbackAnalysis?: string;
  heuristics?: string;
  userTasks?: string;
  analytics?: string;
}

interface Props {
  state: BuilderAppState;
  setState: Dispatch<SetStateAction<BuilderAppState>>;
  history: BuilderHistory;
  setHistory: Dispatch<SetStateAction<BuilderHistory>>;
  originalTitle: string;
  originalContent: string;
  originalLang: Lang;
  evidence: Evidence;
}

export default function BuilderPanel({
  state,
  setState,
  history,
  setHistory,
  originalTitle,
  originalContent,
  originalLang,
  evidence,
}: Props) {
  const [pending, setPending] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [improving, setImproving] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [rightView, setRightView] = useState<"edit" | "compare">("edit");

  const activePage = state.pages[state.lang];
  const otherLang: Lang = state.lang === "en" ? "fr" : "en";
  const otherPage = state.pages[otherLang];

  const composed = useMemo(() => {
    if (!activePage.content) return "";
    return compose({ title: activePage.title, content: activePage.content, lang: state.lang });
  }, [activePage.title, activePage.content, state.lang]);

  const beforeComposed = useMemo(() => {
    if (!originalContent) return "";
    return compose({ title: originalTitle, content: originalContent, lang: originalLang });
  }, [originalContent, originalTitle, originalLang]);

  const hasEvidence = Boolean(
    evidence.feedbackAnalysis || evidence.heuristics || evidence.userTasks || evidence.analytics,
  );

  function pushHistory(current: BuilderAppState) {
    setHistory((h) => {
      const past = [...h.past, current];
      if (past.length > HISTORY_CAP) past.splice(0, past.length - HISTORY_CAP);
      return { past, future: [] };
    });
  }

  function undo() {
    if (history.past.length === 0) return;
    const prev = history.past[history.past.length - 1];
    setHistory({ past: history.past.slice(0, -1), future: [state, ...history.future] });
    setState(prev);
  }

  function redo() {
    if (history.future.length === 0) return;
    const next = history.future[0];
    setHistory({ past: [...history.past, state], future: history.future.slice(1) });
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
          history: state.messages.map((m) => ({ role: m.role, content: m.content })),
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
        title: string;
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
      setState((s) => ({
        ...s,
        pages: { ...s.pages, [s.lang]: { title: data.title, content: data.content } },
        messages: [...newMessages, assistantMsg],
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  function changeLang(lang: Lang) {
    if (lang === state.lang) return;
    pushHistory(state);
    setState((s) => ({ ...s, lang }));
  }

  async function translate() {
    if (!activePage.content) {
      setError("Nothing to translate — the current language is empty.");
      return;
    }
    const snapshot = state.snapshots[state.lang] ?? null;
    const plan = planTranslate({
      currentSource: activePage.content,
      currentTarget: otherPage.content,
      snapshot,
    });

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
      const ok = confirm(
        `${plan.conflicts.length} section${plan.conflicts.length === 1 ? "" : "s"} were edited in BOTH languages since the last translate.\n\nOK → overwrite the ${otherLang.toUpperCase()} edits with fresh translations.\nCancel → keep the ${otherLang.toUpperCase()} edits, skip those sections.`,
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
      const newSnapshot = makeSnapshot(activePage.content, result.content, activePage.title);
      setState((s) => ({
        ...s,
        lang: otherLang,
        pages: { ...s.pages, [otherLang]: { title: result.title, content: result.content } },
        snapshots: { ...s.snapshots, [s.lang]: newSnapshot },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTranslating(false);
    }
  }

  function slugify(s: string): string {
    return (
      s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "page"
    );
  }

  function save() {
    if (!activePage.content && !otherPage.content) return;
    try {
      const payload = {
        version: 3 as const,
        savedAt: new Date().toISOString(),
        title: activePage.title,
        lang: state.lang,
        pages: state.pages,
        snapshots: state.snapshots,
        composed,
        history: state.messages.map((m) => ({ role: m.role, content: m.content })),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
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

  function load() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.gcpage.json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const meta = JSON.parse(text) as {
          title: string;
          lang: Lang;
          pages?: { en: typeof emptyPage; fr: typeof emptyPage };
          content?: string;
          snapshots?: BuilderAppState["snapshots"];
          history?: Array<{ role: "user" | "assistant"; content: string }>;
        };
        let loadedPages: BuilderAppState["pages"];
        if (meta.pages) {
          loadedPages = meta.pages;
        } else {
          loadedPages = { en: { ...emptyPage }, fr: { ...emptyPage } };
          const savedLang = meta.lang === "fr" ? "fr" : "en";
          loadedPages[savedLang] = { title: meta.title, content: meta.content || "" };
        }
        pushHistory(state);
        setState({
          lang: meta.lang === "fr" ? "fr" : "en",
          pages: loadedPages,
          snapshots: meta.snapshots ?? {},
          messages: (meta.history || []).map((h) => ({ role: h.role, content: h.content })),
        });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? `Load failed: ${err.message}` : `Load failed: ${String(err)}`);
      }
    };
    input.click();
  }

  function handleInsertComponent(component: PaletteComponent, location: InsertLocation) {
    pushHistory(state);
    const nextContent = insertComponent(activePage.content, component.html, location);
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
          title: activePage.content ? activePage.title : "New page",
          content: nextContent,
        },
      },
      messages: [...s.messages, paletteMsg],
    }));
  }

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
      pages: { ...s.pages, [s.lang]: { title: nextTitle, content: normalized } },
      messages: [...s.messages, editMsg],
    }));
  }

  function reset() {
    if (
      (activePage.content || otherPage.content) &&
      !confirm("Start a new page? Current builder work will be lost (unless saved).")
    ) {
      return;
    }
    pushHistory(state);
    setState(initialBuilderState(state.lang));
    setError(null);
  }

  async function importUrl() {
    const url = prompt(
      "Paste a Canada.ca URL to import (only canada.ca and wet-boew.github.io domains allowed):",
    );
    if (!url) return;
    if (activePage.content && !confirm("Importing will replace the current page content. Continue?")) {
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
      const data = (await res.json()) as { title: string; content: string; sourceUrl?: string };
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

  function startBlankScaffold() {
    if (
      activePage.content &&
      !confirm("Replace current content with a blank Canada.ca scaffold? Current work will be lost (unless saved).")
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

  // --- Evidence-driven quick actions ---
  async function improveFromEvidence() {
    if (!hasEvidence) return;
    setImproving(true);
    setError(null);
    setRightView("edit");
    try {
      // Distill all evidence into a short prioritized brief server-side, so the
      // builder chat prompt stays small instead of pasting every full analysis.
      const res = await fetch("/api/improve-brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: activePage.content || undefined,
          feedbackAnalysis: evidence.feedbackAnalysis,
          analytics: evidence.analytics,
          heuristics: evidence.heuristics,
          userTasks: evidence.userTasks,
          lang: state.lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Brief failed (${res.status})`);
      const message =
        "Apply these prioritized improvements to the page. Make the concrete edits; " +
        "keep all facts.\n\n" +
        data.brief;
      await send(message, []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImproving(false);
    }
  }

  function plainLanguage() {
    void send(
      "Rewrite the entire page in clear, plain language following the Canada.ca Content Style Guide. Keep the structure and all facts; shorten sentences, use active voice and common words.",
      [],
    );
  }

  function resetToOriginal() {
    if (!originalContent) return;
    pushHistory(state);
    setState((s) => ({
      ...s,
      pages: {
        ...s.pages,
        [s.lang]: { title: originalTitle || "Page", content: originalContent },
      },
      messages: [
        ...s.messages,
        { role: "assistant", content: "Reset to the original page content.", mode: "edit", editsApplied: 1 },
      ],
    }));
  }

  const contentDiffersFromOriginal = activePage.content.trim() !== originalContent.trim();

  return (
    <div className="gc-builder flex h-full min-h-0">
      {/* Left: quick actions + chat */}
      <div className="flex w-[380px] flex-shrink-0 flex-col border-r border-neutral-200">
        <div className="flex flex-wrap gap-1.5 border-b border-neutral-200 bg-neutral-50 p-2">
          <button
            onClick={improveFromEvidence}
            disabled={pending || improving || !hasEvidence}
            title={hasEvidence ? "Distill the feedback/analytics/heuristics into a short brief, then apply it to the page" : "Gather evidence in the Feedback, Analytics, User tasks or Heuristics tabs first"}
            className="rounded-full bg-canada px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {improving ? "✨ Improving…" : "✨ Improve from evidence"}
          </button>
          <button
            onClick={plainLanguage}
            disabled={pending || !activePage.content}
            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
          >
            Plain language
          </button>
          <button
            onClick={resetToOriginal}
            disabled={!contentDiffersFromOriginal || !originalContent}
            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
          >
            Reset to original
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <ChatPanel
            messages={state.messages}
            pending={pending}
            onSend={send}
            onReset={reset}
            error={error}
            onDismissError={() => setError(null)}
          />
        </div>
      </div>

      {/* Right: edit/preview or compare */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1 border-b border-neutral-200 bg-white px-3 py-1.5">
          <button
            onClick={() => setRightView("edit")}
            className={
              "rounded-md px-3 py-1 text-sm " +
              (rightView === "edit" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100")
            }
          >
            Edit &amp; preview
          </button>
          <button
            onClick={() => setRightView("compare")}
            className={
              "rounded-md px-3 py-1 text-sm " +
              (rightView === "compare" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100")
            }
          >
            Compare with original
          </button>
        </div>
        <div className="min-h-0 flex-1">
          {rightView === "edit" ? (
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
          ) : (
            <CompareView
              beforeComposed={beforeComposed}
              afterComposed={composed}
              beforeContent={originalContent}
              afterContent={activePage.content}
              lang={state.lang}
            />
          )}
        </div>
      </div>

      <ComponentPalette
        open={paletteOpen}
        currentContent={activePage.content}
        onClose={() => setPaletteOpen(false)}
        onInsert={handleInsertComponent}
      />
    </div>
  );
}
