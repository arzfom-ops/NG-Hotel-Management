import { supabaseClient } from '../config/supabase.js';
import { formatDateISO, formatStayDatesCompact } from '../utils/formatters.js';

// State Variables
export let currentFolioReservation = null;
export let currentFolioTransactions = [];
export let calculatedCurrentBalance = 0;
export let currentMasterGroup = null;
export let currentMasterTransactions = [];
export let transferTargetReservationsCache = [];
export let folioRoutingAvailableArticles = [];
export let folioRoutingRulesState = [];
export let activeFolioTab = 'pribadi';

// ==========================================
// GUEST & MASTER FOLIO MODAL
// ==========================================

export async function switchFolioTab(tabName) {
    activeFolioTab = tabName || 'pribadi';

    const btnPribadi = document.getElementById('folioTabBtnPribadi');
    const btnMaster = document.getElementById('folioTabBtnMaster');
    const contentPribadi = document.getElementById('tabContentFolioPribadi');
    const contentMaster = document.getElementById('tabContentMasterFolio');

    const isMasterHidden = btnMaster ? btnMaster.classList.contains('hidden') : false;

    if (activeFolioTab === 'master') {
        if (btnPribadi) {
            btnPribadi.className = "px-5 py-2.5 text-xs font-bold rounded-t-lg border-b-2 border-transparent bg-slate-200/70 text-slate-600 hover:text-slate-900 flex items-center gap-2 transition-all";
        }
        if (btnMaster) {
            btnMaster.className = `px-5 py-2.5 text-xs font-bold rounded-t-lg border-b-2 border-indigo-600 bg-white text-indigo-900 shadow-xs flex items-center gap-2 transition-all ${isMasterHidden ? 'hidden' : ''}`.trim();
        }
        if (contentPribadi) contentPribadi.classList.add('hidden');
        if (contentMaster) contentMaster.classList.remove('hidden');

        let masterFolioId = currentFolioReservation?.master_folio_id || currentMasterGroup?.master_folio_id || currentMasterGroup?.id;
        if (!masterFolioId && currentFolioReservation) {
            masterFolioId = await getOrCreateMasterFolioId(currentFolioReservation);
        }
        if (masterFolioId) {
            await fetchMasterFolioDetails(masterFolioId);
        }
    } else { // 'pribadi'
        if (btnPribadi) {
            btnPribadi.className = "px-5 py-2.5 text-xs font-bold rounded-t-lg border-b-2 border-amber-500 bg-white text-slate-800 shadow-xs flex items-center gap-2 transition-all";
        }
        if (btnMaster) {
            btnMaster.className = `px-5 py-2.5 text-xs font-bold rounded-t-lg border-b-2 border-transparent bg-slate-200/70 text-slate-600 hover:text-slate-900 flex items-center gap-2 transition-all ${isMasterHidden ? 'hidden' : ''}`.trim();
        }
        if (contentPribadi) contentPribadi.classList.remove('hidden');
        if (contentMaster) contentMaster.classList.add('hidden');
    }
}

export async function getOrCreateMasterFolioId(res) {
    if (!res) return null;

    const groupId = res.group_id;
    let bookingRef = res.booking_reference;
    const parentResId = res.parent_reservation_id;

    if (groupId) {
        const { data } = await supabaseClient
            .from('master_folios')
            .select('id')
            .eq('group_id', groupId)
            .maybeSingle();
        if (data) return data.id;
    }

    if (bookingRef) {
        const { data } = await supabaseClient
            .from('master_folios')
            .select('id')
            .eq('booking_reference', bookingRef)
            .maybeSingle();
        if (data) return data.id;
    }

    if (parentResId) {
        const { data: parentRes } = await supabaseClient
            .from('reservations')
            .select('id, booking_reference, group_id')
            .eq('id', parentResId)
            .maybeSingle();

        if (parentRes) {
            if (parentRes.group_id) {
                const { data } = await supabaseClient
                    .from('master_folios')
                    .select('id')
                    .eq('group_id', parentRes.group_id)
                    .maybeSingle();
                if (data) return data.id;
            }
            if (parentRes.booking_reference) {
                const { data } = await supabaseClient
                    .from('master_folios')
                    .select('id')
                    .eq('booking_reference', parentRes.booking_reference)
                    .maybeSingle();
                if (data) return data.id;
                bookingRef = parentRes.booking_reference;
            }
        }
    }

    const refForMaster = bookingRef || res.reservation_number || res.id.slice(0, 8);
    const generatedFolioNo = 'MFOL-' + String(Date.now()).slice(-6);

    const { data: newMaster, error } = await supabaseClient
        .from('master_folios')
        .insert([{
            folio_number: generatedFolioNo,
            group_id: groupId || null,
            booking_reference: refForMaster || null
        }])
        .select()
        .single();

    if (!error && newMaster) {
        return newMaster.id;
    }

    return null;
}

export async function openFolioModal(reservationId) {
    const modal = document.getElementById('folioModal');
    if (!modal) return;

    modal.classList.remove('hidden');

    // Reset UI
    const headerGuestEl = document.getElementById('folioHeaderGuestName');
    const headerRoomEl = document.getElementById('folioHeaderRoomNo');
    const headerResNoEl = document.getElementById('folioHeaderResNo');
    const headerFolioEl = document.getElementById('folioHeaderFolioNo');
    const totalChargeEl = document.getElementById('folioTotalCharge');
    const totalPaymentEl = document.getElementById('folioTotalPayment');
    const currentBalanceEl = document.getElementById('folioCurrentBalance');

    if (headerGuestEl) headerGuestEl.textContent = 'Memuat...';
    if (headerRoomEl) headerRoomEl.innerHTML = `<i class="ph ph-bed"></i> Room: -`;
    if (headerResNoEl) headerResNoEl.innerHTML = `<i class="ph ph-hash"></i> Res #: -`;
    if (headerFolioEl) headerFolioEl.textContent = 'FOL-......';
    if (totalChargeEl) totalChargeEl.textContent = 'Rp 0';
    if (totalPaymentEl) totalPaymentEl.textContent = 'Rp 0';
    if (currentBalanceEl) currentBalanceEl.textContent = 'Rp 0';

    try {
        const { data: res, error } = await supabaseClient
            .from('reservations')
            .select('*, guest_profiles(*), room_types(*), rooms(*)')
            .eq('id', reservationId)
            .single();

        if (error) throw error;

        currentFolioReservation = res;

        // Render Guest & Room Info
        const guestName = res.guest_profiles ? res.guest_profiles.full_name : (res.booker_name || 'Guest');
        const roomNo = res.rooms ? res.rooms.room_number : '-';
        const resNo = res.reservation_number || res.id.slice(0, 8);
        const folioNo = res.folio_number || (`FOL-${resNo}`);

        if (headerGuestEl) headerGuestEl.textContent = guestName;
        if (headerRoomEl) headerRoomEl.innerHTML = `<i class="ph ph-bed"></i> Room: Kamar ${roomNo}`;
        if (headerResNoEl) headerResNoEl.innerHTML = `<i class="ph ph-hash"></i> Res #: ${resNo}`;
        if (headerFolioEl) headerFolioEl.textContent = folioNo;

        // Check if Child Room or Parent Room
        const isChildRoom = !!(res.parent_reservation_id && res.parent_reservation_id !== res.id);
        const childBadge = document.getElementById('childRoomMasterBadge');
        const childBadgeText = document.getElementById('childRoomMasterBadgeText');
        const tabBtnMaster = document.getElementById('folioTabBtnMaster');

        if (isChildRoom) {
            // Fetch parent reservation info
            let parentGuestName = 'Parent Guest';
            let parentResNo = res.parent_reservation_id.slice(0, 8);

            const { data: parentRes } = await supabaseClient
                .from('reservations')
                .select('reservation_number, booker_name, guest_profiles(full_name)')
                .eq('id', res.parent_reservation_id)
                .maybeSingle();

            if (parentRes) {
                const parentProfile = parentRes.guest_profiles ? (Array.isArray(parentRes.guest_profiles) ? parentRes.guest_profiles[0] : parentRes.guest_profiles) : null;
                parentGuestName = parentProfile?.full_name || parentRes.booker_name || 'Parent Guest';
                parentResNo = parentRes.reservation_number || parentResNo;
            }

            if (childBadgeText) {
                childBadgeText.textContent = `Terhubung ke Master Folio: ${parentGuestName} (${parentResNo})`;
            }
            if (childBadge) childBadge.classList.remove('hidden');
            if (tabBtnMaster) tabBtnMaster.classList.add('hidden');
        } else {
            if (childBadge) childBadge.classList.add('hidden');

            // Determine if Tab 2 (Master Folio) should be shown
            const hasMasterConnection = !!(res.group_id || res.booking_reference || res.is_parent || !res.parent_reservation_id);
            if (hasMasterConnection) {
                if (tabBtnMaster) tabBtnMaster.classList.remove('hidden');
            } else {
                if (tabBtnMaster) tabBtnMaster.classList.add('hidden');
            }
        }

        // Reset to Tab 1 (Folio Pribadi) by default
        await switchFolioTab('pribadi');

        // Check and update Master Folio Header / Button
        await checkAndUpdateMasterFolioHeader(res);

        // Fetch transactions
        await fetchFolioTransactions(reservationId);

    } catch (err) {
        console.error('Error opening folio modal:', err);
        alert('Gagal memuat data folio: ' + err.message);
        closeFolioModal();
    }
}

export function closeFolioModal() {
    const modal = document.getElementById('folioModal');
    if (modal) modal.classList.add('hidden');
    currentFolioReservation = null;
    currentFolioTransactions = [];
    calculatedCurrentBalance = 0;
}

export async function checkAndUpdateMasterFolioHeader(res) {
    const btnMaster = document.getElementById('btnOpenMasterFolioHeader');
    if (!btnMaster) return;

    if (!res) {
        btnMaster.classList.add('hidden');
        return;
    }

    const groupId = res.group_id;
    let bookingRef = res.booking_reference;
    const parentResId = res.parent_reservation_id;

    if (!groupId && !bookingRef && !parentResId) {
        btnMaster.classList.add('hidden');
        return;
    }

    btnMaster.classList.remove('hidden');

    try {
        let master = null;
        if (groupId) {
            const { data } = await supabaseClient
                .from('master_folios')
                .select('*')
                .eq('group_id', groupId)
                .maybeSingle();
            master = data;
        }
        if (!master && bookingRef) {
            const { data } = await supabaseClient
                .from('master_folios')
                .select('*')
                .eq('booking_reference', bookingRef)
                .maybeSingle();
            master = data;
        }
        if (!master && parentResId) {
            const { data: parentRes } = await supabaseClient
                .from('reservations')
                .select('booking_reference, group_id')
                .eq('id', parentResId)
                .maybeSingle();

            if (parentRes) {
                if (parentRes.group_id) {
                    const { data } = await supabaseClient
                        .from('master_folios')
                        .select('*')
                        .eq('group_id', parentRes.group_id)
                        .maybeSingle();
                    master = data;
                }
                if (!master && parentRes.booking_reference) {
                    const { data } = await supabaseClient
                        .from('master_folios')
                        .select('*')
                        .eq('booking_reference', parentRes.booking_reference)
                        .maybeSingle();
                    master = data;
                    if (!bookingRef) bookingRef = parentRes.booking_reference;
                }
            }
        }

        if (master) {
            btnMaster.innerHTML = `<i class="ph ph-briefcase text-base"></i> Open Master Folio (${master.folio_number})`;
            btnMaster.onclick = () => openMasterFolioModal(groupId, bookingRef, master.id);
        } else {
            btnMaster.innerHTML = `<i class="ph ph-plus-circle text-base"></i> Create Master Folio`;
            btnMaster.onclick = () => handleCreateMasterFolio();
        }
    } catch (e) {
        console.error('Error checking master folio header:', e);
    }
}

