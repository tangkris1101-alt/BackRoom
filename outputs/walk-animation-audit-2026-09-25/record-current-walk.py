"""Record the live Level 0 canvas during an ordinary forward walk."""

import base64
import json
import os
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
sys.path.insert(0, str(Path(os.environ["TEMP"]) / "codex-walk-playwright"))
from playwright.sync_api import sync_playwright  # noqa: E402


def wait_server(url, timeout=35):
    import urllib.request

    start = time.monotonic()
    while time.monotonic() - start < timeout:
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.35)
    raise RuntimeError("Vite did not start")


def main():
    url = "http://127.0.0.1:5173/app.html?debug=true&level=0"
    server_log = (OUT / "record-server.log").open("w", encoding="utf-8")
    server = subprocess.Popen(
        ["npm.cmd", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173", "--strictPort"],
        cwd=ROOT,
        stdout=server_log,
        stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )
    try:
        wait_server(url)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                args=["--enable-webgl"],
            )
            context = browser.new_context(viewport={"width": 960, "height": 540}, device_scale_factor=1)
            context.add_init_script("""{
              localStorage.setItem('backrooms-tutorial-seen', 'true');
              localStorage.setItem('backrooms:material:quality', 'low');
            }""")
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(url, wait_until="domcontentloaded")
            page.locator("#main-menu-start").wait_for(state="visible", timeout=20000)
            page.wait_for_function("!document.querySelector('#main-menu-start').disabled", timeout=20000)
            page.locator("#main-menu-start").click()
            page.wait_for_function("document.querySelector('#scene')?.dataset.sceneReady === 'true'", timeout=60000)
            if page.locator("#tutorial-overlay").is_visible():
                page.locator("#tutorial-skip").click()
            try:
                page.wait_for_function("document.querySelector('#loading-overlay')?.hidden === true", timeout=7000)
            except Exception:
                state = page.evaluate("""() => ({
                  canvas: {...document.querySelector('#scene').dataset},
                  loading: document.querySelector('#loading-overlay').outerHTML.slice(0, 500),
                  pause: document.querySelector('#pause-overlay')?.outerHTML.slice(0, 500)
                })""")
                print("LOADING_STATE", json.dumps(state, ensure_ascii=False), flush=True)
                page.screenshot(path=str(OUT / "walk-current-loading.png"))
                if state["canvas"].get("paused") == "true":
                    page.locator("#pause-resume-area").click()
                page.wait_for_function("document.querySelector('#loading-overlay')?.hidden === true", timeout=30000)
            page.wait_for_timeout(500)
            page.keyboard.press("x")  # turn off the debug follow light
            page.wait_for_timeout(250)
            before = page.locator("#scene").evaluate("e => ({...e.dataset})")
            print("BEFORE", json.dumps({k: before.get(k) for k in ["sceneReady", "paused", "moving", "viewModel", "debugFeatures", "graphicsProfile", "fps"]}, ensure_ascii=False))
            page.screenshot(path=str(OUT / "walk-current-before.png"))

            page.evaluate("""() => {
              window.__walkSamples = [];
              const canvas = document.querySelector('#scene');
              const stream = canvas.captureStream(30);
              const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                ? 'video/webm;codecs=vp9' : 'video/webm';
              window.__walkChunks = [];
              window.__walkRecorder = new MediaRecorder(stream, {mimeType: mime});
              window.__walkRecorder.ondataavailable = e => { if (e.data.size) window.__walkChunks.push(e.data); };
              window.__walkRecorder.start(250);
              const started = performance.now();
              window.__walkSampleTimer = setInterval(() => {
                const d = canvas.dataset;
                window.__walkSamples.push({
                  t: +(performance.now() - started).toFixed(1),
                  moving: d.moving, speed: +d.movementSpeed,
                  bob: +d.headBob, cycle: +d.walkCycle,
                  strength: +d.walkBobStrength, paused: d.paused,
                  frames: +d.frameCount, x: +d.cameraX,
                  y: +d.cameraY, z: +d.cameraZ,
                  yaw: +d.cameraYaw, pitch: +d.cameraPitch
                });
              }, 33);
            }""")
            page.wait_for_timeout(700)
            page.keyboard.down("w")
            page.wait_for_timeout(3200)
            page.keyboard.up("w")
            page.wait_for_timeout(850)
            data_url = page.evaluate("""async () => {
              clearInterval(window.__walkSampleTimer);
              const recorder = window.__walkRecorder;
              const done = new Promise(resolve => recorder.onstop = resolve);
              recorder.stop();
              await done;
              const blob = new Blob(window.__walkChunks, {type: recorder.mimeType});
              return await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(blob);
              });
            }""")
            webm = OUT / "walk-animation-current.webm"
            webm.write_bytes(base64.b64decode(data_url.split(",", 1)[1]))
            samples = page.evaluate("window.__walkSamples")
            (OUT / "walk-current-telemetry.json").write_text(json.dumps(samples, ensure_ascii=False, indent=2), encoding="utf-8")
            after = page.locator("#scene").evaluate("e => ({...e.dataset})")
            print("AFTER", json.dumps({k: after.get(k) for k in ["sceneReady", "paused", "moving", "viewModel", "debugFeatures", "graphicsProfile", "fps"]}, ensure_ascii=False))
            print("SAMPLES", len(samples), "MOVING", sum(s["moving"] == "true" for s in samples), "ERRORS", errors)
            browser.close()

        subprocess.run([
            "ffmpeg", "-y", "-loglevel", "error", "-i", str(webm),
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20",
            str(OUT / "walk-animation-current.mp4"),
        ], check=True)
    finally:
        subprocess.run(
            ["taskkill", "/PID", str(server.pid), "/T", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        server_log.close()


if __name__ == "__main__":
    main()
