"""Instrumented repro: capture the view-model state machine with two items."""

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

DUMP_JS = """() => {
  const vm = window.__fpsArmsDebug;
  const arms = vm?.userData?.arms;
  const item = vm?.getObjectByName('first-person-held-item');
  const camera = vm?.parent;
  const siblings = camera ? camera.children.filter((c) => c.name === 'first-person-baked-hazmat-arms').map((c) => ({
    same: c === vm,
    pose: c.userData?.arms?.userData?.pose,
    armsY: Number(c.userData?.arms?.position?.y?.toFixed(3)),
    heldItemId: c.userData?.heldItemId,
    hasItem: Boolean(c.getObjectByName('first-person-held-item')),
  })) : [];
  return {
    log: window.__fpsArmsLog ?? [],
    cameraInScene: Boolean(camera?.parent),
    viewModelCount: siblings.length,
    siblings,
    state: vm ? {
      pose: arms?.userData?.pose,
      armsPos: arms?.position?.toArray(),
      heldItemId: vm.userData.heldItemId,
      targetHeldItemId: vm.userData.targetHeldItemId,
      transition: vm.userData.poseTransition?.phase ?? null,
      itemPos: item?.position?.toArray() ?? null,
      meshes: arms ? Object.fromEntries(Object.entries(arms.userData.meshes).map(([side, m]) => {
        const pos = m.geometry.getAttribute("position");
        return [side, {
          verts: pos.count,
          v0: [pos.getX(0), pos.getY(0), pos.getZ(0)].map((v) => Number(v.toFixed(3))),
          vMid: [pos.getX(Math.floor(pos.count / 2)), pos.getY(Math.floor(pos.count / 2)), pos.getZ(Math.floor(pos.count / 2))].map((v) => Number(v.toFixed(3))),
          meshPos: m.position.toArray().map((v) => Number(v.toFixed(3))),
        }];
      })) : null,
    } : null,
  };
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
            context = browser.new_context(viewport={"width": 1168, "height": 885}, device_scale_factor=1)
            save = {
                "version": 2,
                "player": {"level": 0, "position": {"x": -48, "y": 1.62, "z": 40}},
                "inventory": [
                    {"id": "flashlight", "count": 1, "type": "flashlight"},
                    {"id": "crumpled-note", "count": 1, "type": "crumpled-note"},
                ],
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
            page.wait_for_function("!document.querySelector('#main-menu-start').disabled", timeout=30000)
            page.locator("#main-menu-start").click()
            page.wait_for_function("document.querySelector('#scene')?.dataset.sceneReady === 'true'", timeout=60000)
            page.wait_for_function("document.querySelector('#loading-overlay')?.hidden === true", timeout=30000)
            page.keyboard.press("x")
            page.wait_for_timeout(1500)
            print("== after load (flashlight equipped) ==")
            print(json.dumps(page.evaluate(DUMP_JS), indent=1))
            page.screenshot(path=str(OUT / "instr-flashlight.png"))
            page.keyboard.press("ArrowRight")
            page.wait_for_timeout(900)
            print("== after ArrowRight (note) ==")
            print(json.dumps(page.evaluate(DUMP_JS), indent=1))
            page.screenshot(path=str(OUT / "instr-note.png"))
            print("errors:", errors, flush=True)
            context.close()
            browser.close()
    finally:
        subprocess.run(["taskkill", "/PID", str(server.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log.close()


if __name__ == "__main__":
    main()
