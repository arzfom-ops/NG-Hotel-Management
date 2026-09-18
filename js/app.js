import { supabaseClient } from './config/supabase.js';
import { formatDateISO, formatStayDatesCompact, addDays } from './utils/formatters.js';
import {
    currentDashboardTab,
    dashboardSelectedDate,
    dashboardRoomTypeFilter,
    dashboardSearchQuery,
    dashboardData,
    handleDashDateChange,
    handleDashRoomTypeChange,
    handleDashSearchInput,
    populateDashRoomTypeFilter,
    currentGroupSubTab,
    switchGroupSubTab,
    switchDashboardTab,
    fetchFrontdeskDashboard,
    renderDashboardTable,
    handleDashboardCheckIn,
    getHousekeepingBgColor,
    getSourceColorClass,
    isDragging,
    dragStartData,
    dragEndData,
    setDragState,
    updateDragHighlight,
    clearDragHighlight,
    openCreateReservationModal,
    currentStartDate,
    selectedRoomTypeFilter,
    renderTapeChart,
    handleTodayClick,
    handlePrev7Days,
    handleNext7Days,
    handleJumpToDate,
    handleRoomTypeFilterChange,
    handleQuickSearch,
    populateCalendarRoomTypeFilter,
    forecastStartDate,
    handleForecastDateChange,
    renderRoomForecast,
    addDaysISO
} from './modules/frontdesk.js';

import {
    populateReservationFormDropdowns,
    openModal,
    openViewReservationModal,
    openReactivateReservationModal,
    switchReservationTab,
    handleGuestSearchInput,
    selectGuestProfile,
    clearSelectedGuest,
    handleStayDatesChange,
    renderDailyBreakdownGrid,
    applyFirstRowToAllDailyRates,
    syncMasterRateToGrid,
    syncMasterMealPlanToGrid,
    updateTotalPreview,
    lookupAndSetRoomRate,
    handleRoomTypeChange,
    handleRateCodeChange,
    handleGuestTypeChange,
    mealPlansCache,
    roomTypesCache,
    ratePlansCache,
    isReactivateMode
} from './modules/reservation.js';

import {
    openGroupBookingModal,
    openEditGroupBookingModal,
    populateGroupCorporateDropdown,
    closeGroupBookingModal,
    addGroupAllotmentRow,
    handleGroupRoomTypeChange,
    removeGroupAllotmentRow,
    handleSaveGroupBooking,
    handleCancelGroupBooking,
    closeGroupDepositErrorModal,
    openSplitReservationModal,
    openFitSplitReservationModal,
    closeRoomingListModal,
    handleSaveRoomingList,
    activeGroupSplitData,
    activeFitSplitData,
    editingGroupId
} from './modules/group.js';

// Global Variables
export const todayDate = new Date();
todayDate.setHours(0, 0, 0, 0);

export let initializedAppDate = new Date().toDateString();

