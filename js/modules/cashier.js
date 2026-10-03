import { supabaseClient } from '../config/supabase.js';
import { formatCurrency, formatRupiah } from '../utils/formatters.js';

// State Variables
export let currentCashierSession = null;
export let cashierSessionTransactions = [];

/**
 * Fetch active or last cashier session for current user & business date
 */
export async function fetchCurrentCashierSession() {
    const businessDate = window.currentHotelDate || new Date().toISOString().split('T')[0];
    const userName = localStorage.getItem('cashierName') || localStorage.getItem('user_name') || 'Admin';

    try {
        // First check for an OPEN shift for this user or any active open shift
        let { data, error } = await supabaseClient
            .from('cashier_sessions')
            .select('*')
            .eq('business_date', businessDate)
            .eq('status', 'OPEN')
            .order('opened_at', { ascending: false })
            .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
            currentCashierSession = data[0];
            localStorage.setItem('activeShiftId', currentCashierSession.id);
            localStorage.setItem('cashierName', currentCashierSession.user_name);
            return currentCashierSession;
        }

        // Check for latest CLOSED shift today for this user/session display
        let { data: closedData, error: closedErr } = await supabaseClient
            .from('cashier_sessions')
            .select('*')
            .eq('business_date', businessDate)
            .eq('status', 'CLOSED')
            .order('closed_at', { ascending: false })
            .limit(1);

        if (!closedErr && closedData && closedData.length > 0) {
            currentCashierSession = closedData[0];
            return currentCashierSession;
        }

        currentCashierSession = null;
        localStorage.removeItem('activeShiftId');
        return null;
    } catch (err) {
        console.error('Error fetching cashier session:', err);
        currentCashierSession = null;
        return null;
    }
}

/**
 * Render the main Cashier Report View (#cashier-report-view)
 */
export async function renderCashierReportView() {
    const container = document.getElementById('cashier-report-view');
    if (!container) return;

    await fetchCurrentCashierSession();

    if (!currentCashierSession) {
        // State 1: No active open shift -> Prompt Open Shift
        renderOpenShiftState();
    } else if (currentCashierSession.status === 'OPEN') {
        // State 2: Active OPEN shift -> Blind Drop summary & Close Shift button
        renderActiveShiftState();
    } else {
        // State 3: Shift CLOSED -> Render Cashier Shift Report
        await renderClosedShiftReportState();
    }
}

/**
 * Render State 1: Open Shift Prompt / Form
 */
export function renderOpenShiftState() {
    const container = document.getElementById('cashier-report-view');
    if (!container) return;

    const defaultUser = localStorage.getItem('cashierName') || 'Kasir Front Office';
    const businessDate = window.currentHotelDate || new Date().toISOString().split('T')[0];

    container.innerHTML = `
        <div class="max-w-xl mx-auto my-8 bg-white/85 backdrop-blur-2xl border border-white/90 shadow-xl rounded-3xl p-8">
            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-3 text-3xl font-bold">
                    <i class="ph ph-cash-register"></i>
                </div>
                <h2 class="text-xl font-bold text-slate-800">Buka Shift Kasir (Open Shift)</h2>
                <p class="text-xs text-slate-500 mt-1">Sesi kasir belum aktif untuk Tanggal Bisnis <span class="font-bold text-slate-700">${businessDate}</span>.</p>
            </div>

            <form onsubmit="handleOpenCashierShiftSubmit(event)" class="space-y-4">
                <div>
                    <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Nama Kasir / User <span class="text-red-500">*</span></label>
                    <input type="text" id="open-cashier-user" required value="${defaultUser}" placeholder="Masukkan Nama Kasir" class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:outline-none focus:border-primary">
                </div>

                <div>
                    <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Modal Awal / Opening Float (Petty Cash) (Rp)</label>
                    <input type="number" id="open-cashier-float" min="0" value="0" step="any" placeholder="0" class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-primary">
                    <p class="text-[11px] text-slate-400 mt-1">Uang modal awal kas yang ada di laci kasir saat membuka shift.</p>
                </div>

                <div class="pt-4">
                    <button type="submit" id="btnSubmitOpenShift" class="w-full py-3 bg-primary hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer">
                        <i class="ph ph-door-open text-lg"></i> Buka Shift Kasir Sekarang
                    </button>
                </div>
            </form>
        </div>
    `;
}

