import { supabaseClient } from '../config/supabase.js';

/**
 * Formats a numeric value into IDR currency string (e.g., Rp 1.500.000)
 * @param {number|string} amount
 * @returns {string}
 */
function formatCurrency(amount) {
    const val = Number(amount) || 0;
    return `Rp ${val.toLocaleString('id-ID')}`;
}

/**
 * Formats a number to 2 decimal places or percentage string
 * @param {number|string} value
 * @returns {string}
 */
function formatPercent(value) {
    const val = Number(value) || 0;
    return `${val.toFixed(2)}%`;
}

/**
 * Calls Supabase RPC `rpc_get_daily_revenue_report` for a given report date.
 * @param {string} selectedDate - Date string in YYYY-MM-DD format
 * @returns {Promise<{data: object|null, error: object|null}>}
 */
export async function fetchDailyRevenueReport(selectedDate) {
    try {
        const { data, error } = await supabaseClient.rpc('rpc_get_daily_revenue_report', {
            p_report_date: selectedDate
        });

        if (error) {
            console.error('Error fetching Daily Revenue Report RPC:', error);
            return { data: null, error };
        }

        return { data, error: null };
    } catch (err) {
        console.error('Exception in fetchDailyRevenueReport:', err);
        return { data: null, error: err };
    }
}

/**
 * Fetches and renders Daily Revenue Report for a date string (or today's date if not provided).
 * @param {string} [dateStr] - YYYY-MM-DD format
 */
export async function loadDailyRevenueReport(dateStr) {
    const reportDateInput = document.getElementById('drr-date-picker');
    let selectedDate = dateStr;
    if (!selectedDate && reportDateInput) {
        selectedDate = reportDateInput.value;
    }
    if (!selectedDate) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        selectedDate = `${year}-${month}-${day}`;
    }

    if (reportDateInput) {
        reportDateInput.value = selectedDate;
    }

    const { data, error } = await fetchDailyRevenueReport(selectedDate);

    if (error) {
        alert(`Gagal memuat Daily Revenue Report: ${error.message || error}`);
        return;
    }

    renderDailyRevenueReport(data);
}

/**
 * Renders JSON report data into UI components (KPI cards, Revenue Breakdown table, Cashier Payment Collection table).
 * @param {object} reportData - The JSON object returned by rpc_get_daily_revenue_report
 */
