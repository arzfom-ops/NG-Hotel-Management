import { supabaseClient } from '../config/supabase.js';
import { formatDateISO, showToast } from '../utils/formatters.js';

/**
 * Gets the current business date being audited.
 * Since night audit runs after midnight (e.g., early morning 2026-09-22),
 * the audit date corresponds to the stay night that just passed (e.g., 2026-09-21).
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function getCurrentBusinessDate() {
    const d = (typeof window !== 'undefined' && window.todayDate) ? new Date(window.todayDate) : new Date();
    // Audit date is the date before today if running post-midnight, or current business date
    const auditDate = new Date(d);
    auditDate.setDate(auditDate.getDate() - 1);
    return formatDateISO(auditDate);
}

/**
 * Executes the Night Audit by calling rpc_run_night_audit with the currentBusinessDate.
 * Pastikan semua pemostingan Room Charge selalu masuk ke Folio Pribadi (folio_id / reservation_id)
 * dengan default routing_type = 'NONE' (tidak otomatis masuk ke Master Folio).
 * Shows a Toast notification displaying the number of posted rooms (posted_count).
 * @param {string} [auditDateStr] - Optional audit date string in YYYY-MM-DD format
 * @returns {Promise<object>} Result object from RPC call
 */
export async function executeNightAudit(auditDateStr) {
    try {
        const currentBusinessDate = auditDateStr || getCurrentBusinessDate();

        const { data, error } = await supabaseClient.rpc('rpc_run_night_audit', {
            p_audit_date: currentBusinessDate
        });

        if (error) {
            console.error('Error executing Night Audit RPC:', error);
            showToast(`Gagal menjalankan Night Audit: ${error.message || error}`, 'error');
            return { success: false, error };
        }

        const postedCount = data?.posted_count ?? data?.posted_rooms ?? (typeof data === 'number' ? data : 0);
        const message = `Night Audit tanggal ${currentBusinessDate} berhasil dijalankan. Jumlah kamar diposting: ${postedCount}`;

        showToast(message, 'success');

        return {
            success: true,
            data,
            posted_count: postedCount,
            audit_date: currentBusinessDate
        };
    } catch (err) {
        console.error('Exception in executeNightAudit:', err);
        showToast(`Terjadi kesalahan Night Audit: ${err.message || err}`, 'error');
        return { success: false, error: err };
    }
}

/**
 * Alias / wrapper handler for UI trigger
 */
export async function handleNightAudit(auditDateStr) {
    return await executeNightAudit(auditDateStr);
}

/**
 * Alias / wrapper for runNightAudit
 */
export async function runNightAudit(auditDateStr) {
    return await executeNightAudit(auditDateStr);
}
