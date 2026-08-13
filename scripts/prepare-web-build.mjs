import assert from "node:assert/strict";
import { copyFile, readFile } from "node:fs/promises";

const appUrl = new URL("../dist/app.html", import.meta.url);
const indexUrl = new URL("../dist/index.html", import.meta.url);
const appHtml = await readFile(appUrl, "utf8");

assert.match(appHtml, /<script\b[^>]*type=["']module["'][^>]*src=["']\.\/assets\//i);
assert.doesNotMatch(appHtml, /(?:src|href)=["']\/?src\//i);

await copyFile(appUrl, indexUrl);
console.log("Prepared dist/index.html for online deployment");
