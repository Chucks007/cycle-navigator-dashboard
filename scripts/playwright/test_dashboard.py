import os
import time

from playwright.sync_api import sync_playwright


def take_screenshot(page, name):
    path = os.path.join('artifacts', name)
    page.screenshot(path=path, full_page=True)
    print(f"Saved screenshot: {path}")


def run_test():
    with sync_playwright() as p:
        # Allow running headless via env var for CI / headless environments
        headless_env = os.getenv("PLAYWRIGHT_HEADLESS", "false").lower()
        headless = headless_env in ("1", "true", "yes")
        browser = p.chromium.launch(headless=headless)
        page = browser.new_page()
        print('Opening dashboard...')
        page.goto('http://localhost:8501', timeout=60000)

        # Wait for Streamlit app to be ready
        try:
            page.wait_for_selector('text=Real-Time Stock Dashboard', timeout=60000)
            print('Dashboard loaded')
        except Exception as e:
            print('Dashboard did not show expected title:', e)

        # Initial screenshot
        time.sleep(1)
        take_screenshot(page, 'initial.png')

        # Click Update button to load default AAPL data
        try:
            page.click('text=Update', timeout=10000)
            print('Clicked Update')
        except Exception as e:
            print('Could not click Update:', e)

        # Wait for chart and tables to appear
        try:
            page.wait_for_selector('text=Historical Data', timeout=30000)
            print('Historical Data section appeared')
        except Exception as e:
            print('Historical Data did not appear:', e)

        time.sleep(2)
        take_screenshot(page, 'after_update.png')

        # Interact with the multiselect for Technical Indicators
        # Streamlit renders multiselects with specific data-testid attributes
        try:
            # Find the one near "Technical Indicators" text
            # Alternative: use the input directly
            indicators_input = page.locator('label:has-text("Technical Indicators")').locator('..').locator('input')

            # Click to open dropdown
            indicators_input.click()
            time.sleep(0.5)

            # Select each indicator by clicking on the option in the dropdown
            for option in ['SMA 20', 'EMA 20', 'RSI 14']:
                # Streamlit renders options with specific text in divs
                option_locator = page.locator(f'[role="option"]:has-text("{option}")')
                if option_locator.count() > 0:
                    option_locator.first.click()
                    time.sleep(0.3)
                else:
                    print(f'Option {option} not found in dropdown')

            # Close dropdown by clicking elsewhere or pressing Escape
            page.keyboard.press('Escape')
            time.sleep(0.5)
            print('Selected all indicators')
        except Exception as e:
            print(f'Could not select indicators via multiselect: {e}')
            # Try alternative approach: click the multiselect container
            try:
                page.locator('label:has-text("Technical Indicators")').locator('..').locator('[data-baseweb="select"]').click()
                time.sleep(1)
                # Select all visible options
                page.locator('[role="option"]').nth(0).click()
                time.sleep(0.3)
                page.locator('[role="option"]').nth(1).click()
                time.sleep(0.3)
                page.locator('[role="option"]').nth(2).click()
                time.sleep(0.3)
                page.keyboard.press('Escape')
                print('Selected indicators using alternative method')
            except Exception as e2:
                print(f'Alternative selection also failed: {e2}')

        # Click Update again to render indicators
        try:
            page.click('text=Update', timeout=10000)
            page.wait_for_selector('text=Technical Indicators', timeout=10000)
            print('Updated with indicators')
        except Exception as e:
            print('Error clicking Update after selecting indicators:', e)

        time.sleep(2)
        take_screenshot(page, 'after_indicators.png')

        # Verification checks
        print('\n=== Verification Results ===')
        checks_passed = []
        checks_failed = []

        # Check 1: Sidebar Real-Time Stock Prices
        try:
            sidebar_stocks = ['AAPL', 'GOOGL', 'AMZN', 'MSFT']
            for stock in sidebar_stocks:
                if page.locator(f'text={stock}').count() > 0:
                    checks_passed.append(f'Sidebar shows {stock} price')
                else:
                    checks_failed.append(f'Sidebar missing {stock} price')
        except Exception as e:
            checks_failed.append(f'Sidebar check error: {e}')

        # Check 2: Last Price metric
        try:
            if page.locator('text=Last Price').count() > 0:
                checks_passed.append('Last Price metric displayed')
            else:
                checks_failed.append('Last Price metric not found')
        except Exception:
            checks_failed.append('Last Price check failed')

        # Check 3: High/Low/Volume metrics
        try:
            if page.locator('text=High').count() > 0:
                checks_passed.append('High metric displayed')
            if page.locator('text=Low').count() > 0:
                checks_passed.append('Low metric displayed')
            if page.locator('text=Volume').count() > 0:
                checks_passed.append('Volume metric displayed')
        except Exception as e:
            checks_failed.append(f'Price metrics check error: {e}')

        # Check 4: Chart presence (Plotly container)
        try:
            plotly_chart = page.locator('.js-plotly-plot').count()
            if plotly_chart > 0:
                checks_passed.append(f'Found {plotly_chart} Plotly chart(s)')
            else:
                checks_failed.append('No Plotly charts found')
        except Exception as e:
            checks_failed.append(f'Chart check error: {e}')

        # Check 5: Historical Data table
        try:
            if page.locator('text=Historical Data').count() > 0:
                checks_passed.append('Historical Data table section present')
            else:
                checks_failed.append('Historical Data table not found')
        except Exception:
            checks_failed.append('Historical Data check failed')

        # Check 6: Technical Indicators table
        try:
            if page.locator('text=Technical Indicators').count() > 0:
                checks_passed.append('Technical Indicators table section present')
            else:
                checks_failed.append('Technical Indicators table not found')
        except Exception:
            checks_failed.append('Technical Indicators table check failed')

        # Print results
        print(f'\n✅ Passed ({len(checks_passed)}):')
        for check in checks_passed:
            print(f'  - {check}')

        if checks_failed:
            print(f'\n❌ Failed ({len(checks_failed)}):')
            for check in checks_failed:
                print(f'  - {check}')

        print(f'\n📊 Summary: {len(checks_passed)}/{len(checks_passed) + len(checks_failed)} checks passed')
        print('===========================\n')

        print('Test finished; closing browser in 3s')
        time.sleep(3)
        browser.close()

        return len(checks_failed) == 0


if __name__ == '__main__':
    os.makedirs('artifacts', exist_ok=True)
    success = run_test()
    exit(0 if success else 1)
