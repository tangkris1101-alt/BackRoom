"""Desktop layout must be untouched by the mobile HUD rules."""

import json, os, subprocess, sys, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
sys.path.insert(0, str(Path(os.environ["TEMP"]) / "codex-walk-playwright"))
from playwright.sync_api import sync_playwright

PROBE = """
() => {
  const rect = (selector) => {
    const element = document.querySelector(selector);
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return { left: Math.round(box.left), bottom: Math.round(box.bottom), top: Math.round(box.top),
             display: getComputedStyle(element).display, opacity: Number(getComputedStyle(element).opacity) };
  };
  return {
    stamina: rect(".stamina-meter__track"),
    health: rect(".health-meter__track"),
    itemInfo: rect("#item-info"),
    useButton: rect("#use-button"),
    coarse: window.matchMedia("(pointer: coarse)").matches,
  };
}
"""

log = (OUT / "desktop-server.log").open("w", encoding="utf-8")
server = subprocess.Popen(["npm.cmd", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173", "--strictPort"],
                          cwd=ROOT, stdout=log, stderr=subprocess.STDOUT,
                          creationflags=subprocess.CREATE_NO_WINDOW)
failures = []
try:
    for _ in range(120):
        try:
            urllib.request.urlopen("http://127.0.0.1:5173/app.html", timeout=2).close()
            break
        except Exception:
            time.sleep(0.3)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True,
            executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe", args=["--enable-webgl"])
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.goto("http://127.0.0.1:5173/map-preview.html", wait_until="load")
        page.goto("http://127.0.0.1:5173/app.html?debug=true&level=0", wait_until="domcontentloaded")
        page.wait_for_function("() => { const b = document.querySelector('#main-menu-start'); return b && !b.disabled; }", timeout=120000)
        if page.evaluate("() => !document.querySelector('#main-menu').hasAttribute('hidden')"):
            page.locator("#main-menu-start").click(timeout=5000)
        page.wait_for_function("document.querySelector('#scene')?.dataset.level === '0'", timeout=60000)
        page.wait_for_timeout(2500)
        state = page.evaluate(PROBE)
        print(json.dumps(state, ensure_ascii=False), flush=True)
        page.screenshot(path=str(OUT / "desktop-layout.png"))
        if state["coarse"]:
            failures.append("desktop viewport reports a coarse pointer")
        if state["stamina"]["left"] != state["health"]["left"]:
            failures.append("desktop meters are not aligned")
        if state["useButton"]["display"] != "none":
            failures.append("the fixed F button shows on the desktop layout")
        browser.close()
finally:
    subprocess.run(["taskkill", "/PID", str(server.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    log.close()
print("FAILURES:" if failures else "desktop layout unchanged")
for failure in failures:
    print(" -", failure)
sys.exit(1 if failures else 0)
