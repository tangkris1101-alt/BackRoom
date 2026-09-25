"""Sweep every held-item branch and capture the result at 1168x885."""

import json
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

ITEMS = [
    "flashlight",
    "crumpled-note",
    "almond-water",
    "super-almond-water",
    "detector",
    "compass",
    "level-key-4",
    "firesalt",
]


def main():
    log = (OUT / "sweep-server.log").open("w", encoding="utf-8")
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
                args=["--enable-webgl"],
            )
            context = browser.new_context(viewport={"width": 1168, "height": 885}, device_scale_factor=1)
            save = {
                "version": 2,
                "player": {"level": 0, "position": {"x": -48, "y": 1.62, "z": 40}},
                "inventory": [{"id": item, "count": 1, "type": item} for item in ITEMS],
                "equippedIndex": 0,
                "flashlight": {"owned": True, "on": False, "battery": 100},
            }
            save_json = json.dumps(save)
            context.add_init_script(f"""{{
              localStorage.setItem('backrooms-tutorial-seen', 'true');
              localStorage.setItem('backrooms:material:quality', 'low');
              localStorage.setItem('backrooms-save', JSON.stringify({save_json}));
            }}""")
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto("http://127.0.0.1:5173/app.html?debug=true&level=0", wait_until="domcontentloaded")
            page.wait_for_function("!document.querySelector('#main-menu-start').disabled", timeout=60000)
            page.locator("#main-menu-start").click()
            page.wait_for_function("document.querySelector('#scene')?.dataset.sceneReady === 'true'", timeout=120000)
            page.wait_for_function("document.querySelector('#loading-overlay')?.hidden === true", timeout=30000)
            page.keyboard.press("x")
            page.wait_for_timeout(1500)
            for item in ITEMS:
                equipped = page.evaluate(
                    "() => document.querySelector('#inventory-bar .inventory-slot[data-equipped=\"true\"]')?.dataset.type ?? 'unknown'"
                )
                path = OUT / f"sweep-{equipped}.png"
                page.screenshot(path=str(path))
                print("captured", equipped, flush=True)
                page.keyboard.press("ArrowRight")
                page.wait_for_timeout(700)
            # walk + sprint with an item to check the prop rides the hand motion
            page.keyboard.down("w")
            page.wait_for_timeout(500)
            page.screenshot(path=str(OUT / "sweep-walk.png"))
            page.keyboard.down("Shift")
            page.wait_for_timeout(700)
            page.screenshot(path=str(OUT / "sweep-sprint.png"))
            page.keyboard.up("Shift")
            page.keyboard.up("w")
            page.wait_for_timeout(400)
            # unequip everything (cycle to the end then drop) and confirm empty pose
            print("errors:", errors, flush=True)
            context.close()
            browser.close()
    finally:
        subprocess.run(["taskkill", "/PID", str(server.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log.close()


if __name__ == "__main__":
    main()
