/**
 * Skill-markdown loader for the auditor features.
 *
 * Two sources, both under the app root:
 *   - Auditor-only skills (feedback analyst, job stories, UX reviewer) in
 *     ./lib/skills/*.md.
 *   - The GCWeb authoring skills (coder, writer, seo, doormat, mapping) in
 *     ./lib/gcweb/skills/*.md — the same files the page builder uses.
 */

import fs from "node:fs";
import path from "node:path";

function readFirst(candidates: string[]): string | null {
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
    } catch {
      /* keep trying */
    }
  }
  return null;
}

/** Auditor-only skill from lib/skills. */
export function readOwnSkill(name: string): string {
  const cwd = process.cwd();
  const content = readFirst([path.join(cwd, "lib", "skills", `${name}.md`)]);
  return content ?? `<!-- ${name}.md not found in lib/skills -->`;
}

/** GCWeb authoring skill from lib/gcweb/skills (shared with the builder). */
export function readSharedSkill(name: string): string {
  const cwd = process.cwd();
  const content = readFirst([path.join(cwd, "lib", "gcweb", "skills", `${name}.md`)]);
  return content ?? `<!-- shared skill ${name}.md not found -->`;
}