export function renderDailyRevenueReport(reportData) {
    if (!reportData) {
        console.warn('renderDailyRevenueReport called with empty reportData');
        return;
    }

    // Extract sections safely
    const stats = reportData.statistics || {};
    const kpi = reportData.kpi_summary || reportData.kpi || {};
    const revenue = reportData.revenue_breakdown || reportData.revenue || {};

    // 1. KPI Summary Cards:
    // Occupancy Rate (%)
    const occToday = stats.occ_percent_today ?? kpi.occupancy_rate_today ?? kpi.occupancy_today ?? kpi.occ_today ?? 0;
    const occMtd = stats.occ_percent_mtd ?? kpi.occupancy_rate_mtd ?? kpi.occupancy_mtd ?? kpi.occ_mtd ?? 0;

    // ADR (Rp)
    const adrToday = kpi.adr_today ?? 0;
    const adrMtd = kpi.adr_mtd ?? 0;

    // RevPAR (Rp)
    const revParToday = kpi.revpar_today ?? kpi.rev_par_today ?? 0;
    const revParMtd = kpi.revpar_mtd ?? kpi.rev_par_mtd ?? 0;

    // Total Revenue (Rp)
    const totalRevToday = revenue.total_today ?? kpi.total_revenue_today ?? kpi.total_rev_today ?? 0;
    const totalRevMtd = revenue.total_mtd ?? kpi.total_revenue_mtd ?? kpi.total_rev_mtd ?? 0;

    // Helper to set element text content if element exists
    const setElemText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    setElemText('drr-kpi-occ-today', formatPercent(occToday));
    setElemText('drr-kpi-occ-mtd', formatPercent(occMtd));

    setElemText('drr-kpi-adr-today', formatCurrency(adrToday));
    setElemText('drr-kpi-adr-mtd', formatCurrency(adrMtd));

    setElemText('drr-kpi-revpar-today', formatCurrency(revParToday));
    setElemText('drr-kpi-revpar-mtd', formatCurrency(revParMtd));

    setElemText('drr-kpi-total-rev-today', formatCurrency(totalRevToday));
    setElemText('drr-kpi-total-rev-mtd', formatCurrency(totalRevMtd));

    // 2. Revenue Breakdown Table
    const revTbody = document.getElementById('drr-revenue-breakdown-tbody');
    if (revTbody) {
        let revRows = [];

        if (Array.isArray(revenue)) {
            revRows = revenue.map(row => ({
                category: row.category || row.category_name || row.name || 'Other Revenue',
                today_actual: Number(row.today_actual ?? row.today ?? row.actual_today) || 0,
                mtd_actual: Number(row.mtd_actual ?? row.mtd ?? row.actual_mtd) || 0
            }));
        } else if (typeof revenue === 'object' && revenue !== null) {
            // Check if revenue object contains room, fnb, other properties directly from RPC
            const roomToday = Number(revenue.room_today) || 0;
            const roomMtd = Number(revenue.room_mtd) || 0;

            const fnbToday = Number(revenue.fnb_today) || 0;
            const fnbMtd = Number(revenue.fnb_mtd) || 0;

            const otherToday = Number(revenue.other_today) || 0;
            const otherMtd = Number(revenue.other_mtd) || 0;

            revRows = [
                { category: 'Room Revenue', today_actual: roomToday, mtd_actual: roomMtd },
                { category: 'F&B Revenue', today_actual: fnbToday, mtd_actual: fnbMtd },
                { category: 'Other Revenue', today_actual: otherToday, mtd_actual: otherMtd }
            ];
        }

        if (revRows.length === 0) {
            revTbody.innerHTML = `<tr><td colspan="3" class="py-4 text-center text-slate-400">Tidak ada data breakdown pendapatan.</td></tr>`;
        } else {
            let totalToday = 0;
            let totalMtd = 0;

            const html = revRows.map(row => {
                totalToday += row.today_actual;
                totalMtd += row.mtd_actual;

                return `
                    <tr class="hover:bg-slate-50 border-b border-slate-100 text-sm">
                        <td class="py-3 px-4 font-medium text-slate-800">${row.category}</td>
                        <td class="py-3 px-4 text-right font-semibold text-slate-700">${formatCurrency(row.today_actual)}</td>
                        <td class="py-3 px-4 text-right font-semibold text-slate-700">${formatCurrency(row.mtd_actual)}</td>
                    </tr>
                `;
            }).join('');

            // Append Total Row
            const totalHtml = `
                <tr class="bg-slate-100 font-bold border-t-2 border-slate-300 text-sm">
                    <td class="py-3 px-4 text-slate-900 uppercase">Total Revenue</td>
                    <td class="py-3 px-4 text-right text-primary">${formatCurrency(totalToday)}</td>
                    <td class="py-3 px-4 text-right text-primary">${formatCurrency(totalMtd)}</td>
                </tr>
            `;

            revTbody.innerHTML = html + totalHtml;
        }
    }

    // 3. Cashier Payment Collection Table
    const payTbody = document.getElementById('drr-cashier-payment-tbody');
    if (payTbody) {
        let paymentMap = {};

        const paymentsToday = reportData.payments_today || [];
        const paymentsMtd = reportData.payments_mtd || [];
        const cashierPayments = reportData.cashier_payments || reportData.payments || reportData.payment_collection || [];

        if (Array.isArray(cashierPayments) && cashierPayments.length > 0 && paymentsToday.length === 0 && paymentsMtd.length === 0) {
            cashierPayments.forEach(row => {
                const method = row.method || row.payment_method || row.name || 'Other Method';
                paymentMap[method] = {
                    today_actual: Number(row.today_actual ?? row.today ?? row.actual_today) || 0,
                    mtd_actual: Number(row.mtd_actual ?? row.mtd ?? row.actual_mtd) || 0
                };
            });
        } else {
            // Process payments_today
            if (Array.isArray(paymentsToday)) {
                paymentsToday.forEach(p => {
                    const method = p.payment_method || p.method || 'Other Method';
                    if (!paymentMap[method]) paymentMap[method] = { today_actual: 0, mtd_actual: 0 };
                    paymentMap[method].today_actual += Number(p.amount) || 0;
                });
            }

            // Process payments_mtd
            if (Array.isArray(paymentsMtd)) {
                paymentsMtd.forEach(p => {
                    const method = p.payment_method || p.method || 'Other Method';
                    if (!paymentMap[method]) paymentMap[method] = { today_actual: 0, mtd_actual: 0 };
                    paymentMap[method].mtd_actual += Number(p.amount) || 0;
                });
            }
        }

        const methods = Object.keys(paymentMap);

        if (methods.length === 0) {
            payTbody.innerHTML = `<tr><td colspan="3" class="py-4 text-center text-slate-400">Tidak ada data penerimaan pembayaran cashier.</td></tr>`;
        } else {
            let totalPayToday = 0;
            let totalPayMtd = 0;

            const html = methods.map(method => {
                const todayVal = paymentMap[method].today_actual;
                const mtdVal = paymentMap[method].mtd_actual;

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
                    <td class="py-3 px-4 text-slate-900 uppercase">Total Payment Collection</td>
                    <td class="py-3 px-4 text-right text-emerald-700">${formatCurrency(totalPayToday)}</td>
                    <td class="py-3 px-4 text-right text-emerald-700">${formatCurrency(totalPayMtd)}</td>
                </tr>
            `;

            payTbody.innerHTML = html + totalHtml;
        }
    }
}
