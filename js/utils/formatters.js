export function formatDateISO(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function formatStayDatesCompact(checkInStr, checkOutStr) {
    if (!checkInStr || !checkOutStr) return '-';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    const parts1 = String(checkInStr).split('-').map(Number);
    const parts2 = String(checkOutStr).split('-').map(Number);
    if (parts1.length < 3 || parts2.length < 3) return '-';

    const [y1, m1, d1] = parts1;
    const [y2, m2, d2] = parts2;

    const monthStr1 = months[m1 - 1] || '';
    const monthStr2 = months[m2 - 1] || '';

    if (y1 === y2) {
        return `${d1} ${monthStr1} - ${d2} ${monthStr2} ${y2}`;
    } else {
        return `${d1} ${monthStr1} ${y1} - ${d2} ${monthStr2} ${y2}`;
    }
}

export function addDays(dateObj, days) {
    const res = new Date(dateObj);
    res.setDate(res.getDate() + days);
    return res;
}

export function formatCurrency(amount) {
    const val = Number(amount) || 0;
    return `Rp ${val.toLocaleString('id-ID')}`;
}

export function formatRupiah(amount) {
    return formatCurrency(amount);
}

export function getStatusBadgeHTML(status) {
    const raw = (status || '').trim();
    const upper = raw.toUpperCase();

    if (upper === 'VC' || upper === 'CLEAN' || upper === 'VACANT CLEAN') {
        return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 backdrop-blur-md shadow-2xs"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>${raw || 'VC'}</span>`;
    }
    if (upper === 'VD' || upper === 'DIRTY' || upper === 'VACANT DIRTY') {
        return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 border border-amber-500/30 backdrop-blur-md shadow-2xs"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>${raw || 'VD'}</span>`;
    }
    if (upper === 'OCC' || upper === 'OC' || upper === 'OD' || upper === 'OCCUPIED' || upper === 'OCCUPIED CLEAN' || upper === 'OCCUPIED DIRTY' || upper === 'CHECKIN' || upper === 'CHECKED IN') {
        return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-700 border border-blue-500/30 backdrop-blur-md shadow-2xs"><span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>${raw || 'OCC'}</span>`;
    }
    if (upper === 'OOO' || upper === 'OUT OF ORDER' || upper === 'OOS' || upper === 'OUT OF SERVICE' || upper === 'CANCELLED' || upper === 'CANCEL') {
        return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 border border-rose-500/30 backdrop-blur-md shadow-2xs"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>${raw || 'OOO'}</span>`;
    }
    if (upper === 'RESERVED' || upper === 'CONFIRMED' || upper === 'RESERVATION') {
        return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-700 border border-purple-500/30 backdrop-blur-md shadow-2xs"><span class="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>${raw || 'Reserved'}</span>`;
    }
    return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-500/15 text-slate-700 border border-slate-500/30 backdrop-blur-md shadow-2xs"><span class="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse"></span>${raw}</span>`;
}

export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.log(`[Toast ${type}]: ${message}`);
        return;
    }

    const toast = document.createElement('div');
    const isError = type === 'error' || type === 'danger';
    const iconClass = isError ? 'ph ph-x-circle text-rose-500 text-xl' : 'ph ph-check-circle text-emerald-500 text-xl';

    toast.className = 'pointer-events-auto bg-white/80 backdrop-blur-xl border border-white/90 shadow-2xl shadow-slate-900/15 rounded-2xl p-4 flex items-center gap-3 text-sm font-semibold transition-all duration-300 animate-bounce-once';
    toast.innerHTML = `
        <i class="${iconClass}"></i>
        <span class="text-slate-800">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Expose globally for legacy non-module inline scripts in index.html
if (typeof window !== 'undefined') {
    window.formatDateISO = formatDateISO;
    window.formatStayDatesCompact = formatStayDatesCompact;
    window.addDays = addDays;
    window.formatCurrency = formatCurrency;
    window.formatRupiah = formatRupiah;
    window.getStatusBadgeHTML = getStatusBadgeHTML;
    window.showToast = showToast;
}
