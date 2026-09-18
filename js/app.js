import { supabaseClient } from './config/supabase.js';
import { formatDateISO, formatStayDatesCompact, addDays } from './utils/formatters.js';

// Global Variables
export const todayDate = new Date();
todayDate.setHours(0, 0, 0, 0);

export let initializedAppDate = new Date().toDateString();

// Attach global variables to window for inline scripts
if (typeof window !== 'undefined') {
    window.todayDate = todayDate;
    window.initializedAppDate = initializedAppDate;
}

// Day Change Detector (Night Audit Sync)
setInterval(() => {
    let currentCheckDate = new Date().toDateString();
    if (currentCheckDate !== initializedAppDate) {
        alert("Sistem mendeteksi pergantian hari (Night Audit). Memuat ulang sinkronisasi data...");
        window.location.reload();
    }
}, 60000);

// App Initialization Function
export async function initApp() {
    const statusDiv = document.getElementById('supabase-status');
    const propNameSpan = document.getElementById('active-property-name');

    try {
        // Cek koneksi & ambil nama hotel
        const { data, error } = await supabaseClient.from('properties').select('name').limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
            if (statusDiv) {
                statusDiv.innerHTML = `<span class="text-green-600 font-semibold"><i class="ph ph-check-circle"></i> Berhasil terhubung.</span>`;
                statusDiv.className = "p-4 rounded-md bg-green-50 border border-green-200 text-sm mb-6 hidden";
            }
            if (propNameSpan) {
                propNameSpan.textContent = data[0].name;
            }
        }

        // Populate Room Type Filter
        if (typeof window.populateCalendarRoomTypeFilter === 'function') {
            window.populateCalendarRoomTypeFilter();
        }
        if (typeof window.populateDashRoomTypeFilter === 'function') {
            window.populateDashRoomTypeFilter();
        }

        // Langkah 3: Trigger Eksekusi Tape Chart & Dashboard
        if (typeof window.fetchFrontdeskDashboard === 'function') {
            window.fetchFrontdeskDashboard();
        }
        if (typeof window.renderTapeChart === 'function') {
            window.renderTapeChart();
        }

        // Fetch data master Bed Types, Room Categories, Rooms & Tax/Service
        if (typeof window.fetchBedTypes === 'function') window.fetchBedTypes();
        if (typeof window.fetchRoomTypes === 'function') window.fetchRoomTypes();
        if (typeof window.fetchRooms === 'function') window.fetchRooms();
        if (typeof window.fetchTaxService === 'function') window.fetchTaxService();

    } catch (err) {
        console.error('Inisialisasi gagal:', err);
        if (statusDiv) {
            statusDiv.innerHTML = `<span class="text-red-600 font-semibold"><i class="ph ph-warning-circle"></i> Gagal terhubung ke Supabase: ${err.message}</span>`;
            statusDiv.className = "p-4 rounded-md bg-red-50 border border-red-200 text-sm mb-6";
        }
    }
}

if (typeof window !== 'undefined') {
    window.initApp = initApp;
}

// Execute initApp on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
