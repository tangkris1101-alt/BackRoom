import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = resolve(projectRoot, "dist");
const sourcePath = resolve(distDirectory, "app.html");
const outputPath = resolve(projectRoot, "backrooms.html");
const distOutputPath = resolve(distDirectory, "backrooms.html");
const distIndexPath = resolve(distDirectory, "index.html");

let html = await readFile(sourcePath, "utf8");

const stylesheetMatch = html.match(
  /<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/,
);
const scriptMatch = html.match(
  /<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/,
);

if (!stylesheetMatch || !scriptMatch) {
  throw new Error("Unable to locate the generated CSS or JavaScript assets.");
}

const resolveAsset = (assetPath) =>
  resolve(distDirectory, assetPath.replace(/^\/+/, ""));

const [css, javascript] = await Promise.all([
  readFile(resolveAsset(stylesheetMatch[1]), "utf8"),
  readFile(resolveAsset(scriptMatch[1]), "utf8"),
]);

const inlineCss = css.replace(/<\/style/gi, "<\\/style");
const inlineJavascript = javascript.replace(/<\/script/gi, "<\\/script");

html = html
  .replace(stylesheetMatch[0], () => `<style>${inlineCss}</style>`)
  .replace(scriptMatch[0], "")
  .replace(
    "</body>",
    () => `    <script>${inlineJavascript}</script>\n  </body>`,
  )
  .replace(
    "</head>",
    "    <!-- This file inlines all assets and can run directly from file://. -->\n  </head>",
  );

await Promise.all([
  writeFile(outputPath, html, "utf8"),
  writeFile(distOutputPath, html, "utf8"),
  writeFile(distIndexPath, html, "utf8"),
]);

console.log("Created standalone backrooms.html and dist/index.html");
