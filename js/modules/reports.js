import { supabaseClient } from '../config/supabase.js';
import { formatCurrency, showToast, formatDateISO } from '../utils/formatters.js';

/**
 * A. fetchDailyReports(businessDate)
 * - Calls supabaseClient.rpc('fn_generate_daily_financial_report', { p_business_date: businessDate })
 * - Handles errors gracefully (shows toast if fail)
 * - Returns the parsed JSON data from the RPC response
 */
export async function fetchDailyReports(businessDate) {
    try {
        let targetDate = businessDate;
        if (!targetDate) {
            if (typeof window !== 'undefined' && window.currentHotelDate) {
                targetDate = window.currentHotelDate;
            } else {
                targetDate = formatDateISO(new Date());
            }
        }

        const { data, error } = await supabaseClient.rpc('fn_generate_daily_financial_report', {
            p_business_date: targetDate
        });

        if (error) {
            console.error('Error fetching Daily Reports RPC:', error);
            showToast(`Gagal memuat Daily Financial Report: ${error.message || error}`, 'error');
            return null;
        }

        console.log('Daily Reports RPC Response:', data);
        return data;
    } catch (err) {
        console.error('Exception in fetchDailyReports:', err);
        showToast(`Terjadi kesalahan: ${err.message || err}`, 'error');
        return null;
    }
}

/**
 * B. renderSummarySection(data)
 * - Takes the summary_cashier part of the data.
 * - Renders a clean table/card layout showing: Cash, Card, Transfer, Grand Total.
 * - Format currency using Intl.NumberFormat('id-ID') or formatCurrency.
 */
export function renderSummarySection(data) {
    const container = document.getElementById('section-summary');
    if (!container) return;

    const summary = data || {};
    const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 });

    const cash = Number(summary.cash || summary.CASH || summary.Cash || 0);
    const card = Number(summary.card || summary.CARD || summary.Card || summary.credit_card || summary.debit_card || 0);
    const transfer = Number(summary.transfer || summary.TRANSFER || summary.Transfer || summary.bank_transfer || 0);
    const grandTotal = summary.grand_total !== undefined ? Number(summary.grand_total) : (cash + card + transfer);

    container.innerHTML = `
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h4 class="text-base font-bold text-slate-800 flex items-center gap-2">
                <i class="ph ph-wallet text-xl text-primary"></i> 1. Summary Cashier (Revenue Breakdown)
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Cash</span>
                    <h5 class="text-xl font-extrabold text-slate-800 mt-1">${formatter.format(cash)}</h5>
                </div>
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Card</span>
                    <h5 class="text-xl font-extrabold text-slate-800 mt-1">${formatter.format(card)}</h5>
                </div>
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Transfer</span>
                    <h5 class="text-xl font-extrabold text-slate-800 mt-1">${formatter.format(transfer)}</h5>
                </div>
                <div class="bg-blue-50 p-4 rounded-xl border border-blue-200">
                    <span class="text-xs font-bold text-blue-600 uppercase tracking-wider">Grand Total</span>
                    <h5 class="text-xl font-extrabold text-primary mt-1">${formatter.format(grandTotal)}</h5>
                </div>
            </div>
        </div>
    `;
}

/**
 * C. renderGuestBalancesTable(data)
 * - Takes the guest_balances array.
 * - Renders an HTML table with columns: Room No, Guest Name, Check-In, Check-Out, Balance.
 * - Highlight rows where Balance > 0 in red/orange text.
 * - If empty, show "No In-House Guests".
 */
