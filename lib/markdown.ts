/**
 * Tiny, safe-enough Markdown -> HTML renderer for the analysis panels.
 *
 * We control the input (it comes from our own LLM prompts asking for GFM),
 * so this handles the subset those prompts produce: headings, tables, bullet
 * and numbered lists, blockquotes, horizontal rules, bold/italic/code, links,
 * and paragraphs. Raw HTML in the source is escaped, so the model can't
 * inject markup into our chrome.
 */

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Inline: escape first, then re-introduce our small set of inline tags. */
function inline(s: string): string {
  let t = esc(s);
  t = t.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  t = t.replace(/\*\*([^*]+)\*\*/g, (_, c) => `<strong>${c}</strong>`);
  t = t.replace(/(^|[^*])\*([^*]+)\*/g, (_, p, c) => `${p}<em>${c}</em>`);
  t = t.replace(
    /\[([^\]]+)\]\((https?:[^)]+)\)/g,
    (_, text, href) => {
      const safe = String(href).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
  );
  // <br> support (used inside table cells by the feedback skill).
  t = t.replace(/&lt;br\s*\/?&gt;/gi, "<br>");
  return t;
}

function renderTable(lines: string[]): string {
  const rowCells = (line: string) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());

  const header = rowCells(lines[0]);
  const body = lines.slice(2); // skip the |---|---| separator
  const thead = `<thead><tr>${header.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${body
    .map(
      (l) =>
        `<tr>${rowCells(l)
          .map((c) => `<td>${inline(c)}</td>`)
          .join("")}</tr>`,
    )
    .join("")}</tbody>`;
  return `<table>${thead}${tbody}</table>`;
}

export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let i = 0;

  const isTableSep = (l: string) => /^\s*\|?[\s:|-]+\|[\s:|-]+\|?\s*$/.test(l) && l.includes("-");

  while (i < lines.length) {
    const line = lines[i];

    // Blank
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    // Table (current line has pipes and the next is a separator)
    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const tbl: string[] = [line, lines[i + 1]];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        tbl.push(lines[i]);
        i++;
      }
      out.push(renderTable(tbl));
      continue;
    }

    // Blockquote
    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`);
      continue;
    }

    // Unordered list (support • as a bullet too — the skills use it)
    if (/^\s*([-*+]|•)\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*+]|•)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*+]|•)\s+/, ""));
        i++;
      }
      out.push(`<ul>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      out.push(`<ol>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</ol>`);
      continue;
    }

    // Paragraph — gather consecutive non-blank, non-special lines.
    const para: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,6}\s|>|\s*([-*+]|•)\s|\s*\d+\.\s)/.test(lines[i]) &&
      !(lines[i].includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1]))
    ) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }

  return out.join("\n");
}
