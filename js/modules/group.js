import { supabaseClient } from '../config/supabase.js';
import { formatDateISO, formatStayDatesCompact, showToast } from '../utils/formatters.js';

// Module State & Variables
export let activeGroupSplitData = null;
export let activeFitSplitData = null;
export let editingGroupId = null;

// activeGroupSplitData handled at top
// activeFitSplitData handled at top

        export async function openFitSplitReservationModal(reservationId) {
            try {
                const { data: res, error } = await supabaseClient
                    .from('reservations')
                    .select('*, guest_profiles(full_name), room_types(name)')
                    .eq('id', reservationId)
                    .single();

                if (error || !res) {
                    alert('Gagal mengambil data reservasi.');
                    return;
                }

                const qty = parseInt(res.qty || 1, 10);
                if (qty <= 1) {
                    alert('Reservasi ini hanya memiliki 1 kamar, tidak dapat di-split.');
                    return;
                }

                const originalGuestName = (res.guest_profiles ? (Array.isArray(res.guest_profiles) ? res.guest_profiles[0]?.full_name : res.guest_profiles.full_name) : null) || res.booker_name || 'Tamu';
                const rtName = res.room_types ? (Array.isArray(res.room_types) ? res.room_types[0]?.name : res.room_types.name) : 'Kamar';
                const stayFmt = formatStayDatesCompact(res.check_in_date, res.check_out_date);

                activeFitSplitData = {
                    reservation: res,
                    originalGuestName: originalGuestName,
                    qty: qty
                };
                activeGroupSplitData = null;

                // Render Info Card
                const infoCard = document.getElementById('roomingListInfoCard');
                if (infoCard) {
                    infoCard.innerHTML = `
                        <div>
                            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">No. Reservasi</span>
                            <span class="text-sm font-bold text-slate-800">${res.reservation_number || res.id.slice(0, 8)}</span>
                        </div>
                        <div>
                            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Sumber Reservasi</span>
                            <span class="text-sm font-semibold text-slate-700">${res.reservation_source || 'Direct'}</span>
                        </div>
                        <div>
                            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Tanggal Inap</span>
                            <span class="text-sm font-semibold text-slate-700">${stayFmt}</span>
                        </div>
                        <div>
                            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Jumlah Kamar</span>
                            <span class="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded font-bold text-xs">${qty} Kamar</span>
                        </div>
                    `;
                }

                // Render Rooming Rows Table
                const rowsTbody = document.getElementById('rooming-list-rows');
                if (rowsTbody) {
                    const rows = [];
                    const rateFmt = Number(res.room_rate || 0).toLocaleString('id-ID');

                    for (let i = 0; i < qty; i++) {
                        const defaultName = i === 0 ? originalGuestName : `TBA - ${originalGuestName} ${i + 1}`;
                        rows.push(`
                            <tr class="rooming-row" data-index="${i}">
                                <td class="py-2.5 px-3 text-center font-bold text-slate-500">${i + 1}</td>
                                <td class="py-2.5 px-3 font-semibold text-slate-800">${rtName}</td>
                                <td class="py-2.5 px-3 font-mono text-slate-700">Rp ${rateFmt}</td>
                                <td class="py-2.5 px-3">
                                    <input type="text" required class="rooming-guest-name w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs font-medium focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600" value="${defaultName}">
                                </td>
                            </tr>
                        `);
                    }
                    rowsTbody.innerHTML = rows.join('');
                }

                const modal = document.getElementById('roomingListModal');
                if (modal) modal.classList.remove('hidden');

            } catch (err) {
                console.error('Error opening FIT split reservation modal:', err);
                alert('Terjadi kesalahan: ' + err.message);
            }
        }

        export async function openSplitReservationModal(groupId) {
            try {
                const { data: gbData, error: gbErr } = await supabaseClient
                    .from('group_bookings')
                    .select('*, corporate_profiles(company_name), group_allotments(*, room_types(name))')
                    .eq('id', groupId)
                    .single();

                if (gbErr || !gbData) {
                    alert('Gagal mengambil data Group Booking.');
                    return;
                }

                let checkInDate = formatDateISO(new Date());
                let checkOutDate = formatDateISO(new Date(Date.now() + 86400000));
                try {
                    if (gbData.contact_person && gbData.contact_person.startsWith('{')) {
                        const cpObj = JSON.parse(gbData.contact_person);
                        checkInDate = cpObj.check_in_date || checkInDate;
                        checkOutDate = cpObj.check_out_date || checkOutDate;
                    }
                } catch (e) {}

                // Expand allotments into individual rooming list items
                const allotments = gbData.group_allotments || [];
                const items = [];

                allotments.forEach(a => {
                    const rtName = a.room_types ? (Array.isArray(a.room_types) ? a.room_types[0]?.name : a.room_types.name) : 'Kamar';
                    const qty = a.blocked_qty || 0;
                    for (let i = 0; i < qty; i++) {
                        items.push({
                            room_type_id: a.room_type_id,
                            room_type_name: rtName,
                            agreed_rate: a.agreed_rate || 0
                        });
                    }
                });

                if (items.length === 0) {
                    alert('Group Booking ini tidak memiliki alokasi room allotment.');
                    return;
                }

                // Fetch physical rooms & check availability for stay dates
                let roomsData = window.roomsCache || [];
                if (!roomsData || roomsData.length === 0) {
                    const { data: fetchR } = await supabaseClient
                        .from('rooms')
                        .select('id, room_number, status, room_type_id, is_virtual');
                    roomsData = fetchR || [];
                }

                // Query overlapping active reservations
                const { data: activeRes } = await supabaseClient
                    .from('reservations')
                    .select('room_id')
                    .not('room_id', 'is', null)
                    .neq('status', 'Cancelled')
                    .neq('status', 'Checkout')
                    .neq('status', 'CHECKED_OUT')
                    .lt('check_in_date', checkOutDate)
                    .gt('check_out_date', checkInDate);

                const occupiedRoomIds = new Set((activeRes || []).map(r => r.room_id));

                // Query overlapping room blocks
                const { data: activeBlocks } = await supabaseClient
                    .from('room_blocks')
                    .select('room_id')
                    .lte('start_date', checkOutDate)
                    .gte('end_date', checkInDate);

                const blockedRoomIds = new Set((activeBlocks || []).map(b => b.room_id));

                // Physical rooms filtering out virtual / PM- rooms, occupied, or blocked
                const physicalRooms = roomsData.filter(r => {
                    if (r.is_virtual) return false;
                    if (r.room_number && String(r.room_number).toUpperCase().startsWith('PM-')) return false;
                    const statusUpper = (r.status || '').toUpperCase();
                    if (statusUpper === 'OOO' || statusUpper === 'OUT OF ORDER') return false;
                    if (occupiedRoomIds.has(r.id) || blockedRoomIds.has(r.id)) return false;
                    return true;
                });

                activeGroupSplitData = {
                    group: gbData,
                    checkInDate: checkInDate,
                    checkOutDate: checkOutDate,
                    items: items,
                    availableRooms: physicalRooms
                };
                activeFitSplitData = null;

                // Render Info Card
                const corpName = gbData.corporate_profiles ? (Array.isArray(gbData.corporate_profiles) ? gbData.corporate_profiles[0]?.company_name : gbData.corporate_profiles.company_name) : '-';
                const stayFmt = formatStayDatesCompact(checkInDate, checkOutDate);
                const infoCard = document.getElementById('roomingListInfoCard');
                if (infoCard) {
                    infoCard.innerHTML = `
                        <div>
                            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Grup Booking</span>
                            <span class="text-sm font-bold text-slate-800">${gbData.group_name}</span>
                        </div>
                        <div>
                            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Bill Receiver</span>
                            <span class="text-sm font-semibold text-slate-700">${corpName}</span>
                        </div>
                        <div>
                            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Tanggal Inap</span>
                            <span class="text-sm font-semibold text-slate-700">${stayFmt}</span>
                        </div>
                        <div>
                            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Kuota</span>
                            <span class="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded font-bold text-xs">${items.length} Kamar</span>
                        </div>
                    `;
                }

                // Render Rooming Rows Table
                const rowsTbody = document.getElementById('rooming-list-rows');
                if (rowsTbody) {
                    rowsTbody.innerHTML = items.map((item, idx) => {
                        const defaultTbaName = `${gbData.group_name} - Guest ${idx + 1}`;
                        const matchingRooms = physicalRooms.filter(r => r.room_type_id === item.room_type_id);

                        let roomOptions = `<option value="">Belum Dialokasikan</option>`;
                        matchingRooms.forEach(r => {
                            roomOptions += `<option value="${r.id}">Kamar ${r.room_number}</option>`;
                        });

                        return `
                            <tr class="rooming-row" data-rt-id="${item.room_type_id}">
                                <td class="py-2.5 px-3 text-center font-bold text-slate-500">${idx + 1}</td>
                                <td class="py-2.5 px-3 font-semibold text-slate-800">${item.room_type_name}</td>
                                <td class="py-2.5 px-3">
                                    <select onchange="updateRoomingListDropdowns()" class="rooming-room-id w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs font-medium focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600">
                                        ${roomOptions}
                                    </select>
                                </td>
                                <td class="py-2.5 px-3">
                                    <input type="text" required class="rooming-guest-name w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs font-medium focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600" value="${defaultTbaName}">
                                </td>
                                <td class="py-2.5 px-3">
                                    <input type="number" min="0" step="1000" required class="rooming-rate w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs font-medium font-mono focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600" value="${item.agreed_rate}">
                                </td>
                            </tr>
                        `;
                    }).join('');

                    updateRoomingListDropdowns();
                }

                const modal = document.getElementById('roomingListModal');
                if (modal) modal.classList.remove('hidden');

            } catch (err) {
                console.error('Error opening split reservation modal:', err);
                alert('Terjadi kesalahan: ' + err.message);
            }
        }

        export function updateRoomingListDropdowns() {
            const selects = document.querySelectorAll('#rooming-list-rows select.rooming-room-id');
            if (!selects || selects.length === 0) return;

            const selectedRoomIds = new Set();
            selects.forEach(sel => {
                if (sel.value) {
                    selectedRoomIds.add(sel.value);
                }
            });

            selects.forEach(sel => {
                const currentVal = sel.value;
                Array.from(sel.options).forEach(opt => {
                    if (!opt.value) {
                        opt.disabled = false;
                    } else if (opt.value === currentVal) {
                        opt.disabled = false;
                    } else if (selectedRoomIds.has(opt.value)) {
                        opt.disabled = true;
                    } else {
                        opt.disabled = false;
                    }
                });
            });
        }

        export function closeRoomingListModal() {
            const modal = document.getElementById('roomingListModal');
            if (modal) modal.classList.add('hidden');
            activeGroupSplitData = null;
            activeFitSplitData = null;
        }

        export async function handleSaveRoomingList(e) {
            e.preventDefault();

            if (!activeGroupSplitData && !activeFitSplitData) return;

            const rowElements = document.querySelectorAll('#rooming-list-rows tr.rooming-row');
            if (!rowElements || rowElements.length === 0) return;

            // Handle Individual / FIT Reservation Split
            if (activeFitSplitData) {
                const origRes = activeFitSplitData.reservation;
                const bookingRef = (origRes.booking_reference && origRes.booking_reference.trim() !== '')
                    ? origRes.booking_reference.trim()
                    : ('REF-' + Date.now().toString().slice(-6) + Math.floor(100 + Math.random() * 900));

                try {
                    for (let i = 0; i < rowElements.length; i++) {
                        const tr = rowElements[i];
                        const nameInput = tr.querySelector('.rooming-guest-name');
                        const guestName = nameInput ? nameInput.value.trim() : (i === 0 ? activeFitSplitData.originalGuestName : `TBA - ${activeFitSplitData.originalGuestName} ${i + 1}`);

                        if (i === 0) {
                            // Row 1: Update original reservation and guest profile if needed
                            if (origRes.guest_profile_id) {
                                await supabaseClient
                                    .from('guest_profiles')
                                    .update({ full_name: guestName })
                                    .eq('id', origRes.guest_profile_id);
                            } else {
                                const { data: newG, error: newGErr } = await supabaseClient
                                    .from('guest_profiles')
                                    .insert([{ full_name: guestName }])
                                    .select();
                                if (!newGErr && newG && newG.length > 0) {
                                    await supabaseClient
                                        .from('reservations')
                                        .update({ guest_profile_id: newG[0].id })
                                        .eq('id', origRes.id);
                                }
                            }

                            const { error: updateErr } = await supabaseClient
                                .from('reservations')
                                .update({
                                    qty: 1,
                                    booking_reference: bookingRef
                                })
                                .eq('id', origRes.id);

                            if (updateErr) throw updateErr;
                        } else {
                            // Row 2+: Insert new guest profile and new reservation
                            const { data: gData, error: gErr } = await supabaseClient
                                .from('guest_profiles')
                                .insert([{ full_name: guestName }])
                                .select();

                            if (gErr) throw gErr;
                            if (!gData || gData.length === 0) throw new Error('Gagal membuat profil tamu.');

                            const guestProfileId = gData[0].id;
                            const resNo = 'RES-' + Date.now().toString().slice(-6) + Math.floor(100 + Math.random() * 900);

                            const newResPayload = {
                                reservation_number: resNo,
                                booking_reference: bookingRef,
                                check_in_date: origRes.check_in_date,
                                check_out_date: origRes.check_out_date,
                                nights: origRes.nights || 1,
                                adult: origRes.adult || 1,
                                child: origRes.child || 0,
                                room_type_id: origRes.room_type_id,
                                room_id: null,
                                rate_plan_id: origRes.rate_plan_id || null,
                                room_rate: origRes.room_rate || 0,
                                qty: 1,
                                extrabed_qty: origRes.extrabed_qty || 0,
                                meal_plan_id: origRes.meal_plan_id || null,
                                segment_id: origRes.segment_id || null,
                                reservation_source: origRes.reservation_source || 'Direct',
                                voucher_number: origRes.voucher_number || null,
                                corporate_id: origRes.corporate_id || null,
                                booker_name: origRes.booker_name || guestName,
                                guest_profile_id: guestProfileId,
                                status: origRes.status || 'Reserved',
                                guest_type: origRes.guest_type || 'Staying Guest'
                            };

                            const { error: insertErr } = await supabaseClient
                                .from('reservations')
                                .insert([newResPayload]);

                            if (insertErr) throw insertErr;
                        }
                    }

                    alert(`Berhasil memecah reservasi menjadi ${rowElements.length} reservasi individual dengan Booking Reference: ${bookingRef}!`);
                    closeRoomingListModal();
                    await fetchFrontdeskDashboard();
                    if (typeof renderTapeChart === 'function') await renderTapeChart();

                } catch (err) {
                    console.error('Error saving FIT split reservations:', err);
                    alert('Gagal menyimpan split reservasi: ' + (err.message || err));
                }
                return;
            }

            // Handle Group Booking Split
            // Validasi Anti-Duplikasi Kamar Fisik sebelum simpan
            const selectedRoomIds = [];
            const roomMap = {};

            rowElements.forEach(tr => {
                const roomSelect = tr.querySelector('.rooming-room-id');
                if (roomSelect && roomSelect.value) {
                    const roomId = roomSelect.value;
                    const optText = roomSelect.options[roomSelect.selectedIndex]?.text || '';
                    const roomNum = optText.replace(/^Kamar\s*/i, '').trim() || roomId;
                    selectedRoomIds.push(roomId);
                    roomMap[roomId] = roomNum;
                }
            });

            const seenRooms = new Set();
            let duplicateRoomNum = null;
            for (const rId of selectedRoomIds) {
                if (seenRooms.has(rId)) {
                    duplicateRoomNum = roomMap[rId] || rId;
                    break;
                }
                seenRooms.add(rId);
            }

            if (duplicateRoomNum) {
                const warnMsg = `Kamar ${duplicateRoomNum} dipilih lebih dari satu kali. Setiap baris harus menggunakan kamar yang berbeda.`;
                showToast(warnMsg, 'error');
                return;
            }

            // Calculate stay nights
            const checkIn = new Date(activeGroupSplitData.checkInDate);
            const checkOut = new Date(activeGroupSplitData.checkOutDate);
            let nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
            if (nights <= 0) nights = 1;

            try {
                for (let i = 0; i < rowElements.length; i++) {
                    const tr = rowElements[i];
                    const roomSelect = tr.querySelector('.rooming-room-id');
                    const nameInput = tr.querySelector('.rooming-guest-name');
                    const rateInput = tr.querySelector('.rooming-rate');

                    const roomId = roomSelect && roomSelect.value ? roomSelect.value : null;
                    const guestName = nameInput && nameInput.value.trim() ? nameInput.value.trim() : `${activeGroupSplitData.group.group_name} - Guest ${i + 1}`;
                    const roomRate = rateInput && parseFloat(rateInput.value) >= 0 ? parseFloat(rateInput.value) : 0;
                    const rtId = tr.getAttribute('data-rt-id');

                    // a) Insert new guest profile in guest_profiles
                    const { data: gData, error: gErr } = await supabaseClient
                        .from('guest_profiles')
                        .insert([{ full_name: guestName }])
                        .select();

                    if (gErr) throw gErr;
                    if (!gData || gData.length === 0) throw new Error('Gagal membuat profil tamu.');

                    const guestProfileId = gData[0].id;

                    // b) Insert new reservation in reservations with parent_reservation_id and status GUARANTEED
                    const resNo = 'RES-' + Date.now().toString().slice(-6) + Math.floor(100 + Math.random() * 900);
                    const resPayload = {
                        reservation_number: resNo,
                        check_in_date: activeGroupSplitData.checkInDate,
                        check_out_date: activeGroupSplitData.checkOutDate,
                        nights: nights,
                        room_type_id: rtId,
                        room_id: roomId,
                        room_rate: roomRate,
                        qty: 1,
                        status: 'GUARANTEED',
                        guest_profile_id: guestProfileId,
                        booker_name: activeGroupSplitData.group.group_name,
                        group_id: activeGroupSplitData.group.id,
                        group_booking_id: activeGroupSplitData.group.id,
                        parent_reservation_id: null,
                        corporate_id: activeGroupSplitData.group.corporate_id || null,
                        reservation_source: 'Walk-in',
                        guest_type: 'Staying Guest'
                    };

                    const { error: rErr } = await supabaseClient
                        .from('reservations')
                        .insert([resPayload]);

                    if (rErr) throw rErr;
                }

                // c) Mark group_bookings status as 'SPLIT' / 'ASSIGNED'
                let cpObj = {};
                try {
                    if (activeGroupSplitData.group.contact_person && activeGroupSplitData.group.contact_person.startsWith('{')) {
                        cpObj = JSON.parse(activeGroupSplitData.group.contact_person);
                    }
                } catch (e) {}
                cpObj.status = 'SPLIT';
                const updatedContactPerson = JSON.stringify(cpObj);

                const { error: splitGbErr } = await supabaseClient
                    .from('group_bookings')
                    .update({
                        status: 'SPLIT',
                        contact_person: updatedContactPerson
                    })
                    .eq('id', activeGroupSplitData.group.id);

                if (splitGbErr) {
                    await supabaseClient
                        .from('group_bookings')
                        .update({ contact_person: updatedContactPerson })
                        .eq('id', activeGroupSplitData.group.id);
                }

                alert(`Berhasil memecah kuota grup "${activeGroupSplitData.group.group_name}" menjadi ${rowElements.length} reservasi kamar!`);
                closeRoomingListModal();
                await fetchFrontdeskDashboard();
                if (typeof renderTapeChart === 'function') await renderTapeChart();
                if (typeof renderRoomForecast === 'function') await renderRoomForecast();

            } catch (err) {
                console.error('Error saving rooming list reservations:', err);
                alert('Gagal menyimpan rooming list: ' + (err.message || err));
            }
        }

        // GROUP BOOKING FUNCTIONS
        // ==========================================