export function renderGuestBalancesTable(data) {
    const container = document.getElementById('section-guest-balances');
    if (!container) return;

    const list = Array.isArray(data) ? data : [];
    const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 });

    let tableRowsHTML = '';
    if (list.length === 0) {
        tableRowsHTML = `
            <tr>
                <td colspan="5" class="py-6 text-center text-slate-400 font-medium">No In-House Guests</td>
            </tr>
        `;
    } else {
        tableRowsHTML = list.map(item => {
            const roomNo = item.room_number || item.room_no || item.room || '-';
            const guestName = item.guest_name || item.name || '-';
            const checkIn = item.check_in_date || item.check_in || '-';
            const checkOut = item.check_out_date || item.check_out || '-';
            const balance = Number(item.balance !== undefined ? item.balance : (item.current_balance || 0));

            const isOutstanding = balance > 0;
            const balanceClass = isOutstanding ? 'text-red-600 font-bold bg-red-50/50' : 'text-slate-700 font-medium';

            return `
                <tr class="hover:bg-slate-50 border-b border-slate-100 text-sm ${isOutstanding ? 'bg-orange-50/30' : ''}">
                    <td class="py-3 px-4 font-bold text-slate-800">${roomNo}</td>
                    <td class="py-3 px-4 text-slate-800 font-medium">${guestName}</td>
                    <td class="py-3 px-4 text-slate-600">${checkIn}</td>
                    <td class="py-3 px-4 text-slate-600">${checkOut}</td>
                    <td class="py-3 px-4 text-right ${balanceClass}">${formatter.format(balance)}</td>
                </tr>
            `;
        }).join('');
    }

    container.innerHTML = `
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h4 class="text-base font-bold text-slate-800 flex items-center gap-2">
                <i class="ph ph-users text-xl text-primary"></i> 2. In-House Guest Balances
            </h4>
            <div class="border border-slate-200 rounded-xl overflow-x-auto">
                <table class="w-full text-left text-xs">
                    <thead class="bg-slate-50 text-slate-600 font-bold uppercase text-[11px] border-b border-slate-200">
                        <tr>
                            <th class="py-3 px-4">Room No</th>
                            <th class="py-3 px-4">Guest Name</th>
                            <th class="py-3 px-4">Check-In</th>
                            <th class="py-3 px-4">Check-Out</th>
                            <th class="py-3 px-4 text-right">Balance</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 font-medium text-slate-700">
                        ${tableRowsHTML}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * D. renderCheckoutList(data)
 * - Takes the checked_out_list array.
 * - Renders an HTML table with columns: Room No, Guest Name, Nights, Settlement Method, Total Paid.
 * - If empty, show "No Checkouts Today".
 */
export function renderCheckoutList(data) {
    const container = document.getElementById('section-checkout-list');
    if (!container) return;

    const list = Array.isArray(data) ? data : [];
    const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 });

    let tableRowsHTML = '';
    if (list.length === 0) {
        tableRowsHTML = `
            <tr>
                <td colspan="5" class="py-6 text-center text-slate-400 font-medium">No Checkouts Today</td>
            </tr>
        `;
    } else {
        tableRowsHTML = list.map(item => {
            const roomNo = item.room_number || item.room_no || item.room || '-';
            const guestName = item.guest_name || item.name || '-';
            const nights = item.nights !== undefined ? item.nights : (item.total_nights || 1);
            const settlementMethod = item.settlement_method || item.payment_method || item.method || 'Direct / Cashier';
            const totalPaid = Number(item.total_paid !== undefined ? item.total_paid : (item.paid_amount || item.amount || 0));

            return `
                <tr class="hover:bg-slate-50 border-b border-slate-100 text-sm">
                    <td class="py-3 px-4 font-bold text-slate-800">${roomNo}</td>
                    <td class="py-3 px-4 text-slate-800 font-medium">${guestName}</td>
                    <td class="py-3 px-4 text-slate-600">${nights} Malam</td>
                    <td class="py-3 px-4 text-slate-600 font-semibold">${settlementMethod}</td>
                    <td class="py-3 px-4 text-right font-bold text-emerald-600">${formatter.format(totalPaid)}</td>
                </tr>
            `;
        }).join('');
    }

    container.innerHTML = `
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h4 class="text-base font-bold text-slate-800 flex items-center gap-2">
                <i class="ph ph-sign-out text-xl text-primary"></i> 3. Checked-Out Guests Today
            </h4>
            <div class="border border-slate-200 rounded-xl overflow-x-auto">
                <table class="w-full text-left text-xs">
                    <thead class="bg-slate-50 text-slate-600 font-bold uppercase text-[11px] border-b border-slate-200">
                        <tr>
                            <th class="py-3 px-4">Room No</th>
                            <th class="py-3 px-4">Guest Name</th>
                            <th class="py-3 px-4">Nights</th>
                            <th class="py-3 px-4">Settlement Method</th>
                            <th class="py-3 px-4 text-right">Total Paid</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 font-medium text-slate-700">
                        ${tableRowsHTML}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * E. openDailyReportsModal()
 * - Opens modal container #modal-daily-reports
 * - Defaults to window.currentHotelDate
 * - Triggers fetchDailyReports and renders all three sections
 */
export async function openDailyReportsModal() {
    const modal = document.getElementById('modal-daily-reports');
    if (!modal) return;

    modal.classList.remove('hidden');

    const picker = document.getElementById('report-date-picker');
    let targetDate = window.currentHotelDate;
    if (!targetDate && typeof window.getHotelBusinessDate === 'function') {
        targetDate = await window.getHotelBusinessDate();
    }
    if (!targetDate) {
        targetDate = formatDateISO(new Date());
    }

    if (picker) {
        picker.value = targetDate;
    }

    await refreshDailyReports();
}

