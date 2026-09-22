import { supabaseClient } from '../config/supabase.js';
import { formatDateISO, formatStayDatesCompact, getStatusBadgeHTML } from '../utils/formatters.js';

// Global State for Frontdesk Dashboard
export var currentDashboardTab = 'arrival';
export var dashboardSelectedDate = typeof formatDateISO === 'function' && typeof window.todayDate !== 'undefined' ? formatDateISO(window.todayDate) : new Date().toISOString().split('T')[0];
export var dashboardRoomTypeFilter = '';
export let dashboardSearchQuery = '';
export let dashboardData = {
    arrival: [],
    inHouse: [],
    departure: []
};

export function handleDashDateChange(val) {
    if (!val) return;
    dashboardSelectedDate = val;
    fetchFrontdeskDashboard();
}

export function handleDashRoomTypeChange(val) {
    dashboardRoomTypeFilter = val;
    renderDashboardTable();
}

export function handleDashSearchInput(val) {
    dashboardSearchQuery = (val || '').toLowerCase().trim();
    renderDashboardTable();
}

export async function populateDashRoomTypeFilter() {
    try {
        const { data, error } = await supabaseClient.from('room_types').select('id, name').order('name', { ascending: true });
        if (error) throw error;
        const dropdown = document.getElementById('dash-room-type-filter');
        if (dropdown) {
            let html = `<option value="">Semua Tipe Kamar</option>`;
            if (data && data.length > 0) {
                html += data.map(rt => `<option value="${rt.id}">${rt.name}</option>`).join('');
            }
            dropdown.innerHTML = html;
            dropdown.value = dashboardRoomTypeFilter;
        }
    } catch (err) {
        console.error('Error populating dashboard room type filter:', err);
    }
}

export let currentGroupSubTab = 'active';

export function switchGroupSubTab(subTab) {
    currentGroupSubTab = subTab;
    const activeBtn = document.getElementById('group-subtab-active');
    const cancelBtn = document.getElementById('group-subtab-cancel');
    if (activeBtn && cancelBtn) {
        const activeClass = 'px-4 py-2 bg-white/90 text-primary shadow-md shadow-primary/10 border border-white/80 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer';
        const inactiveClass = 'px-4 py-2 bg-white/40 hover:bg-white/80 text-slate-600 hover:text-slate-900 border border-transparent hover:border-white/60 rounded-xl text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-95 flex items-center gap-2 cursor-pointer';
        if (subTab === 'active') {
            activeBtn.className = activeClass;
            cancelBtn.className = inactiveClass;
        } else {
            cancelBtn.className = activeClass;
            activeBtn.className = inactiveClass;
        }
    }
    renderDashboardTable();
}

export function switchDashboardTab(tabName) {
    currentDashboardTab = tabName;
    const subtabsWrapper = document.getElementById('group-subtabs-wrapper');
    if (subtabsWrapper) {
        if (tabName === 'group') {
            subtabsWrapper.classList.remove('hidden');
        } else {
            subtabsWrapper.classList.add('hidden');
        }
    }
    const tabs = [
        { id: 'arrival', btn: 'dash-tab-btn-arrival', count: 'dash-count-arrival' },
        { id: 'in-house', btn: 'dash-tab-btn-in-house', count: 'dash-count-in-house' },
        { id: 'departure', btn: 'dash-tab-btn-departure', count: 'dash-count-departure' },
        { id: 'group', btn: 'dash-tab-btn-group', count: 'dash-count-group' }
    ];

    tabs.forEach(t => {
        const btnEl = document.getElementById(t.btn);
        const countEl = document.getElementById(t.count);
        if (btnEl) {
            if (t.id === tabName) {
                btnEl.className = 'dash-tab-btn border-b-2 border-primary text-primary font-bold py-2.5 px-1 text-sm whitespace-nowrap transition-colors flex items-center gap-2';
                if (countEl) countEl.className = 'bg-blue-100 text-primary text-xs px-2 py-0.5 rounded-full font-bold';
            } else {
                btnEl.className = 'dash-tab-btn border-b-2 border-transparent text-slate-500 hover:text-slate-700 font-medium py-2.5 px-1 text-sm whitespace-nowrap transition-colors flex items-center gap-2';
                if (countEl) countEl.className = 'bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-bold';
            }
        }
    });

    renderDashboardTable();
}

