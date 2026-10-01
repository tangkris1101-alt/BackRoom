"""Item metalness pass: same poses, both quality tiers.

Level 1 holds the empty can (cell 10,20, inside the level's dark zone) with a
bottle and a torch placed on the same floor for comparison; Level 2 holds the
wire spool, whose copper was the most metallic material in the project.

Usage: python can-darkness.py [tag]   (tag defaults to "after")
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

CAN = {"x": -28.0, "z": 32.0}
LEVEL_ONE_PICKUPS = {
    "1": {
        "almond-water": {
            "active": True,
            "respawnTimer": 0,
            "position": {"x": CAN["x"] - 1.15, "y": 0, "z": CAN["z"] - 0.9},
            "rotation": 0,
        },
        "flashlight": {
            "active": True,
            "respawnTimer": 0,
            "position": {"x": CAN["x"] + 1.2, "y": 0, "z": CAN["z"] - 0.5},
            "rotation": 0,
        },
        "detector": {"active": False, "respawnTimer": 99999, "position": {"x": 200, "y": 0, "z": 200}, "rotation": 0},
        "compass": {"active": False, "respawnTimer": 99999, "position": {"x": 200, "y": 0, "z": 200}, "rotation": 0},
    },
}

POSES = [
    # level, name, player pose
    (1, "can-aisle", {"x": -28.0, "z": 35.5, "yaw": 0.0, "pitch": -0.30}),
    (1, "can-close", {"x": -28.4, "z": 33.2, "yaw": 0.0, "pitch": -0.62}),
    # Level 2 cell (24,16) spawns the wire spool.
    (2, "spool", {"x": -2.0, "z": 13.0, "yaw": 0.0, "pitch": -0.45}),
]


def safe_eval(page, script, retries=6):
    for _ in range(retries):
        try:
            return page.evaluate(script)
        except Exception:
            page.wait_for_timeout(400)
    return None


def start_level(page, level):
    page.goto(f"http://127.0.0.1:5173/app.html?debug=true&level={level}", wait_until="domcontentloaded")
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
    for wait in (
        f"document.querySelector('#scene')?.dataset.level === '{level}'",
        "document.querySelector('#loading-overlay')?.hidden === true",
    ):
        try:
            page.wait_for_function(wait, timeout=60000)
        except Exception as error:
            print("wait skipped:", error, flush=True)
    page.wait_for_function(
        "() => { const fps = document.querySelector('#scene')?.dataset.fps; return fps && Number(fps) > 0; }",
        timeout=60000,
    )
    page.keyboard.press("x")
    page.wait_for_timeout(1500)


def main():
    tag = sys.argv[1] if len(sys.argv) > 1 else "after"
    log = (OUT / "can-server.log").open("w", encoding="utf-8")
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
            for quality in ("high", "low"):
                for level, name, pose in POSES:
                    context = browser.new_context(viewport={"width": 960, "height": 540}, device_scale_factor=1)
                    save = {
                        "version": 2,
                        "player": {
                            "level": level,
                            "position": {"x": pose["x"], "y": 1.62, "z": pose["z"]},
                            "yaw": pose["yaw"],
                            "pitch": pose["pitch"],
                        },
                        "inventory": [],
                        "equippedIndex": -1,
                        "flashlight": {"owned": False, "on": False, "battery": 0},
                    }
                    if level == 1:
                        save["pickups"] = json.loads(json.dumps(LEVEL_ONE_PICKUPS))
                    save_json = json.dumps(save)
                    context.add_init_script(
                        "(() => {\n"
                        "  localStorage.setItem('backrooms-tutorial-seen', 'true');\n"
                        f"  localStorage.setItem('backrooms:material:quality', '{quality}');\n"
                        f"  localStorage.setItem('backrooms-save', {json.dumps(save_json)});\n"
                        "})();"
                    )
                    page = context.new_page()
                    errors = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    try:
                        start_level(page, level)
                        path = OUT / f"{tag}-{quality}-{name}.png"
                        page.screenshot(path=str(path))
                        print(tag, quality, name, errors, flush=True)
                    finally:
                        context.close()
            browser.close()
    finally:
        subprocess.run(["taskkill", "/PID", str(server.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log.close()


if __name__ == "__main__":
    main()
