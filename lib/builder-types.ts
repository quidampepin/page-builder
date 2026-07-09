/**
 * Builder session types — the bilingual page state the embedded GC Page
 * Builder operates on. Lifted here so the auditor's page cache can hold one
 * session per crawled URL and pass it into BuilderPanel as controlled state.
 */

import type { ChatMessage } from "@/components/ChatPanel";
import type { TranslationSnapshot } from "@/lib/gcweb/smart-translate";

export type Lang = "en" | "fr";

export interface PageData {
  title: string;
  content: string;
}

export interface BuilderAppState {
  lang: Lang;
  pages: { en: PageData; fr: PageData };
  snapshots: { en?: TranslationSnapshot; fr?: TranslationSnapshot };
  messages: ChatMessage[];
}

export interface BuilderHistory {
  past: BuilderAppState[];
  future: BuilderAppState[];
}

export const emptyPage: PageData = { title: "New page", content: "" };

export function initialBuilderState(lang: Lang = "en"): BuilderAppState {
  return {
    lang,
    pages: { en: { ...emptyPage }, fr: { ...emptyPage } },
    snapshots: {},
    messages: [],
  };
}

/** Seed a session from an audited page's content in the given language. */
export function seededBuilderState(
  title: string,
  content: string,
  lang: Lang,
): BuilderAppState {
  const pages = { en: { ...emptyPage }, fr: { ...emptyPage } };
  pages[lang] = { title: title || "New page", content: content || "" };
  return { lang, pages, snapshots: {}, messages: [] };
}

export const initialBuilderHistory: BuilderHistory = { past: [], future: [] };