export async function handleCreateMasterFolio() {
    if (!currentFolioReservation) return;

    const groupId = currentFolioReservation.group_id;
    const bookingRef = currentFolioReservation.booking_reference;

    if (!groupId && !bookingRef) {
        alert('Reservasi tidak terhubung dengan Grup atau Booking Reference.');
        return;
    }

    try {
        const generatedFolioNo = 'MFOL-' + String(Date.now()).slice(-6);

        const { data: newMaster, error } = await supabaseClient
            .from('master_folios')
            .insert([{
                folio_number: generatedFolioNo,
                group_id: groupId || null,
                booking_reference: bookingRef || null
            }])
            .select()
            .single();

        if (error) throw error;

        if (groupId) {
            await supabaseClient
                .from('group_bookings')
                .update({ folio_number: generatedFolioNo })
                .eq('id', groupId);
        }

        alert(`Master Folio (${generatedFolioNo}) berhasil dibuat!`);
        await checkAndUpdateMasterFolioHeader(currentFolioReservation);
        await openMasterFolioModal(groupId, bookingRef, newMaster.id);

    } catch (err) {
        console.error('Error creating master folio:', err);
        alert('Gagal membuat Master Folio: ' + err.message);
    }
}

export function handleOpenFolioFromEdit() {
    const editResId = document.getElementById('edit-reservation-id')?.value;
    if (editResId) {
        openFolioModal(editResId);
    } else {
        alert('ID Reservasi tidak ditemukan.');
    }
}

export async function fetchFolioTransactions(reservationId = currentFolioReservation?.id) {
    if (!reservationId) return;
    const tbody = document.getElementById('folioTransactionsTbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">Loading transactions...</td></tr>`;

    try {
        const { data, error } = await supabaseClient
            .from('folio_transactions')
            .select('*, payment_methods:payment_method_id(id, name, type, method_type)')
            .eq('reservation_id', reservationId)
            .order('transaction_date', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) throw error;

        currentFolioTransactions = data || [];
        renderFolioTransactions();

    } catch (err) {
        console.error('Error fetching folio transactions:', err);
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-red-500 font-semibold">Gagal memuat transaksi: ${err.message}</td></tr>`;
    }
}

export function renderFolioTransactions() {
    const tbody = document.getElementById('folioTransactionsTbody');
    if (!tbody) return;

    let totalCharge = 0;
    let totalPayment = 0;

    const isMasterConnected = !!(currentFolioReservation && (
        currentFolioReservation.group_id ||
        currentFolioReservation.booking_reference ||
        currentFolioReservation.parent_reservation_id
    ));

    if (currentFolioTransactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">Belum ada transaksi di folio ini.</td></tr>`;
    } else {
        tbody.innerHTML = currentFolioTransactions.map(tx => {
            const txType = (tx.transaction_type || 'CHARGE').toUpperCase();
            const amount = Number(tx.amount || 0);
            const isVoided = tx.is_voided === true;

            if (!isVoided) {
                if (txType === 'CHARGE') {
                    totalCharge += amount;
                } else if (txType === 'PAYMENT') {
                    totalPayment += amount;
                }
            }

            const dateStr = tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
            const categoryBadge = tx.category ? `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600 uppercase border border-slate-200">${tx.category}</span>` : '-';
            const chargeDisplay = txType === 'CHARGE' ? `Rp ${amount.toLocaleString('id-ID')}` : '-';
            const paymentDisplay = txType === 'PAYMENT' ? `Rp ${amount.toLocaleString('id-ID')}` : '-';

            let rowClass = isVoided ? 'bg-red-50/50 text-slate-400 line-through' : 'hover:bg-slate-50 text-slate-700';
            let desc = tx.description || '-';
            if (isVoided) desc += ` (VOID: ${tx.void_reason || 'Batal'})`;

            const transferMasterBtn = (isMasterConnected && !isVoided && txType === 'CHARGE') ? `
                <button type="button" onclick="handleTransferToMaster('${tx.id}')" class="px-2 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition-colors flex items-center gap-1" title="Transfer to Master Folio">
                    <i class="ph ph-arrows-out-line-horizontal"></i> Transfer ke Master
                </button>
            ` : '';

            const actionBtn = isVoided ? `<span class="text-xs font-semibold text-red-400">Voided</span>` : `
                <div class="flex items-center justify-center gap-1">
                    ${transferMasterBtn}
                    <button type="button" onclick="handleVoidTransaction('${tx.id}')" class="px-2 py-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors" title="Void Transaksi">
                        <i class="ph ph-prohibit"></i> Void
                    </button>
                </div>
            `;

            return `
                <tr class="${rowClass} border-b border-slate-100 transition-colors text-xs">
                    <td class="p-3 text-center">
                        <input type="checkbox" value="${tx.id}" class="folio-tx-cb folio-tx-checkbox rounded border-slate-300 text-amber-500 focus:ring-amber-400 cursor-pointer" onchange="updateTransferButtonsState()" ${isVoided ? 'disabled' : ''}>
                    </td>
                    <td class="p-3 font-medium whitespace-nowrap text-slate-500">${dateStr}</td>
                    <td class="p-3 font-semibold text-slate-800">${desc}</td>
                    <td class="p-3 text-center">${categoryBadge}</td>
                    <td class="p-3 text-right font-medium text-slate-900">${chargeDisplay}</td>
                    <td class="p-3 text-right font-medium text-emerald-600">${paymentDisplay}</td>
                    <td class="p-3 text-center">${actionBtn}</td>
                </tr>
            `;
        }).join('');
    }

    calculatedCurrentBalance = totalCharge - totalPayment;

    const totalChargeEl = document.getElementById('folioTotalCharge');
    const totalPaymentEl = document.getElementById('folioTotalPayment');
    const currentBalanceEl = document.getElementById('folioCurrentBalance');

    if (totalChargeEl) totalChargeEl.textContent = `Rp ${totalCharge.toLocaleString('id-ID')}`;
    if (totalPaymentEl) totalPaymentEl.textContent = `Rp ${totalPayment.toLocaleString('id-ID')}`;
    if (currentBalanceEl) {
        currentBalanceEl.textContent = `Rp ${calculatedCurrentBalance.toLocaleString('id-ID')}`;
        if (calculatedCurrentBalance > 0) {
            currentBalanceEl.className = "text-xl font-bold text-red-600";
        } else if (calculatedCurrentBalance < 0) {
            currentBalanceEl.className = "text-xl font-bold text-amber-600";
        } else {
            currentBalanceEl.className = "text-xl font-bold text-emerald-600";
        }
    }

    const selectAllCb = document.getElementById('selectAllFolioTx');
    if (selectAllCb) selectAllCb.checked = false;

    updateTransferButtonsState();
}

export async function fetchMasterFolioDetails(masterFolioId) {
    if (!masterFolioId) return;

    try {
        let masterRecord = null;

        const { data: mfData } = await supabaseClient
            .from('master_folios')
            .select('*')
            .eq('id', masterFolioId)
            .maybeSingle();

        masterRecord = mfData;

        if (!masterRecord) {
            const { data: mfGroup } = await supabaseClient
                .from('master_folios')
                .select('*')
                .or(`group_id.eq.${masterFolioId},booking_reference.eq.${masterFolioId}`)
                .maybeSingle();
            masterRecord = mfGroup;
        }

        const effectiveMasterId = masterRecord ? masterRecord.id : masterFolioId;

        let responsibleName = 'Penanggung Jawab Master';
        let connectedRooms = [];
        let resMap = {};

        let queryOr = [];
        if (masterRecord?.group_id) queryOr.push(`group_id.eq.${masterRecord.group_id}`);
        if (masterRecord?.booking_reference) queryOr.push(`booking_reference.eq.${masterRecord.booking_reference}`);

        if (currentFolioReservation) {
            if (currentFolioReservation.parent_reservation_id) {
                queryOr.push(`id.eq.${currentFolioReservation.parent_reservation_id}`);
                queryOr.push(`parent_reservation_id.eq.${currentFolioReservation.parent_reservation_id}`);
            } else {
                queryOr.push(`id.eq.${currentFolioReservation.id}`);
                queryOr.push(`parent_reservation_id.eq.${currentFolioReservation.id}`);
            }
            if (currentFolioReservation.booking_reference) {
                queryOr.push(`booking_reference.eq.${currentFolioReservation.booking_reference}`);
            }
        }

        if (queryOr.length > 0) {
            const { data: connectedResList } = await supabaseClient
                .from('reservations')
                .select('id, reservation_number, parent_reservation_id, booker_name, guest_profiles(full_name), rooms(room_number)')
                .or(queryOr.join(','));

            if (connectedResList && connectedResList.length > 0) {
                const parentRes = connectedResList.find(r => !r.parent_reservation_id || r.parent_reservation_id === r.id) || connectedResList[0];
                if (parentRes) {
                    const guestName = parentRes.guest_profiles ? (Array.isArray(parentRes.guest_profiles) ? parentRes.guest_profiles[0]?.full_name : parentRes.guest_profiles.full_name) : null;
                    responsibleName = guestName || parentRes.booker_name || 'Penanggung Jawab';
                }

                connectedResList.forEach(r => {
                    const roomNo = r.rooms ? (Array.isArray(r.rooms) ? r.rooms[0]?.room_number : r.rooms.room_number) : null;
                    if (roomNo && !connectedRooms.includes(`Kamar ${roomNo}`)) {
                        connectedRooms.push(`Kamar ${roomNo}`);
                    }
                    if (roomNo) {
                        resMap[r.id] = `Kamar ${roomNo}`;
                        resMap[`Kamar ${roomNo}`] = r.id;
                        if (r.reservation_number) resMap[r.reservation_number] = r.id;
                    }
                });
            }
        }

        if (connectedRooms.length === 0 && currentFolioReservation?.rooms) {
            const roomNo = currentFolioReservation.rooms.room_number;
            if (roomNo) connectedRooms.push(`Kamar ${roomNo}`);
        }

        const { data: masterTxList, error: txErr } = await supabaseClient
            .from('folio_transactions')
            .select('*, reservations(id, reservation_number, rooms(room_number))')
            .eq('master_folio_id', effectiveMasterId)
            .order('transaction_date', { ascending: true })
            .order('created_at', { ascending: true });

        if (txErr) throw txErr;

        currentMasterTransactions = masterTxList || [];

        currentMasterGroup = {
            id: effectiveMasterId,
            master_folio_id: effectiveMasterId,
            folio_number: masterRecord?.folio_number || (`MFOL-${effectiveMasterId.slice(0, 8)}`),
            responsible_name: responsibleName,
            connected_rooms: connectedRooms
        };

        const renderData = {
            masterFolio: masterRecord,
            masterFolioId: effectiveMasterId,
            folioNumber: currentMasterGroup.folio_number,
            responsibleName: responsibleName,
            connectedRooms: connectedRooms,
            resMap: resMap,
            transactions: currentMasterTransactions
        };

        renderMasterFolioTab(renderData);

        return renderData;

    } catch (err) {
        console.error('Error fetching master folio details:', err);
        const tbody = document.getElementById('masterTabTransactionsTbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500 font-semibold">Gagal memuat detail Master Folio: ${err.message}</td></tr>`;
        }
    }
}

export function renderMasterFolioTab(data) {
    if (!data) return;

    const respNameEl = document.getElementById('masterTabResponsibleName');
    const folioNoEl = document.getElementById('masterTabFolioNo');
    const roomsEl = document.getElementById('masterTabConnectedRooms');

    if (respNameEl) respNameEl.textContent = data.responsibleName || 'Penanggung Jawab Master';
    if (folioNoEl) folioNoEl.textContent = data.folioNumber || 'MFOL-......';

    if (roomsEl) {
        if (data.connectedRooms && data.connectedRooms.length > 0) {
            roomsEl.innerHTML = data.connectedRooms.map(r => `
                <span class="px-2.5 py-0.5 bg-indigo-900 text-indigo-100 text-xs font-bold rounded-md border border-indigo-700 shadow-2xs">${r}</span>
            `).join('');
        } else {
            roomsEl.innerHTML = `<span class="px-2.5 py-0.5 bg-slate-800 text-slate-300 text-xs font-semibold rounded-md border border-slate-700">Kamar -</span>`;
        }
    }

    let totalCharges = 0;
    let totalPayments = 0;

    const tbody = document.getElementById('masterTabTransactionsTbody');

    if (!data.transactions || data.transactions.length === 0) {
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Belum ada transaksi di Master Folio ini.</td></tr>`;
        }
    } else if (tbody) {
        tbody.innerHTML = data.transactions.map(tx => {
            const txType = (tx.transaction_type || 'CHARGE').toUpperCase();
            const amount = Number(tx.amount || 0);
            const isVoided = tx.is_voided === true;

            if (!isVoided) {
                if (txType === 'CHARGE') totalCharges += amount;
                else if (txType === 'PAYMENT') totalPayments += amount;
            }

            const dateStr = tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
            const categoryBadge = tx.category ? `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600 uppercase border border-slate-200">${tx.category}</span>` : '';
            const chargeDisplay = txType === 'CHARGE' ? `Rp ${amount.toLocaleString('id-ID')}` : '-';
            const paymentDisplay = txType === 'PAYMENT' ? `Rp ${amount.toLocaleString('id-ID')}` : '-';

            let sourceRoomDisplay = '-';
            let originalFolioId = tx.reservation_id || null;

            if (!originalFolioId && tx.description) {
                const resNoMatch = tx.description.match(/\(([^()]+)\)/);
                if (resNoMatch && resNoMatch[1] && data.resMap && data.resMap[resNoMatch[1]]) {
                    originalFolioId = data.resMap[resNoMatch[1]];
                } else {
                    const roomMatch = tx.description.match(/dr Kamar ([^\s()]+)/);
                    if (roomMatch && roomMatch[1] && data.resMap && data.resMap[`Kamar ${roomMatch[1]}`]) {
                        originalFolioId = data.resMap[`Kamar ${roomMatch[1]}`];
                    }
                }
            }

            if (tx.reservations?.rooms?.room_number) {
                sourceRoomDisplay = `Kamar ${tx.reservations.rooms.room_number}`;
            } else if (tx.description && tx.description.includes('dr Kamar ')) {
                const match = tx.description.match(/dr Kamar ([^\s()]+)/);
                if (match && match[1]) {
                    sourceRoomDisplay = `Kamar ${match[1]}`;
                }
            } else if (tx.reservation_id && data.resMap && data.resMap[tx.reservation_id]) {
                sourceRoomDisplay = data.resMap[tx.reservation_id];
            } else if (originalFolioId && data.resMap && data.resMap[originalFolioId]) {
                sourceRoomDisplay = data.resMap[originalFolioId];
            } else if (txType === 'CHARGE') {
                sourceRoomDisplay = 'Master';
            }

            let rowClass = isVoided ? 'bg-red-50/50 text-slate-400 line-through' : 'hover:bg-slate-50 text-slate-700';
            let desc = tx.description || '-';
            if (isVoided) desc += ` (VOID: ${tx.void_reason || 'Batal'})`;

            const returnBtn = (!isVoided && txType === 'CHARGE') ? `
                <button type="button" onclick="handleReturnFromMaster('${tx.id}', '${originalFolioId || ''}')" class="px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded transition-colors shadow-2xs flex items-center gap-1" title="Kembalikan transaksi ke folio kamar asal">
                    <i class="ph ph-arrow-u-up-left text-sm"></i> Kembalikan / Return
                </button>
            ` : '';

            const actionBtns = isVoided ? `<span class="text-xs font-semibold text-red-400">Voided</span>` : `
                <div class="flex items-center justify-center gap-1">
                    ${returnBtn}
                </div>
            `;

            return `
                <tr class="${rowClass} border-b border-slate-100 transition-colors text-xs">
                    <td class="p-3 font-medium whitespace-nowrap text-slate-500">${dateStr}</td>
                    <td class="p-3 font-semibold text-slate-800">${desc} ${categoryBadge}</td>
                    <td class="p-3 text-center font-bold text-indigo-900">${sourceRoomDisplay}</td>
                    <td class="p-3 text-right font-medium text-slate-900">${chargeDisplay}</td>
                    <td class="p-3 text-right font-medium text-emerald-600">${paymentDisplay}</td>
                    <td class="p-3 text-center">${actionBtns}</td>
                </tr>
            `;
        }).join('');
    }

    const masterBalance = totalCharges - totalPayments;

    const chargeEl = document.getElementById('masterTabTotalCharge');
    const paymentEl = document.getElementById('masterTabTotalPayment');
    const balanceEl = document.getElementById('masterTabBalance');

    if (chargeEl) chargeEl.textContent = `Rp ${totalCharges.toLocaleString('id-ID')}`;
    if (paymentEl) paymentEl.textContent = `Rp ${totalPayments.toLocaleString('id-ID')}`;
    if (balanceEl) {
        balanceEl.textContent = `Rp ${masterBalance.toLocaleString('id-ID')}`;
        if (masterBalance > 0) balanceEl.className = "text-lg font-bold text-red-600";
        else if (masterBalance < 0) balanceEl.className = "text-lg font-bold text-amber-600";
        else balanceEl.className = "text-lg font-bold text-emerald-600";
    }
}

