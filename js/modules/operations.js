import { supabaseClient } from '../config/supabase.js';
import { formatDateISO, formatStayDatesCompact, getStatusBadgeHTML } from '../utils/formatters.js';

// --- Housekeeping Management Logic ---
export function getHousekeepingBgColor(status) {
    const s = (status || '').toUpperCase();
    switch (s) {
        case 'VC':
        case 'CLEAN':
        case 'VACANT CLEAN':
            return 'bg-emerald-100 text-emerald-900 border-emerald-200';
        case 'VD':
        case 'DIRTY':
        case 'VACANT DIRTY':
            return 'bg-yellow-100 text-yellow-900 border-yellow-200';
        case 'OC':
        case 'OCCUPIED CLEAN':
            return 'bg-blue-100 text-blue-900 border-blue-200';
        case 'OD':
        case 'OCCUPIED DIRTY':
            return 'bg-orange-100 text-orange-900 border-orange-200';
        case 'OOO':
        case 'OUT OF ORDER':
            return 'bg-red-100 text-red-900 border-red-200';
        default:
            return 'bg-white text-slate-800 border-slate-200';
    }
}

export async function fetchHousekeepingRooms() {
    const grid = document.getElementById('housekeeping-grid');
    if (!grid) return;

    grid.innerHTML = `
        <div class="col-span-full py-8">
            <div class="space-y-3 max-w-2xl mx-auto">
                <div class="bg-slate-200/60 backdrop-blur-xs animate-pulse rounded-xl h-6 w-full"></div>
                <div class="bg-slate-200/60 backdrop-blur-xs animate-pulse rounded-xl h-6 w-3/4"></div>
                <div class="bg-slate-200/60 backdrop-blur-xs animate-pulse rounded-xl h-6 w-5/6"></div>
            </div>
        </div>
    `;

    try {
        const { data, error } = await supabaseClient
            .from('rooms')
            .select('id, room_number, status, room_type_id, is_virtual, room_types(name)')
            .eq('is_virtual', false)
            .order('room_number', { ascending: true });

        if (error) throw error;

        if (data) {
            data.sort((a, b) => a.room_number.localeCompare(b.room_number, undefined, {numeric: true, sensitivity: 'base'}));
        }

        if (!data || data.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full py-12 text-center text-slate-400">
                    <i class="ph ph-bed text-4xl mb-2 text-slate-300"></i>
                    <div>Belum ada kamar yang terdaftar.</div>
                </div>
            `;
            return;
        }

        grid.innerHTML = data.map(room => {
            const roomTypeName = room.room_types
                ? (Array.isArray(room.room_types) ? room.room_types[0]?.name : room.room_types.name)
                : '-';
            const currentStatus = room.status || 'VD';

            let statusBadgeClass = 'bg-slate-100 text-slate-800 border-slate-200';
            const upperStatus = currentStatus.toUpperCase();
            let normalizedStatus = upperStatus;

            if (upperStatus === 'VD' || upperStatus === 'VACANT DIRTY' || upperStatus === 'DIRTY') {
                normalizedStatus = 'VD';
                statusBadgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
            } else if (upperStatus === 'VC' || upperStatus === 'VACANT CLEAN' || upperStatus === 'CLEAN') {
                normalizedStatus = 'VC';
                statusBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
            } else if (upperStatus === 'OC' || upperStatus === 'OCCUPIED CLEAN') {
                normalizedStatus = 'OC';
                statusBadgeClass = 'bg-blue-100 text-blue-800 border-blue-200';
            } else if (upperStatus === 'OD' || upperStatus === 'OCCUPIED DIRTY') {
                normalizedStatus = 'OD';
                statusBadgeClass = 'bg-orange-100 text-orange-800 border-orange-200';
            } else if (upperStatus === 'OOO' || upperStatus === 'OUT OF ORDER') {
                normalizedStatus = 'OOO';
                statusBadgeClass = 'bg-red-100 text-red-800 border-red-200';
            } else if (upperStatus === 'OOS' || upperStatus === 'OUT OF SERVICE') {
                normalizedStatus = 'OOS';
                statusBadgeClass = 'bg-slate-100 text-slate-800 border-slate-200';
            }

            const statuses = [
                { value: 'VD', label: 'VD (Vacant Dirty)' },
                { value: 'VC', label: 'VC (Vacant Clean)' },
                { value: 'OC', label: 'OC (Occupied Clean)' },
                { value: 'OD', label: 'OD (Occupied Dirty)' },
                { value: 'OOO', label: 'OOO (Out of Order)' },
                { value: 'OOS', label: 'OOS (Out of Service)' }
            ];

            const statusOptionsHTML = statuses.map(s => `
                <option value="${s.value}" ${normalizedStatus === s.value ? 'selected' : ''}>${s.label}</option>
            `).join('');

            let quickActionButton = '';
            if (normalizedStatus === 'VD') {
                quickActionButton = `
                    <button onclick="updateRoomStatus('${room.id}', 'VC')" class="w-full mb-2 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer">
                        <i class="ph ph-check-circle text-sm"></i> Mark Clean (VC)
                    </button>
                `;
            } else if (normalizedStatus === 'VC') {
                quickActionButton = `
                    <button onclick="updateRoomStatus('${room.id}', 'VD')" class="w-full mb-2 py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer">
                        <i class="ph ph-broom text-sm"></i> Mark Dirty (VD)
                    </button>
                `;
            }

            return `
                <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                    <div>
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <span class="text-2xl font-bold text-slate-800 tracking-tight">Kamar ${room.room_number || '-'}</span>
                                <div class="text-xs font-medium text-slate-500 mt-0.5">${roomTypeName}</div>
                            </div>
                            ${getStatusBadgeHTML(currentStatus)}
                        </div>
                    </div>
                    <div class="pt-4 border-t border-slate-100 mt-2">
                        ${quickActionButton}
                        <label class="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Update Status</label>
                        <select onchange="updateRoomStatus('${room.id}', this.value)" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-white focus:bg-white focus:outline-none focus:border-primary transition-colors cursor-pointer">
                            ${statusOptionsHTML}
                        </select>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Error fetching housekeeping rooms:', err);
        grid.innerHTML = `
            <div class="col-span-full py-12 text-center text-red-500">
                <i class="ph ph-warning-circle text-3xl mb-1 inline-block"></i>
                <div>Gagal memuat data kamar housekeeping: ${err.message}</div>
            </div>
        `;
    }
}

export function openBlockRoomModal(roomId, blockType) {
    const roomIdEl = document.getElementById('block-room-id');
    const blockTypeEl = document.getElementById('block-type');
    if (roomIdEl) roomIdEl.value = roomId;
    if (blockTypeEl) blockTypeEl.value = blockType;

    const todayStr = formatDateISO(new Date());
    const startEl = document.getElementById('block-start-date');
    const endEl = document.getElementById('block-end-date');
    const reasonEl = document.getElementById('block-reason');
    if (startEl) startEl.value = todayStr;
    if (endEl) endEl.value = todayStr;
    if (reasonEl) reasonEl.value = '';

    const modal = document.getElementById('blockRoomModal');
    if (modal) modal.classList.remove('hidden');
}

export function closeBlockRoomModal() {
    const modal = document.getElementById('blockRoomModal');
    if (modal) modal.classList.add('hidden');
    const form = document.getElementById('blockRoomForm');
    if (form) form.reset();
    fetchHousekeepingRooms();
}

export async function handleSaveBlockRoom(event) {
    if (event) event.preventDefault();
    const roomId = document.getElementById('block-room-id')?.value;
    const blockType = document.getElementById('block-type')?.value;
    const startDate = document.getElementById('block-start-date')?.value;
    const endDate = document.getElementById('block-end-date')?.value;
    const reason = document.getElementById('block-reason')?.value;

    try {
        // Insert record to room_blocks
        const { error: blockErr } = await supabaseClient
            .from('room_blocks')
            .insert([{
                room_id: roomId,
                block_type: blockType,
                start_date: startDate,
                end_date: endDate,
                reason: reason
            }]);

        if (blockErr) throw blockErr;

        // Update room status in rooms table
        const { error: roomErr } = await supabaseClient
            .from('rooms')
            .update({ status: blockType })
            .eq('id', roomId);

        if (roomErr) throw roomErr;

        alert(`Kamar berhasil di-block (${blockType})!`);
        const modal = document.getElementById('blockRoomModal');
        if (modal) modal.classList.add('hidden');
        const form = document.getElementById('blockRoomForm');
        if (form) form.reset();

        fetchHousekeepingRooms();
        if (typeof window.fetchRooms === 'function') window.fetchRooms();
        if (typeof window.renderTapeChart === 'function') window.renderTapeChart();
    } catch (err) {
        console.error('Error saving block room:', err);
        alert('Gagal menyimpan pemblokiran kamar: ' + err.message);
    }
}

export async function updateRoomStatus(roomId, newStatus) {
    const upperStatus = (newStatus || '').toUpperCase();
    if (upperStatus === 'OOO' || upperStatus === 'OOS') {
        openBlockRoomModal(roomId, upperStatus);
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('rooms')
            .update({ status: newStatus })
            .eq('id', roomId);

        if (error) throw error;

        alert('Status kamar berhasil diperbarui!');
        fetchHousekeepingRooms();
        if (typeof window.fetchRooms === 'function') window.fetchRooms(); // Silent background fetch to update roomsCache
    } catch (err) {
        console.error('Error updating room status:', err);
        alert('Gagal mengupdate status kamar: ' + err.message);
    }
}

export async function updateRoomHousekeepingStatus(roomId, newStatus) {
    return updateRoomStatus(roomId, newStatus);
}

// --- Non-Stay Guest (NSG) / Paymaster JS Logic ---
export function openNsgAccountModal() {
    const modal = document.getElementById('nsgAccountModal');
    if (modal) {
        const form = document.getElementById('nsgAccountForm');
        if (form) form.reset();
        modal.classList.remove('hidden');
    }
}

export function closeNsgAccountModal() {
    const modal = document.getElementById('nsgAccountModal');
    if (modal) {
        modal.classList.add('hidden');
        const form = document.getElementById('nsgAccountForm');
        if (form) form.reset();
    }
}

export async function fetchNsgList() {
    const tbody = document.getElementById('nsg-list-tbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="5" class="p-4">
                <div class="space-y-3">
                    <div class="bg-slate-200/60 backdrop-blur-xs animate-pulse rounded-xl h-6 w-full"></div>
                    <div class="bg-slate-200/60 backdrop-blur-xs animate-pulse rounded-xl h-6 w-3/4"></div>
                    <div class="bg-slate-200/60 backdrop-blur-xs animate-pulse rounded-xl h-6 w-5/6"></div>
                </div>
            </td>
        </tr>
    `;

    try {
        const { data, error } = await supabaseClient
            .from('reservations')
            .select(`
                *,
                rooms (room_number),
                guest_profiles (full_name)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const filteredData = (data || []).filter(item => {
            const roomNo = item.rooms ? (Array.isArray(item.rooms) ? item.rooms[0]?.room_number : item.rooms.room_number) : null;
            const isPmRoom = roomNo && String(roomNo).toLowerCase().startsWith('pm-');
            const isNsg = item.guest_type === 'Non-Staying Guest';
            return isNsg || isPmRoom;
        });

        if (!filteredData || filteredData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-8 text-center text-slate-400">
                        Belum ada akun Non-Stay Guest (NSG) / Paymaster (PM).
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filteredData.map(item => {
            const resNo = item.reservation_number || (item.id ? item.id.slice(0, 8) : '-');
            const guestFullName = item.guest_profiles ? (Array.isArray(item.guest_profiles) ? item.guest_profiles[0]?.full_name : item.guest_profiles.full_name) : null;
            const accountName = item.booker_name || guestFullName || '-';
            const description = item.comment || '-';
            const status = item.status || 'Checkin';

            return `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="py-3 px-4 font-mono font-medium text-slate-800">${resNo}</td>
                    <td class="py-3 px-4 font-medium text-slate-900">${accountName}</td>
                    <td class="py-3 px-4 text-slate-600">${description}</td>
                    <td class="py-3 px-4">
                        ${getStatusBadgeHTML(status)}
                    </td>
                    <td class="py-3 px-4 text-right">
                        <button onclick="openFolioModal('${item.id}')" class="px-3 py-1.5 bg-primary hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition-colors shadow-xs inline-flex items-center gap-1 cursor-pointer">
                            <i class="ph ph-receipt text-sm"></i> Open Folio
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error('Error fetching NSG list:', err);
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-8 text-center text-red-500">
                    Gagal memuat data NSG: ${err.message}
                </td>
            </tr>
        `;
    }
}

export async function fetchNsgAccounts() {
    return fetchNsgList();
}

export async function handleSaveNsg(event) {
    if (event) event.preventDefault();

    const accountNameInput = document.getElementById('nsgAccountName');
    const descriptionInput = document.getElementById('nsgAccountDescription');
    const submitBtn = document.getElementById('nsgAccountSubmitBtn');

    const accountName = accountNameInput ? accountNameInput.value.trim() : '';
    const description = descriptionInput ? descriptionInput.value.trim() : '';

    if (!accountName) {
        alert('Nama Akun wajib diisi!');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="ph ph-spinner animate-spin text-lg"></i> Menyimpan...`;
    }

    try {
        const todayISO = new Date().toISOString().split('T')[0];
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const nsgNumber = `NSG-${Date.now().toString().slice(-6)}-${randomNum}`;

        const payload = {
            guest_type: 'Non-Staying Guest',
            status: 'Checkin',
            qty: 1,
            room_id: null,
            booker_name: accountName,
            comment: description,
            reservation_number: nsgNumber,
            check_in_date: todayISO,
            check_out_date: todayISO,
            nights: 1,
            room_rate: 0
        };

        const { data, error } = await supabaseClient
            .from('reservations')
            .insert([payload])
            .select();

        if (error) throw error;

        alert('Akun Non-Stay Guest (NSG) berhasil dibuat!');
        closeNsgAccountModal();
        await fetchNsgList();

    } catch (err) {
        console.error('Error saving NSG account:', err);
        alert('Gagal menyimpan akun NSG: ' + err.message);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Simpan';
        }
    }
}

// --- Corporate Profiles (B2B) JS Logic ---
export async function fetchCorporateProfiles() {
    try {
        const tbody = document.getElementById('corporate-list-tbody');
        if (!tbody) return;
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="p-4">
                    <div class="space-y-3">
                        <div class="bg-slate-200/60 backdrop-blur-xs animate-pulse rounded-xl h-6 w-full"></div>
                        <div class="bg-slate-200/60 backdrop-blur-xs animate-pulse rounded-xl h-6 w-3/4"></div>
                        <div class="bg-slate-200/60 backdrop-blur-xs animate-pulse rounded-xl h-6 w-5/6"></div>
                    </div>
                </td>
            </tr>
        `;

        const { data, error } = await supabaseClient
            .from('corporate_profiles')
            .select('*')
            .order('company_name', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="py-8 text-center text-slate-400">
                        Belum ada data corporate / travel agent.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = data.map(corp => {
            const companyName = corp.company_name || '-';
            const npwp = corp.npwp || '-';
            const billingAddress = corp.billing_address || '-';
            const picName = corp.pic_name || '-';
            const termOfPayment = corp.term_of_payment ? `${corp.term_of_payment} Hari` : '-';
            const creditLimit = corp.credit_limit ? `Rp ${parseFloat(corp.credit_limit).toLocaleString('id-ID')}` : 'Rp 0';

            const escapedName = (corp.company_name || '').replace(/'/g, "\\'");
            const escapedNpwp = (corp.npwp || '').replace(/'/g, "\\'");
            const escapedAddr = (corp.billing_address || '').replace(/'/g, "\\'").replace(/\n/g, "\\n");
            const escapedPic = (corp.pic_name || '').replace(/'/g, "\\'");

            return `
                <tr class="hover:bg-slate-50/80 transition-colors">
                    <td class="py-3.5 px-4 font-semibold text-slate-800">${companyName}</td>
                    <td class="py-3.5 px-4 font-mono text-xs text-slate-600">${npwp}</td>
                    <td class="py-3.5 px-4 text-xs text-slate-600 max-w-xs truncate" title="${billingAddress}">${billingAddress}</td>
                    <td class="py-3.5 px-4 text-xs font-medium text-slate-700">${picName}</td>
                    <td class="py-3.5 px-4 text-xs text-slate-600">${termOfPayment}</td>
                    <td class="py-3.5 px-4 font-bold text-slate-800 text-xs">${creditLimit}</td>
                    <td class="py-3.5 px-4 text-right space-x-2">
                        <button onclick="openEditCorporate('${corp.id}', '${escapedName}', '${escapedNpwp}', '${escapedAddr}', '${escapedPic}', ${corp.term_of_payment || 30}, ${corp.credit_limit || 0})" class="text-blue-600 hover:text-blue-800 transition-colors p-1 cursor-pointer" title="Edit"><i class="ph ph-pencil text-lg"></i></button>
                        <button onclick="deleteCorporate('${corp.id}')" class="text-red-600 hover:text-red-800 transition-colors p-1 cursor-pointer" title="Hapus"><i class="ph ph-trash text-lg"></i></button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error('Error fetching corporate profiles:', err);
        alert('Gagal memuat profil corporate: ' + err.message);
    }
}

export function openCorporateModal() {
    const editIdEl = document.getElementById('edit-corporate-id');
    const nameEl = document.getElementById('corpCompanyName');
    const npwpEl = document.getElementById('corpNpwp');
    const picEl = document.getElementById('corpPicName');
    const addrEl = document.getElementById('corpBillingAddress');
    const topEl = document.getElementById('corpTermOfPayment');
    const limitEl = document.getElementById('corpCreditLimit');

    if (editIdEl) editIdEl.value = '';
    if (nameEl) nameEl.value = '';
    if (npwpEl) npwpEl.value = '';
    if (picEl) picEl.value = '';
    if (addrEl) addrEl.value = '';
    if (topEl) topEl.value = '30';
    if (limitEl) limitEl.value = '0';

    const titleEl = document.getElementById('corporateModalTitle');
    const submitEl = document.getElementById('corporateSubmitBtn');
    if (titleEl) titleEl.textContent = 'Add Corporate Profile';
    if (submitEl) submitEl.textContent = 'Simpan';

    const modal = document.getElementById('corporateModal');
    if (modal) modal.classList.remove('hidden');
}

export function openEditCorporate(id, companyName, npwp, billingAddress, picName, termOfPayment, creditLimit) {
    const editIdEl = document.getElementById('edit-corporate-id');
    const nameEl = document.getElementById('corpCompanyName');
    const npwpEl = document.getElementById('corpNpwp');
    const picEl = document.getElementById('corpPicName');
    const addrEl = document.getElementById('corpBillingAddress');
    const topEl = document.getElementById('corpTermOfPayment');
    const limitEl = document.getElementById('corpCreditLimit');

    if (editIdEl) editIdEl.value = id;
    if (nameEl) nameEl.value = companyName || '';
    if (npwpEl) npwpEl.value = npwp || '';
    if (picEl) picEl.value = picName || '';
    if (addrEl) addrEl.value = billingAddress || '';
    if (topEl) topEl.value = termOfPayment !== undefined ? termOfPayment : 30;
    if (limitEl) limitEl.value = creditLimit !== undefined ? creditLimit : 0;

    const titleEl = document.getElementById('corporateModalTitle');
    const submitEl = document.getElementById('corporateSubmitBtn');
    if (titleEl) titleEl.textContent = 'Edit Corporate Profile';
    if (submitEl) submitEl.textContent = 'Update';

    const modal = document.getElementById('corporateModal');
    if (modal) modal.classList.remove('hidden');
}

export function closeCorporateModal() {
    const modal = document.getElementById('corporateModal');
    if (modal) modal.classList.add('hidden');
    const form = document.getElementById('corporateForm');
    if (form) form.reset();
    const editIdEl = document.getElementById('edit-corporate-id');
    if (editIdEl) editIdEl.value = '';
}

export async function handleSaveCorporate(event) {
    if (event) event.preventDefault();

    const editId = document.getElementById('edit-corporate-id')?.value;
    const companyName = document.getElementById('corpCompanyName')?.value.trim();
    const npwp = document.getElementById('corpNpwp')?.value.trim() || null;
    const picName = document.getElementById('corpPicName')?.value.trim() || null;
    const billingAddress = document.getElementById('corpBillingAddress')?.value.trim() || null;
    const termOfPayment = parseInt(document.getElementById('corpTermOfPayment')?.value, 10) || 0;
    const creditLimit = parseFloat(document.getElementById('corpCreditLimit')?.value) || 0;

    if (!companyName) {
        alert('Nama Perusahaan wajib diisi!');
        return;
    }

    const payload = {
        company_name: companyName,
        npwp: npwp,
        pic_name: picName,
        billing_address: billingAddress,
        term_of_payment: termOfPayment,
        credit_limit: creditLimit
    };

    try {
        if (editId) {
            const { error } = await supabaseClient
                .from('corporate_profiles')
                .update(payload)
                .eq('id', editId);
            if (error) throw error;
            alert('Profil Perusahaan berhasil diperbarui!');
        } else {
            const { error } = await supabaseClient
                .from('corporate_profiles')
                .insert([payload]);
            if (error) throw error;
            alert('Profil Perusahaan berhasil ditambahkan!');
        }

        closeCorporateModal();
        fetchCorporateProfiles();
    } catch (err) {
        console.error('Error saving corporate profile:', err);
        alert('Gagal menyimpan profil perusahaan: ' + err.message);
    }
}

export async function deleteCorporate(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus profil perusahaan ini?')) return;

    try {
        const { error } = await supabaseClient
            .from('corporate_profiles')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert('Profil Perusahaan berhasil dihapus!');
        fetchCorporateProfiles();
    } catch (err) {
        console.error('Error deleting corporate profile:', err);
        alert('Gagal menghapus profil perusahaan: ' + err.message);
    }
}

// --- Cancel List Report & Deposit Settlement JS Logic ---
export let pendingCancelReservationId = null;
export let pendingCancelDepositAmount = 0;

export function openCancelDepositModal(resId, depositAmount) {
    pendingCancelReservationId = resId;
    pendingCancelDepositAmount = depositAmount;

    const amountTextEl = document.getElementById('cancelDepositAmountText');
    if (amountTextEl) {
        amountTextEl.textContent = `Rp ${Number(pendingCancelDepositAmount).toLocaleString('id-ID')}`;
    }

    const modal = document.getElementById('cancelDepositModal');
    if (modal) modal.classList.remove('hidden');
}

export function closeCancelDepositModal() {
    const modal = document.getElementById('cancelDepositModal');
    if (modal) modal.classList.add('hidden');
    pendingCancelReservationId = null;
    pendingCancelDepositAmount = 0;
}

export async function handleCancelBookingReservation() {
    const resId = document.getElementById('edit-reservation-id')?.value;
    if (!resId) return;

    const cancelBtn = document.getElementById('resCancelBookingBtn');
    if (cancelBtn) {
        cancelBtn.disabled = true;
        cancelBtn.innerHTML = `<i class="ph ph-spinner animate-spin text-lg"></i> Checking Folio...`;
    }

    try {
        // Fetch folio transactions to compute Current Balance
        const { data: txs, error: txErr } = await supabaseClient
            .from('folio_transactions')
            .select('*')
            .eq('reservation_id', resId);

        if (txErr) throw txErr;

        let totalCharge = 0;
        let totalPayment = 0;

        (txs || []).forEach(tx => {
            const txType = (tx.transaction_type || 'CHARGE').toUpperCase();
            const amt = Number(tx.amount || 0);
            if (txType === 'CHARGE') totalCharge += amt;
            else if (txType === 'PAYMENT') totalPayment += amt;
        });

        const currentBalance = totalCharge - totalPayment;

        if (currentBalance < 0) {
            // Balance < 0 (Ada Deposit)
            openCancelDepositModal(resId, Math.abs(currentBalance));
        } else {
            // Balance === 0 (or >= 0)
            await executeCancelReservation(resId);
        }

    } catch (err) {
        console.error('Error checking folio for cancellation:', err);
        alert('Gagal memeriksa saldo folio reservasi: ' + err.message);
    } finally {
        if (cancelBtn) {
            cancelBtn.disabled = false;
            cancelBtn.innerHTML = `<i class="ph ph-x-circle text-lg"></i> Cancel Booking`;
        }
    }
}

export async function handleDepositSettlement(settlementType) {
    if (!pendingCancelReservationId || pendingCancelDepositAmount <= 0) return;

    const resId = pendingCancelReservationId;
    const depositAmt = pendingCancelDepositAmount;

    const refundBtn = document.getElementById('cancelRefundBtn');
    const feeBtn = document.getElementById('cancelFeeBtn');

    if (refundBtn) refundBtn.disabled = true;
    if (feeBtn) feeBtn.disabled = true;

    try {
        const description = settlementType === 'refund' ? 'Refund Deposit' : 'Cancellation Fee';

        // Insert balancing CHARGE transaction to bring balance to 0
        const payload = {
            reservation_id: resId,
            transaction_type: 'CHARGE',
            description: description,
            amount: depositAmt,
            transaction_date: new Date().toISOString()
        };

        const { error: txErr } = await supabaseClient
            .from('folio_transactions')
            .insert([payload]);

        if (txErr) throw txErr;

        closeCancelDepositModal();
        await executeCancelReservation(resId);

    } catch (err) {
        console.error('Error settling deposit balance:', err);
        alert('Gagal memproses penyelesaian deposit: ' + err.message);
    } finally {
        if (refundBtn) refundBtn.disabled = false;
        if (feeBtn) feeBtn.disabled = false;
    }
}

export async function executeCancelReservation(resId) {
    const reason = prompt('Please enter the reason for cancellation:');
    if (reason === null) return; // User clicked Cancel on prompt
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
        alert('Alasan pembatalan harus diisi.');
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('reservations')
            .update({
                status: 'Cancelled',
                cancel_reason: trimmedReason
            })
            .eq('id', resId);

        if (error) throw error;

        alert('Reservasi berhasil dibatalkan!');
        if (typeof window.closeModal === 'function') window.closeModal();
        if (typeof window.fetchRooms === 'function') await window.fetchRooms();
        if (typeof window.fetchFrontdeskDashboard === 'function') await window.fetchFrontdeskDashboard();
        if (typeof window.renderTapeChart === 'function') await window.renderTapeChart();
        fetchCancelList();
    } catch (err) {
        console.error('Error executing cancellation:', err);
        alert('Gagal membatalkan reservasi: ' + err.message);
    }
}

export async function fetchCancelList() {
    const tbody = document.getElementById('cancel-list-tbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="p-4">
                <div class="space-y-3">
                    <div class="bg-slate-200/60 backdrop-blur-xs animate-pulse rounded-xl h-6 w-full"></div>
                    <div class="bg-slate-200/60 backdrop-blur-xs animate-pulse rounded-xl h-6 w-3/4"></div>
                    <div class="bg-slate-200/60 backdrop-blur-xs animate-pulse rounded-xl h-6 w-5/6"></div>
                </div>
            </td>
        </tr>
    `;

    try {
        const { data, error } = await supabaseClient
            .from('reservations')
            .select('id, reservation_number, booker_name, reservation_source, voucher_number, check_in_date, check_out_date, cancel_reason, created_at, guest_profiles(full_name)')
            .eq('status', 'Cancelled')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="py-8 text-center text-slate-400">
                        <i class="ph ph-check-circle text-3xl mb-1 inline-block text-slate-300"></i>
                        <div>Tidak ada reservasi yang dibatalkan.</div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = data.map(res => {
            const guestFullName = (res.guest_profiles ? (Array.isArray(res.guest_profiles) ? res.guest_profiles[0]?.full_name : res.guest_profiles.full_name) : null) || res.booker_name || '-';
            const resNumber = res.reservation_number || '-';
            const source = res.reservation_source || 'Direct';
            const voucher = res.voucher_number ? ` / ${res.voucher_number}` : '';
            const stayDates = `${res.check_in_date || ''} s/d ${res.check_out_date || ''}`;
            const cancelReason = res.cancel_reason || '-';

            return `
                <tr class="hover:bg-slate-50/80 transition-colors">
                    <td class="py-3 px-4 font-mono font-semibold text-slate-800">${resNumber}</td>
                    <td class="py-3 px-4 font-medium">${guestFullName}</td>
                    <td class="py-3 px-4 text-slate-600"><span class="font-medium">${source}</span>${voucher}</td>
                    <td class="py-3 px-4 text-slate-600">${stayDates}</td>
                    <td class="py-3 px-4 text-red-600 font-medium">${cancelReason}</td>
                    <td class="py-3 px-4 text-right space-x-2">
                        <button onclick="openViewReservationModal('${res.id}')" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold transition-colors inline-flex items-center gap-1">
                            <i class="ph ph-eye text-sm"></i> View
                        </button>
                        <button onclick="openReactivateReservationModal('${res.id}')" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold transition-colors inline-flex items-center gap-1 shadow-xs">
                            <i class="ph ph-arrow-counter-clockwise text-sm"></i> Reactivate
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Error fetching cancel list:', err);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-8 text-center text-red-500">
                    <i class="ph ph-warning-circle text-2xl mb-1 inline-block"></i>
                    <div>Gagal memuat Cancel List: ${err.message}</div>
                </td>
            </tr>
        `;
    }
}
