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

// Expose globally for legacy non-module inline scripts in index.html
if (typeof window !== 'undefined') {
    window.formatDateISO = formatDateISO;
    window.formatStayDatesCompact = formatStayDatesCompact;
    window.addDays = addDays;
    window.formatCurrency = formatCurrency;
    window.formatRupiah = formatRupiah;
}
