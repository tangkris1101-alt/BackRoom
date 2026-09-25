"""Measure the effective on-screen size of the held item at the grip anchor."""

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

ITEMS = ["flashlight", "crumpled-note", "almond-water", "detector", "compass", "level-key-4", "firesalt"]

MEASURE_JS = """() => {
  const debug = window.__heldItemDebug;
  if (!debug) return { missing: true };
  const { item, mount, arms } = debug;
  const camera = debug.viewModel.parent;
  item.updateWorldMatrix(true, true);
  const V = item.position.constructor;
  const M4 = camera.projectionMatrix.constructor;
  camera.updateMatrixWorld();
  const view = new M4().copy(camera.matrixWorldInverse);
  const proj = new M4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const worldScale = new V();
  item.getWorldScale(worldScale);
  const box = new (item.geometry ? Object : Object)();
  // Union the world-space bounds of every mesh in the item.
  const min = new V(Infinity, Infinity, Infinity);
  const max = new V(-Infinity, -Infinity, -Infinity);
  item.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry.computeBoundingBox();
    const b = child.geometry.boundingBox;
    for (const corner of [
      [b.min.x, b.min.y, b.min.z], [b.max.x, b.min.y, b.min.z],
      [b.min.x, b.max.y, b.min.z], [b.max.x, b.max.y, b.min.z],
      [b.min.x, b.min.y, b.max.z], [b.max.x, b.min.y, b.max.z],
      [b.min.x, b.max.y, b.max.z], [b.max.x, b.max.y, b.max.z],
    ]) {
      const p = new V(...corner).applyMatrix4(child.matrixWorld);
      min.min(p);
      max.max(p);
    }
  });
  const size = max.clone().sub(min);
  const center = min.clone().add(max).multiplyScalar(0.5);
  const centerCam = center.clone().applyMatrix4(view);
  const halfHeight = Math.tan((camera.fov / 2) * Math.PI / 180);
  const width = document.querySelector('#scene').clientWidth;
  const height = document.querySelector('#scene').clientHeight;
  const aspect = width / height;
  // Screen extents of the item's world bounding box, sampled at its corners.
  const project = (p) => {
    const q = p.clone().applyMatrix4(proj);
    return [(q.x + 1) / 2 * width, (1 - q.y) / 2 * height];
  };
  const pts = [];
  for (const corner of [
    [min.x, min.y, min.z], [max.x, min.y, min.z], [min.x, max.y, min.z], [max.x, max.y, min.z],
    [min.x, min.y, max.z], [max.x, min.y, max.z], [min.x, max.y, max.z], [max.x, max.y, max.z],
  ]) pts.push(project(new V(...corner)));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return {
    itemId: debug.itemId,
    worldScale: worldScale.toArray().map((v) => Number(v.toFixed(4))),
    mountScale: mount.scale.toArray().map((v) => Number(v.toFixed(4))),
    armsScale: arms.scale.x,
    sizeMeters: size.toArray().map((v) => Number(v.toFixed(4))),
    centerCamera: centerCam.toArray().map((v) => Number(v.toFixed(3))),
    screen: {
      x: [Math.round(Math.min(...xs)), Math.round(Math.max(...xs))],
      y: [Math.round(Math.min(...ys)), Math.round(Math.max(...ys))],
      widthPx: Math.round(Math.max(...xs) - Math.min(...xs)),
      heightPx: Math.round(Math.max(...ys) - Math.min(...ys)),
    },
    viewport: { width, height, aspect: Number(aspect.toFixed(3)) },
  };
}"""


def main():
    log = (OUT / "measure-server.log").open("w", encoding="utf-8")
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
            for _ in range(len(ITEMS)):
                try:
                    print(json.dumps(page.evaluate(MEASURE_JS)), flush=True)
                except Exception as error:
                    print("measure failed:", error, flush=True)
                page.keyboard.press("ArrowRight")
                page.wait_for_timeout(700)
            print("errors:", errors, flush=True)
            context.close()
            browser.close()
    finally:
        subprocess.run(["taskkill", "/PID", str(server.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log.close()


if __name__ == "__main__":
    main()
