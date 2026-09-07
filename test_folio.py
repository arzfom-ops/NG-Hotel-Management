import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        await page.goto("http://localhost:8000")
        await page.wait_for_timeout(3000)

        # Let's see if there is any reservation capsule on the tape chart
        capsules = await page.locator(".reservation-capsule").all()
        print(f"Found {len(capsules)} reservation capsules")

        if len(capsules) > 0:
            await capsules[0].click()
            await page.wait_for_timeout(1000)

            # Click Open Folio button if reservation modal is open
            folio_btn = page.locator("button:has-text('Open Folio')")
            if await folio_btn.is_visible():
                await folio_btn.click()
                await page.wait_for_timeout(1000)
        else:
            # Open directly via JS if needed
            await page.evaluate("""() => {
                if (window.roomsCache && window.roomsCache.length) {
                    // simulate opening folio for a test reservation
                    currentFolioReservation = { id: 'test-res-1', reservation_number: 'RES123', room_rate: 300000 };
                    document.getElementById('folioHeaderGuestName').textContent = 'Test Guest';
                    document.getElementById('folioModal').classList.remove('hidden');
                    fetchFolioTransactions('test-res-1');
                }
            }""")
            await page.wait_for_timeout(1000)

        await page.screenshot(path="screenshot_folio_revamped_modal.png")

        # Click + Add Charge
        add_charge_btn = page.locator("button:has-text('+ Add Charge')")
        if await add_charge_btn.is_visible():
            await add_charge_btn.click()
            await page.wait_for_timeout(1500)
            await page.screenshot(path="screenshot_folio_add_charge_modal.png")

            # Check charge options
            charge_select = page.locator("#folio-tx-charge-item")
            options = await charge_select.locator("option").all_inner_texts()
            print("Charge select options:", options)

            # Select 'custom'
            await charge_select.select_option("custom")
            await page.wait_for_timeout(500)
            await page.screenshot(path="screenshot_folio_custom_charge.png")

        await browser.close()

asyncio.run(run())
