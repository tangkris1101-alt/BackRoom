"""Level 0 lighting A/B: fixed poses, luminance/contrast/edge/FPS stats.

Usage: python capture-light-poses.py <tag>   (tag: light-before / light-after ...)
"""

import io
import json
import os
import statistics
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
sys.path.insert(0, str(Path(os.environ["TEMP"]) / "codex-walk-playwright"))
from playwright.sync_api import sync_playwright  # noqa: E402

# name, x, z, yaw (rad), pitch (rad)
POSES = [
    ("spawn", -48.0, 40.0, 0.0, 0.22),
    ("hall-a", 16.0, -40.0, 0.0, 0.30),
    ("hall-b", -12.0, -4.0, 1.57, 0.30),
    ("dark", 0.0, 28.0, 0.0, 0.30),
    ("ceiling-hall", 16.0, -40.0, 0.4, 0.50),
]


def safe_eval(page, script, retries=6):
    for _ in range(retries):
        try:
            return page.evaluate(script)
        except Exception:
            page.wait_for_timeout(450)
    return None


def measure(image_or_bytes=None):
    from PIL import Image, ImageFilter

    source = image_or_bytes if isinstance(image_or_bytes, bytes) else str(image_or_bytes)
    image = Image.open(io.BytesIO(source) if isinstance(source, bytes) else source).convert("RGB")
    pixels = list(image.getdata())
    total = len(pixels)
    luminance = [0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in pixels]
    mean = sum(luminance) / total
    grey = image.convert("L")
    width, height = grey.size
    # Centre crop keeps the HUD out of the edge metric.
    crop = grey.crop((int(width * 0.18), int(height * 0.16), int(width * 0.82), int(height * 0.86)))
    edges = list(crop.filter(ImageFilter.FIND_EDGES).getdata())
    return {
        "mean": round(mean, 1),
        "contrast": round(statistics.pstdev(luminance), 1),
        "darkRatio": round(sum(1 for value in luminance if value < 12) / total, 3),
        "clipRatio": round(sum(1 for value in luminance if value > 235) / total, 3),
        # edgeRatio = how much visible falloff the frame has; hardEdgeRatio =
        # share of genuinely hard boundaries (staircase seams, blown hotspots).
        "edgeRatio": round(sum(1 for value in edges if value > 10) / len(edges), 3),
        "hardEdgeRatio": round(sum(1 for value in edges if value > 45) / len(edges), 4),
    }


def start_level(page, name, tag):
    page.goto("http://127.0.0.1:5173/app.html?debug=true&level=0", wait_until="domcontentloaded")
    page.wait_for_function(
        "() => { const button = document.querySelector('#main-menu-start'); return button && !button.disabled; }",
        timeout=120000,
    )
    for _ in range(4):
        menu_open = safe_eval(page, "() => !document.querySelector('#main-menu').hasAttribute('hidden')")
        if menu_open:
            try:
                page.locator("#main-menu-start").click(timeout=5000)
            except Exception:
                continue
            page.wait_for_timeout(900)
        ready = safe_eval(page, "() => document.querySelector('#scene')?.dataset.sceneReady === 'true'")
        if ready:
            break
    try:
        page.wait_for_function("document.querySelector('#scene')?.dataset.level === '0'", timeout=60000)
        page.wait_for_function("document.querySelector('#loading-overlay')?.hidden === true", timeout=30000)
    except Exception as error:
        print("pose", name, "did not start:", error, flush=True)
        page.screenshot(path=str(OUT / f"debug-{tag}-{name}-nostart.png"))
        return False
    # The level-0 opening fades the scene in from white; wait until the game
    # reports a live frame before sampling, otherwise bloom on the fade blows
    # the whole capture out.
    try:
        page.wait_for_function("() => !document.querySelector('#scene')?.dataset.opening", timeout=60000)
    except Exception:
        pass
    page.wait_for_function(
        "() => { const fps = document.querySelector('#scene')?.dataset.fps; return fps && Number(fps) > 0; }",
        timeout=60000,
    )
    page.keyboard.press("x")
    page.wait_for_timeout(1500)
    if safe_eval(page, "() => !document.querySelector('#main-menu').hasAttribute('hidden')"):
        page.screenshot(path=str(OUT / f"debug-{tag}-{name}-menu.png"))
        return False
    return True


def main():
    tag = sys.argv[1] if len(sys.argv) > 1 else "light-after"
    log = (OUT / f"pose-server-{tag}.log").open("w", encoding="utf-8")
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
            stats = []
            for name, x, z, yaw, pitch in POSES:
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
                    if not start_level(page, name, tag):
                        context.close()
                        continue
                    path = OUT / f"{tag}-{name}.png"
                    page.screenshot(path=str(path))
                    result = measure(path)
                    result["fps"] = safe_eval(page, "() => Number(document.querySelector('#scene')?.dataset.fps ?? 0)") or 0
                    if name == "spawn":
                        frames = [measure(page.screenshot()) for _ in range(8)]
                        result["flickerStd"] = round(statistics.pstdev([frame["mean"] for frame in frames]), 2)
                    stats.append({"pose": name, **result})
                    print(name, result, errors, flush=True)
                finally:
                    context.close()
            print("MEAN", json.dumps(stats), flush=True)
            browser.close()
    finally:
        subprocess.run(["taskkill", "/PID", str(server.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log.close()


if __name__ == "__main__":
    main()
