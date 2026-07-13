/**
 * Batch "run" model for Auto mode — persisted entirely client-side
 * (localStorage autosave + a portable .uxrun.json export), so it works
 * identically on local and on Vercel with no server storage.
 */

import type { Action, FeedbackResult, Lang } from "./types";
import type { Readability } from "./readability";

export interface RunPage {
  url: string;
  title?: string;
  content?: string;
  status: "pending" | "working" | "assessed" | "error" | "applied";
  step?: string;
  error?: string;
  feedback?: FeedbackResult;
  feedbackAnalysis?: string;
  analytics?: string;
  userTasks?: string;
  heuristics?: string;
  seo?: string;
  doormats?: string;
  readability?: Readability;
  a11y?: { critical: number; serious: number; moderate: number; minor: number; total: number };
  linkCheck?: string;
  brokenLinks?: number;
  actions?: Action[];
  approved?: boolean[];
  draftContent?: string;
  afterGrade?: number;
}

export interface RunSelected {
  feedback: boolean;
  analytics: boolean;
  tasks: boolean;
  heuristics: boolean;
  seo: boolean;
  doormats: boolean;
}

export type RunPhase = "setup" | "assessing" | "ready" | "review" | "applying" | "edit" | "done";

export interface Run {
  id: string;
  name: string;
  createdAt: string;
  lang: Lang;
  phase: RunPhase;
  selected: RunSelected;
  pages: RunPage[];
  feedbackCsv?: string;
  analyticsCsv?: string;
  execSummary?: string;
  painPoints?: string;
  nextSteps?: string;
}

const KEY = "ccuxt-run:v1";

export function saveRun(r: Run) {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    /* quota — ignore */
  }
}
export function loadRun(): Run | null {
  try {
    const s = localStorage.getItem(KEY);
    return s ? (JSON.parse(s) as Run) : null;
  } catch {
    return null;
  }
}
export function clearRun() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function newRun(name: string, lang: Lang, urls: string[], selected: RunSelected): Run {
  return {
    id: Math.random().toString(36).slice(2),
    name: name || "Untitled run",
    createdAt: new Date().toISOString(),
    lang,
    phase: "assessing",
    selected,
    pages: urls.map((url) => ({ url, status: "pending" as const })),
  };
}