export async function handleTransferToMaster(transactionId, masterFolioId) {
    if (!transactionId) return;

    let targetMasterId = masterFolioId;
    if (!targetMasterId && currentMasterGroup?.master_folio_id) {
        targetMasterId = currentMasterGroup.master_folio_id;
    }
    if (!targetMasterId && currentFolioReservation) {
        targetMasterId = await getOrCreateMasterFolioId(currentFolioReservation);
    }

    if (!targetMasterId) {
        alert('Master Folio ID tidak ditemukan.');
        return;
    }

    try {
        const { data: rpcData, error } = await supabaseClient.rpc('rpc_transfer_folio_transaction', {
            p_transaction_ids: [transactionId],
            p_target_reservation_id: null,
            p_target_master_folio_id: targetMasterId
        });

        if (error) throw error;

        if (currentFolioReservation?.id) {
            await fetchFolioTransactions(currentFolioReservation.id);
        }
        await fetchMasterFolioDetails(targetMasterId);

    } catch (err) {
        console.error('Error transferring transaction to master folio:', err);
        alert('Gagal mentransfer transaksi ke Master: ' + err.message);
    }
}

export async function handleReturnFromMaster(transactionId, originalFolioId) {
    if (!transactionId) return;

    try {
        let targetResId = (originalFolioId && originalFolioId !== 'null' && originalFolioId !== 'undefined') ? originalFolioId : null;

        if (!targetResId) {
            const { data: tx } = await supabaseClient
                .from('folio_transactions')
                .select('reservation_id')
                .eq('id', transactionId)
                .single();
            if (tx && tx.reservation_id) {
                targetResId = tx.reservation_id;
            }
        }

        if (!targetResId && currentFolioReservation) {
            targetResId = currentFolioReservation.id;
        }

        if (!targetResId) {
            alert('Tidak dapat menentukan folio kamar asal.');
            return;
        }

        const { data: rpcData, error } = await supabaseClient.rpc('rpc_transfer_folio_transaction', {
            p_transaction_ids: [transactionId],
            p_target_reservation_id: targetResId,
            p_target_master_folio_id: null
        });

        if (error) throw error;

        if (currentMasterGroup?.master_folio_id) {
            await fetchMasterFolioDetails(currentMasterGroup.master_folio_id);
        }
        if (currentFolioReservation?.id) {
            await fetchFolioTransactions(currentFolioReservation.id);
        }

    } catch (err) {
        console.error('Error returning transaction from master folio:', err);
        alert('Gagal mengembalikan transaksi: ' + err.message);
    }
}