// editingGroupId handled at top

        export async function openGroupBookingModal() {
            editingGroupId = null;
            const modal = document.getElementById('groupBookingModal');
            if (!modal) return;

            const modalTitle = modal.querySelector('h3 span');
            if (modalTitle) modalTitle.textContent = '+ New Group Reservation';

            document.getElementById('group-name').value = '';

            const todayStr = formatDateISO(new Date());
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = formatDateISO(tomorrow);

            document.getElementById('group-checkin').value = todayStr;
            document.getElementById('group-checkout').value = tomorrowStr;

            await populateGroupCorporateDropdown();

            const rowsContainer = document.getElementById('group-allotment-rows');
            if (rowsContainer) {
                rowsContainer.innerHTML = '';
                await addGroupAllotmentRow();
            }

            modal.classList.remove('hidden');
        }

        export async function openEditGroupBookingModal(groupId) {
            editingGroupId = groupId;
            const modal = document.getElementById('groupBookingModal');
            if (!modal) return;

            const modalTitle = modal.querySelector('h3 span');
            if (modalTitle) modalTitle.textContent = 'Edit Group Reservation';

            try {
                const { data: gb, error: gbErr } = await supabaseClient
                    .from('group_bookings')
                    .select('*, group_allotments(*)')
                    .eq('id', groupId)
                    .single();

                if (gbErr || !gb) {
                    alert('Gagal memuat data grup booking.');
                    return;
                }

                document.getElementById('group-name').value = gb.group_name || '';

                let checkInVal = formatDateISO(new Date());
                let checkOutVal = formatDateISO(new Date(Date.now() + 86400000));

                if (gb.contact_person && gb.contact_person.startsWith('{')) {
                    try {
                        const cpObj = JSON.parse(gb.contact_person);
                        checkInVal = cpObj.check_in_date || checkInVal;
                        checkOutVal = cpObj.check_out_date || checkOutVal;
                    } catch (e) {}
                }

                document.getElementById('group-checkin').value = checkInVal;
                document.getElementById('group-checkout').value = checkOutVal;

                await populateGroupCorporateDropdown(gb.corporate_id);

                const rowsContainer = document.getElementById('group-allotment-rows');
                if (rowsContainer) {
                    rowsContainer.innerHTML = '';
                    const allotments = gb.group_allotments || [];
                    if (allotments.length > 0) {
                        for (const alt of allotments) {
                            await addGroupAllotmentRow(alt.room_type_id, alt.blocked_qty, alt.agreed_rate);
                        }
                    } else {
                        await addGroupAllotmentRow();
                    }
                }

                modal.classList.remove('hidden');

            } catch (err) {
                console.error('Error opening edit group booking modal:', err);
                alert('Gagal memuat data grup: ' + (err.message || err));
            }
        }

        export async function populateGroupCorporateDropdown(selectedCorpId = null) {
            const corpSelect = document.getElementById('group-corporate-id');
            if (!corpSelect) return;
            corpSelect.innerHTML = '<option value="">-- Pilih Corporate (Opsional) --</option>';
            try {
                const { data: cProfiles } = await supabaseClient.from('corporate_profiles').select('id, company_name').order('company_name', { ascending: true });
                if (cProfiles && cProfiles.length > 0) {
                    cProfiles.forEach(c => {
                        const opt = document.createElement('option');
                        opt.value = c.id;
                        opt.textContent = c.company_name;
                        if (selectedCorpId && c.id === selectedCorpId) {
                            opt.selected = true;
                        }
                        corpSelect.appendChild(opt);
                    });
                }
            } catch (e) {
                console.error('Error populating corporate profiles for group:', e);
            }
        }

        export function closeGroupBookingModal() {
            editingGroupId = null;
            const modal = document.getElementById('groupBookingModal');
            if (modal) modal.classList.add('hidden');
        }

        export async function addGroupAllotmentRow(selectedRoomTypeId = null, initialQty = 1, initialRate = null) {
            const rowsContainer = document.getElementById('group-allotment-rows');
            if (!rowsContainer) return;

            let roomTypes = [];
            try {
                const { data } = await supabaseClient.from('room_types').select('id, name, base_price').order('name', { ascending: true });
                roomTypes = data || [];
            } catch (e) {
                console.error('Error fetching room types for group allotment:', e);
            }

            const tr = document.createElement('tr');
            tr.className = 'group-allotment-item';

            let typeOptionsHTML = roomTypes.map(rt => {
                const isSel = selectedRoomTypeId && rt.id === selectedRoomTypeId ? 'selected' : '';
                return `<option value="${rt.id}" data-price="${rt.base_price}" ${isSel}>${rt.name} - Rp ${Number(rt.base_price || 0).toLocaleString('id-ID')}</option>`;
            }).join('');

            const firstPrice = roomTypes.length > 0 ? (roomTypes[0].base_price || 0) : 0;
            const rateVal = initialRate !== null && initialRate !== undefined ? initialRate : firstPrice;

            tr.innerHTML = `
                <td class="py-2 px-3">
                    <select onchange="handleGroupRoomTypeChange(this)" class="group-room-type-id w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-primary">
                        ${typeOptionsHTML}
                    </select>
                </td>
                <td class="py-2 px-3">
                    <input type="number" min="1" value="${initialQty}" class="group-blocked-qty w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-primary">
                </td>
                <td class="py-2 px-3">
                    <input type="number" min="0" value="${rateVal}" class="group-agreed-rate w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-primary">
                </td>
                <td class="py-2 px-3 text-center">
                    <button type="button" onclick="removeGroupAllotmentRow(this)" class="p-1 text-slate-400 hover:text-red-600 transition-colors">
                        <i class="ph ph-trash text-base"></i>
                    </button>
                </td>
            `;

            rowsContainer.appendChild(tr);
        }

        export function handleGroupRoomTypeChange(selectEl) {
            const tr = selectEl.closest('tr');
            if (!tr) return;
            const selectedOpt = selectEl.options[selectEl.selectedIndex];
            if (selectedOpt) {
                const price = selectedOpt.getAttribute('data-price') || 0;
                const rateInput = tr.querySelector('.group-agreed-rate');
                if (rateInput) rateInput.value = price;
            }
        }

        export function removeGroupAllotmentRow(btn) {
            const tr = btn.closest('tr');
            const rowsContainer = document.getElementById('group-allotment-rows');
            if (rowsContainer && rowsContainer.children.length > 1) {
                if (tr) tr.remove();
            } else {
                alert('Group booking harus memiliki minimal 1 tipe kamar dalam Room Allotment.');
            }
        }

        export function closeGroupDepositErrorModal() {
            const modal = document.getElementById('groupDepositErrorModal');
            if (modal) modal.classList.add('hidden');
        }

        export async function handleCancelGroupBooking(groupId) {
            if (!groupId) return;

            try {
                // 1. Check if group has a master folio
                const { data: masterFolio } = await supabaseClient
                    .from('master_folios')
                    .select('id')
                    .eq('group_id', groupId)
                    .maybeSingle();

                let totalDeposit = 0;

                if (masterFolio && masterFolio.id) {
                    // Fetch payment transactions linked to this master folio
                    const { data: txs, error: txErr } = await supabaseClient
                        .from('folio_transactions')
                        .select('amount, transaction_type, is_voided')
                        .eq('master_folio_id', masterFolio.id);

                    if (txErr) throw txErr;

                    if (txs && txs.length > 0) {
                        txs.forEach(t => {
                            if (!t.is_voided) {
                                const type = (t.transaction_type || '').toUpperCase();
                                if (type === 'PAYMENT') {
                                    totalDeposit += Number(t.amount || 0);
                                }
                            }
                        });
                    }
                }

                // 2. Deposit check
                if (totalDeposit > 0) {
                    const errModal = document.getElementById('groupDepositErrorModal');
                    if (errModal) {
                        errModal.classList.remove('hidden');
                    } else {
                        alert('Grup tidak bisa dibatalkan karena memiliki deposit aktif. Harap buat akun Non-Stay Guest (NSG) dan pindahkan dana secara manual terlebih dahulu.');
                    }
                    return;
                }

                // 3. Confirmation for 0 deposit
                const confirmed = confirm('Yakin ingin membatalkan grup ini?');
                if (!confirmed) return;

                // 4. Execute Cancel
                // Update group_bookings
                let checkInVal = formatDateISO(new Date());
                let checkOutVal = formatDateISO(new Date(Date.now() + 86400000));

                const { data: gb } = await supabaseClient
                    .from('group_bookings')
                    .select('contact_person')
                    .eq('id', groupId)
                    .maybeSingle();

                if (gb && gb.contact_person && gb.contact_person.startsWith('{')) {
                    try {
                        const cpObj = JSON.parse(gb.contact_person);
                        checkInVal = cpObj.check_in_date || checkInVal;
                        checkOutVal = cpObj.check_out_date || checkOutVal;
                    } catch (e) {}
                }

                const updatedContactPerson = JSON.stringify({
                    check_in_date: checkInVal,
                    check_out_date: checkOutVal,
                    status: 'Cancelled'
                });

                const { error: cancelGbErr } = await supabaseClient
                    .from('group_bookings')
                    .update({
                        status: 'Cancelled',
                        contact_person: updatedContactPerson
                    })
                    .eq('id', groupId);

                if (cancelGbErr) {
                    // Fallback if status column does not exist
                    await supabaseClient
                        .from('group_bookings')
                        .update({ contact_person: updatedContactPerson })
                        .eq('id', groupId);
                }

                // Set blocked_qty = 0 in group_allotments
                const { error: cancelGaErr } = await supabaseClient
                    .from('group_allotments')
                    .update({ blocked_qty: 0 })
                    .eq('group_id', groupId);

                if (cancelGaErr) console.error('Error setting blocked_qty to 0:', cancelGaErr);

                alert('Group Booking berhasil dibatalkan!');
                switchGroupSubTab('cancel');
                await fetchFrontdeskDashboard();

            } catch (err) {
                console.error('Error cancelling group booking:', err);
                alert('Gagal membatalkan Group Booking: ' + (err.message || err));
            }
        }

        export async function handleSaveGroupBooking(e) {
            e.preventDefault();

            const groupName = document.getElementById('group-name').value.trim();
            const corporateId = document.getElementById('group-corporate-id').value || null;
            const checkIn = document.getElementById('group-checkin').value;
            const checkOut = document.getElementById('group-checkout').value;

            if (!groupName) {
                alert('Mohon isi Nama Grup.');
                return;
            }
            if (!checkIn || !checkOut) {
                alert('Mohon isi Tanggal Check-in dan Check-out.');
                return;
            }
            if (new Date(checkOut) <= new Date(checkIn)) {
                alert('Tanggal Check-out harus setelah Tanggal Check-in.');
                return;
            }

            // Collect Repeater rows
            const rowElements = document.querySelectorAll('#group-allotment-rows tr.group-allotment-item');
            const allotments = [];

            rowElements.forEach(tr => {
                const rtSelect = tr.querySelector('.group-room-type-id');
                const qtyInput = tr.querySelector('.group-blocked-qty');
                const rateInput = tr.querySelector('.group-agreed-rate');

                if (rtSelect && qtyInput && rateInput) {
                    const rtId = rtSelect.value;
                    const qty = parseInt(qtyInput.value, 10) || 0;
                    const rate = parseFloat(rateInput.value) || 0;

                    if (rtId && qty > 0) {
                        allotments.push({
                            room_type_id: rtId,
                            blocked_qty: qty,
                            agreed_rate: rate
                        });
                    }
                }
            });

            if (allotments.length === 0) {
                alert('Mohon masukkan minimal 1 Room Allotment dengan jumlah kamar > 0.');
                return;
            }

            try {
                if (editingGroupId) {
                    // EDIT MODE
                    let existingStatus = null;
                    const { data: existingGb } = await supabaseClient
                        .from('group_bookings')
                        .select('contact_person')
                        .eq('id', editingGroupId)
                        .maybeSingle();

                    if (existingGb && existingGb.contact_person && existingGb.contact_person.startsWith('{')) {
                        try {
                            const cpObj = JSON.parse(existingGb.contact_person);
                            if (cpObj.status) existingStatus = cpObj.status;
                        } catch (e) {}
                    }

                    const cpPayloadObj = { check_in_date: checkIn, check_out_date: checkOut };
                    if (existingStatus) cpPayloadObj.status = existingStatus;

                    // 1. Update group_bookings
                    const { error: updErr } = await supabaseClient
                        .from('group_bookings')
                        .update({
                            group_name: groupName,
                            corporate_id: corporateId,
                            contact_person: JSON.stringify(cpPayloadObj)
                        })
                        .eq('id', editingGroupId);

                    if (updErr) throw updErr;

                    // 2. Replace group_allotments
                    await supabaseClient.from('group_allotments').delete().eq('group_id', editingGroupId);

                    const allotmentPayloads = allotments.map(a => ({
                        group_id: editingGroupId,
                        room_type_id: a.room_type_id,
                        blocked_qty: a.blocked_qty,
                        agreed_rate: a.agreed_rate
                    }));

                    const { error: gaErr } = await supabaseClient
                        .from('group_allotments')
                        .insert(allotmentPayloads);

                    if (gaErr) throw gaErr;

                    alert(`Group Booking "${groupName}" berhasil diperbarui!`);
                } else {
                    // CREATE MODE
                    const contactPersonPayload = JSON.stringify({ check_in_date: checkIn, check_out_date: checkOut });

                    // 1. Insert group_bookings
                    const { data: gbData, error: gbErr } = await supabaseClient
                        .from('group_bookings')
                        .insert([{
                            group_name: groupName,
                            corporate_id: corporateId,
                            contact_person: contactPersonPayload
                        }])
                        .select();

                    if (gbErr) throw gbErr;
                    if (!gbData || gbData.length === 0) throw new Error('Gagal menyimpan data group booking.');

                    const newGroupId = gbData[0].id;

                    // 2. Insert group_allotments
                    const allotmentPayloads = allotments.map(a => ({
                        group_id: newGroupId,
                        room_type_id: a.room_type_id,
                        blocked_qty: a.blocked_qty,
                        agreed_rate: a.agreed_rate
                    }));

                    const { error: gaErr } = await supabaseClient
                        .from('group_allotments')
                        .insert(allotmentPayloads);

                    if (gaErr) throw gaErr;

                    alert(`Group Booking "${groupName}" berhasil disimpan!`);
                }

                closeGroupBookingModal();
                await fetchFrontdeskDashboard();

            } catch (err) {
                console.error('Error saving group booking:', err);
                alert('Gagal menyimpan Group Booking: ' + (err.message || err));
            }
        }


