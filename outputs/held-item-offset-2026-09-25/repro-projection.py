"""Project the bound arm geometry through the live matrices to screen pixels."""

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

PROJECT_JS = """() => {
  const vm = window.__fpsArmsDebug;
  const arms = vm.userData.arms;
  const camera = vm.parent;
  const canvas = document.querySelector('#scene');
  const width = canvas.clientWidth, height = canvas.clientHeight;
  const V = vm.position.constructor;
  const M4 = camera.projectionMatrix.constructor;
  const out = { width, height, samples: {} };
  for (const side of ['left', 'right']) {
    const mesh = arms.userData.meshes[side];
    mesh.updateWorldMatrix(true, false);
    const pos = mesh.geometry.getAttribute('position');
    const skin = mesh.geometry.getAttribute('skinSurface');
    const nails = mesh.geometry.getAttribute('nailSurface');
    const clip = new M4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(mesh.matrixWorld);
    const cameraMatrix = new M4().multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld);
    const toCamera = (v) => v.clone().applyMatrix4(cameraMatrix);
    const project = (p) => [Math.round((p.x + 1) / 2 * width), Math.round((1 - p.y) / 2 * height)];
    const projectLocal = (v) => {
      const p = v.clone().applyMatrix4(clip);
      return [Math.round((p.x + 1) / 2 * width), Math.round((1 - p.y) / 2 * height)];
    };
    // Palm = broad flat hand skin; fingertip = pale nail-bed vertices.
    const palm = new V(), tips = new V();
    let palmCount = 0, tipCount = 0;
    for (let i = 0; i < pos.count; i += 1) {
      const v = new V(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (skin.getX(i) > 0.9 && nails.getX(i) < 0.04) { palm.add(v); palmCount += 1; }
      if (nails.getX(i) > 0.6) { tips.add(v); tipCount += 1; }
    }
    if (palmCount) palm.multiplyScalar(1 / palmCount);
    if (tipCount) tips.multiplyScalar(1 / tipCount);
    out.samples[side] = {
      palmCount, tipCount,
      palmLocal: palm.toArray().map((v) => Number(v.toFixed(3))),
      palmCamera: toCamera(palm).toArray().map((v) => Number(v.toFixed(3))),
      palmScreen: projectLocal(palm),
      tipsCamera: toCamera(tips).toArray().map((v) => Number(v.toFixed(3))),
      tipsScreen: projectLocal(tips),
    };
  }
  out.armsPos = arms.position.toArray();
  out.armsScale = arms.scale.x;
  out.itemCamera = (() => {
    const item = vm.getObjectByName('first-person-held-item');
    if (!item) return null;
    item.updateWorldMatrix(true, false);
    const p = new V().setFromMatrixPosition(item.matrixWorld);
    return new V().copy(p).applyMatrix4(camera.matrixWorldInverse).toArray().map((v) => Number(v.toFixed(3)));
  })();
  return out;
}"""

RESTORE_JS = """(side) => {
  const vm = window.__fpsArmsDebug;
  vm.visible = true;
  if (side) vm.userData.arms.userData.meshes[side].visible = true;
}"""

HIDE_JS = """(what) => {
  const vm = window.__fpsArmsDebug;
  if (what === 'arms') vm.userData.arms.visible = false;
  else if (what === 'item') { const it = vm.getObjectByName('first-person-held-item'); if (it) it.visible = false; }
}"""


def main():
    log = (OUT / "repro-server.log").open("w", encoding="utf-8")
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
            for label, inventory in [
                ("one", [{"id": "flashlight", "count": 1, "type": "flashlight"}]),
                ("two", [
                    {"id": "flashlight", "count": 1, "type": "flashlight"},
                    {"id": "crumpled-note", "count": 1, "type": "crumpled-note"},
                ]),
            ]:
                context = browser.new_context(viewport={"width": 960, "height": 540}, device_scale_factor=1)
                save = {
                    "version": 2,
                    "player": {"level": 0, "position": {"x": -48, "y": 1.62, "z": 40}},
                    "inventory": inventory,
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
                try:
                    page.wait_for_function("document.querySelector('#scene')?.dataset.sceneReady === 'true'", timeout=120000)
                except Exception as error:
                    print(label, "scene ready failed:", error, "errors:", errors, flush=True)
                    print(label, "dataset:", page.evaluate("() => ({...document.querySelector('#scene').dataset})"), flush=True)
                    page.screenshot(path=str(OUT / f"proj-{label}-failed.png"))
                    context.close()
                    continue
                page.wait_for_function("document.querySelector('#loading-overlay')?.hidden === true", timeout=30000)
                page.keyboard.press("x")
                page.wait_for_timeout(1800)
                print("==", label, "projection", json.dumps(page.evaluate(PROJECT_JS)), flush=True)
                page.screenshot(path=str(OUT / f"proj-{label}-normal.png"))
                page.evaluate(HIDE_JS, "arms")
                page.wait_for_timeout(200)
                page.screenshot(path=str(OUT / f"proj-{label}-noarms.png"))
                page.evaluate(RESTORE_JS, None)
                page.wait_for_timeout(200)
                print("errors:", errors, flush=True)
                context.close()
            browser.close()
    finally:
        subprocess.run(["taskkill", "/PID", str(server.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log.close()


if __name__ == "__main__":
    main()
