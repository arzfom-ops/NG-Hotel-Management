import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(record_video_dir="/home/jules/verification/videos")
        page = await context.new_page()

        await page.goto("http://localhost:8000")
        await page.wait_for_timeout(500)

        # Mock reservation data with room_rate = 950000.00 and nights = 2
        await page.evaluate("""
            () => {
                const dummyRes = {
                    id: "test-res-123",
                    room_rate: "950000.00",
                    nights: 2,
                    booker_name: "John Doe",
                    reservation_number: "RES-950K",
                    folio_number: "FOL-950K"
                };
                window.currentFolioReservation = dummyRes;
                document.getElementById('folioModal').classList.remove('hidden');
                window.renderFolioModal(dummyRes);
            }
        """)

        await page.wait_for_timeout(1000)
        expected_text = await page.locator("#expected-total-amount").text_content()
        print(f"Rendered Expected Total: {expected_text}")

        await page.screenshot(path="/home/jules/verification/screenshots/expected_total_verification.png")
        await page.wait_for_timeout(1000)

        await context.close()
        await browser.close()

asyncio.run(run())
