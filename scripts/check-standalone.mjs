import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";

const standaloneUrl = new URL("../backrooms.html", import.meta.url);
const distStandaloneUrl = new URL("../dist/backrooms.html", import.meta.url);
const webIndexUrl = new URL("../dist/index.html", import.meta.url);
const modelDirectoryUrl = new URL("../src/assets/models/", import.meta.url);
const { size } = await stat(standaloneUrl);
const html = await readFile(standaloneUrl, "utf8");
const distHtml = await readFile(distStandaloneUrl, "utf8");
const webIndex = await readFile(webIndexUrl, "utf8");
const limit = 35 * 1024 * 1024;

assert.ok(size <= limit, `backrooms.html is ${(size / 1024 / 1024).toFixed(2)} MiB, limit is 35 MiB`);
assert.equal(distHtml, html, "dist/backrooms.html must match the root standalone artifact");
assert.match(html, /<!doctype html>/i);
assert.match(html, /<meta name="backrooms-build" content="[a-f0-9]{12}"/);
assert.match(html, /<\/body>\s*<\/html>\s*$/i);
assert.doesNotMatch(html, /<(?:script|link|img|audio|source)\b[^>]*(?:src|href)=["']https?:\/\//i);
assert.doesNotMatch(html, /<script\b[^>]*\bsrc=/i);
assert.doesNotMatch(html, /<link\b[^>]*rel=["']stylesheet["']/i);
assert.doesNotMatch(html, /\bimport\.meta\b/);
assert.doesNotMatch(html, /new URL\(`[^`]*\.bin`,location\.href\)\.href/);
assert.match(html, /data:application\/octet-stream;base64,/);
// Every relaxed (empty-handed) arm bake has to be inlined: a build that dropped
// one would only surface when a level enters with empty hands.
const relaxedBakes = (await readdir(modelDirectoryUrl)).filter((name) => name.endsWith("relaxed-baked.bin"));
assert.ok(relaxedBakes.length > 0, "the arm bakes must ship a relaxed pose per hand");
for (const name of relaxedBakes) {
  const base64 = (await readFile(new URL(name, modelDirectoryUrl))).toString("base64");
  assert.ok(
    html.includes(`data:application/octet-stream;base64,${base64}`),
    `${name} must be inlined into the standalone artifact`,
  );
}
assert.match(webIndex, /<script\b[^>]*type=["']module["'][^>]*src=["']\.\/assets\//i);
assert.doesNotMatch(webIndex, /This file inlines all assets/i);
assert.notEqual(webIndex, html, "the online index must not be overwritten by the standalone artifact");

console.log(`standalone checks passed (${(size / 1024 / 1024).toFixed(2)} MiB)`);