/**
 * Handle Open Cashier Shift Submission
 */
export async function handleOpenCashierShiftSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    const userName = document.getElementById('open-cashier-user')?.value.trim();
    const floatAmount = parseFloat(document.getElementById('open-cashier-float')?.value) || 0;
    const businessDate = window.currentHotelDate || new Date().toISOString().split('T')[0];

    if (!userName) {
        alert('Nama Kasir wajib diisi.');
        return;
    }

    const btn = document.getElementById('btnSubmitOpenShift');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="ph ph-spinner animate-spin text-lg"></i> Membuka Shift...`;
    }

    try {
        const { data, error } = await supabaseClient
            .from('cashier_sessions')
            .insert([{
                user_name: userName,
                business_date: businessDate,
                status: 'OPEN',
                opening_float: floatAmount,
                opened_at: new Date().toISOString()
            }])
            .select('*')
            .single();

        if (error) throw error;

        currentCashierSession = data;
        localStorage.setItem('activeShiftId', data.id);
        localStorage.setItem('cashierName', userName);

        if (typeof window.updateShiftUI === 'function') window.updateShiftUI();

        alert(`Shift berhasil dibuka oleh ${userName} dengan Modal Awal ${formatRupiah(floatAmount)}.`);
        await renderCashierReportView();

    } catch (err) {
        console.error('Error opening cashier shift:', err);
        alert('Gagal membuka shift kasir: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="ph ph-door-open text-lg"></i> Buka Shift Kasir Sekarang`;
        }
    }
}

/**
 * Render State 2: Active Shift Summary (Blind Drop & Close Shift Button)
 */