export async function openMasterFolioModal(groupId, bookingRef, masterId) {
    try {
        let masterRecord = null;
        if (masterId) {
            const { data } = await supabaseClient
                .from('master_folios')
                .select('*')
                .eq('id', masterId)
                .maybeSingle();
            masterRecord = data;
        }
        if (!masterRecord && groupId) {
            const { data } = await supabaseClient
                .from('master_folios')
                .select('*')
                .eq('group_id', groupId)
                .maybeSingle();
            masterRecord = data;
        }
        if (!masterRecord && bookingRef) {
            const { data } = await supabaseClient
                .from('master_folios')
                .select('*')
                .eq('booking_reference', bookingRef)
                .maybeSingle();
            masterRecord = data;
        }

        let gb = null;
        if (groupId) {
            const { data } = await supabaseClient
                .from('group_bookings')
                .select('*, corporate_profiles(company_name)')
                .eq('id', groupId)
                .maybeSingle();
            gb = data;
        }

        currentMasterGroup = {
            id: masterRecord?.id || groupId,
            master_folio_id: masterRecord?.id || null,
            group_id: groupId || masterRecord?.group_id || null,
            booking_reference: bookingRef || masterRecord?.booking_reference || null,
            folio_number: masterRecord?.folio_number || gb?.folio_number || ('MFOL-' + (masterRecord?.id || groupId || bookingRef).slice(0, 8)),
            group_name: gb?.group_name || (bookingRef ? `OTA Ref: ${bookingRef}` : 'Master Folio'),
            corporate_name: gb?.corporate_profiles ? (Array.isArray(gb.corporate_profiles) ? gb.corporate_profiles[0]?.company_name : gb.corporate_profiles.company_name) : null
        };

        const modal = document.getElementById('masterFolioModal');
        if (!modal) return;

        modal.classList.remove('hidden');

        document.getElementById('masterFolioHeaderGroupName').textContent = currentMasterGroup.group_name;
        document.getElementById('masterFolioHeaderCorporate').textContent = currentMasterGroup.corporate_name || 'Non-Corporate';
        document.getElementById('masterFolioHeaderFolioNo').textContent = currentMasterGroup.folio_number;

        await fetchMasterFolioTransactions(currentMasterGroup);

    } catch (err) {
        console.error('Error opening master folio modal:', err);
        alert('Gagal memuat Master Folio: ' + err.message);
    }
}

export function closeMasterFolioModal() {
    const modal = document.getElementById('masterFolioModal');
    if (modal) modal.classList.add('hidden');
    currentMasterGroup = null;
    currentMasterTransactions = [];
}

