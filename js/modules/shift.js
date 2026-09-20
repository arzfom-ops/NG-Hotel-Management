import { supabaseClient } from '../config/supabase.js';
import { formatCurrency, formatRupiah } from '../utils/formatters.js';

// LocalStorage Keys
const STORAGE_SHIFT_ID = 'activeShiftId';
const STORAGE_CASHIER_NAME = 'cashierName';
const STORAGE_SHIFT_NAME = 'shiftName';

/**
 * Get active shift details from localStorage
 */
export function getActiveShift() {
    const shiftId = localStorage.getItem(STORAGE_SHIFT_ID);
    const cashierName = localStorage.getItem(STORAGE_CASHIER_NAME);
    const shiftName = localStorage.getItem(STORAGE_SHIFT_NAME);

    if (!shiftId) return null;

    return {
        activeShiftId: shiftId,
        cashierName: cashierName || 'Kasir',
        shiftName: shiftName || 'Shift Kasir'
    };
}

/**
 * Update UI elements depending on shift active status
 */
export function updateShiftUI() {
    const shift = getActiveShift();

    const shiftBadge = document.getElementById('topbar-shift-badge');
    const shiftNameSpan = document.getElementById('topbar-shift-name');
    const btnOpenShift = document.getElementById('btn-open-shift-modal');
    const btnCloseShift = document.getElementById('btn-close-shift-modal');

    if (shift) {
        if (shiftBadge) {
            shiftBadge.classList.remove('hidden', 'bg-slate-100', 'text-slate-600');
            shiftBadge.classList.add('flex', 'bg-emerald-50', 'text-emerald-700', 'border-emerald-200');
        }
        if (shiftNameSpan) {
            shiftNameSpan.textContent = `${shift.shiftName} (${shift.cashierName})`;
        }
        if (btnOpenShift) btnOpenShift.classList.add('hidden');
        if (btnCloseShift) btnCloseShift.classList.remove('hidden');
    } else {
        if (shiftBadge) {
            shiftBadge.classList.remove('flex', 'bg-emerald-50', 'text-emerald-700', 'border-emerald-200');
            shiftBadge.classList.add('hidden');
        }
        if (shiftNameSpan) {
            shiftNameSpan.textContent = 'Shift Nonaktif';
        }
        if (btnOpenShift) btnOpenShift.classList.remove('hidden');
        if (btnCloseShift) btnCloseShift.classList.add('hidden');
    }
}

/**
 * Open Modal to Start a Shift
 */
export function openStartShiftModal() {
    const modal = document.getElementById('openShiftModal');
    if (modal) {
        modal.classList.remove('hidden');
        const cashierInput = document.getElementById('open-shift-cashier');
        const nameInput = document.getElementById('open-shift-name');
        const floatInput = document.getElementById('open-shift-float');

        if (cashierInput) cashierInput.value = localStorage.getItem(STORAGE_CASHIER_NAME) || '';
        if (nameInput && !nameInput.value) nameInput.value = 'Pagi';
        if (floatInput && !floatInput.value) floatInput.value = '0';
    }
}

/**
 * Close Start Shift Modal
 */
export function closeStartShiftModal() {
    const modal = document.getElementById('openShiftModal');
    if (modal) modal.classList.add('hidden');
}

/**
 * Handle Open Shift Form Submission or Call
 */
