"""Check that the standalone HTML can load the separate relaxed arm assets."""

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
sys.path.insert(0, str(Path(os.environ["TEMP"]) / "codex-walk-playwright"))
from playwright.sync_api import sync_playwright  # noqa: E402

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        args=["--enable-webgl", "--allow-file-access-from-files"],
    )
    context = browser.new_context(viewport={"width": 960, "height": 540})
    context.add_init_script("""try {
      localStorage.setItem('backrooms-tutorial-seen', 'true');
      localStorage.setItem('backrooms:material:quality', 'low');
    } catch {}""")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto((ROOT / "backrooms.html").as_uri() + "?debug=true&level=0", wait_until="domcontentloaded")
    page.wait_for_function("!document.querySelector('#main-menu-start').disabled", timeout=30000)
    page.locator("#main-menu-start").click()
    page.wait_for_function("document.querySelector('#scene')?.dataset.sceneReady === 'true'", timeout=60000)
    page.wait_for_function("document.querySelector('#scene')?.dataset.viewModel === 'BAKED RIGGED FPS HAZMAT ARMS'", timeout=30000)
    page.wait_for_function("document.querySelector('#loading-overlay')?.hidden === true", timeout=30000)
    page.keyboard.press("x")
    page.wait_for_timeout(400)
    page.screenshot(path=str(OUT / "standalone-empty-idle.png"))
    print({"viewModel": page.locator("#scene").get_attribute("data-view-model"), "errors": errors})
    browser.close()