export async function fetchFrontdeskDashboard() {
    const datePickerEl = document.getElementById('dash-date-picker');
    if (datePickerEl && !datePickerEl.value) {
        datePickerEl.value = dashboardSelectedDate;
    }

    try {
        const selectedDateISO = dashboardSelectedDate || formatDateISO(window.todayDate);

        // 1. Fetch Reservations
        const { data: resData, error: resErr } = await supabaseClient
            .from('reservations')
            .select(`
                id,
                reservation_number,
                booking_reference,
                booker_name,
                check_in_date,
                check_out_date,
                room_rate,
                status,
                room_id,
                room_type_id,
                qty,
                guest_type,
                guest_profiles (full_name),
                room_types (name),
                rooms (room_number)
            `)
            .neq('status', 'Cancelled')
            .neq('status', 'Checkout')
            .neq('status', 'CHECKED_OUT');

        if (resErr) throw resErr;

        const resList = resData || [];

        // Filter out Non-Staying Guests and PM/Paymaster rooms from operational dashboard
        const validResList = resList.filter(r => {
            const roomNo = r.rooms ? (Array.isArray(r.rooms) ? r.rooms[0]?.room_number : r.rooms.room_number) : null;
            const isPmRoom = roomNo && String(roomNo).toLowerCase().startsWith('pm-');
            const isNsg = r.guest_type === 'Non-Staying Guest';
            return !isNsg && !isPmRoom;
        });

        dashboardData.arrival = validResList.filter(r => r.check_in_date === selectedDateISO && (r.status === 'Reserved' || r.status === 'GUARANTEED' || r.status === '6PM_HOLD' || r.status === 'ORAL_CONFIRM' || r.status === 'TENTATIVE'));
        dashboardData.inHouse = validResList.filter(r => r.status === 'Checkin' || r.status === 'CHECKED_IN' || r.status === 'Checked In');
        dashboardData.departure = validResList.filter(r => r.check_out_date === selectedDateISO && (r.status === 'Checkin' || r.status === 'CHECKED_IN' || r.status === 'Checked In'));

        // 2. Fetch Group Bookings with Fallback Query
        let gbData = null;
        let gbErr = null;

        const resGb = await supabaseClient
            .from('group_bookings')
            .select(`
                id,
                group_name,
                contact_person,
                status,
                created_at,
                corporate_profiles (company_name),
                group_allotments (blocked_qty, agreed_rate, room_type_id, room_types (name))
            `)
            .order('created_at', { ascending: false });

        gbData = resGb.data;
        gbErr = resGb.error;

        if (gbErr) {
            console.warn('Error fetching group_bookings with status column, attempting fallback query:', gbErr);
            const fallbackGb = await supabaseClient
                .from('group_bookings')
                .select(`
                    id,
                    group_name,
                    contact_person,
                    created_at,
                    corporate_profiles (company_name),
                    group_allotments (blocked_qty, agreed_rate, room_type_id, room_types (name))
                `)
                .order('created_at', { ascending: false });

            if (fallbackGb.error) {
                console.error('Error fetching group_bookings fallback:', fallbackGb.error);
            } else {
                gbData = fallbackGb.data;
            }
        }

        const gbList = gbData || [];
        dashboardData.group = gbList.map(gb => {
            let status = gb.status;
            if (!status && gb.contact_person && typeof gb.contact_person === 'string' && gb.contact_person.startsWith('{')) {
                try {
                    const cpObj = JSON.parse(gb.contact_person);
                    if (cpObj && cpObj.status) {
                        status = cpObj.status;
                    }
                } catch (e) {}
            }
            status = status || 'Active';

            return {
                id: gb.id,
                group_name: gb.group_name,
                company_name: gb.corporate_profiles ? (Array.isArray(gb.corporate_profiles) ? gb.corporate_profiles[0]?.company_name : gb.corporate_profiles.company_name) : '-',
                contact_person: gb.contact_person,
                status: status,
                allotments: gb.group_allotments || []
            };
        });

        // Update counts in DOM
        const countArr = document.getElementById('dash-count-arrival');
        const countIn = document.getElementById('dash-count-in-house');
        const countDep = document.getElementById('dash-count-departure');
        const countGrp = document.getElementById('dash-count-group');

        if (countArr) countArr.textContent = dashboardData.arrival.length;
        if (countIn) countIn.textContent = dashboardData.inHouse.length;
        if (countDep) countDep.textContent = dashboardData.departure.length;

        // Group count: Active groups (status !== 'Cancelled')
        const activeGroupsCount = (dashboardData.group || []).filter(g => g.status !== 'Cancelled').length;
        if (countGrp) countGrp.textContent = activeGroupsCount;

        renderDashboardTable();

    } catch (err) {
        console.error('Error fetching Frontdesk Dashboard:', err);
    }
}