export async function handleOpenShift(cashierName, shiftName, openingFloat) {
    try {
        // Handle if called via Form Event
        if (cashierName && cashierName.preventDefault) {
            cashierName.preventDefault();
            cashierName = document.getElementById('open-shift-cashier')?.value;
            shiftName = document.getElementById('open-shift-name')?.value;
            openingFloat = document.getElementById('open-shift-float')?.value;
        }

        if (!cashierName || !shiftName) {
            alert('Harap isi Nama Kasir dan Nama Shift.');
            return { success: false, message: 'Form tidak lengkap.' };
        }

        const floatVal = Number(openingFloat) || 0;

        const { data, error } = await supabaseClient.rpc('rpc_open_cashier_shift', {
            p_cashier_name: cashierName,
            p_shift_name: shiftName,
            p_opening_float: floatVal
        });

        if (error) throw error;

        if (data && data.success) {
            localStorage.setItem(STORAGE_SHIFT_ID, data.shift_id);
            localStorage.setItem(STORAGE_CASHIER_NAME, cashierName);
            localStorage.setItem(STORAGE_SHIFT_NAME, shiftName);

            updateShiftUI();
            closeStartShiftModal();

            alert(`Shift "${shiftName}" berhasil dibuka oleh ${cashierName}.`);
            return data;
        } else {
            alert(data?.message || 'Gagal membuka shift.');
            return data;
        }
    } catch (err) {
        console.error('Error opening shift:', err);
        alert('Gagal membuka shift: ' + (err.message || err));
        return { success: false, message: err.message };
    }
}

/**
 * Handle Open Close Shift Modal
 */
export function handleCloseShiftModal() {
    const activeShift = getActiveShift();
    if (!activeShift) {
        alert('Tidak ada shift aktif yang berjalan.');
        return;
    }

    const modal = document.getElementById('closeShiftModal');
    if (modal) {
        modal.classList.remove('hidden');

        const cashierDisplay = document.getElementById('close-shift-cashier-display');
        const shiftDisplay = document.getElementById('close-shift-name-display');

        if (cashierDisplay) cashierDisplay.textContent = activeShift.cashierName;
        if (shiftDisplay) shiftDisplay.textContent = activeShift.shiftName;

        const actualCashInput = document.getElementById('close-shift-actual-cash');
        const cashDropInput = document.getElementById('close-shift-cash-drop');
        const notesInput = document.getElementById('close-shift-notes');

        if (actualCashInput) actualCashInput.value = '';
        if (cashDropInput) cashDropInput.value = '0';
        if (notesInput) notesInput.value = '';
    }
}

/**
 * Close Close Shift Modal
 */
export function closeCloseShiftModal() {
    const modal = document.getElementById('closeShiftModal');
    if (modal) modal.classList.add('hidden');
}

/**
 * Execute Closing Shift
 */
export async function executeCloseShift(actualCash, cash_drop, notes) {
    try {
        // Handle if called via Form Event
        if (actualCash && actualCash.preventDefault) {
            actualCash.preventDefault();
            actualCash = document.getElementById('close-shift-actual-cash')?.value;
            cash_drop = document.getElementById('close-shift-cash-drop')?.value;
            notes = document.getElementById('close-shift-notes')?.value;
        }

        const activeShift = getActiveShift();
        if (!activeShift) {
            alert('Tidak ada shift aktif.');
            return { success: false, message: 'Tidak ada shift aktif.' };
        }

        const actualCashVal = Number(actualCash) || 0;
        const cashDropVal = Number(cash_drop) || 0;
        const notesStr = notes || '';

        const { data, error } = await supabaseClient.rpc('rpc_close_cashier_shift', {
            p_shift_id: activeShift.activeShiftId,
            p_actual_cash: actualCashVal,
            p_cash_drop: cashDropVal,
            p_notes: notesStr
        });

        if (error) throw error;

        if (data && data.success) {
            // Clear local storage shift data
            localStorage.removeItem(STORAGE_SHIFT_ID);
            localStorage.removeItem(STORAGE_CASHIER_NAME);
            localStorage.removeItem(STORAGE_SHIFT_NAME);

            updateShiftUI();
            closeCloseShiftModal();

            // Display Variance Summary Modal
            openShiftSummaryModal(data, activeShift, notesStr);

            return data;
        } else {
            alert(data?.message || 'Gagal menutup shift.');
            return data;
        }
    } catch (err) {
        console.error('Error closing shift:', err);
        alert('Gagal menutup shift: ' + (err.message || err));
        return { success: false, message: err.message };
    }
}

