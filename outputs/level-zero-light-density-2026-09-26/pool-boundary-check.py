"""Pool-boundary check: does a lamp pop in/out at the pool edge?

Captures three poses 3 m apart across the pool boundary found for the lamp at
(52, -40): the middle pose is where the old rank-based pool dropped it.
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

POSES = [
    ("x16", 16.0, -40.0),
    ("x20", 20.0, -40.0),
    ("x24", 24.0, -40.0),
    ("x28", 28.0, -40.0),
    ("x30", 30.0, -40.0),
]


LAMP_X, LAMP_Y, LAMP_Z = 52.0, 2.91, -40.0
FOV_TAN = 0.7265
WIDTH, HEIGHT = 1280, 720


def lamp_window(image_bytes, player_x):
    """Mean luminance in a window around the lamp at (52, 2.91, -40)."""
    import math

    from PIL import Image

    image = Image.open(io.BytesIO(image_bytes)).convert("L")
    dx = LAMP_X - player_x
    dz = LAMP_Z - (-40.0)
    dy = LAMP_Y - 1.62
    sx = int((1 + dz / (dx * FOV_TAN * (WIDTH / HEIGHT))) / 2 * WIDTH)
    sy = int((1 - dy / (dx * FOV_TAN)) / 2 * HEIGHT)
    # 只看灯下方与两侧的墙面/天花板，并裁掉发光面本身（>205）与 HUD 区域
    crop = image.crop((max(0, sx - 150), max(0, sy + 20), min(WIDTH, sx + 150), min(HEIGHT, sy + 150)))
    values = [value for value in crop.getdata() if value < 205]
    return round(statistics.mean(values), 2) if values else 0.0


def stats(image_bytes):
    from PIL import Image

    image = Image.open(io.BytesIO(image_bytes)).convert("L")
    pixels = sorted(image.getdata())
    top = pixels[int(len(pixels) * 0.9):]
    return {
        "mean": round(statistics.mean(pixels), 2),
        "topDecile": round(statistics.mean(top), 2),
    }


def main():
    tag = sys.argv[1] if len(sys.argv) > 1 else "pool-fade"
    log = (OUT / f"pool-server-{tag}.log").open("w", encoding="utf-8")
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
            rows = []
            for name, x, z in POSES:
                context = browser.new_context(viewport={"width": 1280, "height": 720}, device_scale_factor=1)
                save = {
                    "version": 2,
                    "player": {"level": 0, "position": {"x": x, "y": 1.62, "z": z}, "yaw": -1.5708, "pitch": -0.02},
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
                    page.wait_for_function("() => Number(document.querySelector('#scene')?.dataset.fps ?? 0) > 0", timeout=60000)
                except Exception as error:
                    print(name, "not ready:", error, flush=True)
                    context.close()
                    continue
                page.keyboard.press("x")
                page.wait_for_timeout(1500)
                image = page.screenshot(path=str(OUT / f"{tag}-{name}.png"))
                row = {"pose": name, **stats(image), "window": lamp_window(image, x)}
                rows.append(row)
                print(tag, row, errors, flush=True)
                context.close()
            if len(rows) >= 3:
                span = max(row["window"] for row in rows) - min(row["window"] for row in rows)
                print(f"{tag}: topDecile 跨三机位极差 = {span:.2f}（旧行为会出现明显台阶）", flush=True)
            browser.close()
    finally:
        subprocess.run(["taskkill", "/PID", str(server.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log.close()


if __name__ == "__main__":
    main()
