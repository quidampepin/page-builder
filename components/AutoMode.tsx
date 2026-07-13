"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Btn, Spinner } from "./ui";
import Markdown from "./Markdown";
import BuilderPanel from "./BuilderPanel";
import { readability } from "@/lib/readability";
import { a11yStatic } from "@/lib/a11y-static";
import { matchFeedback } from "@/lib/csv";
import { compose } from "@/lib/gcweb/compose";
import { buildProReport, printProReport, type PageReportData } from "@/lib/report-pro";
import { downloadText, slugify } from "@/lib/download";
import { newRun, saveRun, loadRun, clearRun, type Run, type RunSelected } from "@/lib/run";
import { seededBuilderState, initialBuilderHistory, type BuilderAppState, type BuilderHistory, type Lang } from "@/lib/builder-types";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `${res.status} ${res.statusText}`);
  return data as T;
}

const SEV: Record<string, string> = { high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", medium: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" };
type Tab = "assessment" | "actions" | "edit" | "report";
const TABS: { id: Tab; label: string }[] = [
  { id: "assessment", label: "Assessment" },
  { id: "actions", label: "Actions" },
  { id: "edit", label: "Build & edit" },
  { id: "report", label: "Report" },
];
type Session = { state: BuilderAppState; history: BuilderHistory };