export function renderActiveShiftState() {
    const container = document.getElementById('cashier-report-view');
    if (!container || !currentCashierSession) return;

    const session = currentCashierSession;
    const openedTime = new Date(session.opened_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

    container.innerHTML = `
        <div class="max-w-2xl mx-auto my-8 bg-white/85 backdrop-blur-2xl border border-white/90 shadow-xl rounded-3xl p-8">
            <div class="flex items-center justify-between pb-6 border-b border-slate-200">
                <div>
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> SHIFT AKTIF (OPEN)
                    </span>
                    <h2 class="text-2xl font-bold text-slate-800 mt-2">Ringkasan Shift Berjalan</h2>
                    <p class="text-xs text-slate-500 mt-0.5">Business Date: <span class="font-bold text-slate-700">${session.business_date}</span></p>
                </div>
                <button type="button" onclick="openDenominationModal()" class="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer">
                    <i class="ph ph-door-closed text-lg"></i> Tutup Shift & Setoran
                </button>
            </div>

            <div class="grid grid-cols-2 gap-4 my-6">
                <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Kasir / User</div>
                    <div class="text-base font-bold text-slate-800 mt-1">${session.user_name}</div>
                </div>
                <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Waktu Buka Shift</div>
                    <div class="text-base font-bold text-slate-800 mt-1">${openedTime}</div>
                </div>
                <div class="p-4 bg-amber-50 border border-amber-200 rounded-2xl col-span-2">
                    <div class="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Modal Awal (Opening Float)</div>
                    <div class="text-xl font-extrabold text-amber-900 mt-1">${formatRupiah(session.opening_float || 0)}</div>
                </div>
            </div>

            <div class="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl text-xs text-blue-900 flex items-start gap-3">
                <i class="ph ph-info text-xl text-blue-600 shrink-0 mt-0.5"></i>
                <div>
                    <strong class="font-bold">Prosedur Blind Drop:</strong> Nominal kalkulasi penerimaan sistem sengaja disembunyikan untuk menjaga objektivitas penghitungan kas fisik. Tekan tombol <span class="font-bold text-rose-700">"Tutup Shift & Setoran"</span> untuk menghitung fisik uang tunai melalui Kalkulator Pecahan Uang (Denomination Calculator).
                </div>
            </div>
        </div>
    `;
}

/**
 * Open Denomination Calculator Modal for Closing Shift
 */
export function openDenominationModal() {
    const modal = document.getElementById('modal-close-cashier-shift');
    if (modal) {
        modal.classList.remove('hidden');
        resetDenominationForm();
    }
}

/**
 * Close Denomination Calculator Modal
 */
export function closeDenominationModal() {
    const modal = document.getElementById('modal-close-cashier-shift');
    if (modal) modal.classList.add('hidden');
}

/**
 * Reset Denomination Form Inputs
 */
export function resetDenominationForm() {
    const denoms = ['100000', '50000', '20000', '10000', '5000', '2000', '1000', '500'];
    denoms.forEach(d => {
        const input = document.getElementById(`denom-qty-${d}`);
        const totalEl = document.getElementById(`denom-total-${d}`);
        if (input) input.value = '0';
        if (totalEl) totalEl.textContent = 'Rp 0';
    });

    const floatVal = currentCashierSession?.opening_float || 0;
    const pettyInput = document.getElementById('close-petty-retained');
    if (pettyInput) pettyInput.value = floatVal;

    calculateDenominationsTotal();
}

/**
 * Helper to classify transactions into Cash, Non-Cash, Paid Out, City Ledger, or Void
 */
export function classifyTransaction(tx) {
    const isVoid = tx.is_void === true || tx.is_voided === true;
    if (isVoid) {
        return { categoryType: 'VOID', amount: parseFloat(tx.amount || tx.total || tx.charge || tx.credit || 0) };
    }

    const catUpper = (tx.category || '').toUpperCase();
    const txType = (tx.transaction_type || tx.type || '').toUpperCase();
    const pmType = (tx.payment_methods?.type || tx.payment_methods?.method_type || '').toUpperCase();
    const pmName = (tx.payment_methods?.name || '').toUpperCase();
    const descUpper = (tx.description || '').toUpperCase();

    const amount = parseFloat(tx.amount || tx.total || tx.charge || tx.credit || 0);

    if (txType === 'PAID_OUT' || catUpper === 'PAID_OUT') {
        return { categoryType: 'PAID_OUT', amount };
    }

    if (txType === 'PAYMENT' || ['PAYMENT', 'DEPOSIT', 'CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'CITY_LEDGER', 'AR'].includes(catUpper)) {
        if (catUpper === 'BANK_TRANSFER' || pmType.includes('TRANSFER') || pmType.includes('BANK') || pmName.includes('TRANSFER') || pmName.includes('BANK')) {
            return { categoryType: 'BANK_TRANSFER', amount };
        }
        if (catUpper === 'CREDIT_CARD' || pmType.includes('CARD') || pmType.includes('CREDIT') || pmType.includes('EDC') || pmName.includes('CARD') || pmName.includes('CREDIT') || pmName.includes('EDC')) {
            return { categoryType: 'CREDIT_CARD', amount };
        }
        if (catUpper === 'CITY_LEDGER' || catUpper === 'AR' || pmType.includes('CITY') || pmType.includes('LEDGER') || pmName.includes('CITY') || pmName.includes('LEDGER')) {
            return { categoryType: 'CITY_LEDGER', amount };
        }
        return { categoryType: 'CASH_PAYMENT', amount };
    }

    return { categoryType: 'OTHER', amount: 0 };
}

/**
 * Auto-Calculate Denomination Totals
 */
export function calculateDenominationsTotal() {
    const denoms = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500];
    let totalDeclared = 0;

    denoms.forEach(d => {
        const input = document.getElementById(`denom-qty-${d}`);
        const totalEl = document.getElementById(`denom-total-${d}`);
        let qty = parseInt(input?.value) || 0;
        if (qty < 0) {
            qty = 0;
            if (input) input.value = '0';
        }
        const subtotal = d * qty;
        totalDeclared += subtotal;

        if (totalEl) totalEl.textContent = formatRupiah(subtotal);
    });

    const declaredTotalEl = document.getElementById('close-total-declared');
    if (declaredTotalEl) declaredTotalEl.textContent = formatRupiah(totalDeclared);

    const pettyInput = document.getElementById('close-petty-retained');
    let pettyRetained = parseFloat(pettyInput?.value) || 0;
    if (pettyRetained < 0) {
        pettyRetained = 0;
        if (pettyInput) pettyInput.value = '0';
    }

    const remittance = totalDeclared - pettyRetained;
    const remittanceEl = document.getElementById('close-remittance-amount');
    if (remittanceEl) {
        remittanceEl.textContent = formatRupiah(remittance);
        remittanceEl.className = remittance >= 0 ? "text-xl font-extrabold text-emerald-600 font-mono" : "text-xl font-extrabold text-red-600 font-mono";
    }
}

/**
 * Handle Closing Shift Form Submit (Blind Drop Calculation & Persist)
 */
export async function handleCloseCashierShiftSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    if (!currentCashierSession || currentCashierSession.status !== 'OPEN') {
        alert('Tidak ada shift aktif yang siap ditutup.');
        return;
    }

    const denoms = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500];
    let totalDeclaredCash = 0;
    const denominationObj = {};

    denoms.forEach(d => {
        const qty = parseInt(document.getElementById(`denom-qty-${d}`)?.value) || 0;
        denominationObj[String(d)] = qty;
        totalDeclaredCash += d * qty;
    });

    const pettyRetained = parseFloat(document.getElementById('close-petty-retained')?.value) || 0;
    const remittanceAmount = totalDeclaredCash - pettyRetained;

    const btn = document.getElementById('btnSubmitCloseShift');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="ph ph-spinner animate-spin text-base"></i> Memproses Penutupan...`;
    }

    try {
        const session = currentCashierSession;
        const openedAt = session.opened_at;
        const closedAt = new Date().toISOString();

        // Query transactions created during this shift session
        const { data: txList, error: txErr } = await supabaseClient
            .from('folio_transactions')
            .select('*, payment_methods(id, name, type, method_type)')
            .gte('created_at', openedAt)
            .lte('created_at', closedAt);

        if (txErr) throw txErr;

        let totalCashPayments = 0;
        let totalPaidOut = 0;

        (txList || []).forEach(tx => {
            const classified = classifyTransaction(tx);
            if (classified.categoryType === 'PAID_OUT') {
                totalPaidOut += classified.amount;
            } else if (classified.categoryType === 'CASH_PAYMENT') {
                totalCashPayments += classified.amount;
            }
        });

        const systemNetCash = totalCashPayments - totalPaidOut;
        const openingFloat = parseFloat(session.opening_float || 0);
        const systemExpectedCash = openingFloat + systemNetCash;
        const overShort = totalDeclaredCash - systemExpectedCash;

        // Update cashier session in database
        const { data: updatedSession, error: updErr } = await supabaseClient
            .from('cashier_sessions')
            .update({
                status: 'CLOSED',
                closed_at: closedAt,
                system_net_cash: systemNetCash,
                system_expected_cash: systemExpectedCash,
                declared_total_cash: totalDeclaredCash,
                petty_cash_retained: pettyRetained,
                remittance_amount: remittanceAmount,
                over_short: overShort,
                denominations_json: denominationObj
            })
            .eq('id', session.id)
            .select('*')
            .single();

        if (updErr) throw updErr;

        currentCashierSession = updatedSession;
        localStorage.removeItem('activeShiftId');

        if (typeof window.updateShiftUI === 'function') window.updateShiftUI();

        closeDenominationModal();
        alert(`Shift berhasil ditutup!\nExpected: ${formatRupiah(systemExpectedCash)}\nDeclared: ${formatRupiah(totalDeclaredCash)}\nOver/Short: ${formatRupiah(overShort)}`);

        await renderCashierReportView();

    } catch (err) {
        console.error('Error closing cashier shift:', err);
        alert('Gagal menutup shift kasir: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="ph ph-check-circle text-base"></i> Submit Tutup Shift`;
        }
    }
}

