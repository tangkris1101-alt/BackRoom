import os, sys
from pathlib import Path
sys.path.insert(0, str(Path(os.environ["TEMP"]) / "codex-walk-playwright"))
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    )
    page = browser.new_page(viewport={"width": 1000, "height": 460}, device_scale_factor=2)
    page.goto((OUT / "fixture-density-map.html").as_uri(), wait_until="load")
    page.wait_for_timeout(400)
    page.screenshot(path=str(OUT / "fixture-density-map.png"), full_page=True)
    print("shot", flush=True)
    browser.close()