/**
 * closeDailyReportsModal()
 */
export function closeDailyReportsModal() {
    const modal = document.getElementById('modal-daily-reports');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * refreshDailyReports()
 */
export async function refreshDailyReports() {
    const picker = document.getElementById('report-date-picker');
    const selectedDate = picker ? picker.value : (window.currentHotelDate || formatDateISO(new Date()));

    const data = await fetchDailyReports(selectedDate);
    if (data) {
        renderSummarySection(data.summary_cashier || data.summary || {});
        renderGuestBalancesTable(data.guest_balances || []);
        renderCheckoutList(data.checked_out_list || []);
    } else {
        renderSummarySection({});
        renderGuestBalancesTable([]);
        renderCheckoutList([]);
    }
}

/**
 * printDailyReports()
 */
export function printDailyReports() {
    window.print();
}

/**
 * Existing DRR exports maintained for backward compatibility
 */
export async function fetchDailyRevenueReport(selectedDate) {
    const reportDateInput = document.getElementById('drr-date-picker');
    let targetDate = selectedDate;

    if (!targetDate || typeof targetDate !== 'string') {
        targetDate = reportDateInput ? reportDateInput.value : null;
    }

    if (!targetDate) {
        if (typeof window !== 'undefined' && typeof window.getHotelBusinessDate === 'function') {
            targetDate = await window.getHotelBusinessDate();
        } else if (typeof window !== 'undefined' && window.currentHotelDate) {
            targetDate = window.currentHotelDate;
        } else {
            targetDate = formatDateISO(new Date());
        }
    }

    if (reportDateInput) {
        reportDateInput.value = targetDate;
    }

    try {
        const { data, error } = await supabaseClient.rpc('rpc_get_daily_revenue_report', {
            p_report_date: targetDate
        });

        if (error) {
            console.error('Error fetching Daily Revenue Report RPC:', error);
            if (typeof selectedDate !== 'string') {
                showToast(`Gagal memuat Daily Revenue Report: ${error.message || error}`, 'error');
            }
            return { data: null, error };
        }

        if (data) {
            renderDailyRevenueReport(data);
        }

        return { data, error: null };
    } catch (err) {
        console.error('Exception in fetchDailyRevenueReport:', err);
        return { data: null, error: err };
    }
}

export function renderDailyRevenueReport(data) {
    if (!data) return;

    const stats = data.statistics || {};
    const kpi = data.kpi || data.kpi_summary || {};
    const revenue = data.revenue || data.revenue_breakdown || {};

    const setElemText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    const occToday = stats.occ_percent_today ?? 0;
    const occMtd = stats.occ_percent_mtd ?? 0;
    setElemText('drr-card-occ', `${occToday}%`);
    setElemText('drr-card-occ-mtd', `MTD: ${occMtd}%`);

    const adrToday = kpi.adr_today ?? 0;
    const adrMtd = kpi.adr_mtd ?? 0;
    setElemText('drr-card-adr', formatCurrency(adrToday));
    setElemText('drr-card-adr-mtd', `MTD: ${formatCurrency(adrMtd)}`);

    const revparToday = kpi.revpar_today ?? kpi.rev_par_today ?? 0;
    const revparMtd = kpi.revpar_mtd ?? kpi.rev_par_mtd ?? 0;
    setElemText('drr-card-revpar', formatCurrency(revparToday));
    setElemText('drr-card-revpar-mtd', `MTD: ${formatCurrency(revparMtd)}`);

    const totalToday = revenue.total_today ?? 0;
    const totalMtd = revenue.total_mtd ?? 0;
    setElemText('drr-card-revenue', formatCurrency(totalToday));
    setElemText('drr-card-revenue-mtd', `MTD: ${formatCurrency(totalMtd)}`);

    setElemText('drr-stat-inventory', stats.total_inventory ?? 0);
    setElemText('drr-stat-ooo', stats.ooo_today ?? stats.ooo_rooms ?? 0);
    setElemText('drr-stat-available', stats.net_available_today ?? stats.net_available ?? 0);
    setElemText('drr-stat-occupied', stats.occupied_today ?? stats.occupied_rooms ?? 0);

    const datePicker = document.getElementById('drr-date-picker');
    if (datePicker && datePicker.value) {
        setElemText('drr-period-label', `Periode: ${datePicker.value}`);
    }

    const revTbody = document.getElementById('drr-revenue-tbody');
    if (revTbody) {
        const roomToday = revenue.room_today ?? 0;
        const roomMtd = revenue.room_mtd ?? 0;
        const fnbToday = revenue.fnb_today ?? 0;
        const fnbMtd = revenue.fnb_mtd ?? 0;
        const otherToday = revenue.other_today ?? 0;
        const otherMtd = revenue.other_mtd ?? 0;

        revTbody.innerHTML = `
            <tr class="hover:bg-slate-50 border-b border-slate-100 text-sm">
                <td class="py-3 px-4 font-medium text-slate-800">Room Revenue</td>
                <td class="py-3 px-4 text-right font-semibold text-slate-700">${formatCurrency(roomToday)}</td>
                <td class="py-3 px-4 text-right font-semibold text-slate-700">${formatCurrency(roomMtd)}</td>
            </tr>
            <tr class="hover:bg-slate-50 border-b border-slate-100 text-sm">
                <td class="py-3 px-4 font-medium text-slate-800">Food & Beverage</td>
                <td class="py-3 px-4 text-right font-semibold text-slate-700">${formatCurrency(fnbToday)}</td>
                <td class="py-3 px-4 text-right font-semibold text-slate-700">${formatCurrency(fnbMtd)}</td>
            </tr>
            <tr class="hover:bg-slate-50 border-b border-slate-100 text-sm">
                <td class="py-3 px-4 font-medium text-slate-800">Other Revenue</td>
                <td class="py-3 px-4 text-right font-semibold text-slate-700">${formatCurrency(otherToday)}</td>
                <td class="py-3 px-4 text-right font-semibold text-slate-700">${formatCurrency(otherMtd)}</td>
            </tr>
            <tr class="bg-slate-100 font-bold border-t-2 border-slate-300 text-sm">
                <td class="py-3 px-4 text-slate-900 uppercase font-bold">Total Gross Revenue</td>
                <td class="py-3 px-4 text-right text-primary font-bold">${formatCurrency(totalToday)}</td>
                <td class="py-3 px-4 text-right text-primary font-bold">${formatCurrency(totalMtd)}</td>
            </tr>
        `;
    }

    const payTbody = document.getElementById('drr-payments-tbody');
    if (payTbody) {
        const paymentsToday = Array.isArray(data.payments_today) ? data.payments_today : [];
        const paymentsMtd = Array.isArray(data.payments_mtd) ? data.payments_mtd : [];

        const paymentMap = {};

        paymentsToday.forEach(p => {
            const method = p.payment_method || p.method || p.name || 'Other Method';
            if (!paymentMap[method]) paymentMap[method] = { today: 0, mtd: 0 };
            paymentMap[method].today += Number(p.amount ?? p.today_amount) || 0;
        });

        paymentsMtd.forEach(p => {
            const method = p.payment_method || p.method || p.name || 'Other Method';
            if (!paymentMap[method]) paymentMap[method] = { today: 0, mtd: 0 };
            paymentMap[method].mtd += Number(p.amount ?? p.mtd_amount) || 0;
        });

        const methods = Object.keys(paymentMap);

        if (methods.length === 0) {
            payTbody.innerHTML = `<tr><td colspan="3" class="py-4 text-center text-slate-400">Tidak ada data penerimaan pembayaran cashier.</td></tr>`;
        } else {
            let totalPayToday = 0;
            let totalPayMtd = 0;

            const html = methods.map(method => {
                const todayVal = paymentMap[method].today;
                const mtdVal = paymentMap[method].mtd;
                totalPayToday += todayVal;
                totalPayMtd += mtdVal;

                return `
                    <tr class="hover:bg-slate-50 border-b border-slate-100 text-sm">
                        <td class="py-3 px-4 font-medium text-slate-800">${method}</td>
                        <td class="py-3 px-4 text-right font-semibold text-emerald-600">${formatCurrency(todayVal)}</td>
                        <td class="py-3 px-4 text-right font-semibold text-emerald-600">${formatCurrency(mtdVal)}</td>
                    </tr>
                `;
            }).join('');

            const totalHtml = `
                <tr class="bg-slate-100 font-bold border-t-2 border-slate-300 text-sm">
                    <td class="py-3 px-4 text-slate-900 uppercase">Total Collections</td>
                    <td class="py-3 px-4 text-right text-emerald-700">${formatCurrency(totalPayToday)}</td>
                    <td class="py-3 px-4 text-right text-emerald-700">${formatCurrency(totalPayMtd)}</td>
                </tr>
            `;

            payTbody.innerHTML = html + totalHtml;
        }
    }
}

export function handleDRRDateChange(newDate) {
    fetchDailyRevenueReport(newDate);
}

export function handlePrintDRR() {
    window.print();
}

export async function loadDailyRevenueReport(dateStr) {
    return await fetchDailyRevenueReport(dateStr);
}
