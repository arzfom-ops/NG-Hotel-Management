import { supabaseClient } from '../config/supabase.js';
import { formatCurrency, formatRupiah } from '../utils/formatters.js';

/**
 * Fetch Daily Revenue Report from Supabase RPC rpc_get_daily_revenue_report
 * @param {string} [selectedDate] - Date string in YYYY-MM-DD format
 */
export async function fetchDailyRevenueReport(selectedDate) {
    const reportDateInput = document.getElementById('drr-date-picker');
    let targetDate = selectedDate;

    if (!targetDate || typeof targetDate !== 'string') {
        targetDate = reportDateInput ? reportDateInput.value : null;
    }

    if (!targetDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const year = yesterday.getFullYear();
        const month = String(yesterday.getMonth() + 1).padStart(2, '0');
        const day = String(yesterday.getDate()).padStart(2, '0');
        targetDate = `${year}-${month}-${day}`;
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
                alert(`Gagal memuat Daily Revenue Report: ${error.message || error}`);
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

/**
 * Render Daily Revenue Report data to the UI components
 * @param {object} data - RPC result object
 */
export function renderDailyRevenueReport(data) {
    if (!data) return;

    const stats = data.statistics || {};
    const kpi = data.kpi || data.kpi_summary || {};
    const revenue = data.revenue || data.revenue_breakdown || {};

    const setElemText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    // Update KPI Cards
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

    // Update Room Statistics
    setElemText('drr-stat-inventory', stats.total_inventory ?? 0);
    setElemText('drr-stat-ooo', stats.ooo_today ?? stats.ooo_rooms ?? 0);
    setElemText('drr-stat-available', stats.net_available_today ?? stats.net_available ?? 0);
    setElemText('drr-stat-occupied', stats.occupied_today ?? stats.occupied_rooms ?? 0);

    // Update Period Label
    const datePicker = document.getElementById('drr-date-picker');
    if (datePicker && datePicker.value) {
        setElemText('drr-period-label', `Periode: ${datePicker.value}`);
    }

    // Render Revenue Breakdown Table (#drr-revenue-tbody)
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

    // Render Cashier Collections Table (#drr-payments-tbody)
    const payTbody = document.getElementById('drr-payments-tbody');
    if (payTbody) {
        const paymentsToday = Array.isArray(data.payments_today) ? data.payments_today : [];
        const paymentsMtd = Array.isArray(data.payments_mtd) ? data.payments_mtd : [];

        const paymentMap = {}; // { methodName: { today: 0, mtd: 0 } }

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

/**
 * Event handler for date picker change
 * @param {string} newDate
 */
export function handleDRRDateChange(newDate) {
    fetchDailyRevenueReport(newDate);
}

/**
 * Event handler for print report button
 */
export function handlePrintDRR() {
    window.print();
}

/**
 * Helper alias for loading daily revenue report
 */
export async function loadDailyRevenueReport(dateStr) {
    return await fetchDailyRevenueReport(dateStr);
}
