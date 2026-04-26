"use client";

/**
 * Component palette modal.
 *
 * Click-to-insert Tier 1 implementation:
 *   1. User clicks "+ Component" in the preview toolbar → modal opens.
 *   2. User picks a component card from the grid.
 *   3. User picks an "Insert at" location from the dropdown (top/bottom
 *      or before/after a specific h2 by title).
 *   4. Insert button applies the change client-side via insertComponent().
 *
 * No LLM call, no network — the insertion is instant. The parent page is
 * responsible for pushing undo history and updating state.
 *
 * UX notes:
 *   - Esc or backdrop click closes without inserting.
 *   - Dropdown auto-refreshes when the page content changes (via prop).
 *   - Components are grouped by category with sticky section headers.
 *   - Empty page: dropdown only offers "At the top" / "At the bottom"
 *     since there are no h2s yet — insertion will seed a minimal main.
 */

import { useEffect, useMemo, useState } from "react";
import {
  COMPONENTS,
  groupByCategory,
  type PaletteComponent,
} from "@/lib/gcweb/components";
import {
  getInsertLocations,
  type InsertLocation,
} from "@/lib/gcweb/insert-client";
import { ComponentPreview } from "./ComponentPreview";

interface Props {
  open: boolean;
  /** Current page content (breadcrumb + main). Used to compute the
   *  "Insert at" options for the dropdown. */
  currentContent: string;
  onClose: () => void;
  /** Called when the user clicks Insert. Parent applies the insertion
   *  and pushes an undo snapshot. */
  onInsert: (component: PaletteComponent, location: InsertLocation) => void;
}

export function ComponentPalette({
  open,
  currentContent,
  onClose,
  onInsert,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locationValue, setLocationValue] = useState<string>("bottom");

  // Reset selection each time the modal opens. Keeps state predictable —
  // the user always starts from a clean slate.
  useEffect(() => {
    if (open) {
      setSelectedId(null);
      setLocationValue("bottom");
    }
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const locationOptions = useMemo(
    () => getInsertLocations(currentContent),
    [currentContent],
  );

  const grouped = useMemo(() => groupByCategory(), []);

  if (!open) return null;

  const selected = COMPONENTS.find((c) => c.id === selectedId) || null;
  const location =
    locationOptions.find((o) => o.value === locationValue)?.location ?? {
      kind: "bottom" as const,
    };

  function handleInsert() {
    if (!selected) return;
    onInsert(selected, location);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        // Backdrop click closes. Inner clicks shouldn't.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[80vh] w-[min(900px,90vw)] flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">
              Insert component
            </h2>
            <p className="text-xs text-neutral-500">
              Pick a GCWeb pattern and where to insert it. Edit the content
              via chat after.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
            aria-label="Close palette"
          >
            ✕
          </button>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Grid of components, grouped by category. */}
          <div className="flex-1 overflow-auto p-4">
            {(Object.keys(grouped) as Array<keyof typeof grouped>).map(
              (category) => {
                const items = grouped[category];
                if (items.length === 0) return null;
                return (
                  <section key={category} className="mb-5">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      {category}
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {items.map((c) => (
                        <ComponentCard
                          key={c.id}
                          component={c}
                          selected={c.id === selectedId}
                          onSelect={() => setSelectedId(c.id)}
                        />
                      ))}
                    </div>
                  </section>
                );
              },
            )}
          </div>

          {/* Right rail — selection summary + insert controls. */}
          <aside className="flex w-[280px] flex-col gap-3 border-l border-neutral-200 bg-neutral-50 p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">
                Selected
              </label>
              <div className="rounded border border-neutral-200 bg-white p-2 text-xs text-neutral-700">
                {selected ? (
                  <>
                    <div className="font-medium text-neutral-900">
                      {selected.label}
                    </div>
                    <div className="mt-0.5 text-neutral-500">
                      {selected.description}
                    </div>
                  </>
                ) : (
                  <span className="text-neutral-400">
                    Pick a component on the left
                  </span>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="insert-location"
                className="mb-1 block text-xs font-medium text-neutral-700"
              >
                Insert at
              </label>
              <select
                id="insert-location"
                value={locationValue}
                onChange={(e) => setLocationValue(e.target.value)}
                className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
              >
                {locationOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {!currentContent && (
                <p className="mt-1 text-xs text-neutral-500">
                  Empty page — inserting will seed a minimal layout.
                </p>
              )}
            </div>

            <div className="mt-auto flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInsert}
                disabled={!selected}
                className="flex-1 rounded bg-neutral-900 px-3 py-1.5 text-xs text-white hover:bg-neutral-700 disabled:opacity-40 disabled:hover:bg-neutral-900"
              >
                Insert
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ComponentCard({
  component,
  selected,
  onSelect,
}: {
  component: PaletteComponent;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onSelect}
      className={
        "overflow-hidden rounded border text-left text-xs transition " +
        (selected
          // outline (not ring) so the indicator sits outside the clipped frame.
          ? "border-neutral-900 outline outline-2 outline-offset-[-2px] outline-neutral-900"
          : "border-neutral-200 bg-white hover:border-neutral-400")
      }
    >
      {/* Live mini-preview, rendered in a sandboxed iframe with GCWeb CSS. */}
      <div className="border-b border-neutral-100 bg-neutral-50">
        <ComponentPreview html={component.html} />
      </div>
      <div
        className={
          "p-2 " +
          (selected ? "bg-neutral-900 text-white" : "bg-white")
        }
      >
        <div className="font-medium">{component.label}</div>
        <div
          className={
            "mt-0.5 " + (selected ? "text-neutral-300" : "text-neutral-500")
          }
        >
          {component.description}
        </div>
      </div>
    </button>
  );
}