/**
 * Open Shift Summary / Settlement Variance Modal
 */
export function openShiftSummaryModal(summaryData, shiftInfo, notes) {
    const modal = document.getElementById('shiftSummaryModal');
    if (!modal) return;

    modal.classList.remove('hidden');

    const floatEl = document.getElementById('summary-opening-float');
    const actualCashEl = document.getElementById('summary-actual-cash');
    const systemCashEl = document.getElementById('summary-system-cash');
    const cashDropEl = document.getElementById('summary-cash-drop');
    const varianceEl = document.getElementById('summary-variance');
    const notesEl = document.getElementById('summary-notes');

    if (floatEl) floatEl.textContent = formatRupiah(summaryData.opening_float || 0);
    if (actualCashEl) actualCashEl.textContent = formatRupiah(summaryData.actual_cash || 0);
    if (systemCashEl) systemCashEl.textContent = formatRupiah(summaryData.system_cash || 0);
    if (cashDropEl) cashDropEl.textContent = formatRupiah(summaryData.cash_drop || 0);

    const variance = summaryData.variance || 0;
    if (varianceEl) {
        varianceEl.textContent = formatRupiah(variance);
        if (variance < 0) {
            varianceEl.className = 'font-mono text-xl font-bold text-red-600';
        } else if (variance > 0) {
            varianceEl.className = 'font-mono text-xl font-bold text-amber-600';
        } else {
            varianceEl.className = 'font-mono text-xl font-bold text-emerald-600';
        }
    }

    if (notesEl) notesEl.textContent = notes || '-';
}

/**
 * Close Shift Summary Modal
 */
export function closeShiftSummaryModal() {
    const modal = document.getElementById('shiftSummaryModal');
    if (modal) modal.classList.add('hidden');
}

/**
 * Open Shift Logbook Modal
 */
export function openLogbookModal() {
    const modal = document.getElementById('shiftLogbookModal');
    if (modal) {
        modal.classList.remove('hidden');
        fetchShiftLogbooks();
    }
}

/**
 * Close Shift Logbook Modal
 */
export function closeLogbookModal() {
    const modal = document.getElementById('shiftLogbookModal');
    if (modal) modal.classList.add('hidden');
}

/**
 * Fetch list of logbooks from shift_logbooks table and render
 */
export async function fetchShiftLogbooks() {
    const tbody = document.getElementById('logbook-list-tbody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="p-4">
                    <div class="space-y-3">
                        <div class="bg-slate-200/60 backdrop-blur-xs animate-pulse rounded-xl h-6 w-full"></div>
                        <div class="bg-slate-200/60 backdrop-blur-xs animate-pulse rounded-xl h-6 w-3/4"></div>
                    </div>
                </td>
            </tr>
        `;
    }

    try {
        const { data, error } = await supabaseClient
            .from('shift_logbooks')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        renderShiftLogbooks(data || []);
        return data || [];
    } catch (err) {
        console.error('Error fetching shift logbooks:', err);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-4 text-center text-red-500 font-medium">
                        Gagal memuat logbook: ${err.message || err}
                    </td>
                </tr>
            `;
        }
        return [];
    }
}

/**
 * Render logbook items in table/widget
 */
