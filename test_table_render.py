import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        await page.goto("http://localhost:8000")
        await page.wait_for_timeout(3000)

        # Mock currentFolioReservation and sample folio transactions
        await page.evaluate("""() => {
            currentFolioReservation = {
                id: '00000000-0000-0000-0000-000000000000',
                reservation_number: 'TEST-REVAMP',
                room_rate: 500000,
                check_in: '2026-03-01',
                check_out: '2026-03-03'
            };
            currentFolioTransactions = [
                {
                    id: '1',
                    transaction_type: 'CHARGE',
                    description: 'Extrabed',
                    category: 'Front Office',
                    qty: 2,
                    unit_price: 150000,
                    amount: 300000,
                    transaction_date: '2026-03-01T10:00:00Z'
                },
                {
                    id: '2',
                    transaction_type: 'CHARGE',
                    description: 'Room Service Pizza',
                    category: 'F&B',
                    qty: 1,
                    unit_price: 85000,
                    amount: 85000,
                    transaction_date: '2026-03-01T12:30:00Z'
                },
                {
                    id: '3',
                    transaction_type: 'PAYMENT',
                    description: '[QRIS] Room payment',
                    reference_number: 'QRIS-99211',
                    amount: 385000,
                    transaction_date: '2026-03-01T14:00:00Z'
                }
            ];
            document.getElementById('folioHeaderGuestName').textContent = 'Jules Tester';
            document.getElementById('folioModal').classList.remove('hidden');
            renderFolioTransactions();
        }""")
        await page.wait_for_timeout(1000)
        await page.screenshot(path="screenshot_folio_table_rendered.png")

        tbody_html = await page.locator("#folioTransactionsTbody").inner_html()
        print("Rendered Tbody Rows:\n", tbody_html)

        balance_text = await page.locator("#folioCurrentBalance").text_content()
        print("Calculated Balance Text:", balance_text)

        await browser.close()

asyncio.run(run())
