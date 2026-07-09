"use client";

import { useMemo } from "react";
import { renderMarkdown } from "@/lib/markdown";

/** Renders our LLM Markdown output into the styled `.md` container. */
export default function Markdown({ source }: { source: string }) {
  const html = useMemo(() => renderMarkdown(source || ""), [source]);
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}
