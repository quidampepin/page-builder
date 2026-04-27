"use client";

import { useEffect, useState } from "react";

type View = "preview" | "html";

interface Props {
  composed: string;
  /** Raw editable content (breadcrumb + <main>, no shell). The HTML view
   *  edits THIS, not `composed`, because the shell is auto-generated and
   *  shouldn't be hand-edited — any change there would be discarded the
   *  next time compose() runs. */
  content: string;
  title: string;
  lang: "en" | "fr";
  /** Whether the non-active language slot has any content. Drives the
   * visual hint on the inactive EN/FR button (so the user knows whether
   * flipping will show a real page or an empty state). */
  otherLangHasContent: boolean;
  onLangChange: (lang: "en" | "fr") => void;
  onTranslate: () => void;
  translating: boolean;
  /** false while translate is running or when there's nothing to translate. */
  canTranslate: boolean;
  onSave: () => void;
  onLoad: () => void;
  canSave: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Opens the component palette modal. The modal itself lives in the
   *  parent so it can access app state for insertions. */
  onOpenPalette: () => void;
  /** Called when the user clicks Save in the HTML editor. The parent runs
   *  the new content through extractContent() to validate, syncs the title
   *  from the new h1, and pushes an undo snapshot. */
  onUpdateContent: (newContent: string) => void;
}