export function renderDashboardTable() {
    const tbody = document.getElementById('frontdesk-dashboard-tbody');
    if (!tbody) return;

    if (currentDashboardTab === 'group') {
        let allGroups = dashboardData.group || [];

        // Sub-tab filter: Active vs Cancel
        allGroups = allGroups.filter(g => {
            const isCancelled = g.status === 'Cancelled';
            return currentGroupSubTab === 'cancel' ? isCancelled : !isCancelled;
        });

        // Search Filter
        if (dashboardSearchQuery) {
            allGroups = allGroups.filter(g => {
                const name = (g.group_name || '').toLowerCase();
                const corp = (g.company_name || '').toLowerCase();
                return name.includes(dashboardSearchQuery) || corp.includes(dashboardSearchQuery);
            });
        }

        if (!allGroups || allGroups.length === 0) {
            const emptyMsg = currentGroupSubTab === 'cancel'
                ? 'Tidak ada data Group Booking yang dibatalkan.'
                : 'Tidak ada data Group Booking aktif.';
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="py-8 text-center text-slate-400">
                        <i class="ph ph-users-three text-2xl text-slate-300 inline-block mb-1"></i>
                        <div>${emptyMsg}</div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = allGroups.map(g => {
            const groupName = g.group_name || '-';
            const companyName = g.company_name || '-';

            let totalRooms = 0;
            let roomTypesArr = [];
            (g.allotments || []).forEach(a => {
                totalRooms += (a.blocked_qty || 0);
                const rtName = a.room_types ? (Array.isArray(a.room_types) ? a.room_types[0]?.name : a.room_types.name) : 'Room';
                roomTypesArr.push(`${rtName} (${a.blocked_qty || 0})`);
            });

            const roomTypeDisplay = roomTypesArr.length > 0 ? roomTypesArr.join(', ') : '-';

            const isCancelled = g.status === 'Cancelled';
            let statusBadge = getStatusBadgeHTML(isCancelled ? 'Cancelled' : 'VC');
            if (!isCancelled) {
                statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 backdrop-blur-md shadow-2xs"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>Active Group</span>`;
            } else {
                statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 border border-rose-500/30 backdrop-blur-md shadow-2xs"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>Cancelled Group</span>`;
            }

            let actionBtn = `
                <button onclick="openEditGroupBookingModal('${g.id}')" class="px-3 py-1.5 bg-white/60 hover:bg-white/90 backdrop-blur-md border border-white/80 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 active:scale-95 inline-flex items-center gap-1.5 cursor-pointer">
                    <i class="ph ph-pencil-simple text-sm"></i> Edit
                </button>
                <button onclick="handleCancelGroupBooking('${g.id}')" class="px-3 py-1.5 bg-rose-50/80 hover:bg-rose-100 backdrop-blur-md border border-rose-200/80 text-rose-700 rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 active:scale-95 inline-flex items-center gap-1.5 cursor-pointer">
                    <i class="ph ph-x-circle text-sm"></i> Cancel
                </button>
            `;

            if (isCancelled || currentGroupSubTab === 'cancel') {
                actionBtn = `<span class="text-xs text-slate-400 italic font-medium">Read Only</span>`;
            }

            return `
                <tr class="hover:bg-slate-50/80 transition-colors">
                    <td class="py-3 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">${g.id.slice(0, 8)}</td>
                    <td class="py-3 px-4 font-medium max-w-[150px] sm:max-w-[200px] truncate" title="${groupName.replace(/"/g, '&quot;')}">${groupName}</td>
                    <td class="py-3 px-4 text-slate-600 whitespace-nowrap">${companyName}</td>
                    <td class="py-3 px-4 text-slate-600 max-w-[120px] sm:max-w-[160px] truncate" title="${roomTypeDisplay.replace(/"/g, '&quot;')}">${roomTypeDisplay}</td>
                    <td class="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">${totalRooms} Kamar</td>
                    <td class="py-3 px-4 whitespace-nowrap">${statusBadge}</td>
                    <td class="py-3 px-4 text-right whitespace-nowrap">${actionBtn}</td>
                </tr>
            `;
        }).join('');
        return;
    }

    let rawList = [];
    if (currentDashboardTab === 'arrival') rawList = dashboardData.arrival;
    else if (currentDashboardTab === 'in-house') rawList = dashboardData.inHouse;
    else if (currentDashboardTab === 'departure') rawList = dashboardData.departure;

    // Apply Room Type Filter
    let filteredList = rawList;
    if (dashboardRoomTypeFilter) {
        filteredList = filteredList.filter(r => r.room_type_id === dashboardRoomTypeFilter);
    }

    // Apply Smart Search Filter (Res No, Booking Ref, Guest Name, Room No)
    if (dashboardSearchQuery) {
        filteredList = filteredList.filter(r => {
            const resNo = (r.reservation_number || r.id || '').toLowerCase();
            const bookingRef = (r.booking_reference || '').toLowerCase();
            const guestName = ((r.guest_profiles ? (Array.isArray(r.guest_profiles) ? r.guest_profiles[0]?.full_name : r.guest_profiles.full_name) : null) || r.booker_name || '').toLowerCase();
            const roomNo = (r.rooms ? (Array.isArray(r.rooms) ? r.rooms[0]?.room_number : r.rooms.room_number) : '') || '';
            const roomNoStr = String(roomNo).toLowerCase();

            return resNo.includes(dashboardSearchQuery) || bookingRef.includes(dashboardSearchQuery) || guestName.includes(dashboardSearchQuery) || roomNoStr.includes(dashboardSearchQuery);
        });
    }

    if (!filteredList || filteredList.length === 0) {
        let emptyMsg = 'Tidak ada daftar kedatangan.';
        if (currentDashboardTab === 'in-house') emptyMsg = 'Tidak ada tamu yang sedang menginap (In-House).';
        else if (currentDashboardTab === 'departure') emptyMsg = 'Tidak ada keberangkatan.';

        if (dashboardSearchQuery || dashboardRoomTypeFilter) {
            emptyMsg = 'Tidak ditemukan data yang sesuai dengan filter pencarian.';
        }

        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="py-8 text-center text-slate-400">
                    <i class="ph ph-check-circle text-2xl text-slate-300 inline-block mb-1"></i>
                    <div>${emptyMsg}</div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filteredList.map(r => {
        const resNo = r.reservation_number || r.id.slice(0, 8);
        const guestName = (r.guest_profiles ? (Array.isArray(r.guest_profiles) ? r.guest_profiles[0]?.full_name : r.guest_profiles.full_name) : null) || r.booker_name || '-';
        const stayDatesDisplay = formatStayDatesCompact(r.check_in_date, r.check_out_date);
        const roomTypeName = r.room_types ? (Array.isArray(r.room_types) ? r.room_types[0]?.name : r.room_types.name) : '-';
        const roomRateDisplay = r.room_rate !== null && r.room_rate !== undefined ? `Rp ${Number(r.room_rate).toLocaleString('id-ID')}` : 'Rp 0';

        const roomNo = r.rooms ? (Array.isArray(r.rooms) ? r.rooms[0]?.room_number : r.rooms.room_number) : null;
        const roomNoDisplay = roomNo
            ? `<span class="px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-800 border border-slate-200">Kamar ${roomNo}</span>`
            : `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Belum Dialokasikan</span>`;

        let mainActionHTML = '';
        if (currentDashboardTab === 'arrival') {
            if (!r.room_id) {
                mainActionHTML = `
                    <button onclick="openEditReservation('${r.id}')" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 active:scale-95 inline-flex items-center gap-1.5 cursor-pointer">
                        <i class="ph ph-bed text-sm"></i> Assign Room
                    </button>
                `;
            } else {
                mainActionHTML = `
                    <button onclick="handleDashboardCheckIn('${r.id}', '${r.room_id}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 active:scale-95 inline-flex items-center gap-1.5 cursor-pointer">
                        <i class="ph ph-check-circle text-sm"></i> Check-in
                    </button>
                `;
            }
        } else if (currentDashboardTab === 'in-house') {
            mainActionHTML = `
                <button onclick="openFolioModal('${r.id}')" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 active:scale-95 inline-flex items-center gap-1.5 cursor-pointer">
                    <i class="ph ph-receipt text-sm"></i> Folio
                </button>
            `;
        } else if (currentDashboardTab === 'departure') {
            mainActionHTML = `
                <button onclick="openFolioModal('${r.id}')" class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 active:scale-95 inline-flex items-center gap-1.5 cursor-pointer">
                    <i class="ph ph-sign-out text-sm"></i> Check-out
                </button>
            `;
        }

        const splitActionHTML = (r.qty && r.qty > 1) ? `
            <button onclick="openFitSplitReservationModal('${r.id}')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 active:scale-95 inline-flex items-center gap-1.5 cursor-pointer" title="Split Reservasi">
                <i class="ph ph-scissors text-sm"></i> Split Reservasi
            </button>
        ` : '';

        const editActionHTML = `
            <button onclick="openEditReservation('${r.id}')" class="px-3 py-1.5 bg-white/60 hover:bg-white/90 backdrop-blur-md border border-white/80 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 active:scale-95 inline-flex items-center gap-1.5 cursor-pointer" title="Edit Reservasi">
                <i class="ph ph-pencil-simple text-sm"></i> Edit
            </button>
        `;

        return `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="py-3 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">${resNo}</td>
                <td class="py-3 px-4 font-medium max-w-[150px] sm:max-w-[200px] truncate" title="${guestName.replace(/"/g, '&quot;')}">${guestName}</td>
                <td class="py-3 px-4 text-slate-600 whitespace-nowrap">${stayDatesDisplay}</td>
                <td class="py-3 px-4 text-slate-600 max-w-[120px] sm:max-w-[160px] truncate" title="${roomTypeName.replace(/"/g, '&quot;')}">${roomTypeName}</td>
                <td class="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">${roomRateDisplay}</td>
                <td class="py-3 px-4 whitespace-nowrap">${roomNoDisplay}</td>
                <td class="py-3 px-4 text-right whitespace-nowrap space-x-1.5">${mainActionHTML}${splitActionHTML}${editActionHTML}</td>
            </tr>
        `;
    }).join('');
}

export async function handleDashboardCheckIn(reservationId, roomId) {
    if (typeof window.handleCheckIn === 'function') {
        await window.handleCheckIn(reservationId, roomId);
    }
    await fetchFrontdeskDashboard();
}

export function initRealtimeSubscriptions() {
    supabaseClient
        .channel('realtime-rooms-changes')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'rooms'
        }, (payload) => {
            console.log('Realtime Room Update Received:', payload);
            // Update cache rooms lokal jika ada
            const updatedRoom = payload.new;
            const roomsCache = window.roomsCache || [];
            const idx = roomsCache.findIndex(r => r.id === updatedRoom.id);
            if (idx !== -1) {
                roomsCache[idx] = { ...roomsCache[idx], ...updatedRoom };
            }
            // Trigger Re-render instan di UI
            if (typeof renderTapeChart === 'function') renderTapeChart();
            if (typeof fetchHousekeepingRooms === 'function') fetchHousekeepingRooms();
        })
        .subscribe();
}

