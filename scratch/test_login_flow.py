from playwright.sync_api import sync_playwright

def test_login():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context()
        page = context.new_page()

        print("Navigating to https://app.mapfy.com.br/ ...")
        page.goto("https://app.mapfy.com.br/", timeout=45000)
        print("Final URL after goto https://app.mapfy.com.br/:", page.url)
        print("Title:", page.title())

        browser.close()

if __name__ == "__main__":
    test_login()
