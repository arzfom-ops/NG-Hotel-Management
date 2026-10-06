import { supabaseClient } from '../config/supabase.js';
import { formatDateISO, showToast, addDays } from '../utils/formatters.js';

let currentPreAuditCheck = null;
let currentEodReportData = null;

/**
 * Format currency string for display
 */
function formatCurrency(amount) {
    const num = Number(amount) || 0;
    return 'Rp ' + num.toLocaleString('id-ID');
}

/**
 * Format timestamp string for display
 */
function formatDateTimeDisplay(dateStr) {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateStr;
    }
}

/**
 * Gets the current business date being audited.
 */
export function getCurrentBusinessDate() {
    if (currentPreAuditCheck?.current_hotel_date) {
        return currentPreAuditCheck.current_hotel_date;
    }
    const d = (typeof window !== 'undefined' && window.todayDate) ? new Date(window.todayDate) : new Date();
    return formatDateISO(d);
}

/**
 * Seksi A: Pre-Audit Checklist (Validasi Prasyarat)
 * Calls RPC 'fn_pre_night_audit_check' and updates UI indicators.
 */
export async function fetchPreAuditCheck() {
    try {
        const dateEl = document.getElementById('na-current-date');
        const arrEl = document.getElementById('na-pending-arrivals');
        const depEl = document.getElementById('na-pending-departures');
        const openShiftEl = document.getElementById('na-open-shifts');

        const arrCard = document.getElementById('card-pending-arrivals');
        const depCard = document.getElementById('card-pending-departures');
        const openShiftCard = document.getElementById('card-open-shifts');

        const arrLink = document.getElementById('link-pending-arrivals');
        const depLink = document.getElementById('link-pending-departures');
        const openShiftLink = document.getElementById('link-open-shifts');

        const banner = document.getElementById('na-status-banner');
        const bannerMsg = document.getElementById('na-status-message');
        const runBtn = document.getElementById('btn-run-night-audit');

        if (bannerMsg) {
            bannerMsg.innerHTML = `<i class="ph ph-spinner animate-spin text-lg inline-block mr-2"></i> Memeriksa status prasyarat Night Audit...`;
        }

        const { data, error } = await supabaseClient.rpc('fn_pre_night_audit_check');

        if (error) {
            console.error('Error fetching pre night audit check:', error);
            showToast(`Gagal memeriksa checklist Night Audit: ${error.message || error}`, 'error');
            if (bannerMsg) {
                bannerMsg.textContent = `Gagal terhubung ke modul checklist: ${error.message || error}`;
            }
            return null;
        }

        currentPreAuditCheck = data || {};

        const currentDateStr = data?.current_hotel_date || formatDateISO(new Date());

        // Check open cashier sessions for currentDateStr
        let openShifts = [];
        try {
            const { data: shiftData, error: shiftErr } = await supabaseClient
                .from('cashier_sessions')
                .select('id, user_id, user_name')
                .eq('business_date', currentDateStr)
                .eq('status', 'OPEN');
            if (!shiftErr && shiftData) {
                openShifts = shiftData;
            }
        } catch (sErr) {
            console.warn('Error querying cashier_sessions in pre-audit check:', sErr);
        }

        const pendingArrivals = Number(data?.pending_arrivals) || 0;
        const pendingDepartures = Number(data?.pending_departures) || 0;
        const openShiftCount = openShifts.length;
        const isRunning = Boolean(data?.is_audit_running);

        // Render Current Business Date
        if (dateEl) dateEl.textContent = currentDateStr;

        // Render Pending Arrivals
        if (arrEl) arrEl.textContent = `${pendingArrivals} Tamu`;
        if (pendingArrivals > 0) {
            if (arrEl) arrEl.className = "text-2xl font-bold text-red-600";
            if (arrCard) arrCard.className = "p-4 rounded-xl bg-red-50 border border-red-200 flex flex-col justify-between";
            if (arrLink) arrLink.classList.remove('hidden');
        } else {
            if (arrEl) arrEl.className = "text-2xl font-bold text-slate-800";
            if (arrCard) arrCard.className = "p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between";
            if (arrLink) arrLink.classList.add('hidden');
        }

        // Render Pending Departures
        if (depEl) depEl.textContent = `${pendingDepartures} Tamu`;
        if (pendingDepartures > 0) {
            if (depEl) depEl.className = "text-2xl font-bold text-red-600";
            if (depCard) depCard.className = "p-4 rounded-xl bg-red-50 border border-red-200 flex flex-col justify-between";
            if (depLink) depLink.classList.remove('hidden');
        } else {
            if (depEl) depEl.className = "text-2xl font-bold text-slate-800";
            if (depCard) depCard.className = "p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between";
            if (depLink) depLink.classList.add('hidden');
        }

        // Render Open Shifts
        if (openShiftEl) openShiftEl.textContent = `${openShiftCount} Shift`;
        if (openShiftCount > 0) {
            if (openShiftEl) openShiftEl.className = "text-2xl font-bold text-red-600";
            if (openShiftCard) openShiftCard.className = "p-4 rounded-xl bg-red-50 border border-red-200 flex flex-col justify-between";
            if (openShiftLink) openShiftLink.classList.remove('hidden');
        } else {
            if (openShiftEl) openShiftEl.className = "text-2xl font-bold text-slate-800";
            if (openShiftCard) openShiftCard.className = "p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between";
            if (openShiftLink) openShiftLink.classList.add('hidden');
        }

        // Render Status Banner & Action Button State
        const blockingReasons = [];
        if (pendingArrivals > 0) blockingReasons.push(`${pendingArrivals} Check-In gantung`);
        if (pendingDepartures > 0) blockingReasons.push(`${pendingDepartures} Check-Out gantung`);
        if (openShiftCount > 0) {
            const shiftUsers = openShifts.map(s => s.user_name || 'Kasir').join(', ');
            blockingReasons.push(`Shift kasir masih terbuka (${shiftUsers})`);
        }
        if (isRunning) blockingReasons.push("Proses audit sedang berjalan");

        if (blockingReasons.length > 0) {
            if (banner) banner.className = "p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 mb-6 text-sm flex items-start gap-3";
            if (bannerMsg) {
                if (openShiftCount > 0) {
                    bannerMsg.innerHTML = `<strong>Night Audit diblokir!</strong> Shift masih terbuka! Harap tutup semua shift sebelum audit. <br><span class="text-xs text-red-600 mt-1 block">Detail kendala: ${blockingReasons.join('; ')}.</span>`;
                } else {
                    bannerMsg.textContent = `Night Audit diblokir. Harap selesaikan seluruh prasyarat terlebih dahulu: ${blockingReasons.join('; ')}.`;
                }
            }
            if (runBtn) {
                runBtn.disabled = true;
                runBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        } else {
            if (banner) banner.className = "p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 mb-6 text-sm flex items-start gap-3";
            if (bannerMsg) {
                bannerMsg.textContent = "Seluruh prasyarat (Check-In, Check-Out, dan Shift Kasir Closed) terpenuhi. Sistem siap untuk menjalankan proses Night Audit dan penutupan tanggal bisnis.";
            }
            if (runBtn) {
                runBtn.disabled = false;
                runBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }

        return data;
    } catch (err) {
        console.error('Exception in fetchPreAuditCheck:', err);
        return null;
    }
}

/**
 * Seksi B: Seksi Konfirmasi Night Audit
 */
export function openNightAuditConfirmModal() {
    const currentDateStr = currentPreAuditCheck?.current_hotel_date || formatDateISO(new Date());
    const currentDateObj = new Date(currentDateStr + 'T00:00:00');
    const nextDateObj = addDays(currentDateObj, 1);
    const nextDateStr = formatDateISO(nextDateObj);

    const currEl = document.getElementById('na-confirm-date-current');
    const nextEl = document.getElementById('na-confirm-date-next');
    if (currEl) currEl.textContent = currentDateStr;
    if (nextEl) nextEl.textContent = nextDateStr;

    const modal = document.getElementById('modal-night-audit-confirm');
    if (modal) modal.classList.remove('hidden');
}

export function closeNightAuditConfirmModal() {
    const modal = document.getElementById('modal-night-audit-confirm');
    if (modal) modal.classList.add('hidden');
}

/**
 * Seksi B: Eksekusi Night Audit
 */
export async function handleExecuteNightAudit() {
    closeNightAuditConfirmModal();

    showToast('Memproses Night Audit & Posting Room Charges...', 'info');

    try {
        const userName = (typeof window !== 'undefined' && window.currentUser?.name) ? window.currentUser.name : 'System Admin';

        const { data, error } = await supabaseClient.rpc('fn_execute_night_audit', {
            p_user_name: userName
        });

        if (error) {
            console.error('Error executing Night Audit RPC:', error);
            showToast(`Gagal menjalankan Night Audit: ${error.message || error}`, 'error');
            return { success: false, error };
        }

        showToast('Night Audit Berhasil!', 'success');

        // Refresh global hotel business date
        if (data && data.new_business_date && typeof window !== 'undefined') {
            window.currentHotelDate = data.new_business_date;
        }
        if (typeof window !== 'undefined' && typeof window.getHotelBusinessDate === 'function') {
            await window.getHotelBusinessDate();
        }

        // Refresh pre audit checklist & history
        await fetchPreAuditCheck();
        await fetchNightAuditHistory();

        // Otomatis buka modal Laporan Flash / EOD Report
        openEodReportModal(data);

        return { success: true, data };
    } catch (err) {
        console.error('Exception in handleExecuteNightAudit:', err);
        showToast(`Terjadi kesalahan Night Audit: ${err.message || err}`, 'error');
        return { success: false, error: err };
    }
}

/**
 * Wrapper function for backwards compatibility
 */
export async function executeNightAudit(auditDateStr) {
    return await handleExecuteNightAudit();
}

/**
 * Helper to classify folio transaction into categories
 */

function classifyTransactionHelper(tx) {
    const isVoid = tx.is_void === true;
    if (isVoid) {
        return { categoryType: 'VOID', amount: parseFloat(tx.amount || tx.total || tx.charge || tx.credit || 0) };
    }

    const catUpper = (tx.category || '').toUpperCase();
    const txType = (tx.transaction_type || tx.type || '').toUpperCase();
    const pmType = (tx.payment_methods?.type || tx.payment_methods?.method_type || '').toUpperCase();
    const pmName = (tx.payment_methods?.name || '').toUpperCase();

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
 * Fetch and aggregate Cashier Reconciliation Summary for a given business date
 */
export async function fetchEodCashierReconciliation(businessDate) {
    try {
        const currentBusinessDate = typeof businessDate === 'string' ? businessDate : formatDateISO(businessDate || new Date());
        // 1. Fetch CLOSED cashier sessions for this business date
        const { data: sessions, error: sessErr } = await supabaseClient
            .from('cashier_sessions')
            .select('*')
            .eq('business_date', currentBusinessDate)
            .eq('status', 'CLOSED');

        if (sessErr) {
            console.error('Error fetching cashier sessions for EOD reconciliation:', sessErr);
        }

        const closedSessions = sessions || [];

        let totalExpectedCash = 0;
        let totalDeclaredCash = 0;
        let totalOverShort = 0;
        let totalRemittance = 0;
        let totalOpeningFloat = 0;
        let totalSystemNetCash = 0;

        closedSessions.forEach(s => {
            totalExpectedCash += Number(s.system_expected_cash || 0);
            totalDeclaredCash += Number(s.declared_total_cash || s.closing_declared_cash || 0);
            totalOverShort += Number(s.over_short || s.over_short_amount || 0);
            totalRemittance += Number(s.remittance_amount || 0);
            totalOpeningFloat += Number(s.opening_float || 0);
            totalSystemNetCash += Number(s.system_net_cash || 0);
        });

        const status = totalOverShort === 0 ? 'BALANCED' : 'VARIANCE_DETECTED';

        // Session time intervals for checking assigned vs unassigned transactions
        const sessionTimeRanges = closedSessions.map(s => ({
            opened_at: s.opened_at,
            closed_at: s.closed_at
        })).filter(r => r.opened_at && r.closed_at);

        // 2. Fetch folio transactions filtering by hotel_business_date and inner joining cashier_sessions
        let allTx = [];
        const { data: txData, error: txErr } = await supabaseClient
            .from('folio_transactions')
            .select(`
                *,
                payment_methods(name),
                cashier_sessions!inner(status, id, opening_float, system_expected_cash, closing_declared_cash, over_short_amount)
            `)
            .eq('hotel_business_date', currentBusinessDate)
            .eq('cashier_sessions.status', 'CLOSED')
            .order('transaction_date', { ascending: true });

        if (txErr) {
            console.error('Error fetching folio transactions for EOD reconciliation:', txErr);
            // Fallback order by created_at if transaction_date order fails
            const { data: fallbackData } = await supabaseClient
                .from('folio_transactions')
                .select(`
                    *,
                    payment_methods(name),
                    cashier_sessions!inner(status, id, opening_float, system_expected_cash, closing_declared_cash, over_short_amount)
                `)
                .eq('hotel_business_date', currentBusinessDate)
                .eq('cashier_sessions.status', 'CLOSED')
                .order('created_at', { ascending: true });
            if (fallbackData) allTx = fallbackData;
        } else {
            allTx = txData || [];
        }

        const txList = allTx || [];

        let cashReceived = 0;
        let nonCashReceived = 0;
        let cityLedger = 0;
        let paidOut = 0;
        let voidsCount = 0;
        let voidsAmount = 0;

        let unassignedCount = 0;
        let unassignedTotalAmount = 0;

        txList.forEach(tx => {
            const txCreatedIso = tx.created_at ? tx.created_at.split('T')[0] : null;
            const isDateMatch = tx.hotel_business_date === currentBusinessDate || txCreatedIso === currentBusinessDate;

            // Check if tx falls within any closed shift timestamp range
            let isAssignedToSession = false;
            if (tx.created_at && sessionTimeRanges.length > 0) {
                const txTime = new Date(tx.created_at).getTime();
                isAssignedToSession = sessionTimeRanges.some(r => {
                    const openTime = new Date(r.opened_at).getTime();
                    const closeTime = new Date(r.closed_at).getTime();
                    return txTime >= openTime && txTime <= closeTime;
                });
            }

            if (isAssignedToSession) {
                const classified = classifyTransactionHelper(tx);
                if (classified.categoryType === 'VOID') {
                    voidsCount++;
                    voidsAmount += classified.amount;
                } else if (classified.categoryType === 'PAID_OUT') {
                    paidOut += classified.amount;
                } else if (classified.categoryType === 'CASH_PAYMENT') {
                    cashReceived += classified.amount;
                } else if (classified.categoryType === 'BANK_TRANSFER' || classified.categoryType === 'CREDIT_CARD') {
                    nonCashReceived += classified.amount;
                } else if (classified.categoryType === 'CITY_LEDGER') {
                    cityLedger += classified.amount;
                }
            } else if (isDateMatch) {
                // Relevant to today's date but not assigned to any closed session interval
                unassignedCount++;
                unassignedTotalAmount += Number(tx.amount || tx.total || tx.charge || tx.credit || 0);
            }
        });

        return {
            totalExpectedCash,
            totalDeclaredCash,
            totalOverShort,
            totalRemittance,
            totalOpeningFloat,
            totalSystemNetCash,
            status,
            closedSessionsCount: closedSessions.length,
            closedSessions,
            breakdown: {
                cashReceived,
                nonCashReceived,
                cityLedger,
                paidOut,
                voidsCount,
                voidsAmount
            },
            unassignedTransactions: {
                count: unassignedCount,
                totalAmount: unassignedTotalAmount
            }
        };
    } catch (err) {
        console.error('Exception in fetchEodCashierReconciliation:', err);
        return null;
    }
}

/**
 * EOD Flash Report Modal Management
 */
export async function openEodReportModal(reportData) {
    if (!reportData) return;

    currentEodReportData = reportData;

    const businessDate = reportData.previous_business_date || reportData.business_date || currentPreAuditCheck?.current_hotel_date || '-';
    const executedAt = reportData.executed_at ? formatDateTimeDisplay(reportData.executed_at) : formatDateTimeDisplay(new Date().toISOString());
    const executedBy = reportData.executed_by || reportData.p_user_name || (window.currentUser?.name || 'System Admin');
    const roomsOccupied = reportData.total_occupied ?? 0;
    const roomRevenue = reportData.total_revenue ?? 0;
    const taxService = reportData.total_tax_service ?? 0;

    const bDateEl = document.getElementById('eod-business-date');
    const execAtEl = document.getElementById('eod-executed-at');
    const execByEl = document.getElementById('eod-executed-by');
    const roomsEl = document.getElementById('eod-rooms-occupied');
    const revEl = document.getElementById('eod-room-revenue');
    const taxEl = document.getElementById('eod-tax-service');

    if (bDateEl) bDateEl.textContent = businessDate;
    if (execAtEl) execAtEl.textContent = executedAt;
    if (execByEl) execByEl.textContent = executedBy;
    if (roomsEl) roomsEl.textContent = `${roomsOccupied} Kamar`;
    if (revEl) revEl.textContent = formatCurrency(roomRevenue);
    if (taxEl) taxEl.textContent = formatCurrency(taxService);

    // Fetch and render Cashier Reconciliation Summary
    const reconc = await fetchEodCashierReconciliation(businessDate);
    if (reconc) {
        currentEodReportData.reconciliation = reconc;
        renderCashierReconciliationSummaryUI(reconc);
    }

    const modal = document.getElementById('modal-eod-report');
    if (modal) modal.classList.remove('hidden');
}

/**
 * Render Cashier Reconciliation Summary into EOD Modal UI
 */
export function renderCashierReconciliationSummaryUI(reconc) {
    const container = document.getElementById('eod-cashier-reconciliation-container');
    if (!container || !reconc) return;

    const isBalanced = reconc.status === 'BALANCED';
    const statusBadge = isBalanced
        ? `<span class="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">BALANCED</span>`
        : `<span class="px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">VARIANCE DETECTED</span>`;

    const overShortText = reconc.totalOverShort === 0
        ? `<span class="text-emerald-700 font-bold">Rp 0 (Pass)</span>`
        : (reconc.totalOverShort < 0
            ? `<span class="text-rose-700 font-bold">-${formatCurrency(Math.abs(reconc.totalOverShort))} (Short)</span>`
            : `<span class="text-amber-700 font-bold">+${formatCurrency(reconc.totalOverShort)} (Over)</span>`);

    const unassignedAlert = reconc.unassignedTransactions?.count > 0 ? `
        <div class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
            <i class="ph ph-warning-circle text-lg text-amber-600 shrink-0 mt-0.5"></i>
            <div>
                <strong class="font-bold">Peringatan Transaksi Tanpa Session (Unassigned Transactions):</strong>
                <p class="mt-0.5">Terdapat <span class="font-bold text-amber-900">${reconc.unassignedTransactions.count} transaksi</span> senilai <span class="font-bold text-amber-900">${formatCurrency(reconc.unassignedTransactions.totalAmount)}</span> yang dicatat pada tanggal bisnis ini tetapi tidak terhubung ke shift kasir manapun.</p>
            </div>
        </div>
    ` : '';

    container.innerHTML = `
        <div class="flex items-center justify-between border-b pb-1">
            <h4 class="font-bold text-sm text-slate-700 uppercase tracking-wider">Cashier Reconciliation Summary</h4>
            ${statusBadge}
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span class="text-xs font-bold text-slate-500 block uppercase">Total Expected Cash</span>
                <span class="text-lg font-black text-slate-800 font-mono mt-0.5 block">${formatCurrency(reconc.totalExpectedCash)}</span>
                <span class="text-[10px] text-slate-400">Sum expected cash (${reconc.closedSessionsCount} closed shifts)</span>
            </div>
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span class="text-xs font-bold text-slate-500 block uppercase">Total Actual Cash Collected</span>
                <span class="text-lg font-black text-slate-900 font-mono mt-0.5 block">${formatCurrency(reconc.totalDeclaredCash)}</span>
                <span class="text-[10px] text-slate-400">Sum declared cash dari shift kasir</span>
            </div>
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span class="text-xs font-bold text-slate-500 block uppercase">Total Over / Short</span>
                <div class="text-lg font-black font-mono mt-0.5">${overShortText}</div>
                <span class="text-[10px] text-slate-400">Aggregat selisih kasir hari ini</span>
            </div>
        </div>

        <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div class="font-bold text-slate-700 mb-2 uppercase text-[11px] tracking-wider">Rincian Penerimaan Kasir (Closed Shifts)</div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600">
                <div>
                    <span class="text-slate-400 block text-[10px] font-semibold">Cash Received</span>
                    <strong class="text-slate-800 font-mono text-xs">${formatCurrency(reconc.breakdown.cashReceived)}</strong>
                </div>
                <div>
                    <span class="text-slate-400 block text-[10px] font-semibold">Non-Cash (Cards/Transfer)</span>
                    <strong class="text-indigo-800 font-mono text-xs">${formatCurrency(reconc.breakdown.nonCashReceived)}</strong>
                </div>
                <div>
                    <span class="text-slate-400 block text-[10px] font-semibold">City Ledger / AR</span>
                    <strong class="text-amber-800 font-mono text-xs">${formatCurrency(reconc.breakdown.cityLedger)}</strong>
                </div>
                <div>
                    <span class="text-slate-400 block text-[10px] font-semibold">Adjustments / Voids</span>
                    <strong class="text-rose-800 font-mono text-xs">${reconc.breakdown.voidsCount} Tx (${formatCurrency(reconc.breakdown.voidsAmount)})</strong>
                </div>
            </div>
        </div>

        ${unassignedAlert}
    `;
}

export async function closeEodReportModal() {
    const modal = document.getElementById('modal-eod-report');
    if (modal) modal.classList.add('hidden');

    if (typeof window !== 'undefined') {
        if (typeof window.getHotelBusinessDate === 'function') {
            await window.getHotelBusinessDate();
        }
        if (typeof window.fetchHotelBusinessDate === 'function') {
            await window.fetchHotelBusinessDate();
        }
        if (typeof window.renderCurrentModule === 'function') {
            window.renderCurrentModule();
        }
        window.location.reload();
    }
}

/**
 * Print EOD Flash Report
 */
export function printEodReport(data) {
    const report = data || currentEodReportData;
    if (!report) return;

    const businessDate = report.previous_business_date || report.business_date || '-';
    const executedAt = report.executed_at ? formatDateTimeDisplay(report.executed_at) : formatDateTimeDisplay(new Date().toISOString());
    const executedBy = report.executed_by || (window.currentUser?.name || 'System Admin');
    const roomsOccupied = report.total_occupied ?? 0;
    const roomRevenue = report.total_revenue ?? 0;
    const taxService = report.total_tax_service ?? 0;

    const reconc = report.reconciliation || null;

    let reconcHtml = '';
    if (reconc) {
        const isBalanced = reconc.status === 'BALANCED';
        const statusLabel = isBalanced ? 'BALANCED' : 'VARIANCE DETECTED';
        const overShortStr = reconc.totalOverShort === 0 ? 'Rp 0 (Pass)' : (reconc.totalOverShort < 0 ? `-${formatCurrency(Math.abs(reconc.totalOverShort))} (Short)` : `+${formatCurrency(reconc.totalOverShort)} (Over)`);

        let unassignedNote = '';
        if (reconc.unassignedTransactions?.count > 0) {
            unassignedNote = `
                <div style="margin-top: 10px; padding: 10px; background: #fffbebf5; border: 1px solid #fcd34d; border-radius: 6px; font-size: 11px; color: #92400e;">
                    <strong>PERINGATAN UNASSIGNED TRANSACTIONS:</strong> Terdapat ${reconc.unassignedTransactions.count} transaksi tanpa session kasir senilai ${formatCurrency(reconc.unassignedTransactions.totalAmount)}.
                </div>
            `;
        }

        reconcHtml = `
            <div class="summary-title" style="margin-top: 20px;">Cashier Reconciliation Summary (${statusLabel})</div>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Total Expected Cash</div>
                    <div class="metric-value">${formatCurrency(reconc.totalExpectedCash)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Total Actual Cash Collected</div>
                    <div class="metric-value">${formatCurrency(reconc.totalDeclaredCash)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Total Over / Short</div>
                    <div class="metric-value">${overShortStr}</div>
                </div>
            </div>

            <div style="background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 12px; margin-bottom: 15px;">
                <div style="font-weight: bold; margin-bottom: 6px; text-transform: uppercase; font-size: 11px; color: #475569;">Rincian Penerimaan Kasir (${reconc.closedSessionsCount} Closed Shift)</div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
                    <div><span style="color: #64748b; font-size: 10px;">Cash Received:</span><br><strong>${formatCurrency(reconc.breakdown.cashReceived)}</strong></div>
                    <div><span style="color: #64748b; font-size: 10px;">Non-Cash (Cards/Transfer):</span><br><strong>${formatCurrency(reconc.breakdown.nonCashReceived)}</strong></div>
                    <div><span style="color: #64748b; font-size: 10px;">City Ledger (AR):</span><br><strong>${formatCurrency(reconc.breakdown.cityLedger)}</strong></div>
                    <div><span style="color: #64748b; font-size: 10px;">Voids / Adjustments:</span><br><strong>${reconc.breakdown.voidsCount} Tx (${formatCurrency(reconc.breakdown.voidsAmount)})</strong></div>
                </div>
            </div>
            ${unassignedNote}
        `;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
        showToast('Gagal membuka jendela cetak. Pastikan pop-up dibolehkan di browser Anda.', 'error');
        return;
    }

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>EOD Flash Report - ${businessDate}</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; color: #1e293b; }
                .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
                .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px; color: #0f172a; }
                .header p { margin: 4px 0 0 0; font-size: 12px; color: #64748b; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; font-size: 13px; }
                .info-item { display: flex; flex-direction: column; }
                .info-label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; }
                .info-value { font-weight: bold; font-size: 14px; margin-top: 2px; }
                .summary-title { font-size: 14px; font-weight: bold; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
                .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
                .metric-card { padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fafafa; }
                .metric-label { font-size: 11px; color: #475569; font-weight: bold; }
                .metric-value { font-size: 18px; font-weight: bold; color: #0f172a; margin-top: 4px; }
                .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; pt: 12px; font-size: 11px; color: #94a3b8; text-align: center; }
                @media print {
                    body { margin: 0; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Laporan Flash Night Audit (EOD Report)</h1>
                <p>NG Hotel Management System - End of Day Audit Summary</p>
            </div>

            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Tanggal Bisnis Ditutup</span>
                    <span class="info-value">${businessDate}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Tanggal / Waktu Eksekusi</span>
                    <span class="info-value">${executedAt}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Di-audit Oleh</span>
                    <span class="info-value">${executedBy}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Status Audit</span>
                    <span class="info-value" style="color: #166534;">SUCCESS</span>
                </div>
            </div>

            <div class="summary-title">Ringkasan Operasional</div>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Total Kamar Terisi</div>
                    <div class="metric-value">${roomsOccupied} Kamar</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Total Room Revenue</div>
                    <div class="metric-value">${formatCurrency(roomRevenue)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Total Tax & Service</div>
                    <div class="metric-value">${formatCurrency(taxService)}</div>
                </div>
            </div>

            ${reconcHtml}

            <div class="footer">
                Dicetak pada ${new Date().toLocaleString('id-ID')} | Dokumen Resmi Sistem PMS
            </div>

            <script>
                window.onload = function() {
                    window.print();
                };
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
}

/**
 * Seksi C: Riwayat & Re-Print Laporan EOD (History Tab)
 */
export async function fetchNightAuditHistory() {
    try {
        const tbody = document.getElementById('na-history-tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="py-8 text-center text-slate-400">
                        <i class="ph ph-spinner animate-spin text-2xl inline-block mb-2"></i>
                        <div>Memuat riwayat Night Audit...</div>
                    </td>
                </tr>
            `;
        }

        const { data, error } = await supabaseClient
            .from('night_audit_history')
            .select('*')
            .order('business_date', { ascending: false });

        if (error) {
            console.error('Error fetching night audit history:', error);
            showToast(`Gagal memuat riwayat Night Audit: ${error.message || error}`, 'error');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="py-6 text-center text-red-500 font-semibold">
                            Gagal memuat data riwayat: ${error.message || error}
                        </td>
                    </tr>
                `;
            }
            return [];
        }

        if (!data || data.length === 0) {
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="py-8 text-center text-slate-400">
                            Belum ada riwayat Night Audit yang tercatat.
                        </td>
                    </tr>
                `;
            }
            return [];
        }

        if (tbody) {
            tbody.innerHTML = data.map((item, idx) => {
                const bDate = item.business_date || '-';
                const execAt = formatDateTimeDisplay(item.executed_at);
                const execBy = item.executed_by || 'System Admin';
                const occ = item.total_occupied ?? 0;
                const rev = formatCurrency(item.total_revenue ?? 0);

                const rowJson = JSON.stringify(item).replace(/"/g, '&quot;');

                return `
                    <tr class="hover:bg-slate-50/80 transition-colors">
                        <td class="py-3.5 px-4 font-bold text-slate-800">${bDate}</td>
                        <td class="py-3.5 px-4 text-slate-600 text-xs">${execAt}</td>
                        <td class="py-3.5 px-4 text-slate-700 font-medium">${execBy}</td>
                        <td class="py-3.5 px-4 text-center font-semibold text-slate-800">${occ} Kamar</td>
                        <td class="py-3.5 px-4 text-right font-bold text-emerald-700">${rev}</td>
                        <td class="py-3.5 px-4 text-right">
                            <button type="button" onclick="openEodReportFromHistory(${rowJson})" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg transition-colors border border-indigo-200 shadow-sm">
                                <i class="ph ph-printer text-sm"></i> Re-Print EOD Report
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        return data;
    } catch (err) {
        console.error('Exception in fetchNightAuditHistory:', err);
        return [];
    }
}

/**
 * Open EOD Report from History Row
 */
export function openEodReportFromHistory(item) {
    if (!item) return;
    openEodReportModal({
        previous_business_date: item.business_date,
        executed_at: item.executed_at,
        executed_by: item.executed_by,
        total_occupied: item.total_occupied,
        total_revenue: item.total_revenue,
        total_tax_service: item.total_tax_service
    });
}

/**
 * Aliases for backwards compatibility
 */
export async function handleNightAudit(auditDateStr) {
    return await handleExecuteNightAudit();
}

export async function runNightAudit(auditDateStr) {
    return await handleExecuteNightAudit();
}

/**
 * Main render function for Night Audit view
 */
export async function renderNightAudit() {
    const viewContainer = document.getElementById('night-audit-view');
    if (viewContainer) {
        // Ensure container is displayed cleanly
        viewContainer.classList.remove('hidden');
    }
    await fetchPreAuditCheck();
    await fetchNightAuditHistory();
}