// Attach global variables and module functions to window for inline scripts
if (typeof window !== 'undefined') {
    window.todayDate = todayDate;
    window.initializedAppDate = initializedAppDate;

    // Frontdesk State & Handlers
    window.currentDashboardTab = currentDashboardTab;
    window.dashboardSelectedDate = dashboardSelectedDate;
    window.dashboardRoomTypeFilter = dashboardRoomTypeFilter;
    window.dashboardSearchQuery = dashboardSearchQuery;
    window.dashboardData = dashboardData;
    window.handleDashDateChange = handleDashDateChange;
    window.handleDashRoomTypeChange = handleDashRoomTypeChange;
    window.handleDashSearchInput = handleDashSearchInput;
    window.populateDashRoomTypeFilter = populateDashRoomTypeFilter;
    window.currentGroupSubTab = currentGroupSubTab;
    window.switchGroupSubTab = switchGroupSubTab;
    window.switchDashboardTab = switchDashboardTab;
    window.fetchFrontdeskDashboard = fetchFrontdeskDashboard;
    window.renderDashboardTable = renderDashboardTable;
    window.handleDashboardCheckIn = handleDashboardCheckIn;
    window.getHousekeepingBgColor = getHousekeepingBgColor;
    window.getSourceColorClass = getSourceColorClass;

    // Tape Chart Controls & Drag-to-Select
    window.isDragging = isDragging;
    window.dragStartData = dragStartData;
    window.dragEndData = dragEndData;
    window.setDragState = setDragState;
    window.updateDragHighlight = updateDragHighlight;
    window.clearDragHighlight = clearDragHighlight;
    window.openCreateReservationModal = openCreateReservationModal;
    window.currentStartDate = currentStartDate;
    window.selectedRoomTypeFilter = selectedRoomTypeFilter;
    window.renderTapeChart = renderTapeChart;
    window.handleTodayClick = handleTodayClick;
    window.handlePrev7Days = handlePrev7Days;
    window.handleNext7Days = handleNext7Days;
    window.handleJumpToDate = handleJumpToDate;
    window.handleRoomTypeFilterChange = handleRoomTypeFilterChange;
    window.handleQuickSearch = handleQuickSearch;
    window.populateCalendarRoomTypeFilter = populateCalendarRoomTypeFilter;

    // Room Forecast
    window.forecastStartDate = forecastStartDate;
    window.handleForecastDateChange = handleForecastDateChange;
    window.renderRoomForecast = renderRoomForecast;
    window.addDaysISO = addDaysISO;

    // Reservation Module
    window.populateReservationFormDropdowns = populateReservationFormDropdowns;
    window.openModal = openModal;
    window.openViewReservationModal = openViewReservationModal;
    window.openReactivateReservationModal = openReactivateReservationModal;
    window.handleSaveReservation = typeof handleSaveReservation !== 'undefined' ? handleSaveReservation : window.handleSaveReservation;
    window.handleGuestSearchInput = handleGuestSearchInput;
    window.selectGuestProfile = selectGuestProfile;
    window.clearSelectedGuest = clearSelectedGuest;
    window.handleStayDatesChange = handleStayDatesChange;
    window.renderDailyBreakdownGrid = renderDailyBreakdownGrid;
    window.applyFirstRowToAllDailyRates = applyFirstRowToAllDailyRates;
    window.syncMasterRateToGrid = syncMasterRateToGrid;
    window.syncMasterMealPlanToGrid = syncMasterMealPlanToGrid;
    window.updateTotalPreview = updateTotalPreview;
    window.lookupAndSetRoomRate = lookupAndSetRoomRate;
    window.handleRoomTypeChange = handleRoomTypeChange;
    window.handleRateCodeChange = handleRateCodeChange;
    window.handleGuestTypeChange = handleGuestTypeChange;
    window.switchReservationTab = switchReservationTab;
    window.openWebcamModal = typeof openWebcamModal !== 'undefined' ? openWebcamModal : window.openWebcamModal;
    window.closeWebcamModal = typeof closeWebcamModal !== 'undefined' ? closeWebcamModal : window.closeWebcamModal;
    window.captureWebcamPhoto = typeof captureWebcamPhoto !== 'undefined' ? captureWebcamPhoto : window.captureWebcamPhoto;
    window.handleDocUpload = typeof handleDocUpload !== 'undefined' ? handleDocUpload : window.handleDocUpload;
    window.mealPlansCache = mealPlansCache;
    window.roomTypesCache = roomTypesCache;
    window.ratePlansCache = ratePlansCache;
    window.isReactivateMode = isReactivateMode;

    // Group Module
    window.openGroupBookingModal = openGroupBookingModal;
    window.openEditGroupBookingModal = openEditGroupBookingModal;
    window.populateGroupCorporateDropdown = populateGroupCorporateDropdown;
    window.closeGroupBookingModal = closeGroupBookingModal;
    window.addGroupAllotmentRow = addGroupAllotmentRow;
    window.handleGroupRoomTypeChange = handleGroupRoomTypeChange;
    window.removeGroupAllotmentRow = removeGroupAllotmentRow;
    window.handleSaveGroupBooking = handleSaveGroupBooking;
    window.handleCancelGroupBooking = handleCancelGroupBooking;
    window.closeGroupDepositErrorModal = closeGroupDepositErrorModal;
    window.openSplitReservationModal = openSplitReservationModal;
    window.openFitSplitReservationModal = openFitSplitReservationModal;
    window.closeRoomingListModal = closeRoomingListModal;
    window.handleSaveRoomingList = handleSaveRoomingList;
    window.activeGroupSplitData = activeGroupSplitData;
    window.activeFitSplitData = activeFitSplitData;
    window.editingGroupId = editingGroupId;
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
