"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import Markdown from "./Markdown";
import BuilderPanel from "./BuilderPanel";
import type { PageNode } from "@/lib/types";
import type { PageState } from "@/app/page";
import type { BuilderAppState, BuilderHistory, Lang } from "@/lib/builder-types";
import { downloadText, feedbackToCsv, slugify } from "@/lib/download";

type Tab = "preview" | "feedback" | "tasks" | "heuristics" | "build";

const TABS: { id: Tab; label: string }[] = [
  { id: "preview", label: "Content" },
  { id: "feedback", label: "Feedback" },
  { id: "tasks", label: "User tasks" },
  { id: "heuristics", label: "Heuristics" },
  { id: "build", label: "Build" },
];

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-500">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
      {label}
    </div>
  );
}

function Btn({
  onClick,
  disabled,
  children,
  variant = "primary",
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
}) {
  const base =
    "rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";
  const cls =
    variant === "primary"
      ? `${base} bg-slate-800 text-white hover:bg-slate-700`
      : `${base} border border-slate-300 bg-white text-slate-700 hover:bg-slate-100`;
  return (
    <button className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function DownloadMd({ name, source }: { name: string; source: string }) {
  return (
    <button
      onClick={() => downloadText(`${name}.md`, source, "text/markdown")}
      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
    >
      ↓ .md
    </button>
  );
}

function ResultCard({
  title,
  source,
  filename,
}: {
  title: string;
  source: string;
  filename: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</span>
        <DownloadMd name={filename} source={source} />
      </div>
      <Markdown source={source} />
    </div>
  );
}

export default function PageDetail({
  node,
  state,
  appLang,
  builderState,
  builderHistory,
  onBuilderStateChange,
  onBuilderHistoryChange,
  onLoadFeedback,
  onAnalyzeFeedback,
  onUserTasks,
  onHeuristics,
}: {
  node: PageNode;
  state: PageState;
  appLang: Lang;
  builderState: BuilderAppState | undefined;
  builderHistory: BuilderHistory | undefined;
  onBuilderStateChange: Dispatch<SetStateAction<BuilderAppState>>;
  onBuilderHistoryChange: Dispatch<SetStateAction<BuilderHistory>>;
  onLoadFeedback: (subtree: boolean) => void;
  onAnalyzeFeedback: () => void;
  onUserTasks: () => void;
  onHeuristics: () => void;
}) {
  const [tab, setTab] = useState<Tab>("preview");
  const [subtree, setSubtree] = useState(false);

  const slug = slugify(node.title || "page");

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <h2 className="truncate text-base font-semibold text-slate-900">{node.title}</h2>
        <a
          href={node.url}
          target="_blank"
          rel="noopener"
          className="text-xs text-blue-600 hover:underline"
        >
          {node.url}
        </a>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 bg-white px-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-3 py-2.5 text-sm transition ${
              tab === t.id
                ? "font-semibold text-slate-900 after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-canada"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Build tab renders full-bleed (no padding); others get a scroll pad */}
      {tab === "build" ? (
        <div className="min-h-0 flex-1">
          {builderState && builderHistory ? (
            <BuilderPanel
              state={builderState}
              setState={onBuilderStateChange}
              history={builderHistory}
              setHistory={onBuilderHistoryChange}
              originalTitle={state.content?.title ?? node.title}
              originalContent={state.content?.content ?? ""}
              originalLang={appLang}
              evidence={{
                feedbackAnalysis: state.feedbackAnalysis,
                heuristics: state.heuristics,
                userTasks: state.userTasks,
              }}
            />
          ) : (
            <div className="p-4">
              <Spinner label="Loading page content into the builder…" />
            </div>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-4">
          {node.error ? (
            <p className="rounded bg-red-50 p-3 text-sm text-red-700">
              This page failed to fetch: {node.error}
            </p>
          ) : null}

          {/* CONTENT */}
          {tab === "preview" &&
            (state.loadingContent ? (
              <Spinner label="Fetching page…" />
            ) : state.content ? (
              <iframe
                title="preview"
                className="h-[74vh] w-full rounded-lg border border-slate-200 bg-white shadow-sm"
                sandbox="allow-scripts allow-same-origin"
                srcDoc={state.content.composed}
              />
            ) : (
              <p className="text-sm text-slate-500">No content loaded.</p>
            ))}

          {/* FEEDBACK */}
          {tab === "feedback" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Btn onClick={() => onLoadFeedback(subtree)} disabled={state.loadingFeedback}>
                  Load feedback
                </Btn>
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={subtree}
                    onChange={(e) => setSubtree(e.target.checked)}
                  />
                  Include child pages
                </label>
                {state.feedback && state.feedback.matched.length > 0 && (
                  <>
                    <Btn variant="ghost" onClick={onAnalyzeFeedback} disabled={state.loadingFeedbackAnalysis}>
                      Analyze comments
                    </Btn>
                    <button
                      onClick={() =>
                        downloadText(`${slug}-comments.csv`, feedbackToCsv(state.feedback!.matched), "text/csv")
                      }
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      ↓ comments .csv
                    </button>
                  </>
                )}
              </div>

              {state.loadingFeedback && <Spinner label="Matching comments…" />}

              {state.feedback && (
                <div className="text-sm text-slate-600">
                  {state.feedback.note ? (
                    <p className="rounded bg-amber-50 p-3 text-amber-800">{state.feedback.note}</p>
                  ) : (
                    <p>
                      <span className="font-medium">{state.feedback.matched.length}</span> comment(s) matched
                      {state.feedback.subtree ? " (including child pages)" : ""} out of{" "}
                      {state.feedback.totalRows} rows. Columns — URL:{" "}
                      <code>{state.feedback.columns.url ?? "?"}</code>, comment:{" "}
                      <code>{state.feedback.columns.comment ?? "?"}</code>
                      {state.feedback.columns.date ? (
                        <>
                          , date: <code>{state.feedback.columns.date}</code>
                        </>
                      ) : null}
                      .
                    </p>
                  )}
                </div>
              )}

              {state.feedback && state.feedback.matched.length > 0 && (
                <ul className="space-y-1.5">
                  {state.feedback.matched.map((f, i) => (
                    <li key={i} className="rounded-md border border-slate-200 bg-white p-2 text-sm shadow-sm">
                      <span className="text-slate-800">{f.comment}</span>
                      {f.date && <span className="ml-2 text-xs text-slate-400">{f.date}</span>}
                    </li>
                  ))}
                </ul>
              )}

              {state.loadingFeedbackAnalysis && <Spinner label="Analyzing feedback…" />}
              {state.feedbackAnalysis && (
                <ResultCard title="Feedback analysis" source={state.feedbackAnalysis} filename={`${slug}-feedback-analysis`} />
              )}
            </div>
          )}

          {/* USER TASKS */}
          {tab === "tasks" && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Btn onClick={onUserTasks} disabled={state.loadingUserTasks || !state.content}>
                  Generate user tasks
                </Btn>
                {state.feedbackAnalysis && (
                  <span className="text-xs text-slate-500">Feedback themes will be folded in.</span>
                )}
              </div>
              {state.loadingUserTasks && <Spinner label="Writing job stories…" />}
              {state.userTasks && (
                <ResultCard title="User tasks" source={state.userTasks} filename={`${slug}-user-tasks`} />
              )}
            </div>
          )}

          {/* HEURISTICS */}
          {tab === "heuristics" && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Btn onClick={onHeuristics} disabled={state.loadingHeuristics || !state.content}>
                  Run heuristic evaluation
                </Btn>
                {state.feedbackAnalysis && (
                  <span className="text-xs text-slate-500">Findings cross-checked against feedback.</span>
                )}
              </div>
              {state.loadingHeuristics && <Spinner label="Evaluating…" />}
              {state.heuristics && (
                <ResultCard title="Heuristic evaluation" source={state.heuristics} filename={`${slug}-heuristics`} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
