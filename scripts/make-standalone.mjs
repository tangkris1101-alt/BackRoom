import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = resolve(projectRoot, "dist");
const sourcePath = resolve(distDirectory, "app.html");
const outputPath = resolve(projectRoot, "backrooms.html");
const distOutputPath = resolve(distDirectory, "backrooms.html");
const distIndexPath = resolve(distDirectory, "index.html");
const versionManifestPath = resolve(projectRoot, "backrooms-version.json");
const distVersionManifestPath = resolve(distDirectory, "backrooms-version.json");

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

const stylesheetPath = resolveAsset(stylesheetMatch[1]);
const [css, javascript] = await Promise.all([
  readFile(stylesheetPath, "utf8"),
  readFile(resolveAsset(scriptMatch[1]), "utf8"),
]);

const mimeTypes = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".ogg": "audio/ogg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

async function inlineCssAssets(source) {
  const matches = [...source.matchAll(/url\((['"]?)([^'"()]+)\1\)/g)];
  const replacements = await Promise.all(
    matches.map(async (match) => {
      const reference = match[2].trim();
      if (!reference || reference.startsWith("data:") || reference.startsWith("#") || /^(https?:)?\/\//i.test(reference)) {
        return null;
      }
      const filename = reference.replace(/[?#].*$/, "");
      const mimeType = mimeTypes[extname(filename).toLowerCase()];
      if (!mimeType) return null;
      try {
        const data = await readFile(resolve(dirname(stylesheetPath), filename));
        return { source: match[0], replacement: `url("data:${mimeType};base64,${data.toString("base64")}")` };
      } catch {
        return null;
      }
    }),
  );

  return replacements.filter(Boolean).reduce(
    (result, { source: original, replacement }) => result.replaceAll(original, replacement),
    source,
  );
}

async function inlineJavascriptAssets(source) {
  const matches = [...source.matchAll(/new URL\(`([^`]+)`,import\.meta\.url\)\.href/g)];
  const replacements = await Promise.all(
    matches.map(async (match) => {
      const filename = match[1].replace(/[?#].*$/, "");
      const mimeType = mimeTypes[extname(filename).toLowerCase()];
      if (!mimeType) return null;
      try {
        const data = await readFile(resolve(dirname(resolveAsset(scriptMatch[1])), filename));
        return {
          source: match[0],
          replacement: JSON.stringify(`data:${mimeType};base64,${data.toString("base64")}`),
        };
      } catch {
        return null;
      }
    }),
  );
  return replacements.filter(Boolean).reduce(
    (result, { source: original, replacement }) => result.replaceAll(original, replacement),
    source,
  );
}

const inlineCss = (await inlineCssAssets(css)).replace(/<\/style/gi, "<\\/style");
const inlineJavascript = (await inlineJavascriptAssets(javascript)).replace(/<\/script/gi, "<\\/script");
const buildId = createHash("sha256")
  .update(inlineCss)
  .update(inlineJavascript)
  .digest("hex")
  .slice(0, 12);
const updateCheck = `<script>
(() => {
  const buildId = "${buildId}";
  const manifest = new URL("./backrooms-version.json", window.location.href);
  fetch(manifest, { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((latest) => {
      if (!latest?.buildId || latest.buildId === buildId) return;
      const next = new URL(window.location.href);
      if (next.searchParams.get("v") === latest.buildId) return;
      next.searchParams.set("v", latest.buildId);
      window.location.replace(next);
    })
    .catch(() => {
      // A standalone file can still run when no manifest is deployed.
    });
})();
</script>`;

html = html
  .replace("</head>", () => `    <meta name="backrooms-build" content="${buildId}" />\n  </head>`)
  .replace(stylesheetMatch[0], () => `<style>${inlineCss}</style>`)
  .replace(scriptMatch[0], "")
  .replace(
    "</body>",
    () => `    ${updateCheck}\n    <script>${inlineJavascript}</script>\n  </body>`,
  )
  .replace(
    "</head>",
    "    <!-- This file inlines all assets and can run directly from file://. -->\n  </head>",
  );

await Promise.all([
  writeFile(outputPath, html, "utf8"),
  writeFile(distOutputPath, html, "utf8"),
  writeFile(distIndexPath, html, "utf8"),
  writeFile(versionManifestPath, `${JSON.stringify({ buildId })}\n`, "utf8"),
  writeFile(distVersionManifestPath, `${JSON.stringify({ buildId })}\n`, "utf8"),
]);

console.log(`Created standalone Backrooms build ${buildId}`);