export default function AutoMode({ lang }: { lang: Lang }) {
  const [run, setRun] = useState<Run | null>(null);
  const runRef = useRef<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("assessment");
  const importRef = useRef<HTMLInputElement>(null);

  const [urlsText, setUrlsText] = useState("");
  const [name, setName] = useState("");
  const [sel, setSel] = useState<RunSelected>({ feedback: true, analytics: true, tasks: true, heuristics: true, seo: true, doormats: true });
  const [feedbackCsv, setFeedbackCsv] = useState("");
  const [analyticsCsv, setAnalyticsCsv] = useState("");
  const [fbName, setFbName] = useState("");
  const [anName, setAnName] = useState("");
  const fbRef = useRef<HTMLInputElement>(null);
  const anRef = useRef<HTMLInputElement>(null);

  const [sessions, setSessions] = useState<Record<number, Session>>({});
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [openDetails, setOpenDetails] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const r = loadRun();
    if (r) { runRef.current = r; setRun(r); if (r.phase !== "setup" && r.phase !== "assessing") setTab("assessment"); }
  }, []);

  function persist(r: Run) { runRef.current = r; setRun({ ...r }); saveRun(r); }

  const urls = useMemo(() => urlsText.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean).slice(0, 10), [urlsText]);
  async function readFile(file: File, set: (v: string) => void, setNm: (v: string) => void) { set(await file.text()); setNm(file.name); }

  async function start() {
    if (urls.length === 0) { setError("Add at least one Canada.ca URL (max 10)."); return; }
    const r = newRun(name, lang, urls, sel);
    r.feedbackCsv = feedbackCsv || undefined;
    r.analyticsCsv = analyticsCsv || undefined;
    persist(r); setTab("assessment");
    await assessAll(r);
  }

  async function assessAll(r: Run) {
    setBusy(true); setBusyLabel("Running assessments…"); setError(null);
    let i = 0;
    const worker = async () => {
      while (i < r.pages.length) {
        const idx = i++;
        if (r.pages[idx].status === "assessed" || r.pages[idx].status === "applied") continue;
        await assessPage(r, idx);
        persist(r);
      }
    };
    await Promise.all([worker(), worker()]);
    r.phase = "ready"; persist(r);
    setBusyLabel("Summarizing pain points…");
    await generateNarrative(r);
    setBusy(false); setBusyLabel("");
  }

  async function assessPage(r: Run, idx: number) {
    const p = r.pages[idx];
    try {
      p.status = "working"; p.step = "fetching"; persist(r);
      const page = await post<{ title: string; content: string; main: string }>("/api/page", { url: p.url, lang });
      p.title = page.title; p.content = page.content;
      p.readability = readability(page.content || "");
      const st = a11yStatic(page.main || page.content || "");
      p.a11y = { critical: 0, serious: 0, moderate: 0, minor: 0, total: st.imagesMissingAlt + st.headingJumps + st.emptyLinks + (st.hasH1 ? 0 : 1) };

      p.step = "links"; persist(r);
      const links: string[] = [];
      if (typeof DOMParser !== "undefined") {
        const d = new DOMParser().parseFromString(`<div>${page.content}</div>`, "text/html");
        d.querySelectorAll("a[href]").forEach((a) => { const h = a.getAttribute("href") || ""; if (/^https?:/i.test(h)) links.push(h); });
      }
      try {
        const lk = await post<{ checked: number; results: { url: string; ok: boolean; status: number; note?: string }[] }>("/api/check-links", { links });
        const broken = lk.results.filter((x) => x.note !== "skipped (external)" && !x.ok);
        p.brokenLinks = broken.length;
        p.linkCheck = `Checked ${lk.checked} on-domain link(s). ` + (broken.length ? "Broken:\n" + broken.map((b) => `- ${b.status || b.note} ${b.url}`).join("\n") : "No broken on-domain links.");
      } catch { /* non-fatal */ }

      if (r.selected.feedback && r.feedbackCsv) {
        p.step = "feedback"; persist(r);
        const fb = matchFeedback(r.feedbackCsv, p.url, false); p.feedback = fb;
        if (fb.matched.length > 0) { const fa = await post<{ markdown: string }>("/api/analyze-feedback", { comments: fb.matched.map((m) => ({ comment: m.comment, date: m.date })), url: p.url, lang }); p.feedbackAnalysis = fa.markdown; }
      }
      if (r.selected.analytics && r.analyticsCsv) { p.step = "analytics"; persist(r); const an = await post<{ markdown: string }>("/api/analyze-analytics", { csv: r.analyticsCsv, url: p.url, pageTitle: p.title, feedbackThemes: p.feedbackAnalysis, lang }); p.analytics = an.markdown; }
      if (r.selected.tasks) { p.step = "user tasks"; persist(r); const ut = await post<{ markdown: string }>("/api/user-tasks", { pages: [{ title: p.title, url: p.url, content: p.content }], feedbackThemes: p.feedbackAnalysis, analyticsThemes: p.analytics, lang }); p.userTasks = ut.markdown; }
      if (r.selected.heuristics) { p.step = "heuristics"; persist(r); const h = await post<{ markdown: string }>("/api/heuristics", { title: p.title, url: p.url, content: p.content, feedbackThemes: p.feedbackAnalysis, analyticsThemes: p.analytics, userTasks: p.userTasks, lang }); p.heuristics = h.markdown; }
      if (r.selected.seo) { p.step = "SEO"; persist(r); const se = await post<{ markdown: string }>("/api/seo", { title: p.title, url: p.url, content: p.content, feedbackThemes: p.feedbackAnalysis, analyticsThemes: p.analytics, lang }); p.seo = se.markdown; }
      if (r.selected.doormats) { p.step = "doormats"; persist(r); const dm = await post<{ markdown: string }>("/api/doormats", { title: p.title, url: p.url, content: p.content, feedbackThemes: p.feedbackAnalysis, analyticsThemes: p.analytics, lang }); p.doormats = dm.markdown; }

      p.step = "actions"; persist(r);
      const ac = await post<{ actions: Run["pages"][number]["actions"] }>("/api/actions", {
        title: p.title, url: p.url, feedbackAnalysis: p.feedbackAnalysis, analytics: p.analytics, userTasks: p.userTasks, heuristics: p.heuristics, seo: p.seo, doormats: p.doormats,
        accessibility: p.a11y ? `${p.a11y.total} static accessibility issues (missing alt, heading jumps, empty links)` : undefined,
        readability: p.readability ? `Reading grade ${p.readability.gradeLevel}; ${p.readability.passiveHits} passive-voice hits` : undefined, lang,
      });
      p.actions = ac.actions || []; p.approved = p.actions.map(() => true);
      p.status = "assessed"; p.step = undefined;
    } catch (e) { p.status = "error"; p.error = e instanceof Error ? e.message : String(e); p.step = undefined; }
  }

  function a11yTotal(html: string): number { const st = a11yStatic(html); return st.imagesMissingAlt + st.headingJumps + st.emptyLinks + (st.hasH1 ? 0 : 1); }

  async function generateNarrative(r: Run) {
    const narrPages = r.pages.filter((p) => p.content).map((p) => ({
      title: p.title, url: p.url, feedback: p.feedbackAnalysis, analytics: p.analytics, heuristics: p.heuristics, seo: p.seo, doormats: p.doormats,
      appliedActions: p.draftContent ? (p.actions || []).filter((_, i) => p.approved?.[i]).map((a) => a.title) : [],
      gradeBefore: p.readability?.gradeLevel, gradeAfter: p.draftContent ? readability(p.draftContent).gradeLevel : p.readability?.gradeLevel,
      a11yBefore: p.a11y?.total, a11yAfter: p.draftContent ? a11yTotal(p.draftContent) : p.a11y?.total,
    }));
    if (narrPages.length === 0) return;
    try {
      const nar = await post<{ execSummary: string; painPoints: string; nextSteps: string }>("/api/report-narrative", { name: r.name, lang: r.lang, pages: narrPages });
      r.execSummary = nar.execSummary; r.painPoints = nar.painPoints; r.nextSteps = nar.nextSteps; persist(r);
    } catch (e) { setError("Narrative summary failed: " + (e instanceof Error ? e.message : String(e))); }
  }

  function toggle(pi: number, ai: number) { const r = runRef.current; if (!r) return; const ap = r.pages[pi].approved || []; ap[ai] = !ap[ai]; r.pages[pi].approved = [...ap]; persist(r); }

  async function applyAll() {
    const r = runRef.current; if (!r) return;
    setBusy(true); setBusyLabel("Applying approved fixes…"); setError(null); setSessions({});
    let firstDraft: number | null = null;
    for (let idx = 0; idx < r.pages.length; idx++) {
      const p = r.pages[idx];
      const approved = (p.actions || []).filter((_, i) => p.approved?.[i]);
      if (!p.content || approved.length === 0) continue;
      p.status = "working"; p.step = "applying"; persist(r);
      try {
        const brief = approved.map((a, i) => `${i + 1}. ${a.title}. ${a.fix}`).join("\n");
        const res = await post<{ content: string }>("/api/chat", { message: "Apply these approved improvements to the page. Make the concrete edits; keep all facts.\n\n" + brief, currentContent: p.content, lang, title: p.title });
        p.draftContent = res.content; p.afterGrade = readability(res.content).gradeLevel; p.status = "applied"; p.step = undefined;
        if (firstDraft === null) firstDraft = idx;
      } catch (e) { p.status = "error"; p.error = e instanceof Error ? e.message : String(e); }
      persist(r);
    }
    setBusy(false); setBusyLabel("");
    if (firstDraft !== null) { openEdit(firstDraft); setTab("edit"); }
  }

  function openEdit(idx: number) {
    const r = runRef.current; if (!r) return;
    setEditIdx(idx);
    setSessions((prev) => (prev[idx] ? prev : { ...prev, [idx]: { state: seededBuilderState(r.pages[idx].title || "Page", r.pages[idx].draftContent || r.pages[idx].content || "", r.lang), history: initialBuilderHistory } }));
  }
  function makeStateSetter(idx: number): Dispatch<SetStateAction<BuilderAppState>> {
    return (updater) => setSessions((prev) => { const cur = prev[idx]; if (!cur) return prev; const next = typeof updater === "function" ? (updater as (s: BuilderAppState) => BuilderAppState)(cur.state) : updater; const r = runRef.current; if (r) { r.pages[idx].draftContent = next.pages[next.lang]?.content || r.pages[idx].draftContent; saveRun(r); } return { ...prev, [idx]: { ...cur, state: next } }; });
  }
  function makeHistorySetter(idx: number): Dispatch<SetStateAction<BuilderHistory>> {
    return (updater) => setSessions((prev) => { const cur = prev[idx]; if (!cur) return prev; const next = typeof updater === "function" ? (updater as (h: BuilderHistory) => BuilderHistory)(cur.history) : updater; return { ...prev, [idx]: { ...cur, history: next } }; });
  }
  function downloadPageHtml(idx: number) { const r = runRef.current; if (!r) return; const p = r.pages[idx]; const content = p.draftContent || p.content || ""; if (!content) return; downloadText(`${slugify(p.title || "page")}.html`, compose({ title: p.title || "Page", content, lang: r.lang }), "text/html"); }

  function reportPages(r: Run): PageReportData[] {
    return r.pages.filter((p) => p.content).map((p) => {
      const afterTotal = p.draftContent ? a11yTotal(p.draftContent) : undefined;
      return {
        title: p.title || p.url, url: p.url,
        readability: p.draftContent ? readability(p.draftContent) : p.readability,
        beforeGrade: p.draftContent ? p.readability?.gradeLevel : undefined,
        a11y: afterTotal != null ? { critical: 0, serious: 0, moderate: 0, minor: 0, total: afterTotal } : p.a11y,
        a11yBefore: p.draftContent ? p.a11y?.total : undefined,
        feedbackCount: p.feedback?.matched.length, feedbackQuotes: p.feedback?.matched.slice(0, 2).map((m) => m.comment),
        brokenLinks: p.brokenLinks, actions: p.actions, appliedActions: (p.actions || []).filter((_, i) => p.approved?.[i]),
      };
    });
  }
  const reportHtml = useMemo(() => {
    if (!run || run.phase === "setup") return "";
    const ready = run.pages.some((p) => p.content);
    if (!ready) return "";
    return buildProReport({ title: run.name, subtitle: `${run.pages.length} page${run.pages.length === 1 ? "" : "s"} assessed`, generatedAt: new Date().toLocaleString(), lang: run.lang, execSummary: run.execSummary, painPoints: run.painPoints, nextSteps: run.nextSteps, pages: reportPages(run) });
  }, [run]);

  async function refreshReport() { const r = runRef.current; if (!r) return; setBusy(true); setBusyLabel("Writing the report…"); setError(null); await generateNarrative(r); setBusy(false); setBusyLabel(""); }

  function exportRun() { if (run) downloadText(`${slugify(run.name)}.uxrun.json`, JSON.stringify(run, null, 2), "application/json"); }
  async function importRun(file: File) { try { const r = JSON.parse(await file.text()) as Run; persist(r); setTab("assessment"); } catch { setError("Invalid run file."); } }
  function reset() { if (run && !confirm("Discard the current run?")) return; clearRun(); runRef.current = null; setRun(null); setSessions({}); setEditIdx(null); }
  const toggleSel = (k: keyof RunSelected) => setSel((s) => ({ ...s, [k]: !s[k] }));

  function goTab(t: Tab) { if (t === "edit" && editIdx == null && run) { const i = run.pages.findIndex((p) => p.content); if (i >= 0) openEdit(i); } setTab(t); }

  // ---------- SETUP ----------
  if (!run || run.phase === "setup") {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Automatic batch audit</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Give it 1–10 Canada.ca URLs and optional data. It assesses every page, then you move freely between Assessment, Actions, Build &amp; edit, and Report.</p>
        </div>
        {error && <div className="rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Run name (e.g. Visitor visa section)" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
        <textarea value={urlsText} onChange={(e) => setUrlsText(e.target.value)} placeholder="One Canada.ca URL per line (max 10)…" className="h-32 w-full rounded-md border border-slate-300 p-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
        <div className="text-xs text-slate-500 dark:text-slate-400">{urls.length} URL(s) detected{urls.length > 10 ? " (only first 10 used)" : ""}.</div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm"><input ref={fbRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0], setFeedbackCsv, setFbName)} /><Btn variant="ghost" onClick={() => fbRef.current?.click()}>Feedback CSV</Btn><span className="text-xs text-slate-500">{fbName || "optional"}</span></label>
          <label className="flex items-center gap-2 text-sm"><input ref={anRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0], setAnalyticsCsv, setAnName)} /><Btn variant="ghost" onClick={() => anRef.current?.click()}>Analytics CSV</Btn><span className="text-xs text-slate-500">{anName || "optional"}</span></label>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Assessments to run (Opus)</div>
          <div className="flex flex-wrap gap-3">
            {(["feedback", "analytics", "tasks", "heuristics", "seo", "doormats"] as (keyof RunSelected)[]).map((k) => (<label key={k} className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300"><input type="checkbox" checked={sel[k]} onChange={() => toggleSel(k)} /> {k}</label>))}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Readability, accessibility and link checks always run (client-side). Each ticked box is one Opus call per page.</p>
        </div>
        <div className="flex items-center gap-3">
          <Btn onClick={start} disabled={busy || urls.length === 0}>Run assessments</Btn>
          <input ref={importRef} type="file" accept=".json,.uxrun.json" className="hidden" onChange={(e) => e.target.files?.[0] && importRun(e.target.files[0])} />
          <Btn variant="ghost" onClick={() => importRef.current?.click()}>Import run…</Btn>
        </div>
      </div>
    );
  }

  const doneCount = run.pages.filter((p) => p.status === "assessed" || p.status === "applied").length;
  const draftCount = run.pages.filter((p) => p.draftContent).length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900">
        <div className="font-semibold text-slate-900 dark:text-slate-100">{run.name}</div>
        {busy ? <Spinner label={busyLabel} /> : <span className="text-xs text-slate-500 dark:text-slate-400">{doneCount}/{run.pages.length} assessed{draftCount ? ` · ${draftCount} rewritten` : ""}</span>}
        <div className="flex-1" />
        <Btn variant="ghost" onClick={exportRun}>Export run</Btn>
        <Btn variant="ghost" onClick={reset}>New run</Btn>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-2 dark:border-slate-700 dark:bg-slate-900">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => goTab(t.id)} className={`relative px-3 py-2.5 text-sm transition ${tab === t.id ? "font-semibold text-slate-900 after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-canada dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"}`}>{t.label}</button>
        ))}
      </div>

      {error && <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}

      {/* EDIT renders full-height; others scroll */}
      {tab === "edit" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
            {run.pages.map((p, i) => p.content ? (
              <button key={i} onClick={() => openEdit(i)} className={`rounded-full px-3 py-1 text-xs ${editIdx === i ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"}`} title={p.url}>
                {(p.title || p.url).slice(0, 24)}
                {p.draftContent ? <span className="ml-1.5 opacity-90">{p.readability?.gradeLevel ?? "?"}→{readability(p.draftContent).gradeLevel}</span> : null}
              </button>
            ) : null)}
            <div className="flex-1" />
            <Btn variant="ghost" onClick={() => editIdx != null && downloadPageHtml(editIdx)} disabled={editIdx == null}>Download page HTML</Btn>
          </div>
          <div className="min-h-0 flex-1">
            {editIdx != null && sessions[editIdx] ? (
              <BuilderPanel state={sessions[editIdx].state} setState={makeStateSetter(editIdx)} history={sessions[editIdx].history} setHistory={makeHistorySetter(editIdx)} originalTitle={run.pages[editIdx].title || "Page"} originalContent={run.pages[editIdx].content || ""} originalLang={run.lang} evidence={{ feedbackAnalysis: run.pages[editIdx].feedbackAnalysis, heuristics: run.pages[editIdx].heuristics, userTasks: run.pages[editIdx].userTasks, analytics: run.pages[editIdx].analytics }} />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-400">Pick a page above to review its changes (builder&apos;s <b className="mx-1">Compare</b> tab) and tweak it.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-4 dark:bg-slate-950">
          {/* ASSESSMENT */}
          {tab === "assessment" && (
            <div className="space-y-3">
              {run.phase === "assessing" && !busy && <Btn onClick={() => assessAll(run)}>Resume assessment</Btn>}
              {run.painPoints && (
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Pain points across the set</div>
                  {run.execSummary && <Markdown source={run.execSummary} />}
                  <Markdown source={run.painPoints} />
                </div>
              )}
              {run.pages.map((p, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${p.status === "error" ? "bg-red-500" : p.status === "assessed" || p.status === "applied" ? "bg-emerald-500" : p.status === "working" ? "bg-amber-500" : "bg-slate-300"}`} />
                    <span className="font-medium text-slate-900 dark:text-slate-100">{p.title || p.url}</span>
                    {p.readability && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">grade {p.readability.gradeLevel}</span>}
                    {p.a11y && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">a11y {p.a11y.total}</span>}
                    {p.brokenLinks != null && p.brokenLinks > 0 && <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700 dark:bg-red-900 dark:text-red-300">{p.brokenLinks} broken link(s)</span>}
                    {p.feedback && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{p.feedback.matched.length} comments</span>}
                    {p.status === "working" && <span className="text-xs text-amber-600">{p.step}…</span>}
                    {p.status === "error" && <span className="text-xs text-red-500">{p.error}</span>}
                    <div className="flex-1" />
                    {(p.feedbackAnalysis || p.heuristics || p.analytics || p.seo || p.doormats) && (
                      <button onClick={() => setOpenDetails((o) => ({ ...o, [i]: !o[i] }))} className="text-xs text-blue-600 hover:underline dark:text-blue-400">{openDetails[i] ? "Hide details" : "Show details"}</button>
                    )}
                  </div>
                  {openDetails[i] && (
                    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                      {([["Feedback", p.feedbackAnalysis], ["Analytics", p.analytics], ["Heuristics", p.heuristics], ["SEO", p.seo], ["Doormats", p.doormats]] as [string, string | undefined][]).map(([h, md]) => md ? (
                        <div key={h}><div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</div><Markdown source={md} /></div>
                      ) : null)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ACTIONS */}
          {tab === "actions" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Btn onClick={applyAll} disabled={busy}>Apply approved fixes →</Btn>
                <span className="text-xs text-slate-500 dark:text-slate-400">Untick anything you don&apos;t want. Applying rewrites each page; review &amp; tweak in <b>Build &amp; edit</b>.</span>
              </div>
              {run.pages.map((p, pi) => (
                <div key={pi} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{p.title || p.url}</span>
                    {p.draftContent && <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">rewritten</span>}
                  </div>
                  {(p.actions || []).length === 0 ? <p className="text-sm text-slate-400">No actions proposed.</p> : (
                    <ul className="space-y-1.5">
                      {(p.actions || []).map((a, ai) => (
                        <li key={ai} className="flex items-start gap-2 text-sm">
                          <input type="checkbox" checked={!!p.approved?.[ai]} onChange={() => toggle(pi, ai)} className="mt-1" />
                          <div><span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-semibold ${SEV[a.severity] || SEV.low}`}>{a.severity}</span><span className="font-medium text-slate-800 dark:text-slate-200">{a.title}</span><span className="text-slate-500 dark:text-slate-400"> — {a.fix}</span></div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* REPORT */}
          {tab === "report" && (
            <div className="flex h-full flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Btn onClick={refreshReport} disabled={busy}>{run.painPoints ? "Refresh written sections" : "Write report sections"}</Btn>
                <Btn variant="ghost" onClick={() => reportHtml && downloadText(`${slugify(run.name)}-report.html`, reportHtml, "text/html")} disabled={!reportHtml}>Download report (HTML)</Btn>
                <Btn variant="ghost" onClick={() => reportHtml && printProReport(reportHtml)} disabled={!reportHtml}>Download report (PDF)</Btn>
                <span className="text-xs text-slate-500 dark:text-slate-400">{draftCount} page(s) rewritten. Reflects your edits.</span>
              </div>
              {reportHtml ? (
                <iframe title="batch report" className="min-h-0 w-full flex-1 rounded-lg border border-slate-200 bg-white dark:border-slate-700" sandbox="allow-scripts allow-same-origin" srcDoc={reportHtml} />
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-slate-400">The report will appear once the assessment has run.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
