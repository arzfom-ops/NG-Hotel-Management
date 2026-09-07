import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        await page.goto("http://localhost:8000")
        await page.wait_for_timeout(3000)

        # Mock currentFolioReservation and open folio modal
        await page.evaluate("""() => {
            currentFolioReservation = {
                id: '00000000-0000-0000-0000-000000000000',
                reservation_number: 'TEST-REVAMP',
                room_rate: 500000,
                check_in: '2026-03-01',
                check_out: '2026-03-03'
            };
            document.getElementById('folioHeaderGuestName').textContent = 'Jules Tester';
            document.getElementById('folioModal').classList.remove('hidden');
            fetchFolioTransactions('00000000-0000-0000-0000-000000000000');
        }""")
        await page.wait_for_timeout(1500)

        # Open Add Charge Modal
        await page.click("button:has-text('+ Add Charge')")
        await page.wait_for_timeout(1500)

        # Check values in Add Charge modal when master item selected
        price_val = await page.locator("#folio-tx-unit-price").input_value()
        amount_val = await page.locator("#folio-tx-amount").input_value()
        is_readonly = not await page.locator("#folio-tx-unit-price").is_editable()
        print(f"Master Item -> Unit Price: {price_val}, Total Amount: {amount_val}, Unit Price Locked (Readonly): {is_readonly}")

        # Change Qty to 3
        await page.fill("#folio-tx-qty", "3")
        amount_val_3 = await page.locator("#folio-tx-amount").input_value()
        print(f"Qty 3 -> Total Amount: {amount_val_3}")

        # Switch to Custom Entry
        await page.select_option("#folio-tx-charge-item", "custom")
        await page.wait_for_timeout(500)

        custom_desc_visible = await page.locator("#folio-tx-custom-desc-container").is_visible()
        category_visible = await page.locator("#folio-tx-category-container").is_visible()
        unit_price_editable = await page.locator("#folio-tx-unit-price").is_editable()
        print(f"Custom Entry -> Desc Visible: {custom_desc_visible}, Category Visible: {category_visible}, Unit Price Editable: {unit_price_editable}")

        # Close transaction modal
        await page.click("#folioTransactionForm button:has-text('Cancel')")
        await page.wait_for_timeout(500)

        # Open Add Payment Modal
        await page.click("button:has-text('+ Add Payment')")
        await page.wait_for_timeout(1500)
        await page.screenshot(path="screenshot_folio_add_payment_modal.png")

        desc_visible = await page.locator("#folio-tx-desc-container").is_visible()
        pm_visible = await page.locator("#folio-tx-payment-method-container").is_visible()
        ref_visible = await page.locator("#folio-tx-ref-container").is_visible()
        charge_item_visible = await page.locator("#folio-tx-charge-item-container").is_visible()
        print(f"Payment Modal -> Desc Visible: {desc_visible}, PM Visible: {pm_visible}, Ref Visible: {ref_visible}, Charge Item Hidden: {not charge_item_visible}")

        await page.click("#folioTransactionForm button:has-text('Cancel')")
        await page.wait_for_timeout(500)

        await browser.close()

asyncio.run(run())
