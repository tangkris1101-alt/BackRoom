"""Level 0 angled bays: fixed poses that look straight at the new 45° geometry.

Usage: python capture-angled-bays.py <tag>
"""

import json
import math
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

# name, from (x, z), look at (x, z), pitch (rad). The yaw is derived from the
# two points, so a pose only has to name the 45° face it is looking at.
POSES = [
    # Spawn room: the two chamfered corners.
    ("spawn-room-sw", (-50.0, 40.0), (-55.0, 45.0), -0.02),
    ("spawn-room-ne", (-44.0, 32.5), (-37.0, 29.0), -0.02),
    # Central corridor jog: the chamfer at (13,13) and the pier at (14,14).
    ("jog-corner", (-8.0, 9.0), (-7.0, 1.0), -0.02),
    ("jog-pier", (-12.0, 6.0), (-5.0, 3.0), -0.02),
    # The two turns on the run to the lift.
    ("corridor-turn", (24.0, -20.0), (31.0, -21.0), -0.02),
    ("lift-turn", (45.0, -24.0), (51.0, -25.0), -0.02),
    ("lift-pier", (52.0, -28.0), (45.0, -31.0), -0.02),
    # South hall piers, seen from the corridor side.
    ("south-pier", (-5.0, 28.5), (3.0, 27.0), 0.0),
    ("south-pier-east", (14.0, 29.0), (19.0, 29.0), 0.0),
    # West hall pier.
    ("west-pier", (-47.0, -11.0), (-41.0, -11.0), 0.0),
    # North room corners.
    ("north-room-west", (-12.0, -35.5), (-15.0, -39.0), 0.02),
    ("north-room-east", (1.5, -35.5), (7.0, -39.0), 0.02),
    # East wing corners.
    ("east-wing", (58.0, 39.0), (65.0, 35.0), 0.0),
    ("east-wing-corridor", (46.0, 32.0), (51.0, 29.0), 0.0),
]


def yaw_to(from_point, to_point):
    dx = to_point[0] - from_point[0]
    dz = to_point[1] - from_point[1]
    return math.atan2(-dx, -dz)


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
    try:
        page.wait_for_function("document.querySelector('#scene')?.dataset.level === '0'", timeout=60000)
        page.wait_for_function("document.querySelector('#loading-overlay')?.hidden === true", timeout=30000)
    except Exception as error:
        print("level 0 did not start:", error, flush=True)
        return False
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
    return True


def main():
    tag = sys.argv[1] if len(sys.argv) > 1 else "angled"
    log = (OUT / f"pose-server-{tag}.log").open("w", encoding="utf-8")
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
                args=["--enable-webgl"],
            )
            for name, origin, target, pitch in POSES:
                x, z = origin
                yaw = yaw_to(origin, target)
                context = browser.new_context(viewport={"width": 960, "height": 540}, device_scale_factor=1)
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
                  localStorage.setItem('backrooms:material:quality', 'high');
                  localStorage.setItem('backrooms-save', JSON.stringify({save_json}));
                }}""")
                page = context.new_page()
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                try:
                    if not start_level(page):
                        page.screenshot(path=str(OUT / f"debug-{tag}-{name}.png"))
                        continue
                    path = OUT / f"{tag}-{name}.png"
                    page.screenshot(path=str(path))
                    fps = safe_eval(page, "() => Number(document.querySelector('#scene')?.dataset.fps ?? 0)") or 0
                    print(name, f"fps={fps}", errors, flush=True)
                finally:
                    context.close()
            browser.close()
    finally:
        subprocess.run(["taskkill", "/PID", str(server.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log.close()


if __name__ == "__main__":
    main()
