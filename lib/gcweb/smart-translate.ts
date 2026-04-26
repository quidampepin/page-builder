/**
 * Smart re-translation: only re-translate sections that changed since the
 * last time you translated in this direction.
 *
 * The mental model:
 *   - Every translate captures a snapshot: {source, target, title} at that
 *     moment. Stored per source-language under state.snapshots[lang].
 *   - Next time you translate, we diff the CURRENT source against the
 *     snapshot source, section by section. The diff classifies each
 *     position into one of four buckets:
 *
 *       1. unchanged source + unchanged target → keep current target section
 *       2. changed   source + unchanged target → retranslate source section
 *       3. unchanged source + changed   target → keep current target section
 *                                                  (user's FR edits win)
 *       4. changed   source + changed   target → CONFLICT — both languages
 *                                                  edited since last sync.
 *                                                  Caller confirms; if yes,
 *                                                  we retranslate.
 *
 *   - Plus new sections added at the end of source → translate.
 *     Plus sections dropped from source → drop corresponding target sections.
 *
 *   - Title handled separately: if source h1 differs from snapshot h1, we
 *     include the title in the translate call too. Otherwise keep current
 *     target title.
 *
 * Why position-based matching (not content-hash): real edits shift indexes
 * rarely, and GCWeb pages tend to be short enough that positional diff is
 * both accurate and comprehensible to the user when we label conflicts.
 *
 * Position edge cases:
 *   - Source grew (N new): extras beyond snapshot length are always
 *     "changed source / no prior target" → translate them.
 *   - Source shrank: extras beyond current length in snapshot → dropped.
 *     Any target sections at those positions go away too.
 *
 * This file is browser-safe (uses DOMParser via split.ts).
 */

import {
  splitContent,
  joinContent,
  normalizeForDiff,
  extractTitle,
  type SplitContent,
} from "./split";

export interface TranslationSnapshot {
  /** Source content at the moment of the last translate. */
  source: string;
  /** Target content produced by that translate. */
  target: string;
  /** Source title (h1 text) at the moment of the last translate. */
  title: string;
  /** ISO timestamp of the last translate. */
  ts: string;
}

export type SectionAction =
  | { kind: "keep"; targetSection: string }
  | { kind: "translate"; sourceSection: string }
  | { kind: "conflict"; sourceSection: string; targetSection: string };

export interface TranslatePlan {
  /** Per-position action. Array length equals current source section count. */
  actions: SectionAction[];
  /** Indexes (into actions) flagged as conflicts — UI asks the user. */
  conflicts: number[];
  /** Whether the title changed since snapshot. */
  titleChanged: boolean;
  /** Full-translation fallback flag — true when smart mode can't apply. */
  fallbackFull: boolean;
  /** Context for assembly: structural pieces from the CURRENT source. */
  sourceSplit: SplitContent;
  /** Context for assembly: structural pieces from the CURRENT target. */
  targetSplit: SplitContent;
}

/**
 * Build a translation plan without calling the LLM. Lets the UI show a
 * conflict dialog before firing the (expensive) translation request.
 *
 * Returns fallbackFull=true when we can't do a smart diff — no snapshot,
 * empty target, section-count mismatch between snapshot and target, or
 * malformed HTML. Caller should drop to a full-page translate in that case.
 */
export function planTranslate({
  currentSource,
  currentTarget,
  snapshot,
}: {
  currentSource: string;
  currentTarget: string;
  snapshot: TranslationSnapshot | null;
}): TranslatePlan {
  const sourceSplit = splitContent(currentSource);
  const targetSplit = splitContent(currentTarget);
  const emptyPlan: TranslatePlan = {
    actions: [],
    conflicts: [],
    titleChanged: true,
    fallbackFull: true,
    sourceSplit,
    targetSplit,
  };

  if (!snapshot || !currentTarget) return emptyPlan;

  const snapSourceSplit = splitContent(snapshot.source);
  const snapTargetSplit = splitContent(snapshot.target);

  // The snapshot's source and target must have the same section count by
  // construction (we produced the target from the source). If that invariant
  // is broken, something got out of sync — drop to full mode.
  if (snapSourceSplit.sections.length !== snapTargetSplit.sections.length) {
    return emptyPlan;
  }

  const cur = sourceSplit.sections.map(normalizeForDiff);
  const snap = snapSourceSplit.sections.map(normalizeForDiff);
  const curTgt = targetSplit.sections.map(normalizeForDiff);
  const snapTgt = snapTargetSplit.sections.map(normalizeForDiff);

  const actions: SectionAction[] = [];
  const conflicts: number[] = [];

  for (let i = 0; i < sourceSplit.sections.length; i++) {
    const srcNow = cur[i];
    const srcThen = i < snap.length ? snap[i] : undefined;
    const tgtNow = i < curTgt.length ? curTgt[i] : undefined;
    const tgtThen = i < snapTgt.length ? snapTgt[i] : undefined;

    const sourceChanged = srcThen === undefined || srcNow !== srcThen;
    const targetChanged =
      tgtNow === undefined || tgtThen === undefined || tgtNow !== tgtThen;

    // If we don't have a target section at this position, we must translate.
    const hasTarget = tgtNow !== undefined;

    if (!sourceChanged && hasTarget) {
      actions.push({
        kind: "keep",
        targetSection: targetSplit.sections[i],
      });
    } else if (sourceChanged && !targetChanged) {
      actions.push({
        kind: "translate",
        sourceSection: sourceSplit.sections[i],
      });
    } else if (sourceChanged && targetChanged && hasTarget) {
      actions.push({
        kind: "conflict",
        sourceSection: sourceSplit.sections[i],
        targetSection: targetSplit.sections[i],
      });
      conflicts.push(i);
    } else {
      // sourceChanged && !hasTarget — new section at end of source.
      actions.push({
        kind: "translate",
        sourceSection: sourceSplit.sections[i],
      });
    }
  }

  const titleChanged =
    extractTitle(currentSource) !== snapshot.title;

  return {
    actions,
    conflicts,
    titleChanged,
    fallbackFull: false,
    sourceSplit,
    targetSplit,
  };
}