export async function fetchMasterFolioTransactions(masterGroupObj) {
    const tbody = document.getElementById('masterFolioTransactionsTbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">Loading master transactions...</td></tr>`;

    try {
        const masterId = masterGroupObj.master_folio_id;
        const groupId = masterGroupObj.group_id;
        const bookingRef = masterGroupObj.booking_reference;

        let query = supabaseClient
            .from('folio_transactions')
            .select('*, payment_methods:payment_method_id(id, name, type, method_type)');

        if (masterId) {
            query = query.eq('master_folio_id', masterId);
        } else if (groupId) {
            query = query.eq('master_folio_id', groupId);
        } else if (bookingRef) {
            query = query.eq('master_folio_id', bookingRef);
        } else {
            currentMasterTransactions = [];
            renderMasterFolioTransactions();
            return;
        }

        const { data, error } = await query
            .order('transaction_date', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) throw error;

        currentMasterTransactions = data || [];
        renderMasterFolioTransactions();

    } catch (err) {
        console.error('Error fetching master folio transactions:', err);
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-red-500 font-semibold">Gagal memuat transaksi: ${err.message}</td></tr>`;
    }
}

export function renderMasterFolioTransactions() {
    const tbody = document.getElementById('masterFolioTransactionsTbody');
    if (!tbody) return;

    let totalCharge = 0;
    let totalPayment = 0;

    if (currentMasterTransactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">Belum ada transaksi di Master Folio ini.</td></tr>`;
    } else {
        tbody.innerHTML = currentMasterTransactions.map(tx => {
            const txType = (tx.transaction_type || 'CHARGE').toUpperCase();
            const amount = Number(tx.amount || 0);
            const isVoided = tx.is_voided === true;

            if (!isVoided) {
                if (txType === 'CHARGE') {
                    totalCharge += amount;
                } else if (txType === 'PAYMENT') {
                    totalPayment += amount;
                }
            }

            const dateStr = tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
            const categoryBadge = tx.category ? `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600 uppercase border border-slate-200">${tx.category}</span>` : '-';
            const chargeDisplay = txType === 'CHARGE' ? `Rp ${amount.toLocaleString('id-ID')}` : '-';
            const paymentDisplay = txType === 'PAYMENT' ? `Rp ${amount.toLocaleString('id-ID')}` : '-';

            let rowClass = isVoided ? 'bg-red-50/50 text-slate-400 line-through' : 'hover:bg-slate-50 text-slate-700';
            let desc = tx.description || '-';
            if (isVoided) desc += ` (VOID: ${tx.void_reason || 'Batal'})`;

            const actionBtns = `
                <div class="flex items-center justify-center gap-1">
                    <button onclick="handleMoveBackToPersonalFolio('${tx.id}')" class="px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors" title="Kembalikan ke Personal Folio">
                        <i class="ph ph-arrow-u-up-left"></i> Move Back
                    </button>
                    ${isVoided ? '<span class="text-xs font-semibold text-red-400">Voided</span>' :
                    `<button onclick="handleVoidMasterTransaction('${tx.id}')" class="px-2 py-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors" title="Void Transaksi"><i class="ph ph-prohibit"></i> Void</button>`}
                </div>
            `;

            return `
                <tr class="${rowClass} border-b border-slate-100 transition-colors text-xs">
                    <td class="p-3 text-center">
                        <input type="checkbox" value="${tx.id}" class="master-folio-tx-cb rounded border-slate-300 text-indigo-500 focus:ring-indigo-400 cursor-pointer" ${isVoided ? 'disabled' : ''}>
                    </td>
                    <td class="p-3 font-medium whitespace-nowrap text-slate-500">${dateStr}</td>
                    <td class="p-3 font-semibold text-slate-800">${desc}</td>
                    <td class="p-3 text-center">${categoryBadge}</td>
                    <td class="p-3 text-right font-medium text-slate-900">${chargeDisplay}</td>
                    <td class="p-3 text-right font-medium text-emerald-600">${paymentDisplay}</td>
                    <td class="p-3 text-center">${actionBtns}</td>
                </tr>
            `;
        }).join('');
    }

    const currentBalance = totalCharge - totalPayment;

    document.getElementById('masterFolioTotalCharge').textContent = `Rp ${totalCharge.toLocaleString('id-ID')}`;
    document.getElementById('masterFolioTotalPayment').textContent = `Rp ${totalPayment.toLocaleString('id-ID')}`;

    const balanceEl = document.getElementById('masterFolioCurrentBalance');
    if (balanceEl) {
        balanceEl.textContent = `Rp ${currentBalance.toLocaleString('id-ID')}`;
        if (currentBalance > 0) balanceEl.className = "text-xl font-bold text-red-600";
        else if (currentBalance < 0) balanceEl.className = "text-xl font-bold text-amber-600";
        else balanceEl.className = "text-xl font-bold text-emerald-600";
    }
}

export async function handleMoveBackToPersonalFolio(transactionId) {
    if (!transactionId) return;

    try {
        const { data: tx, error: fetchErr } = await supabaseClient
            .from('folio_transactions')
            .select('*')
            .eq('id', transactionId)
            .single();

        if (fetchErr) throw fetchErr;

        // Find associated reservation ID
        let targetResId = null;
        if (currentMasterGroup?.group_id) {
            const { data: resList } = await supabaseClient
                .from('reservations')
                .select('id')
                .eq('group_id', currentMasterGroup.group_id)
                .limit(1);
            if (resList && resList.length > 0) targetResId = resList[0].id;
        }

        if (!targetResId && currentMasterGroup?.booking_reference) {
            const { data: resList } = await supabaseClient
                .from('reservations')
                .select('id')
                .eq('booking_reference', currentMasterGroup.booking_reference)
                .limit(1);
            if (resList && resList.length > 0) targetResId = resList[0].id;
        }

        if (!targetResId) {
            alert('Tidak dapat menentukan reservasi personal asal.');
            return;
        }

        const { error: updErr } = await supabaseClient
            .from('folio_transactions')
            .update({
                reservation_id: targetResId,
                master_folio_id: null
            })
            .eq('id', transactionId);

        if (updErr) throw updErr;

        alert('Transaksi berhasil dikembalikan ke Personal Folio.');
        await fetchMasterFolioTransactions(currentMasterGroup);

        if (currentFolioReservation) {
            await fetchFolioTransactions(currentFolioReservation.id);
        }

    } catch (err) {
        console.error('Error moving back to personal folio:', err);
        alert('Gagal mengembalikan transaksi: ' + err.message);
    }
}

export async function handleVoidMasterTransaction(transactionId) {
    await handleVoidTransaction(transactionId);
    if (currentMasterGroup) {
        await fetchMasterFolioTransactions(currentMasterGroup);
    }
}

// ==========================================
// FOLIO TRANSACTIONS (CHARGE / PAYMENT)
// ==========================================

export async function openAddChargeModal() {
    const txModal = document.getElementById('folioTransactionModal');
    const txTypeSelect = document.getElementById('folio-tx-type');
    const modalTitle = document.getElementById('folioTxModalTitle');

    if (txTypeSelect) txTypeSelect.value = 'CHARGE';
    if (modalTitle) modalTitle.innerHTML = `<i class="ph ph-plus-circle text-amber-500"></i> Post New Charge Item`;

    document.getElementById('folio-tx-charge-item-container')?.classList.remove('hidden');
    document.getElementById('folio-tx-qty-price-container')?.classList.remove('hidden');
    document.getElementById('folio-tx-desc-container')?.classList.add('hidden');
    document.getElementById('folio-tx-payment-method-container')?.classList.add('hidden');
    document.getElementById('folio-tx-ref-container')?.classList.add('hidden');

    const chargeSelect = document.getElementById('folio-tx-charge-item');
    if (chargeSelect) {
        chargeSelect.innerHTML = `<option value="">Loading charge items...</option>`;
        try {
            const { data, error } = await supabaseClient
                .from('extra_charges')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;

            let html = `<option value="">-- Pilih Item Charge --</option>`;
            (data || []).forEach(item => {
                html += `<option value="${item.id}" data-price="${item.price}" data-name="${item.name}" data-category="${item.category || 'Others'}">${item.name} (${item.category || 'Charge'}) - Rp ${parseFloat(item.price || 0).toLocaleString('id-ID')}</option>`;
            });
            html += `<option value="custom">+ Input Custom Charge (Lain-lain)</option>`;
            chargeSelect.innerHTML = html;

        } catch (e) {
            console.error('Error fetching extra charges for folio:', e);
            chargeSelect.innerHTML = `<option value="custom">+ Input Custom Charge (Lain-lain)</option>`;
        }
    }

    handleChargeItemChange();

    if (txModal) {
        delete txModal.dataset.isMasterMode;
        txModal.classList.remove('hidden');
    }
}

export async function openAddPaymentModal() {
    const txModal = document.getElementById('folioTransactionModal');
    const txTypeSelect = document.getElementById('folio-tx-type');
    const modalTitle = document.getElementById('folioTxModalTitle');

    if (txTypeSelect) txTypeSelect.value = 'PAYMENT';
    if (modalTitle) modalTitle.innerHTML = `<i class="ph ph-receipt text-emerald-500"></i> Post Payment / Deposit`;

    document.getElementById('folio-tx-charge-item-container')?.classList.add('hidden');
    document.getElementById('folio-tx-custom-desc-container')?.classList.add('hidden');
    document.getElementById('folio-tx-category-container')?.classList.add('hidden');
    document.getElementById('folio-tx-qty-price-container')?.classList.add('hidden');
    document.getElementById('folio-tx-desc-container')?.classList.remove('hidden');
    document.getElementById('folio-tx-payment-method-container')?.classList.remove('hidden');
    document.getElementById('folio-tx-ref-container')?.classList.remove('hidden');

    const amountInput = document.getElementById('folio-tx-amount');
    if (amountInput) {
        amountInput.removeAttribute('readonly');
        amountInput.value = calculatedCurrentBalance > 0 ? calculatedCurrentBalance : '';
    }

    const descInput = document.getElementById('folio-tx-description');
    if (descInput) descInput.value = '';

    const refInput = document.getElementById('folio-tx-reference');
    if (refInput) refInput.value = '';

    const pmSelect = document.getElementById('folio-tx-payment-method');
    if (pmSelect) {
        pmSelect.innerHTML = `<option value="">Loading payment methods...</option>`;
        try {
            const { data, error } = await supabaseClient
                .from('payment_methods')
                .select('*')
                .eq('is_active', true)
                .order('name', { ascending: true });

            if (error) throw error;

            if (data && data.length > 0) {
                pmSelect.innerHTML = data.map(pm => {
                    const methodType = pm.method_type || pm.type || '';
                    const optionText = methodType ? `${methodType} - ${pm.name}` : pm.name;
                    return `<option value="${pm.name}" data-type="${methodType}">${optionText}</option>`;
                }).join('');
            } else {
                pmSelect.innerHTML = `<option value="Cash" data-type="Cash">Cash - Cash</option>`;
            }
        } catch (err) {
            console.error('Error fetching payment methods for folio transaction:', err);
            pmSelect.innerHTML = `<option value="Cash" data-type="Cash">Cash - Cash</option>`;
        }
    }

    handleFolioPaymentMethodChange();

    if (txModal) {
        delete txModal.dataset.isMasterMode;
        txModal.classList.remove('hidden');
    }
}

export async function openMasterAddChargeModal() {
    await openAddChargeModal();
    const txModal = document.getElementById('folioTransactionModal');
    if (txModal) txModal.dataset.isMasterMode = "true";
}

export async function openMasterAddPaymentModal() {
    await openAddPaymentModal();
    const txModal = document.getElementById('folioTransactionModal');
    if (txModal) txModal.dataset.isMasterMode = "true";
}

export function closeFolioTransactionModal() {
    const txModal = document.getElementById('folioTransactionModal');
    if (txModal) {
        txModal.classList.add('hidden');
        delete txModal.dataset.isMasterMode;
    }
    const form = document.getElementById('folioTransactionForm');
    if (form) form.reset();
}

export function handleChargeItemChange() {
    const select = document.getElementById('folio-tx-charge-item');
    const customDescContainer = document.getElementById('folio-tx-custom-desc-container');
    const categoryContainer = document.getElementById('folio-tx-category-container');
    const unitPriceInput = document.getElementById('folio-tx-unit-price');

    if (!select) return;

    if (select.value === 'custom') {
        customDescContainer?.classList.remove('hidden');
        categoryContainer?.classList.remove('hidden');
        if (unitPriceInput) unitPriceInput.value = '';
    } else {
        customDescContainer?.classList.add('hidden');
        categoryContainer?.classList.add('hidden');
        const selectedOption = select.options[select.selectedIndex];
        const price = selectedOption ? selectedOption.getAttribute('data-price') : 0;
        if (unitPriceInput) unitPriceInput.value = price || 0;
    }

    calculateFolioTotal();
}

export function handleFolioPaymentMethodChange() {
    const pmSelect = document.getElementById('folio-tx-payment-method');
    const refContainer = document.getElementById('folio-tx-ref-container');
    if (!pmSelect || !refContainer) return;

    const selectedOption = pmSelect.options[pmSelect.selectedIndex];
    const type = selectedOption ? selectedOption.getAttribute('data-type') : '';

    if (type === 'Cash' || pmSelect.value === 'Cash') {
        refContainer.classList.add('hidden');
    } else {
        refContainer.classList.remove('hidden');
    }
}

export function calculateFolioTotal() {
    const qty = parseInt(document.getElementById('folio-tx-qty')?.value) || 1;
    const unitPrice = parseFloat(document.getElementById('folio-tx-unit-price')?.value) || 0;
    const amountInput = document.getElementById('folio-tx-amount');

    if (amountInput) {
        amountInput.value = qty * unitPrice;
    }
}

export async function handleSaveFolioTransaction(e) {
    if (e && e.preventDefault) e.preventDefault();
    const txModal = document.getElementById('folioTransactionModal');
    const isMasterMode = txModal && txModal.dataset.isMasterMode === "true";

    if (!isMasterMode && !currentFolioReservation) return;
    if (isMasterMode && !currentMasterGroup) return;

    const txType = document.getElementById('folio-tx-type').value;
    let description = '';
    let category = null;
    let qty = null;
    let unitPrice = null;
    let amount = 0;
    let referenceNumber = null;

    if (txType === 'CHARGE') {
        const chargeSelect = document.getElementById('folio-tx-charge-item');
        const selectedValue = chargeSelect ? chargeSelect.value : '';

        qty = parseInt(document.getElementById('folio-tx-qty').value) || 1;
        unitPrice = parseFloat(document.getElementById('folio-tx-unit-price').value) || 0;
        amount = qty * unitPrice;

        if (selectedValue === 'custom') {
            description = document.getElementById('folio-tx-custom-desc').value.trim();
            category = document.getElementById('folio-tx-category').value;
        } else {
            const selectedOption = chargeSelect ? chargeSelect.options[chargeSelect.selectedIndex] : null;
            description = selectedOption ? selectedOption.getAttribute('data-name') : 'Charge Item';
            category = selectedOption ? selectedOption.getAttribute('data-category') : 'Others';
        }

        if (!description) {
            alert('Deskripsi transaksi harus diisi.');
            return;
        }
    } else { // PAYMENT
        const descInput = document.getElementById('folio-tx-description');
        let noteDesc = descInput ? descInput.value.trim() : '';
        amount = parseFloat(document.getElementById('folio-tx-amount').value) || 0;

        const paymentMethodSelect = document.getElementById('folio-tx-payment-method');
        const paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : '';
        const refInput = document.getElementById('folio-tx-reference');
        referenceNumber = refInput ? refInput.value.trim() : '';

        const methodLabel = paymentMethod ? `[${paymentMethod}]` : '';
        description = noteDesc ? `${methodLabel} ${noteDesc}`.trim() : `Payment ${methodLabel}`.trim();
        referenceNumber = referenceNumber || paymentMethod || null;
    }

    if (isNaN(amount) || amount <= 0) {
        alert('Jumlah transaksi (amount) harus lebih dari 0.');
        return;
    }

    const resId = isMasterMode ? null : currentFolioReservation.id;
    const masterId = isMasterMode ? (currentMasterGroup.master_folio_id || currentMasterGroup.id) : null;

    const submitBtn = document.getElementById('folioTxSubmitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="ph ph-spinner animate-spin text-base"></i> Saving...`;
    }

    try {
        let rpcSuccess = false;
        try {
            const { data: rpcData, error: rpcErr } = await supabaseClient.rpc('rpc_post_folio_transaction', {
                p_reservation_id: resId,
                p_master_folio_id: masterId,
                p_transaction_type: txType,
                p_description: description,
                p_category: category,
                p_qty: qty,
                p_unit_price: unitPrice,
                p_amount: amount,
                p_reference_number: referenceNumber
            });
            if (!rpcErr && rpcData && rpcData.success !== false) {
                rpcSuccess = true;
            } else if (rpcErr) {
                console.warn('rpc_post_folio_transaction error, falling back to direct insert:', rpcErr);
            }
        } catch (e) {
            console.warn('rpc_post_folio_transaction call exception, falling back:', e);
        }

        if (!rpcSuccess) {
            const payload = {
                reservation_id: resId,
                master_folio_id: masterId,
                transaction_type: txType,
                description: description,
                category: category,
                qty: qty,
                unit_price: unitPrice,
                amount: amount,
                reference_number: referenceNumber,
                transaction_date: new Date().toISOString()
            };

            const { error } = await supabaseClient
                .from('folio_transactions')
                .insert([payload]);

            if (error) throw error;
        }

        closeFolioTransactionModal();
        if (isMasterMode) {
            await fetchMasterFolioTransactions(currentMasterGroup);
        } else {
            await fetchFolioTransactions(currentFolioReservation.id);
        }

    } catch (err) {
        console.error('Error saving folio transaction:', err);
        alert('Gagal menyimpan transaksi: ' + err.message);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="ph ph-floppy-disk text-base"></i> Save Transaction`;
        }
    }
}

export async function handleVoidTransaction(transactionId) {
    if (!transactionId) return;

    const voidReason = prompt("Masukkan alasan pembatalan (wajib diisi):");
    if (voidReason === null || voidReason.trim() === "") {
        return;
    }

    try {
        let rpcSuccess = false;
        try {
            const { data: rpcData, error: rpcErr } = await supabaseClient.rpc('rpc_void_folio_transaction', {
                p_transaction_id: transactionId,
                p_void_reason: voidReason.trim()
            });
            if (!rpcErr && rpcData && rpcData.success !== false) {
                rpcSuccess = true;
            } else if (rpcErr) {
                console.warn('rpc_void_folio_transaction error, falling back to direct update:', rpcErr);
            }
        } catch (e) {
            console.warn('rpc_void_folio_transaction call exception, falling back:', e);
        }

        if (!rpcSuccess) {
            const { error } = await supabaseClient
                .from('folio_transactions')
                .update({
                    is_voided: true,
                    void_reason: voidReason.trim(),
                    voided_at: new Date().toISOString()
                })
                .eq('id', transactionId);

            if (error) throw error;
        }

        if (currentFolioReservation && currentFolioReservation.id) {
            await fetchFolioTransactions(currentFolioReservation.id);
        }
    } catch (err) {
        console.error('Error voiding transaction:', err);
        alert('Gagal membatalkan transaksi: ' + err.message);
    }
}

// ==========================================
// TRANSFER TAGIHAN & ROUTING
// ==========================================

export function updateTransferButtonsState() {
    const checkedBoxes = document.querySelectorAll('.folio-tx-checkbox:checked, .folio-tx-cb:checked');
    const checkedCount = checkedBoxes.length;
    const btnTransferSelected = document.getElementById('btnTransferSelected');
    const btnMoveToMaster = document.getElementById('btnMoveToMaster');

    const isConnectedToMaster = !!(currentFolioReservation && (
        currentFolioReservation.group_id ||
        currentFolioReservation.booking_reference ||
        currentFolioReservation.parent_reservation_id
    ));

    if (checkedCount > 0) {
        if (btnTransferSelected) btnTransferSelected.disabled = false;
        if (btnMoveToMaster) {
            btnMoveToMaster.disabled = !isConnectedToMaster;
        }
    } else {
        if (btnTransferSelected) btnTransferSelected.disabled = true;
        if (btnMoveToMaster) btnMoveToMaster.disabled = true;
    }
}

export function toggleSelectAllFolioTx(masterCheckbox) {
    const checkboxes = document.querySelectorAll('.folio-tx-checkbox:not(:disabled), .folio-tx-cb:not(:disabled)');
    checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
    updateTransferButtonsState();
}

export function onFolioTxCheckboxChange() {
    updateTransferButtonsState();
}

export async function openTransferBillModal() {
    const checkedBoxes = document.querySelectorAll('.folio-tx-checkbox:checked, .folio-tx-cb:checked');
    if (checkedBoxes.length === 0) {
        alert('Pilih minimal satu transaksi untuk ditransfer.');
        return;
    }

    const infoEl = document.getElementById('transferSelectedCountInfo');
    if (infoEl) {
        infoEl.textContent = `${checkedBoxes.length} item transaksi dipilih untuk ditransfer.`;
    }

    const searchInput = document.getElementById('transferTargetSearch');
    if (searchInput) searchInput.value = '';

    const selectEl = document.getElementById('transferTargetSelect');
    if (selectEl) {
        selectEl.innerHTML = '<option value="">Memuat reservasi tujuan...</option>';
    }

    const modal = document.getElementById('transferBillModal');
    if (modal) modal.classList.remove('hidden');

    try {
        const currentResId = currentFolioReservation ? currentFolioReservation.id : null;

        const { data, error } = await supabaseClient
            .from('reservations')
            .select('id, reservation_number, booker_name, guest_type, status, guest_profiles(full_name), rooms(room_number)')
            .or('status.eq.Checkin,guest_type.eq.Non-Staying Guest')
            .neq('status', 'Cancelled');

        if (error) throw error;

        transferTargetReservationsCache = (data || []).filter(r => r.id !== currentResId);
        renderTransferTargetOptions(transferTargetReservationsCache);

    } catch (err) {
        console.error('Error fetching transfer destinations:', err);
        if (selectEl) {
            selectEl.innerHTML = `<option value="">Gagal memuat tujuan: ${err.message}</option>`;
        }
    }
}

export function renderTransferTargetOptions(list) {
    const selectEl = document.getElementById('transferTargetSelect');
    if (!selectEl) return;

    if (!list || list.length === 0) {
        selectEl.innerHTML = '<option value="">Tidak ada reservasi tujuan yang tersedia.</option>';
        return;
    }

    const inHouse = list.filter(r => r.guest_type !== 'Non-Staying Guest' && r.status === 'Checkin');
    const nsg = list.filter(r => r.guest_type === 'Non-Staying Guest');
    const others = list.filter(r => r.guest_type !== 'Non-Staying Guest' && r.status !== 'Checkin');

    let html = '';

    if (inHouse.length > 0) {
        html += '<optgroup label="Tamu In-House (Staying Guest)">';
        inHouse.forEach(r => {
            const guestProfile = r.guest_profiles ? (Array.isArray(r.guest_profiles) ? r.guest_profiles[0] : r.guest_profiles) : null;
            const guestName = (guestProfile ? guestProfile.full_name : null) || r.booker_name || 'Guest';
            const roomNo = r.rooms ? (Array.isArray(r.rooms) ? r.rooms[0]?.room_number : r.rooms.room_number) : '-';
            const resNo = r.reservation_number || r.id.slice(0, 8);
            html += `<option value="${r.id}">[Kamar ${roomNo}] ${guestName} (${resNo})</option>`;
        });
        html += '</optgroup>';
    }

    if (nsg.length > 0) {
        html += '<optgroup label="Akun Non-Staying Guest (NSG)">';
        nsg.forEach(r => {
            const accountName = r.booker_name || 'NSG Account';
            const resNo = r.reservation_number || r.id.slice(0, 8);
            html += `<option value="${r.id}">[NSG] ${accountName} (${resNo})</option>`;
        });
        html += '</optgroup>';
    }

    if (others.length > 0) {
        html += '<optgroup label="Reservasi Lainnya">';
        others.forEach(r => {
            const guestProfile = r.guest_profiles ? (Array.isArray(r.guest_profiles) ? r.guest_profiles[0] : r.guest_profiles) : null;
            const guestName = (guestProfile ? guestProfile.full_name : null) || r.booker_name || 'Guest';
            const roomNo = r.rooms ? (Array.isArray(r.rooms) ? r.rooms[0]?.room_number : r.rooms.room_number) : '-';
            const resNo = r.reservation_number || r.id.slice(0, 8);
            html += `<option value="${r.id}">[${r.status}] [Kamar ${roomNo}] ${guestName} (${resNo})</option>`;
        });
        html += '</optgroup>';
    }

    selectEl.innerHTML = html;
}

export function filterTransferTargets() {
    const searchVal = (document.getElementById('transferTargetSearch')?.value || '').toLowerCase().trim();
    if (!searchVal) {
        renderTransferTargetOptions(transferTargetReservationsCache);
        return;
    }

    const filtered = transferTargetReservationsCache.filter(r => {
        const guestProfile = r.guest_profiles ? (Array.isArray(r.guest_profiles) ? r.guest_profiles[0] : r.guest_profiles) : null;
        const guestName = (guestProfile ? guestProfile.full_name : '').toLowerCase();
        const bookerName = (r.booker_name || '').toLowerCase();
        const roomNo = (r.rooms ? (Array.isArray(r.rooms) ? r.rooms[0]?.room_number : r.rooms.room_number) : '').toLowerCase();
        const resNo = (r.reservation_number || r.id).toLowerCase();

        return guestName.includes(searchVal) || bookerName.includes(searchVal) || roomNo.includes(searchVal) || resNo.includes(searchVal);
    });

    renderTransferTargetOptions(filtered);
}

export function closeTransferBillModal() {
    const modal = document.getElementById('transferBillModal');
    if (modal) modal.classList.add('hidden');
}

export async function executeTransferBill() {
    const checkedBoxes = Array.from(document.querySelectorAll('.folio-tx-checkbox:checked, .folio-tx-cb:checked'));
    const selectedIds = checkedBoxes.map(cb => cb.value);

    if (selectedIds.length === 0) {
        alert('Pilih minimal satu transaksi untuk ditransfer.');
        return;
    }

    const selectEl = document.getElementById('transferTargetSelect');
    const targetId = selectEl?.value;
    if (!targetId) {
        alert('Pilih reservasi/akun tujuan transfer.');
        return;
    }

    const selectedOption = selectEl?.options[selectEl.selectedIndex];
    const isMaster = selectedOption?.getAttribute('data-type') === 'master' ||
                     selectedOption?.dataset?.type === 'master' ||
                     targetId.startsWith('master_') ||
                     targetId.startsWith('mf_');

    const pTargetReservationId = isMaster ? null : targetId;
    const pTargetMasterFolioId = isMaster ? (targetId.startsWith('master_') || targetId.startsWith('mf_') ? targetId.replace(/^(master_|mf_)/, '') : targetId) : null;

    try {
        const { error } = await supabaseClient.rpc('rpc_transfer_folio_transaction', {
            p_transaction_ids: selectedIds,
            p_target_reservation_id: pTargetReservationId,
            p_target_master_folio_id: pTargetMasterFolioId
        });

        if (error) throw error;

        closeTransferBillModal();
        await fetchFolioTransactions(currentFolioReservation?.id);

    } catch (err) {
        console.error('Error transferring bill:', err);
        alert('Gagal mentransfer transaksi: ' + err.message);
    }
}

export async function handleTransferSingleToMaster(txId) {
    if (!txId || !currentFolioReservation) return;

    const checkboxes = document.querySelectorAll('.folio-tx-checkbox, .folio-tx-cb');
    checkboxes.forEach(cb => cb.checked = (cb.value === txId));
    updateTransferButtonsState();

    await handleMoveToMasterFolio();
}

export async function handleMoveToMasterFolio() {
    if (!currentFolioReservation) return;

    const groupId = currentFolioReservation.group_id;
    let bookingRef = currentFolioReservation.booking_reference;
    const parentResId = currentFolioReservation.parent_reservation_id;

    if (!groupId && !bookingRef && !parentResId) {
        alert('Reservasi ini tidak terhubung dengan Master Folio, Grup, atau Parent Reservation.');
        return;
    }

    const checkedBoxes = Array.from(document.querySelectorAll('.folio-tx-checkbox:checked, .folio-tx-cb:checked'));
    if (checkedBoxes.length === 0) {
        alert('Pilih minimal satu transaksi untuk dipindahkan ke Master Folio.');
        return;
    }

    try {
        let masterFolioId = null;
        if (groupId) {
            const { data } = await supabaseClient
                .from('master_folios')
                .select('id')
                .eq('group_id', groupId)
                .maybeSingle();
            if (data) masterFolioId = data.id;
        }
        if (!masterFolioId && bookingRef) {
            const { data } = await supabaseClient
                .from('master_folios')
                .select('id')
                .eq('booking_reference', bookingRef)
                .maybeSingle();
            if (data) masterFolioId = data.id;
        }
        if (!masterFolioId && parentResId) {
            const { data: parentRes } = await supabaseClient
                .from('reservations')
                .select('booking_reference, group_id')
                .eq('id', parentResId)
                .maybeSingle();

            if (parentRes) {
                if (parentRes.group_id) {
                    const { data } = await supabaseClient
                        .from('master_folios')
                        .select('id')
                        .eq('group_id', parentRes.group_id)
                        .maybeSingle();
                    if (data) masterFolioId = data.id;
                }
                if (!masterFolioId && parentRes.booking_reference) {
                    const { data } = await supabaseClient
                        .from('master_folios')
                        .select('id')
                        .eq('booking_reference', parentRes.booking_reference)
                        .maybeSingle();
                    if (data) masterFolioId = data.id;
                    if (!bookingRef) bookingRef = parentRes.booking_reference;
                }
            }
        }

        if (!masterFolioId) {
            const generatedFolioNo = 'MFOL-' + String(Date.now()).slice(-6);
            const { data: newMaster, error: createErr } = await supabaseClient
                .from('master_folios')
                .insert([{
                    folio_number: generatedFolioNo,
                    group_id: groupId || null,
                    booking_reference: bookingRef || null
                }])
                .select()
                .single();

            if (createErr) throw createErr;
            masterFolioId = newMaster.id;

            if (groupId) {
                await supabaseClient
                    .from('group_bookings')
                    .update({ folio_number: generatedFolioNo })
                    .eq('id', groupId);
            }
        }

        if (!confirm(`Transfer ${checkedBoxes.length} transaksi terpilih ke Master Folio?`)) {
            return;
        }

        const selectedIds = checkedBoxes.map(cb => cb.value);

        const { data: rpcData, error: rpcErr } = await supabaseClient.rpc('rpc_transfer_folio_transaction', {
            p_transaction_ids: selectedIds,
            p_target_reservation_id: null,
            p_target_master_folio_id: masterFolioId
        });

        if (rpcErr) throw rpcErr;

        await fetchFolioTransactions(currentFolioReservation.id);

        if (currentMasterGroup) {
            await fetchMasterFolioTransactions(currentMasterGroup);
        }

        await checkAndUpdateMasterFolioHeader(currentFolioReservation);

        const msg = (rpcData && rpcData.message) ? rpcData.message : `${selectedIds.length} transaksi berhasil dipindahkan ke Master Folio.`;
        alert(msg);

    } catch (err) {
        console.error('Error moving transactions to master folio:', err);
        alert('Gagal memindahkan transaksi: ' + err.message);
    }
}

export async function populateFolioRoutingDualList() {
    const availSelect = document.getElementById('res-routing-available');
    const routedSelect = document.getElementById('res-routing-routed');
    if (!availSelect || !routedSelect) return;

    availSelect.innerHTML = `<option disabled class="text-slate-400">Memuat artikel...</option>`;
    routedSelect.innerHTML = `<option disabled class="text-slate-400">Memuat rules...</option>`;

    try {
        const categories = [
            { id: 'CAT-ROOM', type: 'CATEGORY', category: 'Room', name: '[Kategori] All Room Charges' },
            { id: 'CAT-FB', type: 'CATEGORY', category: 'F&B', name: '[Kategori] All F&B Charges' }
        ];

        const { data: eCharges } = await supabaseClient
            .from('extra_charges')
            .select('id, name, category, price')
            .order('name', { ascending: true });

        const articles = (eCharges || []).map(ec => ({
            id: ec.id,
            type: 'ARTICLE',
            category: ec.category || 'General',
            name: `[Artikel] ${ec.name} (${ec.category || 'Charge'}) - Rp ${parseFloat(ec.price || 0).toLocaleString('id-ID')}`
        }));

        folioRoutingAvailableArticles = [...categories, ...articles];

        const editResId = document.getElementById('edit-reservation-id')?.value;
        folioRoutingRulesState = [];

        if (editResId) {
            const { data: existingRules, error: rErr } = await supabaseClient
                .from('folio_routing_rules')
                .select('*');

            if (!rErr && existingRules) {
                const resRules = existingRules.filter(r => r.source_reservation_id === editResId);
                folioRoutingRulesState = resRules;
            }
        }

        renderRoutingDualList();

    } catch (err) {
        console.error('Error populating folio routing dual list:', err);
        availSelect.innerHTML = `<option disabled class="text-red-500">Gagal memuat artikel</option>`;
        routedSelect.innerHTML = `<option disabled class="text-red-500">Gagal memuat rules</option>`;
    }
}

export function renderRoutingDualList() {
    const availSelect = document.getElementById('res-routing-available');
    const routedSelect = document.getElementById('res-routing-routed');
    if (!availSelect || !routedSelect) return;

    const routedKeys = new Set();
    folioRoutingRulesState.forEach(rule => {
        if (rule.route_type === 'CATEGORY' && rule.category_name) {
            routedKeys.add(`CAT-${rule.category_name.toUpperCase()}`);
        } else if (rule.route_type === 'ARTICLE' && rule.article_id) {
            routedKeys.add(rule.article_id);
        }
    });

    let availHTML = '';
    let routedHTML = '';

    folioRoutingAvailableArticles.forEach(item => {
        const isRouted = routedKeys.has(item.id) ||
                        (item.type === 'CATEGORY' && (routedKeys.has(`CAT-${item.category.toUpperCase()}`) || routedKeys.has(item.id)));

        if (isRouted) {
            routedHTML += `<option value="${item.id}" data-type="${item.type}" data-category="${item.category}" class="py-1 px-2 border-b border-slate-100 hover:bg-emerald-50">${item.name}</option>`;
        } else {
            availHTML += `<option value="${item.id}" data-type="${item.type}" data-category="${item.category}" class="py-1 px-2 border-b border-slate-100 hover:bg-blue-50">${item.name}</option>`;
        }
    });

    availSelect.innerHTML = availHTML || `<option disabled class="text-slate-400 p-2">Semua artikel telah ditransfer ke Master</option>`;
    routedSelect.innerHTML = routedHTML || `<option disabled class="text-slate-400 p-2">Belum ada artikel yang ditransfer</option>`;
}

export function moveSelectedRouting(direction) {
    const availSelect = document.getElementById('res-routing-available');
    const routedSelect = document.getElementById('res-routing-routed');

    if (direction === 'right') {
        const selectedOptions = Array.from(availSelect.selectedOptions).filter(opt => !opt.disabled);
        if (selectedOptions.length === 0) return;

        selectedOptions.forEach(opt => {
            const itemId = opt.value;
            const itemObj = folioRoutingAvailableArticles.find(i => i.id === itemId);
            if (itemObj) {
                const ruleObj = {
                    route_type: itemObj.type,
                    category_name: itemObj.type === 'CATEGORY' ? itemObj.category : (itemObj.category || 'General'),
                    article_id: itemObj.type === 'ARTICLE' ? itemObj.id : null
                };
                folioRoutingRulesState.push(ruleObj);
            }
        });
    } else if (direction === 'left') {
        const selectedOptions = Array.from(routedSelect.selectedOptions).filter(opt => !opt.disabled);
        if (selectedOptions.length === 0) return;

        const removedIds = new Set(selectedOptions.map(opt => opt.value));
        folioRoutingRulesState = folioRoutingRulesState.filter(rule => {
            if (rule.route_type === 'CATEGORY' && rule.category_name) {
                return !removedIds.has(`CAT-${rule.category_name.toUpperCase()}`);
            } else if (rule.route_type === 'ARTICLE' && rule.article_id) {
                return !removedIds.has(rule.article_id);
            }
            return true;
        });
    }

    renderRoutingDualList();
}

export async function handleSaveFolioRouting() {
    const editResId = document.getElementById('edit-reservation-id')?.value;
    if (!editResId) {
        alert('Routing rules akan otomatis tersimpan saat Anda menyimpan Reservasi.');
        return;
    }

    try {
        const { error: delErr } = await supabaseClient
            .from('folio_routing_rules')
            .delete()
            .eq('source_reservation_id', editResId);

        if (delErr) throw delErr;

        if (folioRoutingRulesState.length > 0) {
            const insertPayload = folioRoutingRulesState.map(rule => ({
                source_reservation_id: editResId,
                route_type: rule.route_type,
                category_name: rule.category_name,
                article_id: rule.article_id
            }));

            const { error: insErr } = await supabaseClient
                .from('folio_routing_rules')
                .insert(insertPayload);

            if (insErr) throw insErr;
        }

        alert('Attribut Folio Routing Rules berhasil disimpan!');

    } catch (err) {
        console.error('Error saving folio routing:', err);
        alert('Gagal menyimpan Folio Routing: ' + err.message);
    }
}

// ==========================================
// CHECKOUT & PRINT
// ==========================================

export async function handleProcessCheckout() {
    if (!currentFolioReservation) return;

    if (calculatedCurrentBalance !== 0) {
        alert('Cannot Check-out. Folio balance must be 0.');
        return;
    }

    const checkoutBtn = document.getElementById('processCheckoutBtn');
    if (checkoutBtn) {
        checkoutBtn.disabled = true;
        checkoutBtn.innerHTML = `<i class="ph ph-spinner animate-spin text-lg"></i> Processing Check-out...`;
    }

    try {
        let rpcSuccess = false;
        try {
            const { data: rpcData, error: rpcErr } = await supabaseClient.rpc('rpc_process_checkout', {
                p_reservation_id: currentFolioReservation.id
            });
            if (!rpcErr && rpcData && rpcData.success !== false) {
                rpcSuccess = true;
            } else if (rpcErr) {
                console.warn('rpc_process_checkout error, falling back to direct update:', rpcErr);
            }
        } catch (e) {
            console.warn('rpc_process_checkout call exception, falling back:', e);
        }

        if (!rpcSuccess) {
            const { error } = await supabaseClient
                .from('reservations')
                .update({ status: 'Checkout' })
                .eq('id', currentFolioReservation.id);

            if (error) throw error;

            const roomId = currentFolioReservation.room_id;
            if (roomId) {
                const { error: updateRoomErr } = await supabaseClient
                    .from('rooms')
                    .update({ status: 'VD' })
                    .eq('id', roomId);

                if (updateRoomErr) console.error('Error updating room status to VD:', updateRoomErr);
            }
        }

        if (typeof window.fetchRooms === 'function') window.fetchRooms();

        alert('Check-out berhasil diproses!');
        closeFolioModal();
        if (typeof window.fetchFrontdeskDashboard === 'function') await window.fetchFrontdeskDashboard();
        if (typeof window.renderTapeChart === 'function') await window.renderTapeChart();

    } catch (err) {
        console.error('Error processing checkout:', err);
        alert('Gagal memproses check-out: ' + err.message);
    } finally {
        if (checkoutBtn) {
            checkoutBtn.disabled = false;
            checkoutBtn.innerHTML = `<i class="ph ph-sign-out text-lg"></i> Process Check-out`;
        }
    }
}

export async function handleCheckOut(reservationId, roomId) {
    const targetResId = reservationId || (currentFolioReservation ? currentFolioReservation.id : null);
    if (!targetResId) return;

    try {
        const { error } = await supabaseClient
            .from('reservations')
            .update({ status: 'Checkout' })
            .eq('id', targetResId);

        if (error) throw error;

        let targetRoomId = roomId || (currentFolioReservation ? currentFolioReservation.room_id : null);
        if (!targetRoomId) {
            const { data: res } = await supabaseClient
                .from('reservations')
                .select('room_id')
                .eq('id', targetResId)
                .single();
            if (res) targetRoomId = res.room_id;
        }

        if (targetRoomId) {
            const { error: updateRoomErr } = await supabaseClient
                .from('rooms')
                .update({ status: 'VD' })
                .eq('id', targetRoomId);

            if (updateRoomErr) console.error('Error updating room status to VD:', updateRoomErr);
        }

        if (typeof window.fetchRooms === 'function') window.fetchRooms();

        alert('Check-out berhasil diproses!');
        if (typeof window.fetchFrontdeskDashboard === 'function') await window.fetchFrontdeskDashboard();
        if (typeof window.renderTapeChart === 'function') await window.renderTapeChart();

    } catch (err) {
        console.error('Error processing check-out:', err);
        alert('Gagal memproses check-out: ' + err.message);
    }
}

export function handlePrintFolio() {
    if (!currentFolioReservation) return;

    const res = currentFolioReservation;
    const guestName = res.guest_profiles ? res.guest_profiles.full_name : (res.booker_name || 'Guest');
    const roomNo = res.rooms ? res.rooms.room_number : '-';
    const resNo = res.reservation_number || res.id.slice(0, 8);
    const folioNo = res.folio_number || (`FOL-${resNo}`);
    const printDate = new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' });

    let totalCharges = 0;
    let totalPayments = 0;

    const rowsHtml = currentFolioTransactions.map(tx => {
        const txType = (tx.transaction_type || 'CHARGE').toUpperCase();
        const amount = Number(tx.amount || 0);
        const isVoided = tx.is_voided === true;

        if (!isVoided) {
            if (txType === 'CHARGE') totalCharges += amount;
            else if (txType === 'PAYMENT') totalPayments += amount;
        }

        const dateStr = tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
        const chargeDisplay = txType === 'CHARGE' ? `Rp ${amount.toLocaleString('id-ID')}` : '-';
        const paymentDisplay = txType === 'PAYMENT' ? `Rp ${amount.toLocaleString('id-ID')}` : '-';
        const desc = isVoided ? `<span style="text-decoration: line-through; color: #94a3b8;">${tx.description || '-'} [VOID]</span>` : (tx.description || '-');

        return `
            <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
                <td style="padding: 6px 8px;">${dateStr}</td>
                <td style="padding: 6px 8px;">${desc}</td>
                <td style="padding: 6px 8px; text-align: center;">${txType === 'CHARGE' ? (tx.qty || 1) : '-'}</td>
                <td style="padding: 6px 8px; text-align: right;">${chargeDisplay}</td>
                <td style="padding: 6px 8px; text-align: right;">${paymentDisplay}</td>
            </tr>
        `;
    }).join('');

    const currentBalance = totalCharges - totalPayments;

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
        alert('Pop-up terblokir. Izinkan pop-up untuk mencetak folio.');
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Guest Folio - ${guestName}</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1e293b; background: #fff; }
                .header-container { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
                .hotel-info h1 { margin: 0 0 4px 0; font-size: 20px; font-weight: 800; color: #0f172a; }
                .hotel-info p { margin: 0; color: #64748b; font-size: 12px; }
                .reference-box { text-align: right; }
                .folio-highlight { font-family: monospace; font-size: 22px; font-weight: 800; color: #0f172a; background: #fef3c7; padding: 4px 10px; border-radius: 6px; border: 1px solid #f59e0b; display: inline-block; }
                .res-sub { font-size: 13px; font-weight: 600; color: #475569; margin-top: 6px; }
                .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f8fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; }
                .details-item label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; }
                .details-item span { font-size: 13px; font-weight: 600; color: #0f172a; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th { background: #f1f5f9; padding: 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; border-bottom: 2px solid #cbd5e1; }
                .summary-box { width: 280px; margin-left: auto; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; }
                .summary-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px; }
                .summary-row.total { font-weight: 800; font-size: 14px; border-top: 1px solid #cbd5e1; pt-2; margin-top: 6px; padding-top: 6px; color: #0f172a; }
                .footer-note { margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
                @media print {
                    body { padding: 0; }
                    .folio-highlight { background: #fef3c7 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="header-container">
                <div class="hotel-info">
                    <h1>NG HOTEL MANAGEMENT</h1>
                    <p>Official Guest Billing & Folio Invoice</p>
                </div>
                <div class="reference-box">
                    <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 2px;">FOLIO NUMBER</div>
                    <div class="folio-highlight">${folioNo}</div>
                    <div class="res-sub">Nomor Reservasi: <span style="font-family: monospace;">${resNo}</span></div>
                </div>
            </div>

            <div class="details-grid">
                <div class="details-item">
                    <label>Nama Tamu</label>
                    <span>${guestName}</span>
                </div>
                <div class="details-item">
                    <label>Nomor Kamar</label>
                    <span>Kamar ${roomNo}</span>
                </div>
                <div class="details-item">
                    <label>Tanggal Inap (Check-in / Check-out)</label>
                    <span>${res.check_in_date || '-'} s/d ${res.check_out_date || '-'} (${res.nights || 1} Malam)</span>
                </div>
                <div class="details-item">
                    <label>Tanggal Cetak</label>
                    <span>${printDate}</span>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Tanggal</th>
                        <th>Deskripsi / Kategori</th>
                        <th style="text-align: center;">Qty</th>
                        <th style="text-align: right;">Charge (Debit)</th>
                        <th style="text-align: right;">Payment (Kredit)</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <div class="summary-box">
                <div class="summary-row">
                    <span>Total Charge:</span>
                    <span>Rp ${totalCharges.toLocaleString('id-ID')}</span>
                </div>
                <div class="summary-row">
                    <span>Total Payment:</span>
                    <span>Rp ${totalPayments.toLocaleString('id-ID')}</span>
                </div>
                <div class="summary-row total">
                    <span>Sisa Tagihan (Balance):</span>
                    <span>Rp ${currentBalance.toLocaleString('id-ID')}</span>
                </div>
            </div>

            <div class="footer-note">
                <p>Terima kasih atas kunjungan Anda di NG Hotel. Dokumen ini merupakan bukti tagihan resmi.</p>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
    try { printWindow.print(); } catch (e) {}
}

export function handlePrintMasterFolio() {
    if (!currentMasterGroup) return;

    const gb = currentMasterGroup;
    const folioNo = gb.folio_number || ('MFOL-' + (gb.id ? gb.id.slice(0, 8) : '000000'));
    const groupName = gb.group_name || 'Master Folio';
    const corpName = gb.corporate_name || (gb.booking_reference ? `OTA Ref: ${gb.booking_reference}` : 'Non-Corporate');
    const printDate = new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' });

    let totalCharges = 0;
    let totalPayments = 0;

    const rowsHtml = currentMasterTransactions.map(tx => {
        const txType = (tx.transaction_type || 'CHARGE').toUpperCase();
        const amount = Number(tx.amount || 0);
        const isVoided = tx.is_voided === true;

        if (!isVoided) {
            if (txType === 'CHARGE') totalCharges += amount;
            else if (txType === 'PAYMENT') totalPayments += amount;
        }

        const dateStr = tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
        const chargeDisplay = txType === 'CHARGE' ? `Rp ${amount.toLocaleString('id-ID')}` : '-';
        const paymentDisplay = txType === 'PAYMENT' ? `Rp ${amount.toLocaleString('id-ID')}` : '-';
        const desc = isVoided ? `<span style="text-decoration: line-through; color: #94a3b8;">${tx.description || '-'} [VOID]</span>` : (tx.description || '-');

        return `
            <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
                <td style="padding: 6px 8px;">${dateStr}</td>
                <td style="padding: 6px 8px;">${desc}</td>
                <td style="padding: 6px 8px; text-align: center;">${txType === 'CHARGE' ? (tx.qty || 1) : '-'}</td>
                <td style="padding: 6px 8px; text-align: right;">${chargeDisplay}</td>
                <td style="padding: 6px 8px; text-align: right;">${paymentDisplay}</td>
            </tr>
        `;
    }).join('');

    const currentBalance = totalCharges - totalPayments;

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
        alert('Pop-up terblokir. Izinkan pop-up untuk mencetak Master Folio.');
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Master Folio Invoice - ${groupName}</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1e293b; background: #fff; }
                .header-container { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
                .hotel-info h1 { margin: 0; font-size: 20px; color: #0f172a; }
                .hotel-info p { margin: 2px 0 0; font-size: 11px; color: #64748b; }
                .reference-box { text-align: right; }
                .folio-highlight { background: #e0e7ff; color: #3730a3; padding: 4px 10px; font-weight: 800; font-family: monospace; font-size: 16px; border-radius: 4px; display: inline-block; }
                .res-sub { font-size: 11px; color: #64748b; margin-top: 4px; }
                .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; }
                .details-item label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; }
                .details-item span { font-size: 13px; font-weight: 600; color: #0f172a; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th { background: #f1f5f9; padding: 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; border-bottom: 2px solid #cbd5e1; }
                .summary-box { width: 280px; margin-left: auto; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; }
                .summary-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px; }
                .summary-row.total { font-weight: 800; font-size: 14px; border-top: 1px solid #cbd5e1; margin-top: 6px; padding-top: 6px; color: #0f172a; }
                .footer-note { margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
                @media print {
                    body { padding: 0; }
                    .folio-highlight { background: #e0e7ff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="header-container">
                <div class="hotel-info">
                    <h1>NG HOTEL MANAGEMENT</h1>
                    <p>Official Group Master Billing & Invoice</p>
                </div>
                <div class="reference-box">
                    <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 2px;">MASTER FOLIO NUMBER</div>
                    <div class="folio-highlight">${folioNo}</div>
                </div>
            </div>

            <div class="details-grid">
                <div class="details-item">
                    <label>Nama Grup</label>
                    <span>${groupName}</span>
                </div>
                <div class="details-item">
                    <label>Perusahaan / Corporate</label>
                    <span>${corpName}</span>
                </div>
                <div class="details-item">
                    <label>Tanggal Cetak</label>
                    <span>${printDate}</span>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Tanggal</th>
                        <th>Deskripsi / Kategori</th>
                        <th style="text-align: center;">Qty</th>
                        <th style="text-align: right;">Charge (Debit)</th>
                        <th style="text-align: right;">Payment (Kredit)</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <div class="summary-box">
                <div class="summary-row">
                    <span>Total Charge:</span>
                    <span>Rp ${totalCharges.toLocaleString('id-ID')}</span>
                </div>
                <div class="summary-row">
                    <span>Total Payment:</span>
                    <span>Rp ${totalPayments.toLocaleString('id-ID')}</span>
                </div>
                <div class="summary-row total">
                    <span>Sisa Tagihan (Balance):</span>
                    <span>Rp ${currentBalance.toLocaleString('id-ID')}</span>
                </div>
            </div>

            <div class="footer-note">
                <p>Terima kasih atas kerja sama Anda dengan NG Hotel. Dokumen ini merupakan bukti tagihan Master resmi.</p>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
    try { printWindow.print(); } catch (e) {}
}
