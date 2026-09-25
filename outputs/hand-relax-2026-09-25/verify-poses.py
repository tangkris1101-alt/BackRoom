"""Capture the actual scene with empty, equipped, sprint and zoom poses."""

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


def game_save(item_id=None):
    inventory = [{"id": item_id, "count": 1, "type": item_id}] if item_id else []
    return {
        "version": 2,
        "player": {"level": 0, "position": {"x": -48, "y": 1.62, "z": 40}},
        "inventory": inventory,
        "equippedIndex": 0 if inventory else -1,
        "flashlight": {"owned": item_id == "flashlight", "on": False, "battery": 100},
    }


def open_game(browser, level, viewport, item_id=None):
    context = browser.new_context(viewport=viewport, device_scale_factor=1)
    save_json = json.dumps(game_save(item_id))
    context.add_init_script(f"""{{
      localStorage.setItem('backrooms-tutorial-seen', 'true');
      localStorage.setItem('backrooms:material:quality', 'low');
      localStorage.setItem('backrooms-save', JSON.stringify({save_json}));
    }}""")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(f"http://127.0.0.1:5173/app.html?debug=true&level={level}", wait_until="domcontentloaded")
    page.wait_for_function("!document.querySelector('#main-menu-start').disabled", timeout=30000)
    page.locator("#main-menu-start").click()
    page.wait_for_function("document.querySelector('#scene')?.dataset.sceneReady === 'true'", timeout=60000)
    page.wait_for_function("document.querySelector('#loading-overlay')?.hidden === true", timeout=30000)
    page.keyboard.press("x")
    page.wait_for_timeout(500)
    if page.locator("#scene").get_attribute("data-scene-ready") != "true":
        page.wait_for_function("!document.querySelector('#main-menu-start').disabled", timeout=20000)
        page.locator("#main-menu-start").click()
        page.wait_for_function("document.querySelector('#scene')?.dataset.sceneReady === 'true'", timeout=60000)
        page.wait_for_function("document.querySelector('#loading-overlay')?.hidden === true", timeout=30000)
        page.keyboard.press("x")
        page.wait_for_timeout(500)
    return context, page, errors


def snapshot(page, name):
    page.screenshot(path=str(OUT / name))
    return page.locator("#scene").evaluate("e => ({level: e.dataset.level, viewModel: e.dataset.viewModel, fps: e.dataset.fps, debug: e.dataset.debugFeatures, moving: e.dataset.moving})")


def main():
    log = (OUT / "verify-server.log").open("w", encoding="utf-8")
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
            cases = [
                (0, {"width": 960, "height": 540}, None, "level0-empty"),
                (0, {"width": 960, "height": 540}, "flashlight", "level0-flashlight"),
                (0, {"width": 960, "height": 540}, "almond-water", "level0-water"),
                (1, {"width": 960, "height": 540}, None, "level1-empty"),
                (1, {"width": 960, "height": 540}, "flashlight", "level1-flashlight"),
                (0, {"width": 390, "height": 844}, None, "portrait-empty"),
            ]
            if len(sys.argv) > 1:
                cases = [case for case in cases if case[3] == sys.argv[1]]
            for level, viewport, item_id, label in cases:
                context, page, errors = open_game(browser, level, viewport, item_id)
                print(label, "idle", snapshot(page, f"{label}-idle.png"), "errors", errors, flush=True)
                if label == "level0-empty":
                    page.keyboard.down("w")
                    page.keyboard.down("Shift")
                    page.wait_for_timeout(900)
                    print(label, "sprint", snapshot(page, f"{label}-sprint.png"), flush=True)
                    page.keyboard.up("Shift")
                    page.keyboard.up("w")
                    page.keyboard.down("c")
                    page.wait_for_timeout(350)
                    print(label, "zoom", snapshot(page, f"{label}-zoom.png"), flush=True)
                    page.keyboard.up("c")
                if item_id:
                    page.keyboard.press("q")
                    page.wait_for_timeout(100)
                    print(label, "transition", snapshot(page, f"{label}-transition.png"), "errors", errors, flush=True)
                    page.wait_for_timeout(400)
                    print(label, "unequipped", snapshot(page, f"{label}-unequipped.png"), "errors", errors, flush=True)
                    if label == "level0-flashlight":
                        page.locator("#scene").click(position={"x": 480, "y": 270})
                        page.mouse.move(480, 440)
                        page.mouse.move(480, 610)
                        page.wait_for_timeout(250)
                        print("pickup target", page.locator("#scene").evaluate("e => ({locked: e.dataset.mouseLocked, ready: e.dataset.pickupAvailable, pitch: e.dataset.cameraPitch})"), flush=True)
                        page.keyboard.press("f")
                        page.wait_for_timeout(100)
                        print(label, "reequip-transition", snapshot(page, f"{label}-reequip-transition.png"), "errors", errors, flush=True)
                        page.wait_for_timeout(400)
                        print(label, "reequipped", snapshot(page, f"{label}-reequipped.png"), "errors", errors, flush=True)
                context.close()
            browser.close()
    finally:
        subprocess.run(["taskkill", "/PID", str(server.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log.close()


if __name__ == "__main__":
    main()
