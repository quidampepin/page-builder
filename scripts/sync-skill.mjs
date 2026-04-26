#!/usr/bin/env node
/**
 * sync-skill — re-read the user's Claude Code skills from ~/.claude/skills/
 * and copy them into lib/gcweb/skills/ so the system prompt stays current.
 *
 * Usage:
 *   npm run sync-skill              (syncs all known skills)
 *   npm run sync-skill -- coder     (syncs only canada-ca-coder)
 *
 * Override the source directory with SKILLS_SRC env var, e.g.:
 *   SKILLS_SRC=/path/to/repo/skills npm run sync-skill
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SKILLS = [
  "canada-ca-coder",
  "canada-ca-writer",
  "canada-ca-seo",
  "canada-ca-doormat",
  "gc-component-mapping",
];

function candidateSources() {
  const env = process.env.SKILLS_SRC;
  if (env) return [env];
  return [
    path.join(os.homedir(), ".claude", "skills"),
    path.resolve(process.cwd(), "..", "skills"),
    path.resolve(process.cwd(), "skills"),
  ];
}

function findSkillFile(name) {
  for (const base of candidateSources()) {
    const candidate = path.join(base, name, "SKILL.md");
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function stripFrontmatter(content) {
  // Remove leading YAML frontmatter block so the embedded markdown is just prose
  if (content.startsWith("---")) {
    const end = content.indexOf("\n---", 3);
    if (end !== -1) return content.slice(end + 4).trimStart();
  }
  return content;
}

const filter = process.argv.slice(2);
const targets = filter.length
  ? SKILLS.filter((s) => filter.some((f) => s.includes(f)))
  : SKILLS;

const destDir = path.resolve(process.cwd(), "lib", "gcweb", "skills");
fs.mkdirSync(destDir, { recursive: true });

let okCount = 0;
let missCount = 0;

for (const skill of targets) {
  const src = findSkillFile(skill);
  if (!src) {
    console.warn(`  [skip] ${skill} — not found in any candidate path`);
    missCount++;
    continue;
  }
  const raw = fs.readFileSync(src, "utf8");
  const clean = stripFrontmatter(raw);
  const dest = path.join(destDir, `${skill}.md`);
  fs.writeFileSync(dest, clean);
  console.log(`  [ok]   ${skill} ← ${src}`);
  okCount++;
}

console.log(`\nSynced ${okCount} skill(s); ${missCount} missing.`);
if (missCount) {
  console.log(
    "Tip: set SKILLS_SRC=/your/skills/dir to override the default search paths.",
  );
}
