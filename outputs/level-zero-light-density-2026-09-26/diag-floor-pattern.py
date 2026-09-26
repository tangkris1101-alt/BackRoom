"""Diagnose the floor pattern: same pose at high vs low quality.

Low quality skips `createFixtureLightField` entirely, so any pattern that
disappears there belongs to the baked light field (and its per-cell mask).
"""

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

POSES = [
    ("floor-down-dark", 0.0, 28.0, 0.0, -0.85),
    ("floor-down-hall", 16.0, -40.0, 0.4, -0.7),
    ("floor-graze-dark", 0.0, 28.0, 0.0, -0.12),
    ("floor-graze-hall", 16.0, -40.0, 0.4, -0.12),
]


def main():
    log = (OUT / "diag-server.log").open("w", encoding="utf-8")
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
            for quality in ["high", "low"]:
                for name, x, z, yaw, pitch in POSES:
                    context = browser.new_context(viewport={"width": 1280, "height": 720}, device_scale_factor=2)
                    save = {
                        "version": 2,
                        "player": {"level": 0, "position": {"x": x, "y": 1.62, "z": z}, "yaw": yaw, "pitch": pitch},
                        "inventory": [],
                        "equippedIndex": -1,
                        "flashlight": {"owned": False, "on": False, "battery": 0},
                    }
                    save_json = json.dumps(save)
                    context.add_init_script(f"""{{
                      localStorage.setItem('backrooms-tutorial-seen', 'true');
                      localStorage.setItem('backrooms:material:quality', '{quality}');
                      localStorage.setItem('backrooms-save', JSON.stringify({save_json}));
                    }}""")
                    page = context.new_page()
                    errors = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.goto("http://127.0.0.1:5173/app.html?debug=true&level=0", wait_until="domcontentloaded")
                    page.wait_for_function(
                        "() => { const button = document.querySelector('#main-menu-start'); return button && !button.disabled; }",
                        timeout=120000,
                    )
                    for _ in range(4):
                        if page.evaluate("() => !document.querySelector('#main-menu').hasAttribute('hidden')"):
                            try:
                                page.locator("#main-menu-start").click(timeout=5000)
                            except Exception:
                                continue
                            page.wait_for_timeout(900)
                        if page.evaluate("() => document.querySelector('#scene')?.dataset.sceneReady === 'true'"):
                            break
                    try:
                        page.wait_for_function("() => !document.querySelector('#scene')?.dataset.opening", timeout=60000)
                        page.wait_for_function(
                            "() => Number(document.querySelector('#scene')?.dataset.fps ?? 0) > 0",
                            timeout=60000,
                        )
                    except Exception as error:
                        print(name, quality, "not ready:", error, flush=True)
                        context.close()
                        continue
                    page.keyboard.press("x")
                    page.wait_for_timeout(1500)
                    profile = page.evaluate("() => document.querySelector('#scene')?.dataset.graphicsProfile")
                    path = OUT / f"diag-{name}-{quality}.png"
                    page.screenshot(path=str(path))
                    print(name, quality, "profile", profile, errors, flush=True)
                    context.close()
            browser.close()
    finally:
        subprocess.run(["taskkill", "/PID", str(server.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log.close()


if __name__ == "__main__":
    main()