/**
 * Render State 3: Closed Shift Printable Cashier Report
 */
export async function renderClosedShiftReportState() {
    const container = document.getElementById('cashier-report-view');
    if (!container || !currentCashierSession) return;

    const session = currentCashierSession;
    const openedTime = session.opened_at ? new Date(session.opened_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
    const closedTime = session.closed_at ? new Date(session.closed_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

    // Fetch transactions during this session
    let txList = [];
    try {
        const query = supabaseClient
            .from('folio_transactions')
            .select('*, payment_methods(id, name, type, method_type), reservations(id, reservation_number, guest_name, booker_name, guest_card_files!fk_reservations_guest_card(full_name))')
            .gte('created_at', session.opened_at);

        if (session.closed_at) {
            query.lte('created_at', session.closed_at);
        }

        const { data, error } = await query.order('created_at', { ascending: true });
        if (!error && data) txList = data;
    } catch (e) {
        console.error('Error fetching transactions for cashier report:', e);
    }

    cashierSessionTransactions = txList;

    // Classify transactions for report sections
    let totalCashPayments = 0;
    let totalPaidOut = 0;

    const nonCashTransfers = [];
    let totalTransfers = 0;

    const nonCashCards = [];
    let totalCards = 0;

    const cityLedgerArList = [];
    let totalCityLedger = 0;

    const voidedList = [];

    txList.forEach(tx => {
        const classified = classifyTransaction(tx);
        if (classified.categoryType === 'VOID') {
            voidedList.push(tx);
        } else if (classified.categoryType === 'PAID_OUT') {
            totalPaidOut += classified.amount;
        } else if (classified.categoryType === 'BANK_TRANSFER') {
            nonCashTransfers.push(tx);
            totalTransfers += classified.amount;
        } else if (classified.categoryType === 'CREDIT_CARD') {
            nonCashCards.push(tx);
            totalCards += classified.amount;
        } else if (classified.categoryType === 'CITY_LEDGER') {
            cityLedgerArList.push(tx);
            totalCityLedger += classified.amount;
        } else if (classified.categoryType === 'CASH_PAYMENT') {
            totalCashPayments += classified.amount;
        }
    });

    const openingFloat = parseFloat(session.opening_float || 0);
    const expectedCashInDrawer = openingFloat + totalCashPayments - totalPaidOut;
    const declaredCash = parseFloat(session.declared_total_cash || 0);
    const overShort = session.over_short !== undefined ? parseFloat(session.over_short) : (declaredCash - expectedCashInDrawer);
    const pettyRetained = parseFloat(session.petty_cash_retained || 0);
    const remittance = session.remittance_amount !== undefined ? parseFloat(session.remittance_amount) : (declaredCash - pettyRetained);

    const overShortBadge = overShort === 0 ? `<span class="text-emerald-600 font-bold">Rp 0 (Sesuai / Pass)</span>` :
                           (overShort < 0 ? `<span class="text-red-600 font-bold">-${formatRupiah(Math.abs(overShort))} (Short / Kurang)</span>` :
                                            `<span class="text-amber-600 font-bold">+${formatRupiah(overShort)} (Over / Lebih)</span>`);

    container.innerHTML = `
        <div class="max-w-4xl mx-auto my-6 bg-white/90 backdrop-blur-2xl border border-white/90 shadow-2xl rounded-3xl p-6 sm:p-8" id="cashier-report-printable">

            <!-- Actions Header -->
            <div class="flex items-center justify-between pb-6 border-b border-slate-200 mb-6 print:hidden">
                <div class="flex items-center gap-3">
                    <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                        <i class="ph ph-check-circle text-emerald-600 text-sm"></i> SHIFT CLOSED
                    </span>
                    <h2 class="text-xl font-bold text-slate-800">Laporan Penerimaan Kasir (Cashier Shift Report)</h2>
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" onclick="window.print()" class="px-4 py-2 bg-primary hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer">
                        <i class="ph ph-printer text-base"></i> Cetak Laporan
                    </button>
                    <button type="button" onclick="renderOpenShiftState()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer">
                        <i class="ph ph-plus-circle text-base"></i> Buka Shift Baru
                    </button>
                </div>
            </div>

            <!-- Report Printable Header -->
            <div class="border-b-2 border-slate-900 pb-4 mb-6">
                <div class="flex justify-between items-start">
                    <div>
                        <h1 class="text-xl font-black text-slate-900 tracking-tight">NG HOTEL MANAGEMENT</h1>
                        <p class="text-xs font-semibold text-slate-500 uppercase">CASHIER SHIFT & RECEIPT SUMMARY REPORT</p>
                    </div>
                    <div class="text-right">
                        <div class="text-xs font-bold text-slate-700">BUSINESS DATE: <span class="font-extrabold text-slate-900">${session.business_date}</span></div>
                        <div class="text-[11px] text-slate-500">Session ID: <span class="font-mono">${session.id.slice(0, 8)}</span></div>
                    </div>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-200 text-xs">
                    <div>
                        <span class="text-slate-400 font-bold block uppercase text-[10px]">Nama Kasir</span>
                        <span class="font-bold text-slate-800">${session.user_name}</span>
                    </div>
                    <div>
                        <span class="text-slate-400 font-bold block uppercase text-[10px]">Status Shift</span>
                        <span class="font-bold text-emerald-700">${session.status}</span>
                    </div>
                    <div>
                        <span class="text-slate-400 font-bold block uppercase text-[10px]">Waktu Buka</span>
                        <span class="font-semibold text-slate-700">${openedTime}</span>
                    </div>
                    <div>
                        <span class="text-slate-400 font-bold block uppercase text-[10px]">Waktu Tutup</span>
                        <span class="font-semibold text-slate-700">${closedTime}</span>
                    </div>
                </div>
            </div>

            <!-- SECTION 1: CASH MOVEMENT -->
            <div class="mb-8">
                <h3 class="text-xs font-black uppercase tracking-wider text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border-l-4 border-primary mb-3">
                    Section 1: Cash Movement (Mutasi Uang Tunai)
                </h3>
                <div class="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
                    <table class="w-full text-xs">
                        <tbody>
                            <tr class="border-b border-slate-200/60">
                                <td class="py-2.5 px-4 font-semibold text-slate-600">Modal Awal (Opening Float)</td>
                                <td class="py-2.5 px-4 text-right font-mono font-bold text-slate-800">${formatRupiah(openingFloat)}</td>
                            </tr>
                            <tr class="border-b border-slate-200/60">
                                <td class="py-2.5 px-4 font-semibold text-slate-600">(+) Total Cash Payments (Penerimaan Tunai)</td>
                                <td class="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">${formatRupiah(totalCashPayments)}</td>
                            </tr>
                            <tr class="border-b border-slate-200/60">
                                <td class="py-2.5 px-4 font-semibold text-slate-600">(-) Paid Out (Kas Keluar)</td>
                                <td class="py-2.5 px-4 text-right font-mono font-bold text-rose-600">(${formatRupiah(totalPaidOut)})</td>
                            </tr>
                            <tr class="bg-slate-100/80 font-bold border-b border-slate-300">
                                <td class="py-2.5 px-4 text-slate-800">Expected Cash in Drawer (Seharusnya)</td>
                                <td class="py-2.5 px-4 text-right font-mono text-slate-900">${formatRupiah(expectedCashInDrawer)}</td>
                            </tr>
                            <tr class="border-b border-slate-200/60">
                                <td class="py-2.5 px-4 font-semibold text-slate-600">Declared Cash (Hasil Fisik Kalkulator Pecahan)</td>
                                <td class="py-2.5 px-4 text-right font-mono font-bold text-slate-900">${formatRupiah(declaredCash)}</td>
                            </tr>
                            <tr class="border-b border-slate-200/60">
                                <td class="py-2.5 px-4 font-semibold text-slate-600">Over / Short (Selisih)</td>
                                <td class="py-2.5 px-4 text-right font-mono">${overShortBadge}</td>
                            </tr>
                            <tr class="bg-emerald-50 text-emerald-900 font-bold">
                                <td class="py-3 px-4">Remittance (Total Setoran Fisik ke Akunting)</td>
                                <td class="py-3 px-4 text-right font-mono text-base font-extrabold text-emerald-700">${formatRupiah(remittance)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- SECTION 2: NON-CASH PAYMENTS -->
            <div class="mb-8">
                <h3 class="text-xs font-black uppercase tracking-wider text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border-l-4 border-indigo-500 mb-3">
                    Section 2: Non-Cash Payments
                </h3>

                <!-- Sub 1: Bank Transfer -->
                <div class="mb-4">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-xs font-bold text-slate-700">Daftar Bank Transfer</span>
                        <span class="text-xs font-extrabold font-mono text-indigo-700">Total: ${formatRupiah(totalTransfers)}</span>
                    </div>
                    ${renderNonCashTable(nonCashTransfers)}
                </div>

                <!-- Sub 2: Credit/Debit Cards -->
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-xs font-bold text-slate-700">Daftar Kartu Kredit / Debit (EDC)</span>
                        <span class="text-xs font-extrabold font-mono text-indigo-700">Total: ${formatRupiah(totalCards)}</span>
                    </div>
                    ${renderNonCashTable(nonCashCards)}
                </div>
            </div>

            <!-- SECTION 3: CITY LEDGER (AR) -->
            <div class="mb-8">
                <h3 class="text-xs font-black uppercase tracking-wider text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border-l-4 border-amber-500 mb-3">
                    Section 3: City Ledger (AR / Piutang Perusahaan)
                </h3>
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xs font-bold text-slate-700">Daftar Tagihan City Ledger / Corporate</span>
                    <span class="text-xs font-extrabold font-mono text-amber-700">Total: ${formatRupiah(totalCityLedger)}</span>
                </div>
                ${renderNonCashTable(cityLedgerArList)}
            </div>

            <!-- SECTION 4: VOIDED TRANSACTIONS -->
            <div class="mb-6">
                <h3 class="text-xs font-black uppercase tracking-wider text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border-l-4 border-rose-500 mb-3">
                    Section 4: Voided Transactions (Transaksi Dibatalkan)
                </h3>
                ${renderVoidedTable(voidedList)}
            </div>

            <!-- Signatures -->
            <div class="grid grid-cols-3 gap-6 pt-8 border-t border-slate-300 text-center text-xs">
                <div>
                    <p class="font-bold text-slate-700">Dibuat Oleh (Kasir):</p>
                    <div class="h-16"></div>
                    <p class="font-bold border-t border-slate-400 pt-1 text-slate-800">${session.user_name}</p>
                </div>
                <div>
                    <p class="font-bold text-slate-700">Diperiksa Oleh (FO Supervisor):</p>
                    <div class="h-16"></div>
                    <p class="font-bold border-t border-slate-400 pt-1 text-slate-800">( .................................... )</p>
                </div>
                <div>
                    <p class="font-bold text-slate-700">Diterima Oleh (Accounting):</p>
                    <div class="h-16"></div>
                    <p class="font-bold border-t border-slate-400 pt-1 text-slate-800">( .................................... )</p>
                </div>
            </div>
        </div>
    `;
}

function renderNonCashTable(items) {
    if (!items || items.length === 0) {
        return `<div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-400">Tidak ada transaksi.</div>`;
    }

    return `
        <div class="border border-slate-200 rounded-xl overflow-hidden">
            <table class="w-full text-left text-xs">
                <thead class="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                    <tr>
                        <th class="py-2 px-3">Waktu</th>
                        <th class="py-2 px-3">Tamu / Reservasi</th>
                        <th class="py-2 px-3">Deskripsi / Metode</th>
                        <th class="py-2 px-3">Ref #</th>
                        <th class="py-2 px-3 text-right">Nominal</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    ${items.map(tx => {
                        const timeStr = tx.created_at ? new Date(tx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
                        const gCard = tx.reservations?.guest_card_files ? (Array.isArray(tx.reservations.guest_card_files) ? tx.reservations.guest_card_files[0] : tx.reservations.guest_card_files) : null;
                        const guestName = tx.reservations?.guest_name || gCard?.full_name || tx.reservations?.booker_name || '-';
                        const resNo = tx.reservations?.reservation_number || '-';
                        const amount = parseFloat(tx.amount || tx.total || tx.charge || tx.credit || 0);

                        return `
                            <tr class="hover:bg-slate-50">
                                <td class="py-2 px-3 font-mono text-slate-500">${timeStr}</td>
                                <td class="py-2 px-3 font-semibold text-slate-800">${guestName} <span class="text-[10px] text-slate-400 font-normal">(${resNo})</span></td>
                                <td class="py-2 px-3 text-slate-700">${tx.description || tx.category || '-'}</td>
                                <td class="py-2 px-3 font-mono text-slate-500">${tx.reference_number || '-'}</td>
                                <td class="py-2 px-3 text-right font-mono font-bold text-slate-900">${formatRupiah(amount)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderVoidedTable(items) {
    if (!items || items.length === 0) {
        return `<div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-400">Tidak ada transaksi yang dibatalkan (void).</div>`;
    }

    return `
        <div class="border border-slate-200 rounded-xl overflow-hidden">
            <table class="w-full text-left text-xs">
                <thead class="bg-rose-50 text-rose-800 font-semibold border-b border-rose-200 text-[11px]">
                    <tr>
                        <th class="py-2 px-3">Waktu Void</th>
                        <th class="py-2 px-3">Deskripsi Transaksi</th>
                        <th class="py-2 px-3">Nominal</th>
                        <th class="py-2 px-3">Alasan Void</th>
                        <th class="py-2 px-3">Oleh</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    ${items.map(tx => {
                        const voidTimeStr = tx.voided_at ? new Date(tx.voided_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) :
                                           (tx.created_at ? new Date(tx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-');
                        const amount = parseFloat(tx.amount || tx.total || tx.charge || tx.credit || 0);

                        return `
                            <tr class="bg-red-50/40 hover:bg-red-50">
                                <td class="py-2 px-3 font-mono text-slate-500">${voidTimeStr}</td>
                                <td class="py-2 px-3 font-semibold text-slate-800">${tx.description || '-'}</td>
                                <td class="py-2 px-3 font-mono font-bold text-slate-700 line-through">${formatRupiah(amount)}</td>
                                <td class="py-2 px-3 text-rose-700 font-semibold">${tx.void_reason || 'Tidak ada alasan'}</td>
                                <td class="py-2 px-3 font-medium text-slate-600">${tx.voided_by || 'Staff'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}
