"""Screenshot the plan view and a few region crops of the emitted Level 0 geometry."""

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
    log = (OUT / "plan-server.log").open("w", encoding="utf-8")
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
            zooms = {
                "zoom-jog": (-16.0, -8.0, 22.0, 20.0, 90),
                "zoom-spawn": (-60.0, 24.0, 24.0, 24.0, 90),
                "zoom-lift": (40.0, -32.0, 24.0, 26.0, 90),
                "zoom-south-piers": (0.0, 22.0, 26.0, 20.0, 90),
            }
            for name, (x0, z0, w, h, scale) in zooms.items():
                page.set_viewport_size({"width": int(w / 4 * scale) + 20, "height": int(h / 4 * scale) + 20})
                page.goto(
                    "http://127.0.0.1:5173/outputs/level-zero-angled-geometry-2026-10-01/plan-view.html"
                    f"?x0={x0}&z0={z0}&w={w}&h={h}&scale={scale}",
                    wait_until="load",
                )
                page.wait_for_function("() => window.planReady === true", timeout=60000)
                page.locator("#plan").screenshot(path=str(OUT / f"{name}.png"))
                print(name, x0, z0, w, h, scale, flush=True)
            browser.close()
    finally:
        subprocess.run(["taskkill", "/PID", str(server.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log.close()


if __name__ == "__main__":
    main()