export function PreviewPane({
  composed,
  content,
  title,
  lang,
  otherLangHasContent,
  onLangChange,
  onTranslate,
  translating,
  canTranslate,
  onSave,
  onLoad,
  canSave,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenPalette,
  onUpdateContent,
}: Props) {
  const [view, setView] = useState<View>("preview");

  // Local draft for the HTML editor. Initialized from `content` whenever
  // the user enters HTML view fresh. Once dirty, we DON'T silently
  // overwrite it on external content changes (e.g. an LLM edit while the
  // user is mid-typing) — the user has to explicitly Cancel or Save.
  const [htmlDraft, setHtmlDraft] = useState<string>(content);
  const dirty = htmlDraft !== content;

  // When the user switches into HTML view, refresh the draft from the
  // current content. Switching out of HTML view is gated by a confirm()
  // when dirty (see toggle handlers below).
  useEffect(() => {
    if (view === "html") {
      setHtmlDraft(content);
    }
    // We intentionally don't depend on `content` here — once in HTML view,
    // external content changes don't clobber the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Action queued behind a pending HTML commit. When the user clicks
  // Save / Copy HTML / Download from the toolbar with unsaved HTML edits,
  // we first commit the draft via onUpdateContent (which updates parent
  // state asynchronously). The useEffect below then fires the queued
  // action once the new `content` lands as a prop — by which point
  // `composed` and the parent's save() closure are also fresh. Without
  // this two-step, those actions would use stale data from the previous
  // render's closure.
  const [queuedAction, setQueuedAction] = useState<
    null | "save" | "copy" | "download"
  >(null);

  useEffect(() => {
    if (queuedAction === null) return;
    // The parent has re-rendered with the committed content. Sync the
    // draft so dirty becomes false, then fire the queued action.
    setHtmlDraft(content);
    if (queuedAction === "save") onSave();
    else if (queuedAction === "copy") void copy();
    else if (queuedAction === "download") download();
    setQueuedAction(null);
    // We deliberately depend only on `content` (and queuedAction itself)
    // so the effect fires when the commit lands. The handlers are stable
    // enough for our purposes — onSave reflects the latest parent state
    // because the parent re-rendered between commit and effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, queuedAction]);

  /**
   * Run a toolbar action (save to disk, copy HTML, download HTML).
   *
   * If there are unsaved HTML edits, commit them first via
   * onUpdateContent and queue the action — the useEffect above runs it
   * once the new content lands. This makes the toolbar Save button feel
   * like a single atomic "save my work" action regardless of whether the
   * user is in Preview or in the HTML editor with dirty edits.
   */
  function runOrQueue(action: "save" | "copy" | "download") {
    if (view === "html" && dirty) {
      onUpdateContent(htmlDraft);
      setQueuedAction(action);
      return;
    }
    if (action === "save") onSave();
    else if (action === "copy") void copy();
    else if (action === "download") download();
  }

  function switchView(next: View) {
    if (view === next) return;
    if (view === "html" && dirty) {
      const ok = confirm(
        "You have unsaved HTML edits. Discard them and switch to Preview?",
      );
      if (!ok) return;
    }
    setView(next);
  }

  function saveHtml() {
    if (!dirty) return;
    onUpdateContent(htmlDraft);
    // Parent will update `content`; the useEffect above won't re-fire (view
    // didn't change), so we leave `htmlDraft` as-is. After the parent's
    // state lands, dirty becomes false and Save disables itself naturally.
  }

  function cancelHtml() {
    setHtmlDraft(content);
  }

  function download() {
    const blob = new Blob([composed], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(title || "page")}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    await navigator.clipboard.writeText(composed);
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-4 py-2.5">
        <div className="flex rounded-md border border-neutral-300 overflow-hidden">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo last change"
            aria-label="Undo"
            className="px-2 py-1 text-sm hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            ← Undo
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo last undone change"
            aria-label="Redo"
            className="border-l border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            Redo →
          </button>
        </div>

        <div className="flex rounded-md border border-neutral-300 overflow-hidden">
          <button
            type="button"
            onClick={() => switchView("preview")}
            className={
              "px-3 py-1 text-sm " +
              (view === "preview"
                ? "bg-blue-600 text-white"
                : "bg-white hover:bg-neutral-100")
            }
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => switchView("html")}
            title={
              view === "html"
                ? "Editing the page content (breadcrumb + main). Shell is auto-generated."
                : "Edit the page HTML directly"
            }
            className={
              "px-3 py-1 text-sm border-l border-neutral-300 " +
              (view === "html"
                ? "bg-blue-600 text-white"
                : "bg-white hover:bg-neutral-100")
            }
          >
            HTML
            {view === "html" && dirty && (
              <span
                className="ml-1 text-amber-400"
                aria-label="unsaved changes"
                title="Unsaved changes"
              >
                •
              </span>
            )}
          </button>
        </div>

        <div className="flex rounded-md border border-neutral-300 overflow-hidden">
          <button
            type="button"
            onClick={() => onLangChange("en")}
            className={
              "px-2 py-1 text-sm " +
              (lang === "en"
                ? "bg-blue-600 text-white"
                : "bg-white hover:bg-neutral-100")
            }
            title={
              lang === "en"
                ? "English (current)"
                : otherLangHasContent || lang === "fr"
                ? "Switch to English"
                : "Switch to English (slot is empty)"
            }
          >
            EN
            {lang !== "en" && !otherLangHasContent && (
              <span className="ml-1 text-neutral-400" aria-hidden>
                ∅
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onLangChange("fr")}
            className={
              "px-2 py-1 text-sm border-l border-neutral-300 " +
              (lang === "fr"
                ? "bg-blue-600 text-white"
                : "bg-white hover:bg-neutral-100")
            }
            title={
              lang === "fr"
                ? "Français (courant)"
                : otherLangHasContent || lang === "en"
                ? "Basculer en français"
                : "Basculer en français (emplacement vide)"
            }
          >
            FR
            {lang !== "fr" && !otherLangHasContent && (
              <span className="ml-1 text-neutral-400" aria-hidden>
                ∅
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onTranslate}
          disabled={!canTranslate}
          title={
            lang === "en"
              ? "Translate current page to French"
              : "Translate current page to English"
          }
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          {translating
            ? "Translating..."
            : lang === "en"
            ? "Translate → FR"
            : "Translate → EN"}
        </button>

        <button
          type="button"
          onClick={onOpenPalette}
          title="Insert a GCWeb component from the palette"
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-100"
        >
          + Component
        </button>

        <div className="flex-1" />

        <button
          type="button"
          onClick={onLoad}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-100"
        >
          Load
        </button>
        <button
          type="button"
          onClick={() => runOrQueue("save")}
          disabled={!canSave}
          title={
            view === "html" && dirty
              ? "Save the page to disk (will apply your unsaved HTML edits first)"
              : "Save the page to disk"
          }
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-100 disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => runOrQueue("copy")}
          disabled={!canSave}
          title={
            view === "html" && dirty
              ? "Copy the composed HTML (will apply your unsaved HTML edits first)"
              : "Copy the composed HTML to clipboard"
          }
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-100 disabled:opacity-50"
        >
          Copy HTML
        </button>
        <button
          type="button"
          onClick={() => runOrQueue("download")}
          disabled={!canSave}
          title={
            view === "html" && dirty
              ? "Download the composed HTML (will apply your unsaved HTML edits first)"
              : "Download the composed HTML"
          }
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          Download
        </button>
      </header>

      <div className="flex-1 overflow-hidden bg-neutral-200">
        {view === "preview" ? (
          <iframe
            title="Canada.ca preview"
            className="h-full w-full bg-white"
            sandbox="allow-scripts allow-same-origin"
            srcDoc={composed || EMPTY_PLACEHOLDER}
          />
        ) : (
          <div className="flex h-full flex-col">
            <textarea
              value={htmlDraft}
              onChange={(e) => setHtmlDraft(e.target.value)}
              spellCheck={false}
              // Editor pane: dark theme matches a code editor, fills the
              // available height. Tailwind's text-sm feels tight but it's
              // what the previous read-only pre used so we stay consistent.
              className="flex-1 resize-none bg-neutral-900 p-3 font-mono text-sm leading-relaxed text-neutral-100 outline-none focus:bg-neutral-800"
              placeholder="<!-- No page yet. Send a prompt on the left, or paste HTML here. -->"
              aria-label="Edit page HTML"
            />
            <div className="flex items-center gap-2 border-t border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300">
              <span className="text-neutral-400">
                Editing breadcrumb + <code>&lt;main&gt;</code>. Shell is
                auto-generated.
              </span>
              {dirty && (
                <span className="text-amber-400">• unsaved changes</span>
              )}
              <div className="flex-1" />
              <button
                type="button"
                onClick={cancelHtml}
                disabled={!dirty}
                className="rounded-md border border-neutral-600 px-2 py-1 text-sm text-neutral-200 hover:bg-neutral-700 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveHtml}
                disabled={!dirty}
                title="Apply HTML changes (pushes an undo snapshot)"
                className="rounded-md bg-amber-500 px-3 py-1 text-sm font-medium text-neutral-900 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500"
              >
                Save HTML
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "page";
}

const EMPTY_PLACEHOLDER = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>No page yet</title>
<style>
  body {
    font-family: -apple-system, system-ui, sans-serif;
    color: #666;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    margin: 0;
    background: #f8f8f8;
  }
  .hint { text-align: center; max-width: 400px; padding: 2rem; }
  .hint h1 { font-size: 1rem; color: #333; }
  .hint p { font-size: 0.9rem; }
</style>
</head><body>
<div class="hint">
  <h1>No page yet</h1>
  <p>Send a prompt on the left to generate a Canada.ca page.</p>
</div>
</body></html>`;
