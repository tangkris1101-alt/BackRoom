import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(projectRoot, "src/ui/changelog.js");
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const limitIndex = args.indexOf("--limit");
const requestedLimit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : 12;
const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? requestedLimit : 12;
const titleZhIndex = args.indexOf("--title-zh");
const latestTitleZh = titleZhIndex >= 0 ? args[titleZhIndex + 1]?.trim() : "";
const zhOverrides = new Map();
const isArtifactSyncTitle = (value) => (
  /^chore(?:\([^)]*\))?:\s*sync changelog and standalone build$/i.test(value)
);

for (let index = 0; index < args.length; index += 1) {
  if (args[index] !== "--zh") continue;
  const override = args[index + 1] ?? "";
  const separator = override.indexOf("=");
  if (separator <= 0) continue;
  zhOverrides.set(override.slice(0, separator), override.slice(separator + 1));
}

let existingEntries = [];
try {
  const moduleUrl = `${pathToFileURL(outputPath).href}?sync=${Date.now()}`;
  existingEntries = (await import(moduleUrl)).CHANGELOG_ENTRIES ?? [];
} catch {
  // The first generation can proceed without an existing snapshot.
}
const existingZh = new Map(existingEntries.map((entry) => [entry.commit, entry.titleZh]));

const { stdout } = await execFileAsync(
  "git",
  ["log", `-${limit * 2}`, "--date=short", "--pretty=format:%h%x1f%ad%x1f%s%x1e"],
  { cwd: projectRoot, encoding: "utf8", maxBuffer: 1024 * 1024 },
);

const containsChinese = (value) => /[\u3400-\u9fff]/u.test(value);
const stripConventionalPrefix = (value) => value.replace(
  /^(?:feat|fix|perf|refactor|docs|test|build|chore)(?:\([^)]*\))?:\s*/i,
  "",
);
const sanitizeStandaloneText = (value) => value.replaceAll("import.meta", "ES module metadata");
const entries = stdout
  .split("\x1e")
  .map((record) => record.trim())
  .filter(Boolean)
  .filter((record) => !isArtifactSyncTitle(record.split("\x1f")[2] ?? ""))
  .slice(0, limit)
  .map((record, index) => {
    const [commit, date, rawTitle] = record.split("\x1f");
    const title = sanitizeStandaloneText(rawTitle);
    const strippedTitle = stripConventionalPrefix(title);
    const titleZh = sanitizeStandaloneText(zhOverrides.get(commit)
      || (index === 0 ? latestTitleZh : "")
      || existingZh.get(commit)
      || (containsChinese(strippedTitle) ? strippedTitle : title));
    return { commit, date, title, titleZh };
  });

const rendered = [
  "// Generated from local Git history by `npm.cmd run changelog:sync`.",
  "// English titles preserve commit subjects; Chinese titles reuse saved translations or CLI overrides.",
  "export const CHANGELOG_ENTRIES = [",
  ...entries.map((entry) => (
    `  { commit: ${JSON.stringify(entry.commit)}, date: ${JSON.stringify(entry.date)}, title: ${JSON.stringify(entry.title)}, titleZh: ${JSON.stringify(entry.titleZh)} },`
  )),
  "];",
  "",
].join("\n");

if (checkOnly) {
  const current = await readFile(outputPath, "utf8").catch(() => "");
  if (current !== rendered) {
    console.error("Changelog snapshot is stale. Run: npm.cmd run changelog:sync");
    process.exitCode = 1;
  } else {
    console.log(`Changelog snapshot is current (${entries.length} entries).`);
  }
} else {
  await writeFile(outputPath, rendered, "utf8");
  console.log(`Updated src/ui/changelog.js with ${entries.length} Git entries.`);
}
