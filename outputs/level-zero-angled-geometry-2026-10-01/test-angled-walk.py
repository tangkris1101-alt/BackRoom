"""Level 0 angled bays: drive the real game into the 45° faces and read the
resulting player position back out of the autosave.

Usage: python test-angled-walk.py
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

SAVE_INTERVAL_MS = 5000


def yaw_to(dx, dz):
    import math
    return math.atan2(-dx, -dz)


PROBES = [
    {
        # Bay (23,8) is a WN bay: its face runs along x + z = 10 with the
        # walkable notch on the low side. Walking into it has to stop the player
        # short of the pier.
        "name": "wall-stops-the-player",
        "start": (30.6, -21.4),
        "look": (1.0, 1.0),
        "keys": ["w"],
        "hold": 2.4,
        "check": lambda p: 8.8 < p["x"] + p["z"] < 10.2,
        "expect": "x + z stays under the 45° face at x + z = 10",
    },
    {
        # Walking along the face keeps x + z at the value the player started
        # with, so the 45° wall should let the body slide the length of it and
        # out of the north port instead of catching.
        "name": "face-slides-the-player",
        "start": (30.6, -21.4),
        "look": (1.0, -1.0),
        "keys": ["w"],
        "hold": 2.2,
        "check": lambda p: p["z"] < -21.6 and p["x"] > 30.8,
        "expect": "the player slides along the face towards the north port",
    },
    {
        # Corridor jog at (13,13): the chamfer closes the west half of the bay,
        # so a body walking north up the corridor has to reach the east half.
        # North-east input should carry it through the notch and round the turn.
        "name": "corner-stays-passable",
        "start": (-7.0, 6.0),
        "look": (0.0, -1.0),
        "keys": ["w", "d"],
        "hold": 3.0,
        "check": lambda p: p["x"] > -6.2 and p["z"] < 1.2,
        "expect": "the player rounds the 45° corner into the next bay east",
    },
]


def safe_eval(page, script, retries=6):
    for _ in range(retries):
        try:
            return page.evaluate(script)
        except Exception:
            page.wait_for_timeout(450)
    return None


def start_level(page):
    page.goto("http://127.0.0.1:5173/app.html?debug=true&level=0", wait_until="domcontentloaded")
    page.wait_for_function(
        "() => { const button = document.querySelector('#main-menu-start'); return button && !button.disabled; }",
        timeout=120000,
    )
    for _ in range(4):
        if safe_eval(page, "() => !document.querySelector('#main-menu').hasAttribute('hidden')"):
            try:
                page.locator("#main-menu-start").click(timeout=5000)
            except Exception:
                continue
            page.wait_for_timeout(900)
        if safe_eval(page, "() => document.querySelector('#scene')?.dataset.sceneReady === 'true'"):
            break
    page.wait_for_function("document.querySelector('#scene')?.dataset.level === '0'", timeout=60000)
    page.wait_for_function("document.querySelector('#loading-overlay')?.hidden === true", timeout=30000)
    try:
        page.wait_for_function("() => !document.querySelector('#scene')?.dataset.opening", timeout=60000)
    except Exception:
        pass
    page.wait_for_function(
        "() => { const fps = document.querySelector('#scene')?.dataset.fps; return fps && Number(fps) > 0; }",
        timeout=60000,
    )
    page.keyboard.press("x")
    page.wait_for_timeout(1200)


def read_player(page):
    raw = safe_eval(
        page,
        "() => window.localStorage.getItem('backrooms-save') || window.localStorage.getItem('backrooms-save:guest') || null",
    )
    if not raw:
        keys = safe_eval(page, "() => Object.keys(window.localStorage)")
        raise RuntimeError(f"no save found; localStorage keys: {keys}")
    return json.loads(raw)["player"]


def main():
    log = (OUT / "walk-server.log").open("w", encoding="utf-8")
    server = subprocess.Popen(
        ["npm.cmd", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173", "--strictPort"],
        cwd=ROOT,
        stdout=log,
        stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )
    failures = 0
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
            for probe in PROBES:
                context = browser.new_context(viewport={"width": 960, "height": 540})
                x, z = probe["start"]
                save = {
                    "version": 2,
                    "player": {
                        "level": 0,
                        "position": {"x": x, "y": 1.62, "z": z},
                        "yaw": yaw_to(*probe["look"]),
                        "pitch": -0.02,
                    },
                    "inventory": [],
                    "equippedIndex": -1,
                    "flashlight": {"owned": False, "on": False, "battery": 0},
                }
                save_json = json.dumps(save)
                context.add_init_script(f"""{{
                  localStorage.setItem('backrooms-tutorial-seen', 'true');
                  localStorage.setItem('backrooms:material:quality', 'high');
                  localStorage.setItem('backrooms-save', JSON.stringify({save_json}));
                }}""")
                page = context.new_page()
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                try:
                    start_level(page)
                    for key in probe["keys"]:
                        page.keyboard.down(key)
                    page.wait_for_timeout(int(probe["hold"] * 1000))
                    for key in probe["keys"]:
                        page.keyboard.up(key)
                    page.wait_for_timeout(SAVE_INTERVAL_MS + 800)
                    player = read_player(page)
                    position = player["position"]
                    ok = probe["check"](position)
                    failures += 0 if ok else 1
                    print(
                        f"{probe['name']}: {'PASS' if ok else 'FAIL'} "
                        f"start=({x:.2f},{z:.2f}) end=({position['x']:.2f},{position['z']:.2f}) "
                        f"expected {probe['expect']}",
                        errors,
                        flush=True,
                    )
                    page.screenshot(path=str(OUT / f"walk-{probe['name']}.png"))
                finally:
                    context.close()
            browser.close()
    finally:
        subprocess.run(["taskkill", "/PID", str(server.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log.close()
    print("failures:", failures)
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
