import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("online and standalone builds remain separate", async () => {
  const [online, standalone, assets] = await Promise.all([
    readFile(new URL("../dist/index.html", import.meta.url), "utf8"),
    readFile(new URL("../backrooms.html", import.meta.url), "utf8"),
    readdir(new URL("../dist/assets/", import.meta.url)),
  ]);

  assert.match(online, /<script\b[^>]*type=["']module["'][^>]*src=["']\.\/assets\//i);
  assert.doesNotMatch(online, /This file inlines all assets/i);
  assert.doesNotMatch(online, /(?:src|href)=["']\/?src\//i);
  assert.notEqual(online, standalone);
  assert.match(standalone, /This file inlines all assets/i);
  assert.doesNotMatch(standalone, /<script\b[^>]*\bsrc=/i);
  assert.ok(assets.filter((name) => name.endsWith(".js")).length >= 10);
  assert.ok(assets.some((name) => /^three-[A-Za-z0-9_-]{8,}\.js$/.test(name)));
});
