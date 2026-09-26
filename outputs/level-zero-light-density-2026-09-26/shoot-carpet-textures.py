"""Render the Level 0 carpet textures (colour / bump / roughness / macro) to an image."""

import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
sys.path.insert(0, str(Path(os.environ["TEMP"]) / "codex-walk-playwright"))
from playwright.sync_api import sync_playwright  # noqa: E402

PAGE = """<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#101216;color:#ddd;font:12px system-ui}
.row{display:flex;gap:12px;padding:12px}
figure{margin:0}figcaption{margin-bottom:6px}canvas{background:#222;border:1px solid #333}
</style></head><body><div class="row" id="row"></div>
<script type="module">
import * as tex from "/src/scene/level-zero/textures.js";
const panels = [
  ["carpet colour", tex.createLevelZeroCarpetTexture],
  ["carpet detail maps", () => tex.createLevelZeroCarpetDetailMaps()],
  ["carpet macro", tex.createLevelZeroCarpetMacroTexture],
  ["ceiling", tex.createLevelZeroCeilingTexture],
];
const row = document.getElementById("row");
for (const [label, factory] of panels) {
  const value = factory();
  const figure = document.createElement("figure");
  const caption = document.createElement("figcaption");
  caption.textContent = label;
  const canvas = document.createElement("canvas");
  canvas.width = 384; canvas.height = 384;
  const context = canvas.getContext("2d");
  const texture = value?.map ?? value;
  const sources = [texture?.image, value?.bumpMap?.image, value?.roughnessMap?.image].filter(Boolean);
  // 平铺 2x2，便于观察是否可无缝重复
  sources.forEach((image, index) => {
    const cell = 192;
    for (let ty = 0; ty < 2; ty += 1) {
      for (let tx = 0; tx < 2; tx += 1) {
        context.drawImage(image, (index % 2) * cell + tx * cell / 2, Math.floor(index / 2) * cell + ty * cell / 2, cell / 2, cell / 2);
      }
    }
  });
  if (value?.bumpMap) { caption.textContent += " (colour + bump)"; }
  figure.append(caption, canvas);
  row.append(figure);
}
document.title = "carpet textures";
</script></body></html>"""


def main():
    page_path = OUT / "carpet-textures.html"
    page_path.write_text(PAGE, encoding="utf-8")
    log = (OUT / "tex-server.log").open("w", encoding="utf-8")
    server = subprocess.Popen(
        ["npm.cmd", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173", "--strictPort"],
        cwd=ROOT,
        stdout=log,
        stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )
    try:
        for _ in range(100):
            try:
                urllib.request.urlopen("http://127.0.0.1:5173/app.html", timeout=2).close()
                break
            except Exception:
                time.sleep(0.3)
        else:
            raise RuntimeError("Vite did not start")
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            )
            page = browser.new_page(viewport={"width": 1640, "height": 440}, device_scale_factor=2)
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto("http://127.0.0.1:5173/outputs/level-zero-light-density-2026-09-26/carpet-textures.html", wait_until="load")
            page.wait_for_timeout(2500)
            page.screenshot(path=str(OUT / "carpet-textures.png"), full_page=True)
            print("errors:", errors, flush=True)
            browser.close()
    finally:
        subprocess.run(["taskkill", "/PID", str(server.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log.close()


if __name__ == "__main__":
    main()
