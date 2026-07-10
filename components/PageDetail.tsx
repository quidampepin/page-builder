"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import BuilderPanel from "./BuilderPanel";
import PageAndIA from "./PageAndIA";
import FeedbackPanel from "./FeedbackPanel";
import AnalyticsPanel from "./AnalyticsPanel";
import AssessPanel from "./AssessPanel";
import ActionsPanel from "./ActionsPanel";
import SectionPanel from "./SectionPanel";
import ReportPanel from "./ReportPanel";
import { Spinner } from "./ui";
import { compose } from "@/lib/gcweb/compose";
import { slugify } from "@/lib/download";
import type { CrawlResult, PageNode } from "@/lib/types";
import type { PageState } from "@/app/page";
import type { BuilderAppState, BuilderHistory, Lang } from "@/lib/builder-types";

type Tab = "pageia" | "feedback" | "analytics" | "assess" | "actions" | "section" | "build" | "report";

const TABS: { id: Tab; label: string }[] = [
  { id: "pageia", label: "Page & IA" },
  { id: "feedback", label: "Feedback" },
  { id: "analytics", label: "Analytics" },
  { id: "assess", label: "Assess" },
  { id: "actions", label: "Actions" },
  { id: "section", label: "Section" },
  { id: "build", label: "Build" },
  { id: "report", label: "Report" },
];

export default function PageDetail({
  crawl,
  crawling,
  onCrawl,
  onStartBlank,
  selectedKey,
  onSelect,
  node,
  state,
  patch,
  lang,
  builderState,
  builderHistory,
  onBuilderStateChange,
  onBuilderHistoryChange,
}: {
  crawl: CrawlResult | null;
  crawling: boolean;
  onCrawl: (url: string, depth: number) => void;
  onStartBlank: () => void;
  selectedKey: string | null;
  onSelect: (url: string) => void;
  node: PageNode | null;
  state: PageState;
  patch: (p: Partial<PageState>) => void;
  lang: Lang;
  builderState?: BuilderAppState;
  builderHistory?: BuilderHistory;
  onBuilderStateChange: Dispatch<SetStateAction<BuilderAppState>>;
  onBuilderHistoryChange: Dispatch<SetStateAction<BuilderHistory>>;
}) {
  const [tab, setTab] = useState<Tab>("pageia");
  const [buildSeed, setBuildSeed] = useState<{ text: string; n: number }>({ text: "", n: 0 });

  const bLang = builderState?.lang ?? lang;
  const activeContent = builderState?.pages[bLang]?.content || state.content?.content || "";
  const activeTitle = builderState?.pages[bLang]?.title || state.content?.title || node?.title || "New page";
  const activeUrl = node?.url || "";
  const slug = slugify(activeTitle);

  const activeComposed = useMemo(() => {
    if (activeContent) return compose({ title: activeTitle, content: activeContent, lang: bLang });
    return state.content?.composed || "";
  }, [activeContent, activeTitle, bLang, state.content?.composed]);

  function applyFix(fix: string) {
    setBuildSeed((s) => ({ text: fix, n: s.n + 1 }));
    setTab("build");
  }

  const hasPage = Boolean(node);

  function tabEnabled(id: Tab): boolean {
    if (id === "pageia") return true;
    if (id === "section") return Boolean(crawl);
    return hasPage;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 dark:border-slate-700 dark:bg-slate-900">
        {TABS.map((t) => {
          const disabled = !tabEnabled(t.id);
          return (
            <button
              key={t.id}
              onClick={() => !disabled && setTab(t.id)}
              disabled={disabled}
              className={`relative whitespace-nowrap px-3 py-2.5 text-sm transition ${
                tab === t.id
                  ? "font-semibold text-slate-900 after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-canada dark:text-white"
                  : "text-slate-500 hover:text-slate-800 disabled:opacity-30 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "pageia" ? (
        <div className="min-h-0 flex-1">
          <PageAndIA
            crawl={crawl}
            crawling={crawling}
            onCrawl={onCrawl}
            onStartBlank={onStartBlank}
            selectedKey={selectedKey}
            onSelect={onSelect}
            activeComposed={activeComposed}
          />
        </div>
      ) : tab === "build" ? (
        <div className="min-h-0 flex-1">
          {builderState && builderHistory ? (
            <BuilderPanel
              state={builderState}
              setState={onBuilderStateChange}
              history={builderHistory}
              setHistory={onBuilderHistoryChange}
              originalTitle={state.content?.title ?? activeTitle}
              originalContent={state.content?.content ?? ""}
              originalLang={lang}
              evidence={{
                feedbackAnalysis: state.feedbackAnalysis,
                heuristics: state.heuristics,
                userTasks: state.userTasks,
                analytics: state.analytics,
              }}
              seedMessage={buildSeed}
            />
          ) : (
            <div className="p-4"><Spinner label="Preparing the builder…" /></div>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-4 dark:bg-slate-950">
          {tab === "feedback" && (
            <FeedbackPanel lang={lang} url={activeUrl} slug={slug} state={state} patch={patch} />
          )}
          {tab === "analytics" && (
            <AnalyticsPanel lang={lang} url={activeUrl} title={activeTitle} slug={slug} feedbackThemes={state.feedbackAnalysis} state={state} patch={patch} />
          )}
          {tab === "assess" && (
            <AssessPanel
              lang={lang}
              url={activeUrl}
              title={activeTitle}
              slug={slug}
              activeContent={activeContent}
              activeComposed={activeComposed}
              state={state}
              patch={patch}
            />
          )}
          {tab === "actions" && (
            <ActionsPanel lang={lang} title={activeTitle} url={activeUrl} state={state} patch={patch} onApplyFix={applyFix} />
          )}
          {tab === "section" && (
            <SectionPanel crawl={crawl} lang={lang} feedbackThemes={state.feedbackAnalysis} />
          )}
          {tab === "report" && (
            <ReportPanel lang={lang} title={activeTitle} url={activeUrl} state={state} patch={patch} />
          )}
        </div>
      )}
    </div>
  );
}
