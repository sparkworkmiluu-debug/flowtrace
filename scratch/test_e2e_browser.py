from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_page()
    errors = []
    failed_reqs = []
    page.on("pageerror", lambda err: errors.append(f"PAGEERROR: {err}"))
    page.on("console", lambda msg: errors.append(f"CONSOLE {msg.type}: {msg.text}") if msg.type == "error" else None)
    page.on("response", lambda res: failed_reqs.append(f"{res.status} {res.url}") if res.status >= 400 else None)

    page.goto("http://localhost:3000", wait_until="networkidle")
    print("Loaded title:", page.title())
    for label in ["Cycle Laundering Ring", "Gather-Scatter Cluster", "Legitimate Payroll Cleared"]:
        btn = page.get_by_role("button", name=label)
        print(f"Clicking: {label} (visible={btn.is_visible()}, disabled={btn.is_disabled()})")
        btn.click()
        page.wait_for_timeout(1500)

    print("ERRORS:", errors or "None")
    print("FAILED_REQUESTS:", failed_reqs or "None")
    browser.close()