export function renderShiftLogbooks(logbooks) {
    const tbody = document.getElementById('logbook-list-tbody');
    const badgeCount = document.getElementById('logbook-pending-count');

    if (badgeCount) {
        const pending = logbooks.filter(l => !l.is_resolved).length;
        badgeCount.textContent = pending;
        if (pending > 0) {
            badgeCount.classList.remove('hidden');
        } else {
            badgeCount.classList.add('hidden');
        }
    }

    if (!tbody) return;

    if (!logbooks || logbooks.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-8 text-center text-slate-400">
                    Belum ada catatan logbook shift.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = logbooks.map(item => {
        const createdAt = item.created_at ? new Date(item.created_at).toLocaleString('id-ID', {
            dateStyle: 'short',
            timeStyle: 'short'
        }) : '-';

        const categoryClass = item.category === 'Front Office' ? 'bg-blue-100 text-blue-800' :
                              item.category === 'Housekeeping' ? 'bg-amber-100 text-amber-800' :
                              item.category === 'Engineering' ? 'bg-purple-100 text-purple-800' :
                              'bg-slate-100 text-slate-800';

        const statusBadge = item.is_resolved ?
            `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 backdrop-blur-md shadow-2xs">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Selesai
             </span>` :
            `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 border border-rose-500/30 backdrop-blur-md shadow-2xs">
                <span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span> Pending
             </span>`;

        const resolveAction = item.is_resolved ?
            `<span class="text-xs text-slate-400 font-medium">Selesai</span>` :
            `<button type="button" onclick="handleResolveLogbook('${item.id}')" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer">
                <i class="ph ph-check text-sm"></i> Tandai Selesai
             </button>`;

        return `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="py-3 px-4 whitespace-nowrap text-xs text-slate-500">${createdAt}</td>
                <td class="py-3 px-4 whitespace-nowrap">
                    <span class="px-2 py-1 rounded-md text-xs font-bold ${categoryClass}">
                        ${item.category || 'General'}
                    </span>
                    ${item.room_number ? `<span class="ml-2 px-2 py-0.5 bg-slate-200 text-slate-800 rounded font-bold text-xs">Kmr ${item.room_number}</span>` : ''}
                </td>
                <td class="py-3 px-4 font-medium text-slate-800 text-xs">
                    <div>${item.message}</div>
                    <div class="text-[10px] text-slate-400 mt-0.5">Oleh: ${item.created_by || 'Staff'}</div>
                </td>
                <td class="py-3 px-4 whitespace-nowrap">${statusBadge}</td>
                <td class="py-3 px-4 text-right whitespace-nowrap">${resolveAction}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Handle Add Logbook Entry
 */
export async function handleAddLogbookEntry(category, roomNumber, message) {
    try {
        // Handle form submission event
        if (category && category.preventDefault) {
            category.preventDefault();
            category = document.getElementById('logbook-category')?.value;
            roomNumber = document.getElementById('logbook-room-number')?.value;
            message = document.getElementById('logbook-message')?.value;
        }

        if (!message || !message.trim()) {
            alert('Harap isi pesan catatan logbook.');
            return { success: false, message: 'Pesan kosong.' };
        }

        const activeShift = getActiveShift();

        const { data, error } = await supabaseClient
            .from('shift_logbooks')
            .insert([{
                shift_id: activeShift ? activeShift.activeShiftId : null,
                category: category || 'General',
                room_number: roomNumber ? String(roomNumber).trim() : null,
                message: message.trim(),
                is_resolved: false,
                created_by: activeShift ? activeShift.cashierName : 'Staff'
            }])
            .select('*');

        if (error) throw error;

        // Reset form inputs
        const msgInput = document.getElementById('logbook-message');
        const roomInput = document.getElementById('logbook-room-number');
        if (msgInput) msgInput.value = '';
        if (roomInput) roomInput.value = '';

        await fetchShiftLogbooks();

        return { success: true, data };
    } catch (err) {
        console.error('Error adding logbook entry:', err);
        alert('Gagal menambah logbook: ' + (err.message || err));
        return { success: false, message: err.message };
    }
}

/**
 * Handle Resolve Logbook Entry
 */
export async function handleResolveLogbook(logbookId) {
    try {
        if (!logbookId) return;

        const { data, error } = await supabaseClient
            .from('shift_logbooks')
            .update({ is_resolved: true })
            .eq('id', logbookId)
            .select('*');

        if (error) throw error;

        await fetchShiftLogbooks();

        return { success: true, data };
    } catch (err) {
        console.error('Error resolving logbook:', err);
        alert('Gagal menyelesaikan catatan logbook: ' + (err.message || err));
        return { success: false, message: err.message };
    }
}
