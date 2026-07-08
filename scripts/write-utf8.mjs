#!/usr/bin/env node
// Normalize a UTF-8 text source file by stripping a leading BOM and writing
// the result back without one. Use this after PowerShell Set-Content mishaps
// to clean files in-place.

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("usage: node scripts/write-utf8.mjs <file> [<file>...]");
  process.exit(2);
}

let total = 0;
for (const rel of targets) {
  const file = path.resolve(projectRoot, rel);
  const raw = await fs.readFile(file, "utf8");
  const stripped = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const hadBom = stripped.length !== raw.length;
  const buf = Buffer.from(stripped, "utf8");
  await fs.writeFile(file, buf);
  const tag = hadBom ? "stripped BOM" : "rewritten UTF-8";
  console.log(tag + ": " + path.relative(projectRoot, file));
  total += 1;
}
console.log("normalised " + total + " file(s).");