export { getHousekeepingBgColor } from './operations.js';

export function getSourceColorClass(source) {
    switch ((source || '').toLowerCase()) {
        case 'tiket.com':
            return 'bg-blue-600';
        case 'traveloka':
            return 'bg-sky-500';
        case 'agoda':
            return 'bg-red-500';
        case 'walk-in':
            return 'bg-slate-500';
        case 'direct':
            return 'bg-emerald-600';
        case 'phone':
            return 'bg-amber-600';
        case 'email':
            return 'bg-indigo-600';
        case 'online':
            return 'bg-purple-600';
        default:
            return 'bg-blue-500';
    }
}

// Global Drag-to-Select State
export let isDragging = false;
export let dragStartData = null; // { roomId, date }
export let dragEndData = null;   // { roomId, date }

export function setDragState(dragging, startData = null, endData = null) {
    isDragging = dragging;
    dragStartData = startData;
    dragEndData = endData;
}

export function updateDragHighlight() {
    clearDragHighlight();
    if (!isDragging || !dragStartData || !dragEndData) return;

    const roomId = dragStartData.roomId;
    const date1 = dragStartData.date;
    const date2 = dragEndData.date;

    const startDate = date1 < date2 ? date1 : date2;
    const endDate = date1 < date2 ? date2 : date1;

    const cells = document.querySelectorAll(`.calendar-cell[data-room-id="${roomId}"]`);
    cells.forEach(cell => {
        const cellDate = cell.dataset.date;
        if (cellDate >= startDate && cellDate <= endDate) {
            cell.classList.add('bg-blue-200/80', 'ring-2', 'ring-primary', 'ring-inset');
        }
    });
}

export function clearDragHighlight() {
    const cells = document.querySelectorAll('.calendar-cell');
    cells.forEach(cell => {
        cell.classList.remove('bg-blue-200/80', 'ring-2', 'ring-primary', 'ring-inset');
    });
}

export async function openCreateReservationModal(roomId, checkInDate, checkOutDate) {
    clearDragHighlight();
    if (typeof window.openModal === 'function') {
        await window.openModal();
    }

    if (checkInDate) {
        const checkInInput = document.getElementById('res-check-in');
        if (checkInInput) checkInInput.value = checkInDate;
    }

    if (checkOutDate) {
        const checkOutInput = document.getElementById('res-check-out');
        if (checkOutInput) checkOutInput.value = checkOutDate;
    }

    if (typeof window.handleStayDatesChange === 'function') {
        window.handleStayDatesChange('check-out');
    }

    if (roomId) {
        const roomsCache = window.roomsCache || [];
        const selectedRoom = roomsCache.find(r => r.id === roomId);
        if (selectedRoom) {
            const roomTypeSelect = document.getElementById('res-room-type');
            if (roomTypeSelect) {
                roomTypeSelect.value = selectedRoom.room_type_id || '';
                if (typeof window.handleRoomTypeChange === 'function') {
                    window.handleRoomTypeChange();
                }
            }
            const roomNumberSelect = document.getElementById('res-room-number');
            if (roomNumberSelect) {
                roomNumberSelect.value = roomId;
            }
        }
    }
}

// Global Tape Chart State
export var currentStartDate = typeof window.todayDate !== 'undefined' ? new Date(window.todayDate) : new Date();
export var selectedRoomTypeFilter = '';

