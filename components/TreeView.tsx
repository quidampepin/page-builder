"use client";

import type { PageNode } from "@/lib/types";

function shortLabel(node: PageNode): string {
  if (node.title && node.title !== node.url) return node.title;
  try {
    const p = new URL(node.url).pathname.split("/").filter(Boolean);
    return p[p.length - 1] || node.url;
  } catch {
    return node.url;
  }
}

/** Indented list of crawled pages (ordered depth-first). */
export default function TreeView({
  nodes,
  selected,
  onSelect,
}: {
  nodes: PageNode[];
  selected: string | null;
  onSelect: (url: string) => void;
}) {
  return (
    <ul className="text-sm">
      {nodes.map((node) => (
        <li key={node.url}>
          <button
            onClick={() => onSelect(node.url)}
            title={node.url}
            className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-slate-100 ${
              selected === node.url ? "bg-slate-200 font-medium" : ""
            }`}
            style={{ paddingLeft: `${8 + node.depth * 16}px` }}
          >
            <span className="text-slate-300">{node.depth === 0 ? "◆" : "└"}</span>
            <span className="flex-1 truncate">{shortLabel(node)}</span>
            {node.error ? (
              <span
                className="rounded bg-red-100 px-1 text-[10px] text-red-700"
                title={node.error}
              >
                !
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
