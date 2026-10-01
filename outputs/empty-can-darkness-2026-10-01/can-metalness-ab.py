"""Isolated metalness A/B: the same can, same studio lighting, same view.

Loads tests/empty-can-visual.html three times and rewrites the served module's
metalness on the way in, so nothing but the material differs between the runs.

Usage: python can-metalness-ab.py
"""

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

VARIANTS = {
    # label -> (shell metalness, interior metalness); None keeps the file's value.
    "shell-0.56": (0.56, None),
    "shell-0.22": (None, None),
    "shell-0.00": (0.0, None),
    "interior-0.34": (None, 0.34),
}

SHELL_SOURCE = "metalness: 0.22,"
INTERIOR_SOURCE = "metalness: 0.18,"
CAN_SOURCE = Path(__file__).resolve().parents[2] / "src" / "scene" / "items" / "empty-can.js"

MEASURE = """
() => {
  const canvas = document.querySelector("canvas");
  const box = canvas.getBoundingClientRect();
  document.querySelector(".controls")?.style.setProperty("display", "none");
  return { width: box.width, height: box.height };
}
"""


def main():
    log = (OUT / "ab-server.log").open("w", encoding="utf-8")
    server = subprocess.Popen(
        ["npm.cmd", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173", "--strictPort"],
        cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW,
    )
    try:
        for _ in range(120):
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
                args=["--enable-webgl"],
            )
            original = CAN_SOURCE.read_text(encoding="utf-8")
            assert SHELL_SOURCE in original and INTERIOR_SOURCE in original, "the metalness lines moved"
            try:
                for label, (shell, interior) in VARIANTS.items():
                    patched = original
                    if shell is not None:
                        patched = patched.replace(SHELL_SOURCE, f"metalness: {shell},", 1)
                    if interior is not None:
                        patched = patched.replace(INTERIOR_SOURCE, f"metalness: {interior},", 1)
                    CAN_SOURCE.write_text(patched, encoding="utf-8")
                    print("variant", label, "shell", shell, "interior", interior, flush=True)
                    context = browser.new_context(viewport={"width": 900, "height": 700}, device_scale_factor=1)
                    page = context.new_page()
                    page.goto("http://127.0.0.1:5173/tests/empty-can-visual.html", wait_until="load")
                    page.wait_for_timeout(2500)
                    page.evaluate(MEASURE)
                    page.wait_for_timeout(400)
                    page.locator("canvas").screenshot(path=str(OUT / f"ab-can-{label}.png"))
                    print("  saved", f"ab-can-{label}.png", flush=True)
                    context.close()
            finally:
                CAN_SOURCE.write_text(original, encoding="utf-8")
                print("source restored", flush=True)
            browser.close()
    finally:
        subprocess.run(["taskkill", "/PID", str(server.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log.close()


if __name__ == "__main__":
    main()
