#!/usr/bin/env node
// Walks the repository (skipping build artefacts and Vite cache) looking for
// UTF-8 byte order marks and stray script/style closing tags in text source
// files. Run before build, in CI, and as a pre-commit hook.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TEXT_EXTENSIONS = new Set([
  ".js", ".mjs", ".cjs", ".ts", ".jsx", ".tsx",
  ".css", ".scss", ".html", ".htm", ".svg", ".json",
  ".md", ".txt", ".yml", ".yaml"
]);
const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".vite", ".cache", ".next", ".turbo"
]);
const TARGET_PATHS = process.argv.slice(2);
const roots = TARGET_PATHS.length > 0
  ? TARGET_PATHS.map((p) => path.resolve(projectRoot, p))
  : [projectRoot];

let totalChecked = 0;
const problems = [];

function visit(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) { checkFile(target); return; }
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      visit(path.join(target, entry.name));
    } else {
      const full = path.join(target, entry.name);
      if (entry.name.startsWith(".")) continue;
      checkFile(full);
    }
  }
}

function checkFile(file) {
  if (!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) return;
  totalChecked += 1;
  const fd = fs.openSync(file, "r");
  try {
    const head = Buffer.alloc(3);
    const bytesRead = fs.readSync(fd, head, 0, 3, 0);
    if (bytesRead === 3 && head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf) {
      problems.push({ file, issue: "utf8-bom" });
      return;
    }
    if (/\.(html|htm)$/i.test(file)) {
      const data = fs.readFileSync(file);
      const text = data.toString("utf8");
      const lf = text.indexOf("\n");
      const firstLine = lf === -1 ? text : text.slice(0, lf);
      if (firstLine.charCodeAt(0) === 0xfeff) {
        problems.push({ file, issue: "leading-bom-line" });
      }
    }
  } finally {
    fs.closeSync(fd);
  }
}

for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  visit(root);
}

if (problems.length === 0) {
  console.log("checked " + totalChecked + " text files, no BOM found.");
  process.exit(0);
}

for (const { file, issue } of problems) {
  console.error("[" + issue + "] " + path.relative(projectRoot, file));
}
console.error("checked " + totalChecked + " files, " + problems.length + " issue(s) found.");
process.exit(1);
