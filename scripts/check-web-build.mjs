import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const distUrl = new URL("../dist/", import.meta.url);
const appUrl = new URL("app.html", distUrl);
const indexUrl = new URL("index.html", distUrl);
const [appHtml, indexHtml, indexStat, assetNames] = await Promise.all([
  readFile(appUrl, "utf8"),
  readFile(indexUrl, "utf8"),
  stat(indexUrl),
  readdir(new URL("assets/", distUrl)),
]);

assert.equal(indexHtml, appHtml, "dist/index.html must be the Vite online entry");
assert.ok(indexStat.size <= 128 * 1024, `online index is ${(indexStat.size / 1024).toFixed(1)} KiB, limit is 128 KiB`);
assert.doesNotMatch(indexHtml, /This file inlines all assets/i);
assert.doesNotMatch(indexHtml, /(?:src|href)=["']\/?src\//i);
assert.doesNotMatch(indexHtml, /data:(?:audio|image)\//i);

const scriptMatch = indexHtml.match(/<script\b[^>]*type=["']module["'][^>]*src=["'](\.\/assets\/[^"']+\.js)["']/i);
const styleMatch = indexHtml.match(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["'](\.\/assets\/[^"']+\.css)["']/i);
assert.ok(scriptMatch, "online index must reference a hashed module entry");
assert.ok(styleMatch, "online index must reference a hashed stylesheet");
assert.match(scriptMatch[1], /-[A-Za-z0-9_-]{8,}\.js$/);
assert.match(styleMatch[1], /-[A-Za-z0-9_-]{8,}\.css$/);

const entryUrl = new URL(scriptMatch[1].replace(/^\.\//, ""), distUrl);
const [entrySource, entryStat] = await Promise.all([readFile(entryUrl), stat(entryUrl)]);
const entryGzipSize = gzipSync(entrySource, { level: 9 }).length;
assert.ok(entryGzipSize <= 512 * 1024, `online entry JS gzip size is ${(entryGzipSize / 1024).toFixed(1)} KiB, limit is 512 KiB`);

const javascriptAssets = assetNames.filter((name) => name.endsWith(".js"));
assert.ok(javascriptAssets.length >= 10, `expected dynamic level chunks, found ${javascriptAssets.length} JavaScript files`);
assert.ok(javascriptAssets.some((name) => /^three-[A-Za-z0-9_-]{8,}\.js$/.test(name)), "Three.js must be emitted as a separately cacheable vendor chunk");

console.log(`web build checks passed (${(indexStat.size / 1024).toFixed(1)} KiB HTML, ${(entryStat.size / 1024).toFixed(1)} KiB entry JS / ${(entryGzipSize / 1024).toFixed(1)} KiB gzip, ${javascriptAssets.length} JS chunks)`);
