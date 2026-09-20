import asyncio
from playwright.async_api import async_playwright

async def run_verification():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        await page.goto("http://localhost:8000")
        await page.wait_for_timeout(2500)

        print("=== STEP 1: Setting up multi-room parent/child test data ===")
        setup_result = await page.evaluate('''async () => {
            const client = window.supabaseClient;

            // 1. Get room IDs
            const { data: rooms } = await client.from('rooms').select('id, room_number').limit(5);
            if (!rooms || rooms.length < 2) return { error: 'Not enough rooms' };

            const room1 = rooms[0];
            const room2 = rooms[1];

            // 2. Create Parent Reservation
            const parentResNum = 'REV-MASTER-' + Date.now().toString().slice(-5);
            const { data: parentRes, error: pErr } = await client.from('reservations').insert([{
                reservation_number: parentResNum,
                booker_name: 'Bapak Ahmad Parent',
                check_in_date: '2026-09-20',
                check_out_date: '2026-09-22',
                nights: 2,
                room_id: room1.id,
                room_rate: 750000,
                status: 'Checkin',
                guest_type: 'Staying Guest'
            }]).select().single();

            if (pErr) return { error: pErr };

            // 3. Create Master Folio record
            const { data: masterFolio, error: mfErr } = await client.from('master_folios').insert([{
                folio_number: 'MFOL-' + Date.now().toString().slice(-6),
                booking_reference: parentResNum
            }]).select().single();

            if (mfErr) return { error: mfErr };

            // 4. Create Child Reservation
            const childResNum = `${parentResNum}-2`;
            const { data: childRes, error: cErr } = await client.from('reservations').insert([{
                reservation_number: childResNum,
                booker_name: 'Bapak Ahmad Child',
                parent_reservation_id: parentRes.id,
                booking_reference: parentResNum,
                check_in_date: '2026-09-20',
                check_out_date: '2026-09-22',
                nights: 2,
                room_id: room2.id,
                room_rate: 600000,
                status: 'Checkin',
                guest_type: 'Staying Guest'
            }]).select().single();

            if (cErr) return { error: cErr };

            // 5. Add a CHARGE on child reservation
            const { data: childCharge, error: chargeErr } = await client.from('folio_transactions').insert([{
                reservation_id: childRes.id,
                transaction_type: 'CHARGE',
                description: 'Resto Breakfast Item',
                amount: 150000,
                qty: 1,
                unit_price: 150000,
                category: 'F&B',
                transaction_date: new Date().toISOString()
            }]).select().single();

            return {
                parentRes,
                childRes,
                masterFolio,
                childCharge,
                room1Number: room1.room_number,
                room2Number: room2.room_number
            };
        }''')

        print("Setup Result:", setup_result)
        assert "error" not in setup_result, f"Setup failed: {setup_result.get('error')}"

        parent_id = setup_result["parentRes"]["id"]
        child_id = setup_result["childRes"]["id"]
        master_folio_id = setup_result["masterFolio"]["id"]
        child_charge_id = setup_result["childCharge"]["id"]
        room2_num = setup_result["room2Number"]

        print("\n=== STEP 2: Open Child Room Folio Modal & Verify Header Badge + Transfer Button ===")
        await page.evaluate(f"window.openFolioModal('{child_id}')")
        await page.wait_for_timeout(1000)

        badge_text = await page.locator("#childRoomMasterBadgeText").text_content()
        print(f"Child Room Indicator Badge: '{badge_text}'")
        assert "Terhubung ke Master Folio" in badge_text, f"Unexpected badge text: {badge_text}"

        # Tab Master button should be hidden for child room
        is_master_tab_visible = await page.locator("#folioTabBtnMaster").is_visible()
        print(f"Master Tab Visible for Child Room: {is_master_tab_visible}")
        assert not is_master_tab_visible, "Master tab should be hidden for child room"

        # Verify [ Transfer ke Master ] button exists in transaction table
        transfer_btn = page.locator("button:has-text('Transfer ke Master')")
        assert await transfer_btn.count() > 0, "Transfer ke Master button not found on child charge"
        print("Found [ Transfer ke Master ] button on child charge transaction.")

        await page.screenshot(path="screenshot_child_folio_modal.png")

        print("\n=== STEP 3: Click [ Transfer ke Master ] & Verify Instant Transfer ===")
        await transfer_btn.first.click()
        await page.wait_for_timeout(1500)

        # Child balance should now be 0 after transferring the charge
        child_bal = await page.locator("#folioCurrentBalance").text_content()
        print(f"Child Room Balance after transfer: '{child_bal}'")

        await page.click("button:has-text('Close')")
        await page.wait_for_timeout(500)

        print("\n=== STEP 4: Open Parent Room Folio Modal & Verify Tabs + Master Tab Content ===")
        await page.evaluate(f"window.openFolioModal('{parent_id}')")
        await page.wait_for_timeout(1000)

        # Tab 2 Master Folio button should be visible for parent
        is_master_tab_visible = await page.locator("#folioTabBtnMaster").is_visible()
        print(f"Master Tab Visible for Parent Room: {is_master_tab_visible}")
        assert is_master_tab_visible, "Master tab should be visible for parent room"

        # Click Tab 2: Master Folio
        await page.click("#folioTabBtnMaster")
        await page.wait_for_timeout(1500)

        resp_name = await page.locator("#masterTabResponsibleName").text_content()
        connected_rooms = await page.locator("#masterTabConnectedRooms").text_content()
        total_charges = await page.locator("#masterTabTotalCharge").text_content()
        balance = await page.locator("#masterTabBalance").text_content()

        print(f"Master Tab Penanggung Jawab: '{resp_name}'")
        print(f"Master Tab Connected Rooms: '{connected_rooms}'")
        print(f"Master Tab Total Charges: '{total_charges}'")
        print(f"Master Tab Balance: '{balance}'")

        # Verify Source Room column (Kamar Asal)
        master_tbody = await page.locator("#masterTabTransactionsTbody").inner_html()
        print(f"Master Table HTML contains Room {room2_num}: {f'Kamar {room2_num}' in master_tbody}")
        assert f"Kamar {room2_num}" in master_tbody, f"Source room Kamar {room2_num} not found in master transaction table"

        # Verify [ Kembalikan / Return ] button exists
        return_btn = page.locator("#masterTabTransactionsTbody button:has-text('Kembalikan / Return')")
        assert await return_btn.count() > 0, "Return button not found in Master Folio table"
        print("Found [ Kembalikan / Return ] button on transferred item in Master Folio.")

        await page.screenshot(path="screenshot_final_folio_verification.png")

        print("\n=== STEP 5: Click [ Kembalikan / Return ] & Verify Item Returned to Child Room ===")
        await return_btn.first.click()
        await page.wait_for_timeout(1500)

        master_bal_after = await page.locator("#masterTabBalance").text_content()
        print(f"Master Tab Balance after return: '{master_bal_after}'")

        # Switch back to Tab 1 (Folio Pribadi)
        await page.click("#folioTabBtnPribadi")
        await page.wait_for_timeout(500)

        await page.click("button:has-text('Close')")
        await page.wait_for_timeout(500)

        # Reopen Child Room Folio to verify charge is back
        await page.evaluate(f"window.openFolioModal('{child_id}')")
        await page.wait_for_timeout(1000)

        child_bal_after_return = await page.locator("#folioCurrentBalance").text_content()
        print(f"Child Room Balance after return: '{child_bal_after_return}'")
        assert "150" in child_bal_after_return or "150.000" in child_bal_after_return, f"Expected 150.000 in child balance, got {child_bal_after_return}"

        print("\nALL VERIFICATION TESTS PASSED SUCCESSFULLY!")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_verification())
