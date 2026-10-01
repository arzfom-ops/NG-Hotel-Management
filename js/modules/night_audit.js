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
        const arrCard = document.getElementById('card-pending-arrivals');
        const depCard = document.getElementById('card-pending-departures');
        const arrLink = document.getElementById('link-pending-arrivals');
        const depLink = document.getElementById('link-pending-departures');
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
        const pendingArrivals = Number(data?.pending_arrivals) || 0;
        const pendingDepartures = Number(data?.pending_departures) || 0;
        const isRunning = Boolean(data?.is_audit_running);
        const canProceed = Boolean(data?.can_proceed) && pendingArrivals === 0 && pendingDepartures === 0 && !isRunning;

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

        // Render Status Banner & Action Button State
        if (pendingArrivals > 0 || pendingDepartures > 0 || isRunning) {
            if (banner) banner.className = "p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 mb-6 text-sm flex items-start gap-3";
            if (bannerMsg) {
                bannerMsg.textContent = "Night Audit diblokir. Harap selesaikan seluruh proses Check-In dan Check-Out gantung terlebih dahulu.";
            }
            if (runBtn) {
                runBtn.disabled = true;
                runBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        } else {
            if (banner) banner.className = "p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 mb-6 text-sm flex items-start gap-3";
            if (bannerMsg) {
                bannerMsg.textContent = "Seluruh prasyarat terpenuhi. Sistem siap untuk menjalankan proses Night Audit dan penutupan tanggal bisnis.";
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
 * EOD Flash Report Modal Management
 */
export function openEodReportModal(reportData) {
    if (!reportData) return;

    currentEodReportData = reportData;

    const businessDate = reportData.previous_business_date || reportData.business_date || currentPreAuditCheck?.current_hotel_date || '-';
    const executedAt = reportData.executed_at ? formatDateTimeDisplay(reportData.executed_at) : formatDateTimeDisplay(new Date().toISOString());
    const executedBy = reportData.executed_by || reportData.p_user_name || (window.currentUser?.name || 'System Admin');
    const roomsOccupied = reportData.total_occupied ?? reportData.total_rooms_occupied ?? 0;
    const roomRevenue = reportData.total_revenue ?? reportData.total_room_revenue ?? 0;
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

    const modal = document.getElementById('modal-eod-report');
    if (modal) modal.classList.remove('hidden');
}

export function closeEodReportModal() {
    const modal = document.getElementById('modal-eod-report');
    if (modal) modal.classList.add('hidden');
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
    const roomsOccupied = report.total_occupied ?? report.total_rooms_occupied ?? 0;
    const roomRevenue = report.total_revenue ?? report.total_room_revenue ?? 0;
    const taxService = report.total_tax_service ?? 0;

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
                const occ = item.total_rooms_occupied ?? 0;
                const rev = formatCurrency(item.total_room_revenue ?? 0);

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
        total_occupied: item.total_rooms_occupied,
        total_revenue: item.total_room_revenue,
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
