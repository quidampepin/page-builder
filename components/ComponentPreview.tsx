"use client";

/**
 * Small visual preview of a GCWeb component, rendered inside a sandboxed
 * iframe with GCWeb CSS loaded and the body scaled down.
 *
 * Why an iframe instead of just injecting the HTML into a div:
 *   - GCWeb CSS styles html/body/headings globally. Loading it into the
 *     palette page would blow up the Tailwind-based UI.
 *   - An iframe gives the component full CSS scope without bleeding out.
 *   - sandbox="" blocks scripts so the WET JS (accordion toggles, tabs
 *     behaviour) stays quiet — we just want the rendered layout.
 *
 * How the scale trick works:
 *   - The body gets `transform: scale(0.3)` so everything visually shrinks.
 *   - Width is set to 333% (1 / 0.3) so the scaled-down version fills the
 *     iframe width. Without this, the body would occupy only the scaled
 *     portion, leaving blank space on the right.
 *   - Origin top-left so nothing shifts oddly.
 *
 * Performance:
 *   - Each iframe pulls theme.min.css from the WET CDN. Browsers cache
 *     aggressively so it's one request per session.
 *   - Initial render takes ~100ms; acceptable for a modal.
 */

import { useMemo } from "react";

// Pulled from lib/gcweb/shell.ts — keeping it literal here avoids importing
// the full shell module into the palette bundle (shell.ts is fine for
// client use, but this is just the one URL we need).
const GCWEB_CSS =
  "https://wet-boew.github.io/themes-dist/GCWeb/GCWeb/css/theme.min.css";

interface Props {
  html: string;
  /** Scale factor. 0.3 fits a typical section into ~140px tall. */
  scale?: number;
  /** Iframe height in px. Width follows the card. */
  height?: number;
}

export function ComponentPreview({ html, scale = 0.3, height = 140 }: Props) {
  const srcDoc = useMemo(() => buildSrcDoc(html, scale), [html, scale]);

  return (
    <iframe
      title="Component preview"
      srcDoc={srcDoc}
      // sandbox="" blocks all scripts. We want static rendering only.
      sandbox=""
      // pointer-events-none means clicks go to the card, not the iframe.
      className="pointer-events-none block w-full border-0 bg-white"
      style={{ height }}
      loading="lazy"
    />
  );
}

function buildSrcDoc(html: string, scale: number): string {
  const widthPercent = Math.round((1 / scale) * 100);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<base target="_blank">
<link rel="stylesheet" href="${GCWEB_CSS}">
<style>
  /* Scale everything down so a full-size component fits a small card. */
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    transform: scale(${scale});
    transform-origin: top left;
    width: ${widthPercent}%;
    padding: 12px;
  }
  /* Kill any leftover outline/focus ring noise inside the preview. */
  * { outline: none !important; }
  /* Show the first details content so accordion/tab previews have something visible. */
  details { overflow: hidden; }
  details > summary { list-style: disclosure-closed; }
  details[open] > summary { list-style: disclosure-open; }
  /* Container class from Bootstrap 3 caps width at ~1170px on desktop;
     we want the component to use the full preview width. */
  .container, .container-fluid { width: auto; padding-left: 0; padding-right: 0; }
</style>
</head>
<body>${html}</body>
</html>`;
}