export async function renderTapeChart() {
    const container = document.getElementById('tape-chart-wrapper');
    if (!container) return;

    try {
        // Fetch live rooms from Supabase
        const { data: dbRooms, error: roomsErr } = await supabaseClient
            .from('rooms')
            .select(`
                id,
                room_number,
                status,
                room_type_id,
                is_virtual,
                room_types (name)
            `);

        if (roomsErr) throw roomsErr;

        if (dbRooms) {
            // Sort rooms naturally by room_number
            dbRooms.sort((a, b) => (a.room_number || '').localeCompare(b.room_number || '', undefined, { numeric: true, sensitivity: 'base' }));
            window.roomsCache = dbRooms;
        }

        const roomsCache = window.roomsCache || [];

        if (!roomsCache || roomsCache.length === 0) {
            container.innerHTML = `<div class="p-6 text-center text-slate-400">Belum ada data kamar.</div>`;
            return;
        }

        const CELL_WIDTH = 80; // 80px per day
        const TOTAL_DAYS = 14;

        // Sync datepicker input with currentStartDate
        const datepickerInput = document.getElementById('calendar-jump-date');
        if (datepickerInput) {
            datepickerInput.value = formatDateISO(currentStartDate);
        }

        // Generate array of Date objects for 14 days
        const datesList = [];
        for (let i = 0; i < TOTAL_DAYS; i++) {
            datesList.push(addDays(currentStartDate, i));
        }

        const minDateStr = formatDateISO(datesList[0]);
        const maxDateStr = formatDateISO(datesList[TOTAL_DAYS - 1]);

        // Filter rooms by room type if selected & exclude PM / Paymaster / Virtual rooms
        let displayRooms = roomsCache.filter(r => !r.is_virtual && (!r.room_number || !r.room_number.toLowerCase().startsWith('pm-')));
        if (selectedRoomTypeFilter) {
            displayRooms = displayRooms.filter(r => r.room_type_id === selectedRoomTypeFilter);
        }

        // Fetch active reservations overlapping the 14 days range
        const { data: reservations, error: resErr } = await supabaseClient
            .from('reservations')
            .select(`
                id,
                room_id,
                check_in_date,
                check_out_date,
                status,
                booker_name,
                reservation_source,
                guest_profiles (full_name)
            `)
            .not('room_id', 'is', null)
            .neq('status', 'Cancelled')
            .neq('status', 'Checkout')
            .neq('status', 'CHECKED_OUT')
            .lt('check_in_date', addDaysISO(maxDateStr, 1))
            .gte('check_out_date', minDateStr);

        if (resErr) throw resErr;

        // Fetch room blocks overlapping the 14 days range
        const { data: roomBlocks, error: blockErr } = await supabaseClient
            .from('room_blocks')
            .select(`
                id,
                room_id,
                start_date,
                end_date,
                block_type,
                reason
            `)
            .lte('start_date', maxDateStr)
            .gte('end_date', minDateStr);

        if (blockErr) throw blockErr;

        // Build HTML Table structure
        let tableHTML = `
            <div class="overflow-x-auto relative w-full border border-slate-200 rounded-lg shadow-xs bg-white">
                <table class="w-full border-collapse text-left select-none" style="min-width: ${160 + (TOTAL_DAYS * CELL_WIDTH)}px;">
                    <thead>
                        <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                            <th class="sticky left-0 z-30 bg-slate-50 border-r border-slate-200 shadow-sm min-w-[160px] max-w-[160px] w-[160px] p-3">
                                Room
                            </th>
        `;

        // Render 14-day Header Columns
        datesList.forEach(d => {
            const dateISO = formatDateISO(d);
            const isToday = dateISO === formatDateISO(window.todayDate);

            const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' });
            const dayNum = d.getDate();
            const monthName = d.toLocaleDateString('id-ID', { month: 'short' });

            tableHTML += `
                <th class="p-2 border-r border-slate-200 text-center sticky top-0 z-10 ${isToday ? 'bg-blue-100/70 text-primary font-bold' : 'bg-slate-50'}" style="width: ${CELL_WIDTH}px; min-width: ${CELL_WIDTH}px; max-width: ${CELL_WIDTH}px;">
                    <div class="text-[10px] text-slate-400 font-normal">${dayName}</div>
                    <div class="text-sm font-bold leading-tight">${dayNum}</div>
                    <div class="text-[10px] text-slate-400 font-normal">${monthName}</div>
                </th>
            `;
        });

        tableHTML += `
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200 text-sm">
        `;

        function getStatusBadgeMarkup(status) {
            return getStatusBadgeHTML(status);
        }

        // Render Room Rows
        displayRooms.forEach(room => {
            const roomTypeName = room.room_types ? (Array.isArray(room.room_types) ? room.room_types[0]?.name : room.room_types.name) : '-';
            const statusBadge = getStatusBadgeMarkup(room.status);

            tableHTML += `
                <tr class="hover:bg-slate-50/50 transition-colors">
                    <td class="sticky left-0 z-20 bg-white border-r border-slate-200 shadow-sm min-w-[160px] max-w-[160px] p-3">
                        <div class="flex items-center justify-between gap-2">
                            <span class="font-bold text-slate-800">Kamar ${room.room_number}</span>
                            ${statusBadge}
                        </div>
                        <div class="text-xs text-slate-500 truncate mt-0.5" title="${roomTypeName.replace(/"/g, '&quot;')}">${roomTypeName}</div>
                    </td>
                    <td colspan="${TOTAL_DAYS}" class="p-0 relative align-middle">
                        <div class="flex w-full h-full min-h-[48px] relative">
            `;

            // 1. Grid Date Cells
            datesList.forEach(d => {
                const dateISO = formatDateISO(d);
                const isToday = dateISO === formatDateISO(window.todayDate);

                tableHTML += `
                    <div data-room-id="${room.id}"
                         data-date="${dateISO}"
                         class="calendar-cell cursor-pointer hover:bg-blue-50/50 border-r border-slate-200 h-12 flex-1 transition-colors ${isToday ? 'bg-blue-50/30' : ''}"
                         style="min-width: ${CELL_WIDTH}px; max-width: ${CELL_WIDTH}px;">
                    </div>
                `;
            });

            // 2. Render Floating Capsules for Reservations
            const currentReservations = reservations.filter(r => r.room_id === room.id);
            const gridStartDt = new Date(minDateStr + 'T00:00:00');
            const maxGridWidth = TOTAL_DAYS * CELL_WIDTH;

            currentReservations.forEach(res => {
                const startDt = new Date(res.check_in_date + 'T00:00:00');
                const endDt = new Date(res.check_out_date + 'T00:00:00');

                if (res.check_out_date > minDateStr && res.check_in_date <= maxDateStr) {
                    const startOffsetDays = (startDt - gridStartDt) / (1000 * 3600 * 24);
                    const durationDays = (endDt - startDt) / (1000 * 3600 * 24);

                    let leftPx = (startOffsetDays + 0.5) * CELL_WIDTH;
                    let widthPx = durationDays * CELL_WIDTH;

                    if (leftPx < 0) {
                        widthPx += leftPx;
                        leftPx = 0;
                    }

                    if (leftPx + widthPx > maxGridWidth) {
                        widthPx = maxGridWidth - leftPx;
                    }

                    if (widthPx > 0) {
                        const status = (res.status || 'Reserved').toLowerCase();
                        const source = res.reservation_source || 'Direct';
                        const displayName = (res.guest_profiles ? (Array.isArray(res.guest_profiles) ? res.guest_profiles[0]?.full_name : res.guest_profiles.full_name) : null) || res.booker_name || 'Guest';

                        let capsuleBgClass = 'bg-sky-200 text-sky-900 border-sky-300 hover:bg-sky-300'; // Reserved
                        if (status === 'checkin') {
                            capsuleBgClass = 'bg-emerald-200 text-emerald-900 border-emerald-300 hover:bg-emerald-300'; // Checkin
                        }

                        tableHTML += `
                            <div onclick="openEditReservation('${res.id}')"
                                 data-reservation-id="${res.id}"
                                 class="absolute top-1.5 bottom-1.5 ${capsuleBgClass} border rounded-md px-2 py-1 text-xs font-medium flex items-center shadow-xs overflow-hidden whitespace-nowrap cursor-pointer transition-all z-10"
                                 style="left: ${leftPx}px; width: ${widthPx}px;"
                                 title="${displayName.replace(/"/g, '&quot;')} (${source}) - ${res.check_in_date} s/d ${res.check_out_date} [Status: ${res.status || 'Reserved'}]">
                                <i class="ph ph-user text-xs mr-1 shrink-0 opacity-80"></i>
                                <span class="truncate">${displayName} (${source})</span>
                            </div>
                        `;
                    }
                }
            });

            // 3. Render Floating Capsules for Room Blocks (OOO / OOS)
            const currentRoomBlocks = roomBlocks.filter(b => b.room_id === room.id);
            currentRoomBlocks.forEach(block => {
                const startDate = block.start_date;

                // Calculate effective end date (if end_date <= start_date, default to +1 day)
                let endDate = block.end_date;
                if (!endDate || endDate <= startDate) {
                    const sDt = new Date(startDate + 'T00:00:00');
                    sDt.setDate(sDt.getDate() + 1);
                    endDate = formatDateISO(sDt);
                }

                if (endDate > minDateStr && startDate <= maxDateStr) {
                    const startDt = new Date(startDate + 'T00:00:00');
                    const endDt = new Date(endDate + 'T00:00:00');

                    const startOffsetDays = (startDt - gridStartDt) / (1000 * 3600 * 24);
                    const durationDays = Math.max(1, (endDt - startDt) / (1000 * 3600 * 24));

                    let leftPx = (startOffsetDays + 0.5) * CELL_WIDTH;
                    let widthPx = durationDays * CELL_WIDTH;

                    if (leftPx < 0) {
                        widthPx += leftPx;
                        leftPx = 0;
                    }

                    if (leftPx + widthPx > maxGridWidth) {
                        widthPx = maxGridWidth - leftPx;
                    }

                    if (widthPx > 0) {
                        const blockType = (block.block_type || '').toUpperCase();
                        const blockReason = block.reason || '';

                        let capsuleBgClass = 'bg-red-200 text-red-900 border-red-300';
                        if (blockType === 'OOS') {
                            capsuleBgClass = 'bg-slate-200 text-slate-800 border-slate-300';
                        }

                        tableHTML += `
                            <div class="absolute top-1.5 bottom-1.5 ${capsuleBgClass} border rounded-md px-2 py-1 text-xs font-semibold flex items-center justify-center shadow-xs overflow-hidden whitespace-nowrap z-10 pointer-events-auto"
                                 style="left: ${leftPx}px; width: ${widthPx}px;"
                                 title="${blockType}: ${blockReason.replace(/"/g, '&quot;')} (${startDate} s/d ${endDate})">
                                <span class="truncate">${blockType} - ${blockReason || 'Blocked'}</span>
                            </div>
                        `;
                    }
                }
            });

            tableHTML += `
                        </div>
                    </td>
                </tr>
            `;
        });

        tableHTML += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = tableHTML;
    } catch (err) {
        console.error('Error rendering tape chart:', err);
        container.innerHTML = `
            <div class="p-6 text-center text-red-500">
                <i class="ph ph-warning-circle text-2xl mb-1"></i>
                <div>Gagal memuat Tape Chart: ${err.message}</div>
            </div>
        `;
    }
}

