"""Mobile HUD pass: meter alignment, panel placement and the fixed F button.

Runs the game in a phone-shaped viewport (landscape 800x380 and portrait
390x844), drives it with touch input only, and reads the HUD geometry back out
of the DOM.

Usage: python mobile-check.py <tag>
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

VIEWPORTS = {
    "landscape": {"width": 800, "height": 380},
    "portrait": {"width": 390, "height": 844},
}

MEASURE = """
() => {
  const rect = (selector) => {
    const element = document.querySelector(selector);
    if (!element || element.hidden) return null;
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      left: Math.round(box.left),
      right: Math.round(box.right),
      top: Math.round(box.top),
      bottom: Math.round(box.bottom),
      width: Math.round(box.width),
      height: Math.round(box.height),
      visible: style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.01,
      opacity: Number(style.opacity),
    };
  };
  const useButton = document.querySelector("#use-button");
  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    coarse: window.matchMedia("(pointer: coarse)").matches,
    landscape: window.matchMedia("(orientation: landscape)").matches,
    staminaTrack: rect(".stamina-meter__track"),
    healthTrack: rect(".health-meter__track"),
    itemInfo: rect("#item-info"),
    inventoryBar: rect("#inventory-bar"),
    useButton: rect("#use-button"),
    joystick: rect("#joystick"),
    useButtonVisibleClass: useButton?.classList.contains("is-visible") ?? null,
    useButtonDisabled: useButton?.disabled ?? null,
    inventoryTypes: Array.from(document.querySelectorAll("#inventory-slots [data-type]"))
      .map((slot) => slot.dataset.type),
    focusItem: document.querySelector("#scene")?.dataset.focusItem ?? "",
  };
}
"""


def safe_eval(page, script, retries=6):
    for _ in range(retries):
        try:
            return page.evaluate(script)
        except Exception:
            page.wait_for_timeout(400)
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


def build_save():
    # Spawn cell (3,23) centre: ORIGIN (-62, -54) + col/row * 4 + 2.
    spawn = {"x": -48.0, "z": 40.0}
    # The camera looks at the bottle 2.5m ahead and a little down: 0.34 is the
    # height the bottle's own inspect test aims at, 1.62 the eye height.
    yaw = -1.16
    pitch = -0.474
    return {
        "version": 2,
        "player": {"level": 0, "position": {"x": spawn["x"], "y": 1.62, "z": spawn["z"]}, "yaw": yaw, "pitch": pitch},
        "inventory": [],
        "equippedIndex": -1,
        "flashlight": {"owned": False, "on": False, "battery": 0},
        # Pickups are stored per level, keyed by the level number.
        "pickups": {
            "0": {
                "almond-water": {
                    "active": True,
                    "respawnTimer": 0,
                    "position": {"x": spawn["x"] + 2.3, "y": 0, "z": spawn["z"] - 1.0},
                    "rotation": 0,
                },
                # Behind the player: out of the crosshair, still within reach.
                "flashlight": {
                    "active": True,
                    "respawnTimer": 0,
                    "position": {"x": spawn["x"] - 1.1, "y": 0, "z": spawn["z"] + 0.9},
                    "rotation": 0,
                },
                "super-almond-water": {
                    "active": False,
                    "respawnTimer": 99999,
                    "position": {"x": 200, "y": 0, "z": 200},
                    "rotation": 0,
                },
                "compass": {
                    "active": False,
                    "respawnTimer": 99999,
                    "position": {"x": 200, "y": 0, "z": 200},
                    "rotation": 0,
                },
            },
        },
    }


def overlap(a, b):
    if not a or not b:
        return False
    return (
        min(a["right"], b["right"]) - max(a["left"], b["left"]) > 0
        and min(a["bottom"], b["bottom"]) - max(a["top"], b["top"]) > 0
    )


def check_layout(state, viewport, failures, *, label, require_bar=False):
    middle = viewport["height"] * 0.5
    item_info = state["itemInfo"]
    if item_info and item_info["bottom"] > middle:
        failures.append(f"[{label}] item description crosses the middle of the screen (bottom {item_info['bottom']})")
    if item_info and overlap(item_info, state["staminaTrack"]):
        failures.append(f"[{label}] item description covers the meters")
    bar = state["inventoryBar"]
    if require_bar and not bar:
        failures.append(f"[{label}] inventory bar is not visible with items in the bag")
    if bar and bar["top"] < middle:
        failures.append(f"[{label}] inventory bar crosses the middle of the screen (top {bar['top']})")
    button = state["useButton"]
    if not button or not button["visible"]:
        failures.append(f"[{label}] fixed F button is not visible on the mobile layout")
        return
    if button["left"] < 0 or button["right"] > viewport["width"] or button["bottom"] > viewport["height"]:
        failures.append(f"[{label}] fixed F button is off screen: {button}")
    if overlap(button, state["joystick"]):
        failures.append(f"[{label}] fixed F button overlaps the joystick")
    if bar and overlap(button, bar):
        failures.append(f"[{label}] fixed F button overlaps the inventory bar")


def run_pass(browser, name, viewport, save_json, failures):
    context = browser.new_context(
        viewport=viewport,
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
    )
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
        idle = safe_eval(page, MEASURE)
        print(f"[{name}] idle:", json.dumps(idle, ensure_ascii=False), flush=True)
        page.screenshot(path=str(OUT / f"mobile-{name}-idle.png"))
        check_layout(idle, viewport, failures, label=name)
        if idle["staminaTrack"]["left"] != idle["healthTrack"]["left"]:
            failures.append(
                f"[{name}] stamina bar starts at {idle['staminaTrack']['left']}, "
                f"health bar at {idle['healthTrack']['left']}"
            )
        if idle["staminaTrack"]["width"] != idle["healthTrack"]["width"]:
            failures.append(f"[{name}] stamina and health bars have different widths")
        if idle["coarse"] is not True:
            failures.append(f"[{name}] emulation did not report a coarse pointer")
        if idle["useButtonVisibleClass"] is not True:
            failures.append(f"[{name}] fixed F button did not light up with two items in reach")

        page.screenshot(path=str(OUT / f"mobile-{name}-before-tap.png"))
        page.locator("#use-button").tap()
        page.wait_for_timeout(900)
        after = safe_eval(page, MEASURE)
        print(f"[{name}] after tap:", json.dumps(after, ensure_ascii=False), flush=True)
        page.screenshot(path=str(OUT / f"mobile-{name}-after-tap.png"))
        taken = set(after["inventoryTypes"])
        for expected in ("almond-water", "flashlight"):
            if expected not in taken:
                failures.append(
                    f"[{name}] one tap did not take the {expected} in reach (inventory: {sorted(taken)})"
                )
        if after["useButtonVisibleClass"]:
            failures.append(f"[{name}] fixed F button still lit with nothing left in reach")
        check_layout(after, viewport, failures, label=f"{name} after tap", require_bar=True)
        # The panel that describes an item or an interaction is the same element
        # in every mode, so the details card the tap leaves behind proves where
        # the description sits: the top band, never across the crosshair.
        if not after["itemInfo"]:
            failures.append(f"[{name}] no description card after the tap")
        if errors:
            failures.append(f"[{name}] page errors: {errors}")
    finally:
        context.close()


def main():
    tag = sys.argv[1] if len(sys.argv) > 1 else "mobile"
    log = (OUT / f"mobile-server-{tag}.log").open("w", encoding="utf-8")
    server = subprocess.Popen(
        ["npm.cmd", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173", "--strictPort"],
        cwd=ROOT,
        stdout=log,
        stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )
    failures = []
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
            save_json = json.dumps(build_save())
            for name, viewport in VIEWPORTS.items():
                run_pass(browser, name, viewport, save_json, failures)
            browser.close()
    finally:
        subprocess.run(["taskkill", "/PID", str(server.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log.close()

    print("FAILURES:" if failures else "all mobile checks passed")
    for failure in failures:
        print(" -", failure)
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