/**
 * Execute a plan: call the translate API with only the sections that need
 * work, then assemble the final target content.
 *
 * `conflictResolution` decides what to do with positions flagged as
 * conflict. "overwrite" retranslates them (source wins); "keep" leaves the
 * current target section untouched (user's target edits win).
 *
 * The caller is responsible for presenting the conflict decision to the
 * user — this function just executes what was decided.
 */
export async function executePlan({
  plan,
  currentTitle,
  from,
  to,
  conflictResolution,
}: {
  plan: TranslatePlan;
  currentTitle: string;
  from: "en" | "fr";
  to: "en" | "fr";
  conflictResolution: "overwrite" | "keep";
}): Promise<{ content: string; title: string }> {
  // Build the list of sections to send to the model and remember where
  // each translated result should land.
  const toTranslate: Array<{ index: number; html: string }> = [];
  for (let i = 0; i < plan.actions.length; i++) {
    const a = plan.actions[i];
    if (a.kind === "translate") {
      toTranslate.push({ index: i, html: a.sourceSection });
    } else if (a.kind === "conflict" && conflictResolution === "overwrite") {
      toTranslate.push({ index: i, html: a.sourceSection });
    }
  }

  let translatedMap = new Map<number, string>();
  let newTitle = currentTitle;

  if (toTranslate.length > 0 || plan.titleChanged) {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chunks: toTranslate.map((x) => x.html),
        title: plan.titleChanged ? currentTitle : undefined,
        from,
        to,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Translate API returned ${res.status}`);
    }
    const data = (await res.json()) as {
      translatedChunks: string[];
      title?: string;
    };
    if (data.translatedChunks.length !== toTranslate.length) {
      throw new Error(
        `Translate API returned ${data.translatedChunks.length} chunks, expected ${toTranslate.length}.`,
      );
    }
    toTranslate.forEach((x, i) => {
      translatedMap.set(x.index, data.translatedChunks[i]);
    });
    if (data.title) newTitle = data.title;
  }

  // Assemble final target sections in source order.
  const finalSections: string[] = [];
  for (let i = 0; i < plan.actions.length; i++) {
    const a = plan.actions[i];
    if (a.kind === "keep") {
      finalSections.push(a.targetSection);
    } else if (a.kind === "translate") {
      const t = translatedMap.get(i);
      if (t === undefined) {
        throw new Error(`Missing translation for section ${i}.`);
      }
      finalSections.push(t);
    } else {
      // conflict
      if (conflictResolution === "overwrite") {
        const t = translatedMap.get(i);
        if (t === undefined) {
          throw new Error(`Missing translation for conflicted section ${i}.`);
        }
        finalSections.push(t);
      } else {
        finalSections.push(a.targetSection);
      }
    }
  }

  // Use the target's main tag attrs and breadcrumb structure for assembly —
  // that keeps the target language's nav structure stable across translates.
  // Breadcrumb itself: if source breadcrumb changed, we'd need to retranslate
  // it; for v1 we keep whatever's already in the target slot.
  const assembled = joinContent({
    breadcrumb: plan.targetSplit.breadcrumb ?? plan.sourceSplit.breadcrumb,
    mainOpenTag: plan.targetSplit.mainOpenTag || plan.sourceSplit.mainOpenTag,
    sections: finalSections,
  });

  return { content: assembled, title: newTitle };
}

/**
 * Convenience wrapper: runs a full-page translate via the same /api/translate
 * endpoint (content mode). Used as the fallback when smart-mode can't apply.
 */
export async function fullTranslate({
  content,
  title,
  from,
  to,
}: {
  content: string;
  title: string;
  from: "en" | "fr";
  to: "en" | "fr";
}): Promise<{ content: string; title: string }> {
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content, title, from, to }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Translate API returned ${res.status}`);
  }
  return (await res.json()) as { content: string; title: string };
}

/** Build a fresh snapshot after a successful translate. */
export function makeSnapshot(
  source: string,
  target: string,
  title: string,
): TranslationSnapshot {
  return {
    source,
    target,
    title,
    ts: new Date().toISOString(),
  };
}