// --- Smart Control Bar Handlers ---
export function handleTodayClick() {
    currentStartDate = new Date(window.todayDate);
    renderTapeChart();
}

export function handlePrev7Days() {
    currentStartDate = addDays(currentStartDate, -7);
    renderTapeChart();
}

export function handleNext7Days() {
    currentStartDate = addDays(currentStartDate, 7);
    renderTapeChart();
}

export function handleJumpToDate(dateStr) {
    if (!dateStr) return;
    const chosenDate = new Date(dateStr + 'T00:00:00');
    if (!isNaN(chosenDate.getTime())) {
        currentStartDate = chosenDate;
        renderTapeChart();
    }
}

export function handleRoomTypeFilterChange(val) {
    selectedRoomTypeFilter = val;
    renderTapeChart();
}

export async function handleQuickSearch(event) {
    if (event.key !== 'Enter') return;
    const query = (event.target.value || '').trim();
    if (!query) return;

    try {
        // 1. Query guest_profiles matching full_name
        const { data: matchedGuests, error: guestErr } = await supabaseClient
            .from('guest_profiles')
            .select('id')
            .ilike('full_name', `%${query}%`);
        if (guestErr) throw guestErr;

        const guestIds = (matchedGuests || []).map(g => g.id);

        // 2. Query reservations by reservation_number ILIKE or guest_profile_id IN matchedGuests
        let queryBuilder = supabaseClient
            .from('reservations')
            .select('id, check_in_date, reservation_number, room_type_id')
            .neq('status', 'Cancelled')
            .neq('status', 'Checkout')
            .neq('status', 'CHECKED_OUT');

        if (guestIds.length > 0) {
            queryBuilder = queryBuilder.or(`reservation_number.ilike.%${query}%,guest_profile_id.in.(${guestIds.join(',')})`);
        } else {
            queryBuilder = queryBuilder.ilike('reservation_number', `%${query}%`);
        }

        const { data: foundReservations, error: resErr } = await queryBuilder.limit(1);
        if (resErr) throw resErr;

        if (!foundReservations || foundReservations.length === 0) {
            alert('Reservation not found');
            return;
        }

        const targetRes = foundReservations[0];
        if (targetRes.check_in_date) {
            currentStartDate = new Date(targetRes.check_in_date + 'T00:00:00');
        }

        // If Room Type Filter is active and target reservation's room type doesn't match, clear filter
        if (selectedRoomTypeFilter && targetRes.room_type_id && targetRes.room_type_id !== selectedRoomTypeFilter) {
            selectedRoomTypeFilter = '';
            const filterDropdown = document.getElementById('calendar-room-type-filter');
            if (filterDropdown) filterDropdown.value = '';
        }

        await renderTapeChart();

        // Apply 3-second blink highlight animation to the matching reservation capsules
        const capsules = document.querySelectorAll(`[data-reservation-id="${targetRes.id}"]`);
        if (capsules.length > 0) {
            capsules.forEach(capsule => {
                capsule.classList.add('highlight-blink');
            });

            // Scroll the first capsule into view
            capsules[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

            setTimeout(() => {
                capsules.forEach(capsule => {
                    capsule.classList.remove('highlight-blink');
                });
            }, 3000);
        }

    } catch (err) {
        console.error('Error in Quick Search:', err);
        alert('Gagal melakukan pencarian: ' + err.message);
    }
}

export async function populateCalendarRoomTypeFilter() {
    try {
        const { data, error } = await supabaseClient.from('room_types').select('id, name').order('name', { ascending: true });
        if (error) throw error;
        const dropdown = document.getElementById('calendar-room-type-filter');
        if (dropdown) {
            let html = `<option value="">All Room Types</option>`;
            if (data && data.length > 0) {
                html += data.map(rt => `<option value="${rt.id}">${rt.name}</option>`).join('');
            }
            dropdown.innerHTML = html;
            dropdown.value = selectedRoomTypeFilter;
        }
    } catch (err) {
        console.error('Error populating calendar room type filter:', err);
    }
}

// --- Room Forecast JS Logic ---
export let forecastStartDate = new Date();

export function handleForecastDateChange(val) {
    if (!val) return;
    forecastStartDate = new Date(val);
    renderRoomForecast();
}

export async function renderRoomForecast() {
    const container = document.getElementById('forecast-table-container');
    const datepicker = document.getElementById('forecast-date-picker');

    if (!container) return;

    if (datepicker && !datepicker.value) {
        datepicker.value = formatDateISO(forecastStartDate);
    } else if (datepicker && datepicker.value) {
        forecastStartDate = new Date(datepicker.value);
    }

    try {
        // Generate 14 days list from forecastStartDate
        const datesList = [];
        for (let i = 0; i < 14; i++) {
            datesList.push(addDays(forecastStartDate, i));
        }

        const minDateStr = formatDateISO(datesList[0]);
        const maxDateStr = formatDateISO(datesList[13]);

        // 1. Fetch total physical rooms count from DB or roomsCache (exclude is_virtual = true & PM- rooms)
        let totalRoomsCount = 0;
        const roomsCache = window.roomsCache || [];
        if (roomsCache && roomsCache.length > 0) {
            const physicalRooms = roomsCache.filter(r => !r.is_virtual && (!r.room_number || !r.room_number.toLowerCase().startsWith('pm-')));
            totalRoomsCount = physicalRooms.length;
        } else {
            const { data: roomsData, error: roomsErr } = await supabaseClient
                .from('rooms')
                .select('id, room_number, status, is_virtual')
                .eq('is_virtual', false);
            if (roomsErr) throw roomsErr;
            const physicalRooms = (roomsData || []).filter(r => !r.room_number || !r.room_number.toLowerCase().startsWith('pm-'));
            totalRoomsCount = physicalRooms.length;
        }

        // 2. Fetch OOO / OOS room blocks overlapping 14 days
        const { data: roomBlocks, error: blocksErr } = await supabaseClient
            .from('room_blocks')
            .select('id, room_id, start_date, end_date, block_type')
            .lte('start_date', maxDateStr)
            .gte('end_date', minDateStr);
        if (blocksErr) console.error('Error fetching room_blocks for forecast:', blocksErr);

        // 3. Fetch active reservations overlapping 14 days excluding non-staying / virtual PM room reservations
        const { data: resData, error: resErr } = await supabaseClient
            .from('reservations')
            .select('id, check_in_date, check_out_date, qty, reservation_source, segment_id, status, guest_type, room_id, rooms (room_number, is_virtual)')
            .neq('status', 'Cancelled')
            .neq('status', 'Checkout')
            .neq('status', 'CHECKED_OUT')
            .lt('check_in_date', addDaysISO(maxDateStr, 1))
            .gte('check_out_date', minDateStr);
        if (resErr) throw resErr;

        const activeReservationsRaw = resData || [];
        const activeReservations = activeReservationsRaw.filter(r => {
            if (r.guest_type === 'Non-Staying Guest') return false;
            if (r.rooms) {
                const roomObj = Array.isArray(r.rooms) ? r.rooms[0] : r.rooms;
                if (roomObj) {
                    if (roomObj.is_virtual) return false;
                    if (roomObj.room_number && String(roomObj.room_number).toLowerCase().startsWith('pm-')) return false;
                }
            }
            // Explicitly ignore TENTATIVE from stock deduction
            const statusUpper = (r.status || '').toUpperCase();
            if (statusUpper === 'TENTATIVE') return false;

            return true;
        });

        // Daily metrics calculation for each of the 14 days
        const metrics = {
            roomTotal: [],
            ooo: [],
            available: [],
            occupied: [],
            sold: [],
            occupancyPct: []
        };

        const activeBlocks = roomBlocks || [];

        datesList.forEach(d => {
            const dateISO = formatDateISO(d);

            // Total Rooms
            const roomTotalVal = totalRoomsCount;

            // Out of Order: blocks active on dateISO (start_date <= dateISO <= end_date)
            const oooCount = activeBlocks.filter(b => {
                const s = b.start_date;
                const e = b.end_date;
                return dateISO >= s && dateISO <= e;
            }).length;

            // Room Occupied = reservations active on dateISO (check_in_date <= dateISO < check_out_date)
            let occupiedCount = 0;
            let complimentCount = 0;

            activeReservations.forEach(r => {
                if (r.check_in_date <= dateISO && dateISO < r.check_out_date) {
                    const qty = r.qty || 1;
                    occupiedCount += qty;

                    const sourceStr = (r.reservation_source || '').toLowerCase();
                    const segmentStr = (r.segment_id || '').toLowerCase();
                    if (sourceStr.includes('compliment') || sourceStr.includes('house use') || segmentStr.includes('compliment')) {
                        complimentCount += qty;
                    }
                }
            });

            // Room Available (Sisa Kamar untuk Dijual) = Room Total - Out of Order - Room Occupied
            const availableVal = Math.max(0, roomTotalVal - oooCount - occupiedCount);

            // Room Sold = Occupied - Compliment
            const soldVal = Math.max(0, occupiedCount - complimentCount);

            // % Occupancy = (Room Occupied / (Room Total - Out of Order)) * 100
            const totalMinusOoo = roomTotalVal - oooCount;
            let occPct = 0;
            if (totalMinusOoo > 0) {
                occPct = (occupiedCount / totalMinusOoo) * 100;
            }

            metrics.roomTotal.push(roomTotalVal);
            metrics.ooo.push(oooCount);
            metrics.available.push(availableVal);
            metrics.occupied.push(occupiedCount);
            metrics.sold.push(soldVal);
            metrics.occupancyPct.push(occPct);
        });

        // Build Matrix HTML Table
        let tableHTML = `
            <table class="w-full border-collapse bg-white text-left select-none text-sm">
                <thead>
                    <tr class="bg-slate-50 border-b border-slate-200">
                        <th class="sticky left-0 z-20 bg-slate-50 border-r border-slate-200 p-3 min-w-[180px] w-[180px] font-bold text-xs text-slate-500 uppercase tracking-wider">
                            Metric / Tanggal
                        </th>
        `;

        datesList.forEach((d, idx) => {
            const dayStr = d.toLocaleDateString('id-ID', { weekday: 'short' });
            const dateNumStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            const isToday = formatDateISO(d) === formatDateISO(window.todayDate);

            tableHTML += `
                <th class="p-2.5 text-center border-r border-slate-200 min-w-[85px] max-w-[85px] ${isToday ? 'bg-blue-50 font-bold text-primary' : 'text-slate-700'}">
                    <div class="text-[10px] uppercase tracking-wider text-slate-400">Hari ${idx + 1} (${dayStr})</div>
                    <div class="text-xs font-bold mt-0.5">${dateNumStr}</div>
                </th>
            `;
        });

        tableHTML += `
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 text-slate-700">
        `;

        // Row configurations
        const rowsConfig = [
            { label: 'Room Total', key: 'roomTotal', class: 'font-medium text-slate-700 bg-white' },
            { label: 'Out of Order', key: 'ooo', class: 'font-medium text-slate-600 bg-slate-50/50' },
            { label: 'Room Available', key: 'available', class: 'font-bold text-slate-800 bg-white' },
            { label: 'Room Occupied', key: 'occupied', class: 'font-medium text-blue-700 bg-slate-50/50' },
            { label: 'Room Sold', key: 'sold', class: 'font-medium text-slate-700 bg-white' },
            { label: '% Occupancy', key: 'occupancyPct', isPercentage: true, class: 'font-bold text-slate-900 bg-slate-50/70' }
        ];

        rowsConfig.forEach(row => {
            tableHTML += `
                <tr class="${row.class}">
                    <td class="sticky left-0 z-10 bg-inherit border-r border-slate-200 px-3 py-2.5 font-semibold text-xs text-slate-800">
                        ${row.label}
                    </td>
            `;

            metrics[row.key].forEach((val, idx) => {
                let cellBg = '';
                let displayVal = val;

                if (row.isPercentage) {
                    displayVal = val.toFixed(1) + '%';
                    if (val > 90) {
                        cellBg = 'bg-red-100 text-red-700 font-bold'; // High Occupancy Alert (>90%)
                    }
                }

                tableHTML += `
                    <td class="px-2 py-2.5 text-center border-r border-slate-200 ${cellBg}">
                        ${displayVal}
                    </td>
                `;
            });

            tableHTML += `</tr>`;
        });

        tableHTML += `
                </tbody>
            </table>
        `;

        container.innerHTML = tableHTML;

    } catch (err) {
        console.error('Error rendering Room Forecast:', err);
        container.innerHTML = `
            <div class="p-8 text-center text-red-500">
                <i class="ph ph-warning-circle text-2xl inline-block mb-2"></i>
                <div>Gagal memuat Room Forecast: ${err.message}</div>
            </div>
        `;
    }
}

// Helper function addDaysISO
export function addDaysISO(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return formatDateISO(d);
}
