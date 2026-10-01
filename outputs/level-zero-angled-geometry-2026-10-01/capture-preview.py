"""Screenshot the map preview with Level 0 selected, to check the new cell types."""

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


def main():
    log = (OUT / "preview-server.log").open("w", encoding="utf-8")
    server = subprocess.Popen(
        ["npm.cmd", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173", "--strictPort"],
        cwd=ROOT,
        stdout=log,
        stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NO_WINDOW,
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
            )
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto("http://127.0.0.1:5173/map-preview.html", wait_until="load")
            page.wait_for_timeout(3000)
            for _ in range(20):
                if page.evaluate("() => !!document.querySelector('#map')?.width"):
                    break
                page.wait_for_timeout(300)
            tiles = page.evaluate(
                """() => {
                  const select = document.querySelector('#level-select');
                  return select ? Array.from(select.options).map((option) => option.value) : null;
                }"""
            )
            print("level options", tiles, "errors", errors, flush=True)
            page.select_option("#level-select", "0") if page.locator("#level-select").count() else None
            page.wait_for_timeout(1200)
            page.screenshot(path=str(OUT / "preview-level0.png"))
            print("errors after select", errors, flush=True)
            browser.close()
    finally:
        subprocess.run(["taskkill", "/PID", str(server.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log.close()


if __name__ == "__main__":
    main()
