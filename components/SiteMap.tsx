"use client";

import { useMemo, useRef } from "react";
import type { PageNode } from "@/lib/types";
import { downloadBlob, downloadText } from "@/lib/download";

interface Laid {
  node: PageNode;
  x: number;
  y: number;
}

const COL_W = 230;
const ROW_H = 34;
const BOX_W = 190;
const BOX_H = 24;
const PAD = 20;

function label(node: PageNode): string {
  if (node.title && node.title !== node.url) return node.title;
  try {
    const p = new URL(node.url).pathname.split("/").filter(Boolean);
    return p[p.length - 1] || node.url;
  } catch {
    return node.url;
  }
}

/**
 * On-demand visual map of the crawled node and its children. A simple tidy
 * layout: x = depth, y assigned so leaves stack and parents center on their
 * children. Click a node to select it. Exportable as SVG or PNG.
 */
export default function SiteMap({
  root,
  nodes,
  selected,
  onSelect,
}: {
  root: string;
  nodes: PageNode[];
  selected: string | null;
  onSelect: (url: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  const { laid, edges, width, height } = useMemo(() => {
    const byUrl = new Map(nodes.map((n) => [n.url, n]));
    const laidMap = new Map<string, Laid>();
    let leafCursor = 0;

    const place = (url: string): number => {
      const node = byUrl.get(url);
      if (!node) return leafCursor;
      const children = node.children.filter((c) => byUrl.has(c));
      let y: number;
      if (children.length === 0) {
        y = leafCursor;
        leafCursor += 1;
      } else {
        const ys = children.map((c) => place(c));
        y = (Math.min(...ys) + Math.max(...ys)) / 2;
      }
      laidMap.set(url, { node, x: node.depth, y });
      return y;
    };
    place(root);

    for (const n of nodes) {
      if (!laidMap.has(n.url)) {
        laidMap.set(n.url, { node: n, x: n.depth, y: leafCursor });
        leafCursor += 1;
      }
    }

    const laid = Array.from(laidMap.values());
    const edges: { from: Laid; to: Laid }[] = [];
    for (const l of laid) {
      for (const c of l.node.children) {
        const to = laidMap.get(c);
        if (to) edges.push({ from: l, to });
      }
    }

    const maxDepth = Math.max(0, ...laid.map((l) => l.x));
    const width = PAD * 2 + maxDepth * COL_W + BOX_W;
    const height = PAD * 2 + Math.max(1, leafCursor) * ROW_H;
    return { laid, edges, width, height };
  }, [root, nodes]);

  const px = (l: Laid) => PAD + l.x * COL_W;
  const py = (l: Laid) => PAD + l.y * ROW_H;

  function serializeSvg(): string {
    const el = svgRef.current;
    if (!el) return "";
    const clone = el.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    // white background so exported image isn't transparent
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", String(width));
    rect.setAttribute("height", String(height));
    rect.setAttribute("fill", "#ffffff");
    clone.insertBefore(rect, clone.firstChild);
    return new XMLSerializer().serializeToString(clone);
  }

  function downloadSvg() {
    const svg = serializeSvg();
    if (svg) downloadText("site-map.svg", svg, "image/svg+xml");
  }

  function downloadPng() {
    const svg = serializeSvg();
    if (!svg) return;
    const scale = 2;
    const img = new Image();
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((b) => {
          if (b) downloadBlob("site-map.png", b);
          URL.revokeObjectURL(url);
        }, "image/png");
      }
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }

  return (
    <div className="relative h-full w-full overflow-auto bg-slate-50">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur">
        <span className="text-xs font-medium text-slate-500">Site map</span>
        <div className="flex-1" />
        <button
          onClick={downloadSvg}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
        >
          Download SVG
        </button>
        <button
          onClick={downloadPng}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
        >
          Download PNG
        </button>
      </div>
      <svg ref={svgRef} width={width} height={height} className="block">
        {edges.map((e, i) => {
          const x1 = px(e.from) + BOX_W;
          const y1 = py(e.from) + BOX_H / 2;
          const x2 = px(e.to);
          const y2 = py(e.to) + BOX_H / 2;
          const mx = (x1 + x2) / 2;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth={1.5}
            />
          );
        })}
        {laid.map((l) => {
          const isSel = selected === l.node.url;
          const isErr = !!l.node.error;
          return (
            <g
              key={l.node.url}
              transform={`translate(${px(l)}, ${py(l)})`}
              className="cursor-pointer"
              onClick={() => onSelect(l.node.url)}
            >
              <rect
                width={BOX_W}
                height={BOX_H}
                rx={4}
                fill={isSel ? "#1d4ed8" : isErr ? "#fee2e2" : "#ffffff"}
                stroke={isSel ? "#1d4ed8" : isErr ? "#ef4444" : "#cbd5e1"}
                strokeWidth={1.5}
              />
              <text x={8} y={BOX_H / 2 + 4} fontSize={11} fill={isSel ? "#ffffff" : "#0f172a"}>
                {label(l.node).slice(0, 26)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
