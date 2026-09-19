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
    addDaysISO,
    initRealtimeSubscriptions
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
    isReactivateMode,
    webcamStream,
    pendingNewReservationDeposits,
    openWebcamModal,
    closeWebcamModal,
    captureWebcamPhoto,
    handleDocUpload,
    clearDocPreview,
    getCompressedDocBlob,
    openEditReservation,
    toggleAddDepositForm,
    fetchAndRenderReservationDepositHistory,
    renderReservationDepositHistory,
    handleAddDepositSubmit,
    closeModal,
    handleCheckInReservation,
    handleCheckIn,
    handlePrintRegistrationCard,
    handleSaveReservation
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

import {
    currentFolioReservation,
    currentFolioTransactions,
    calculatedCurrentBalance,
    currentMasterGroup,
    currentMasterTransactions,
    transferTargetReservationsCache,
    folioRoutingAvailableArticles,
    folioRoutingRulesState,
    openFolioModal,
    closeFolioModal,
    checkAndUpdateMasterFolioHeader,
    handleCreateMasterFolio,
    handleOpenFolioFromEdit,
    fetchFolioTransactions,
    renderFolioTransactions,
    openMasterFolioModal,
    closeMasterFolioModal,
    fetchMasterFolioTransactions,
    renderMasterFolioTransactions,
    handleMoveBackToPersonalFolio,
    handleVoidMasterTransaction,
    openAddChargeModal,
    openAddPaymentModal,
    openMasterAddChargeModal,
    openMasterAddPaymentModal,
    closeFolioTransactionModal,
    handleChargeItemChange,
    handleFolioPaymentMethodChange,
    calculateFolioTotal,
    handleSaveFolioTransaction,
    handleVoidTransaction,
    updateTransferButtonsState,
    toggleSelectAllFolioTx,
    onFolioTxCheckboxChange,
    openTransferBillModal,
    renderTransferTargetOptions,
    filterTransferTargets,
    closeTransferBillModal,
    executeTransferBill,
    handleMoveToMasterFolio,
    populateFolioRoutingDualList,
    renderRoutingDualList,
    moveSelectedRouting,
    handleSaveFolioRouting,
    handleProcessCheckout,
    handleCheckOut,
    handlePrintFolio,
    handlePrintMasterFolio
} from './modules/folio.js';

import {
    fetchHousekeepingRooms,
    openBlockRoomModal,
    closeBlockRoomModal,
    handleSaveBlockRoom,
    updateRoomStatus,
    updateRoomHousekeepingStatus,
    openNsgAccountModal,
    closeNsgAccountModal,
    fetchNsgList,
    fetchNsgAccounts,
    handleSaveNsg,
    fetchCorporateProfiles,
    openCorporateModal,
    openEditCorporate,
    closeCorporateModal,
    handleSaveCorporate,
    deleteCorporate,
    pendingCancelReservationId,
    pendingCancelDepositAmount,
    openCancelDepositModal,
    closeCancelDepositModal,
    handleCancelBookingReservation,
    handleDepositSettlement,
    executeCancelReservation,
    fetchCancelList
} from './modules/operations.js';

import {
    switchSettingsTab,
    fetchBedTypes,
    openBedTypeModal,
    openEditBedType,
    closeBedTypeModal,
    handleSaveBedType,
    deleteBedType,
    fetchRoomTypes,
    openRoomCategoryModal,
    openEditRoomType,
    closeRoomCategoryModal,
    handleSaveRoomCategory,
    deleteRoomType,
    populateRoomTypeDropdown,
    fetchRooms,
    openRoomModal,
    openEditRoom,
    closeRoomModal,
    handleSaveRoom,
    deleteRoom,
    fetchExtraCharges,
    openExtraChargeModal,
    openEditExtraCharge,
    closeExtraChargeModal,
    handleSaveExtraCharge,
    deleteExtraCharge,
    fetchPaymentMethods,
    openPaymentMethodModal,
    openEditPaymentMethod,
    closePaymentMethodModal,
    handleSavePaymentMethod,
    deletePaymentMethod,
    fetchInvoiceSetting,
    handleSaveInvoiceSetting,
    fetchSegmentCodes,
    openSegmentCodeModal,
    openEditSegmentCode,
    closeSegmentCodeModal,
    handleSaveSegmentCode,
    deleteSegmentCode,
    fetchMainGroups,
    openMainGroupModal,
    openEditMainGroup,
    closeMainGroupModal,
    handleSaveMainGroup,
    deleteMainGroup,
    fetchTaxService,
    openTaxServiceModal,
    closeTaxServiceModal,
    handleSaveTaxService,
    deleteTaxService,
    fetchDepartments,
    openDepartmentModal,
    openEditDepartment,
    closeDepartmentModal,
    handleSaveDepartment,
    deleteDepartment,
    fetchOutlets,
    openOutletModal,
    openEditOutlet,
    closeOutletModal,
    handleSaveOutlet,
    deleteOutlet,
    fetchMealPlans,
    loadOutletsCache,
    buildOutletOptionsHTML,
    addMealPlanBreakdownRow,
    removeMealPlanBreakdownRow,
    clearMealPlanBreakdownRows,
    openMealPlanModal,
    openEditMealPlan,
    closeMealPlanModal,
    handleSaveMealPlan,
    deleteMealPlan,
    renderRoomTypePriceInputs,
    fetchRatePlans,
    openRatePlanModal,
    openEditRatePlan,
    closeRatePlanModal,
    handleSaveRatePlan,
    deleteRatePlan,
    outletsCache
} from './modules/settings.js';

// Global Variables
export const todayDate = new Date();
todayDate.setHours(0, 0, 0, 0);

export let initializedAppDate = new Date().toDateString();

// Frontdesk Accordion Toggle Function
export function toggleFrontdeskAccordion(forceOpen) {
    const submenu = document.getElementById('frontdesk-submenu');
    const chevron = document.getElementById('frontdesk-chevron');
    if (!submenu) return;
    const isHidden = submenu.classList.contains('hidden');
    if (forceOpen === true || (forceOpen === undefined && isHidden)) {
        submenu.classList.remove('hidden');
        if (chevron) chevron.classList.add('rotate-180');
    } else if (forceOpen === false || (forceOpen === undefined && !isHidden)) {
        submenu.classList.add('hidden');
        if (chevron) chevron.classList.remove('rotate-180');
    }
}

// Single Page Application (SPA) View Toggling
export async function switchView(viewName) {
    const frontdeskTopbar = document.getElementById('frontdesk-topbar');
    const frontdeskView = document.getElementById('frontdesk-view');
    const nsgView = document.getElementById('nsg-view');
    const roomForecastView = document.getElementById('room-forecast-view');
    const housekeepingView = document.getElementById('housekeeping-view');
    const corporateView = document.getElementById('corporate-view');
    const cancelListView = document.getElementById('cancel-list-view');
    const adminSettingsView = document.getElementById('admin-settings-view');

    const navFrontdesk = document.getElementById('nav-frontdesk');
    const navRoomForecast = document.getElementById('nav-room-forecast');
    const navNsg = document.getElementById('nav-nsg');
    const navHousekeeping = document.getElementById('nav-housekeeping');
    const navCorporate = document.getElementById('nav-corporate');
    const navCancelList = document.getElementById('nav-cancel-list');
    const navSettings = document.getElementById('nav-settings');

    const allSubNavBtns = [navFrontdesk, navRoomForecast, navNsg];
    allSubNavBtns.forEach(btn => {
        if (btn) btn.className = "flex items-center gap-3 p-2.5 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors text-sm font-normal";
    });

    const allMainNavBtns = [navHousekeeping, navCorporate, navCancelList, navSettings];
    allMainNavBtns.forEach(btn => {
        if (btn) btn.className = "flex items-center gap-3 p-3 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors font-normal";
    });

    if (viewName === 'settings') {
        if (frontdeskTopbar) frontdeskTopbar.classList.add('hidden');
        if (frontdeskView) frontdeskView.classList.add('hidden');
        if (nsgView) nsgView.classList.add('hidden');
        if (roomForecastView) roomForecastView.classList.add('hidden');
        if (housekeepingView) housekeepingView.classList.add('hidden');
        if (corporateView) corporateView.classList.add('hidden');
        if (cancelListView) cancelListView.classList.add('hidden');
        if (adminSettingsView) adminSettingsView.classList.remove('hidden');

        if (navSettings) navSettings.className = "flex items-center gap-3 p-3 rounded-lg bg-blue-50 text-primary font-semibold transition-colors";
    } else if (viewName === 'nsg') {
        toggleFrontdeskAccordion(true);
        if (frontdeskTopbar) frontdeskTopbar.classList.remove('hidden');
        const topbarHeader = frontdeskTopbar ? frontdeskTopbar.querySelector('h2') : null;
        if (topbarHeader) topbarHeader.textContent = "Frontdesk / Non-Stay Guest (NSG)";

        if (frontdeskView) frontdeskView.classList.add('hidden');
        if (roomForecastView) roomForecastView.classList.add('hidden');
        if (housekeepingView) housekeepingView.classList.add('hidden');
        if (corporateView) corporateView.classList.add('hidden');
        if (cancelListView) cancelListView.classList.add('hidden');
        if (adminSettingsView) adminSettingsView.classList.add('hidden');
        if (nsgView) nsgView.classList.remove('hidden');

        if (navNsg) navNsg.className = "flex items-center gap-3 p-2.5 rounded-lg bg-blue-50 text-primary font-semibold transition-colors text-sm";

        fetchNsgList();
    } else if (viewName === 'room-forecast') {
        toggleFrontdeskAccordion(true);
        if (frontdeskTopbar) frontdeskTopbar.classList.remove('hidden');
        const topbarHeader = frontdeskTopbar ? frontdeskTopbar.querySelector('h2') : null;
        if (topbarHeader) topbarHeader.textContent = "Frontdesk / Room Forecast";

        if (frontdeskView) frontdeskView.classList.add('hidden');
        if (nsgView) nsgView.classList.add('hidden');
        if (housekeepingView) housekeepingView.classList.add('hidden');
        if (corporateView) corporateView.classList.add('hidden');
        if (cancelListView) cancelListView.classList.add('hidden');
        if (adminSettingsView) adminSettingsView.classList.add('hidden');
        if (roomForecastView) roomForecastView.classList.remove('hidden');

        if (navRoomForecast) navRoomForecast.className = "flex items-center gap-3 p-2.5 rounded-lg bg-blue-50 text-primary font-semibold transition-colors text-sm";

        renderRoomForecast();
    } else if (viewName === 'corporate') {
        if (frontdeskTopbar) frontdeskTopbar.classList.remove('hidden');
        const topbarHeader = frontdeskTopbar ? frontdeskTopbar.querySelector('h2') : null;
        if (topbarHeader) topbarHeader.textContent = "Corporate / Travel Agent Profiles";

        if (frontdeskView) frontdeskView.classList.add('hidden');
        if (nsgView) nsgView.classList.add('hidden');
        if (roomForecastView) roomForecastView.classList.add('hidden');
        if (housekeepingView) housekeepingView.classList.add('hidden');
        if (cancelListView) cancelListView.classList.add('hidden');
        if (adminSettingsView) adminSettingsView.classList.add('hidden');
        if (corporateView) corporateView.classList.remove('hidden');

        if (navCorporate) navCorporate.className = "flex items-center gap-3 p-3 rounded-lg bg-blue-50 text-primary font-semibold transition-colors";

        fetchCorporateProfiles();
    } else if (viewName === 'cancel-list') {
        if (frontdeskTopbar) frontdeskTopbar.classList.remove('hidden');
        const topbarHeader = frontdeskTopbar ? frontdeskTopbar.querySelector('h2') : null;
        if (topbarHeader) topbarHeader.textContent = "Reports / Cancel List";

        if (frontdeskView) frontdeskView.classList.add('hidden');
        if (nsgView) nsgView.classList.add('hidden');
        if (roomForecastView) roomForecastView.classList.add('hidden');
        if (housekeepingView) housekeepingView.classList.add('hidden');
        if (corporateView) corporateView.classList.add('hidden');
        if (adminSettingsView) adminSettingsView.classList.add('hidden');
        if (cancelListView) cancelListView.classList.remove('hidden');

        if (navCancelList) navCancelList.className = "flex items-center gap-3 p-3 rounded-lg bg-blue-50 text-primary font-semibold transition-colors";

        fetchCancelList();
    } else if (viewName === 'housekeeping') {
        if (frontdeskTopbar) frontdeskTopbar.classList.remove('hidden');
        const topbarHeader = frontdeskTopbar ? frontdeskTopbar.querySelector('h2') : null;
        if (topbarHeader) topbarHeader.textContent = "Housekeeping / Room Status";

        if (frontdeskView) frontdeskView.classList.add('hidden');
        if (nsgView) nsgView.classList.add('hidden');
        if (roomForecastView) roomForecastView.classList.add('hidden');
        if (corporateView) corporateView.classList.add('hidden');
        if (cancelListView) cancelListView.classList.add('hidden');
        if (adminSettingsView) adminSettingsView.classList.add('hidden');
        if (housekeepingView) housekeepingView.classList.remove('hidden');

        if (navHousekeeping) navHousekeeping.className = "flex items-center gap-3 p-3 rounded-lg bg-blue-50 text-primary font-semibold transition-colors";

        fetchHousekeepingRooms();
    } else {
        toggleFrontdeskAccordion(true);
        if (frontdeskTopbar) frontdeskTopbar.classList.remove('hidden');
        const topbarHeader = frontdeskTopbar ? frontdeskTopbar.querySelector('h2') : null;
        if (topbarHeader) topbarHeader.textContent = "Frontdesk / Tape Chart";

        if (frontdeskView) frontdeskView.classList.remove('hidden');
        if (nsgView) nsgView.classList.add('hidden');
        if (roomForecastView) roomForecastView.classList.add('hidden');
        if (housekeepingView) housekeepingView.classList.add('hidden');
        if (corporateView) corporateView.classList.add('hidden');
        if (cancelListView) cancelListView.classList.add('hidden');
        if (adminSettingsView) adminSettingsView.classList.add('hidden');

        if (navFrontdesk) navFrontdesk.className = "flex items-center gap-3 p-2.5 rounded-lg bg-blue-50 text-primary font-semibold transition-colors text-sm";

        await fetchRooms();
        await fetchFrontdeskDashboard();
        await renderTapeChart();
    }

    // Toggle Mobile Menu closed if open
    const sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.add('-translate-x-full');
    }
}

// Attach global variables and module functions to window for inline scripts
if (typeof window !== 'undefined') {
    window.todayDate = todayDate;
    window.initializedAppDate = initializedAppDate;
    window.toggleFrontdeskAccordion = toggleFrontdeskAccordion;
    window.switchView = switchView;

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
    window.initRealtimeSubscriptions = initRealtimeSubscriptions;

    // Reservation Module
    window.populateReservationFormDropdowns = populateReservationFormDropdowns;
    window.openModal = openModal;
    window.openViewReservationModal = openViewReservationModal;
    window.openReactivateReservationModal = openReactivateReservationModal;
    window.handleSaveReservation = handleSaveReservation;
    window.openEditReservation = openEditReservation;
    window.closeModal = closeModal;
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
    window.openWebcamModal = openWebcamModal;
    window.closeWebcamModal = closeWebcamModal;
    window.captureWebcamPhoto = captureWebcamPhoto;
    window.handleDocUpload = handleDocUpload;
    window.clearDocPreview = clearDocPreview;
    window.getCompressedDocBlob = getCompressedDocBlob;
    window.toggleAddDepositForm = toggleAddDepositForm;
    window.fetchAndRenderReservationDepositHistory = fetchAndRenderReservationDepositHistory;
    window.renderReservationDepositHistory = renderReservationDepositHistory;
    window.handleAddDepositSubmit = handleAddDepositSubmit;
    window.handleCheckInReservation = handleCheckInReservation;
    window.handleCheckIn = handleCheckIn;
    window.handlePrintRegistrationCard = handlePrintRegistrationCard;
    window.mealPlansCache = mealPlansCache;
    window.roomTypesCache = roomTypesCache;
    window.ratePlansCache = ratePlansCache;
    window.isReactivateMode = isReactivateMode;
    window.pendingNewReservationDeposits = pendingNewReservationDeposits;

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

    // Folio Module
    window.currentFolioReservation = currentFolioReservation;
    window.currentFolioTransactions = currentFolioTransactions;
    window.calculatedCurrentBalance = calculatedCurrentBalance;
    window.currentMasterGroup = currentMasterGroup;
    window.currentMasterTransactions = currentMasterTransactions;
    window.transferTargetReservationsCache = transferTargetReservationsCache;
    window.folioRoutingAvailableArticles = folioRoutingAvailableArticles;
    window.folioRoutingRulesState = folioRoutingRulesState;
    window.openFolioModal = openFolioModal;
    window.closeFolioModal = closeFolioModal;
    window.checkAndUpdateMasterFolioHeader = checkAndUpdateMasterFolioHeader;
    window.handleCreateMasterFolio = handleCreateMasterFolio;
    window.handleOpenFolioFromEdit = handleOpenFolioFromEdit;
    window.fetchFolioTransactions = fetchFolioTransactions;
    window.renderFolioTransactions = renderFolioTransactions;
    window.openMasterFolioModal = openMasterFolioModal;
    window.closeMasterFolioModal = closeMasterFolioModal;
    window.fetchMasterFolioTransactions = fetchMasterFolioTransactions;
    window.renderMasterFolioTransactions = renderMasterFolioTransactions;
    window.handleMoveBackToPersonalFolio = handleMoveBackToPersonalFolio;
    window.handleVoidMasterTransaction = handleVoidMasterTransaction;
    window.openAddChargeModal = openAddChargeModal;
    window.openAddPaymentModal = openAddPaymentModal;
    window.openMasterAddChargeModal = openMasterAddChargeModal;
    window.openMasterAddPaymentModal = openMasterAddPaymentModal;
    window.closeFolioTransactionModal = closeFolioTransactionModal;
    window.handleChargeItemChange = handleChargeItemChange;
    window.handleFolioPaymentMethodChange = handleFolioPaymentMethodChange;
    window.calculateFolioTotal = calculateFolioTotal;
    window.handleSaveFolioTransaction = handleSaveFolioTransaction;
    window.handleVoidTransaction = handleVoidTransaction;
    window.updateTransferButtonsState = updateTransferButtonsState;
    window.toggleSelectAllFolioTx = toggleSelectAllFolioTx;
    window.onFolioTxCheckboxChange = onFolioTxCheckboxChange;
    window.openTransferBillModal = openTransferBillModal;
    window.renderTransferTargetOptions = renderTransferTargetOptions;
    window.filterTransferTargets = filterTransferTargets;
    window.closeTransferBillModal = closeTransferBillModal;
    window.executeTransferBill = executeTransferBill;
    window.handleMoveToMasterFolio = handleMoveToMasterFolio;
    window.populateFolioRoutingDualList = populateFolioRoutingDualList;
    window.renderRoutingDualList = renderRoutingDualList;
    window.moveSelectedRouting = moveSelectedRouting;
    window.handleSaveFolioRouting = handleSaveFolioRouting;
    window.handleProcessCheckout = handleProcessCheckout;
    window.handleCheckOut = handleCheckOut;
    window.handlePrintFolio = handlePrintFolio;
    window.handlePrintMasterFolio = handlePrintMasterFolio;

    // Operations Module
    window.fetchHousekeepingRooms = fetchHousekeepingRooms;

    window.openBlockRoomModal = openBlockRoomModal;
    window.closeBlockRoomModal = closeBlockRoomModal;
    window.handleSaveBlockRoom = handleSaveBlockRoom;
    window.updateRoomStatus = updateRoomStatus;
    window.updateRoomHousekeepingStatus = updateRoomHousekeepingStatus;
    window.openNsgAccountModal = openNsgAccountModal;
    window.closeNsgAccountModal = closeNsgAccountModal;
    window.fetchNsgList = fetchNsgList;
    window.fetchNsgAccounts = fetchNsgAccounts;
    window.handleSaveNsg = handleSaveNsg;
    window.fetchCorporateProfiles = fetchCorporateProfiles;
    window.openCorporateModal = openCorporateModal;
    window.openEditCorporate = openEditCorporate;
    window.closeCorporateModal = closeCorporateModal;
    window.handleSaveCorporate = handleSaveCorporate;
    window.deleteCorporate = deleteCorporate;
    window.pendingCancelReservationId = pendingCancelReservationId;
    window.pendingCancelDepositAmount = pendingCancelDepositAmount;
    window.openCancelDepositModal = openCancelDepositModal;
    window.closeCancelDepositModal = closeCancelDepositModal;
    window.handleCancelBookingReservation = handleCancelBookingReservation;
    window.handleDepositSettlement = handleDepositSettlement;
    window.executeCancelReservation = executeCancelReservation;
    window.fetchCancelList = fetchCancelList;

    // Settings Module
    window.switchSettingsTab = switchSettingsTab;
    window.fetchBedTypes = fetchBedTypes;
    window.openBedTypeModal = openBedTypeModal;
    window.openEditBedType = openEditBedType;
    window.closeBedTypeModal = closeBedTypeModal;
    window.handleSaveBedType = handleSaveBedType;
    window.deleteBedType = deleteBedType;
    window.fetchRoomTypes = fetchRoomTypes;
    window.openRoomCategoryModal = openRoomCategoryModal;
    window.openEditRoomType = openEditRoomType;
    window.closeRoomCategoryModal = closeRoomCategoryModal;
    window.handleSaveRoomCategory = handleSaveRoomCategory;
    window.deleteRoomType = deleteRoomType;
    window.populateRoomTypeDropdown = populateRoomTypeDropdown;
    window.fetchRooms = fetchRooms;
    window.openRoomModal = openRoomModal;
    window.openEditRoom = openEditRoom;
    window.closeRoomModal = closeRoomModal;
    window.handleSaveRoom = handleSaveRoom;
    window.deleteRoom = deleteRoom;
    window.fetchExtraCharges = fetchExtraCharges;
    window.openExtraChargeModal = openExtraChargeModal;
    window.openEditExtraCharge = openEditExtraCharge;
    window.closeExtraChargeModal = closeExtraChargeModal;
    window.handleSaveExtraCharge = handleSaveExtraCharge;
    window.deleteExtraCharge = deleteExtraCharge;
    window.fetchPaymentMethods = fetchPaymentMethods;
    window.openPaymentMethodModal = openPaymentMethodModal;
    window.openEditPaymentMethod = openEditPaymentMethod;
    window.closePaymentMethodModal = closePaymentMethodModal;
    window.handleSavePaymentMethod = handleSavePaymentMethod;
    window.deletePaymentMethod = deletePaymentMethod;
    window.fetchInvoiceSetting = fetchInvoiceSetting;
    window.handleSaveInvoiceSetting = handleSaveInvoiceSetting;
    window.fetchSegmentCodes = fetchSegmentCodes;
    window.openSegmentCodeModal = openSegmentCodeModal;
    window.openEditSegmentCode = openEditSegmentCode;
    window.closeSegmentCodeModal = closeSegmentCodeModal;
    window.handleSaveSegmentCode = handleSaveSegmentCode;
    window.deleteSegmentCode = deleteSegmentCode;
    window.fetchMainGroups = fetchMainGroups;
    window.openMainGroupModal = openMainGroupModal;
    window.openEditMainGroup = openEditMainGroup;
    window.closeMainGroupModal = closeMainGroupModal;
    window.handleSaveMainGroup = handleSaveMainGroup;
    window.deleteMainGroup = deleteMainGroup;
    window.fetchTaxService = fetchTaxService;
    window.openTaxServiceModal = openTaxServiceModal;
    window.closeTaxServiceModal = closeTaxServiceModal;
    window.handleSaveTaxService = handleSaveTaxService;
    window.deleteTaxService = deleteTaxService;
    window.fetchDepartments = fetchDepartments;
    window.openDepartmentModal = openDepartmentModal;
    window.openEditDepartment = openEditDepartment;
    window.closeDepartmentModal = closeDepartmentModal;
    window.handleSaveDepartment = handleSaveDepartment;
    window.deleteDepartment = deleteDepartment;
    window.fetchOutlets = fetchOutlets;
    window.openOutletModal = openOutletModal;
    window.openEditOutlet = openEditOutlet;
    window.closeOutletModal = closeOutletModal;
    window.handleSaveOutlet = handleSaveOutlet;
    window.deleteOutlet = deleteOutlet;
    window.fetchMealPlans = fetchMealPlans;
    window.loadOutletsCache = loadOutletsCache;
    window.buildOutletOptionsHTML = buildOutletOptionsHTML;
    window.addMealPlanBreakdownRow = addMealPlanBreakdownRow;
    window.removeMealPlanBreakdownRow = removeMealPlanBreakdownRow;
    window.clearMealPlanBreakdownRows = clearMealPlanBreakdownRows;
    window.openMealPlanModal = openMealPlanModal;
    window.openEditMealPlan = openEditMealPlan;
    window.closeMealPlanModal = closeMealPlanModal;
    window.handleSaveMealPlan = handleSaveMealPlan;
    window.deleteMealPlan = deleteMealPlan;
    window.renderRoomTypePriceInputs = renderRoomTypePriceInputs;
    window.fetchRatePlans = fetchRatePlans;
    window.openRatePlanModal = openRatePlanModal;
    window.openEditRatePlan = openEditRatePlan;
    window.closeRatePlanModal = closeRatePlanModal;
    window.handleSaveRatePlan = handleSaveRatePlan;
    window.deleteRatePlan = deleteRatePlan;
    window.outletsCache = outletsCache;
}

// Drag-to-Select Global Event Listeners
document.addEventListener('mousedown', (e) => {
    const cell = e.target.closest('.calendar-cell');
    if (!cell) return;
    if (e.target.closest('[onclick^="openEditReservation"]')) return;

    const roomId = cell.dataset.roomId;
    const date = cell.dataset.date;
    if (roomId && date) {
        setDragState(true, { roomId, date }, { roomId, date });
        updateDragHighlight();
    }
});

document.addEventListener('mouseover', (e) => {
    if (!isDragging || !dragStartData) return;
    const cell = e.target.closest('.calendar-cell');
    if (!cell) return;

    const roomId = cell.dataset.roomId;
    const date = cell.dataset.date;
    if (roomId === dragStartData.roomId && date) {
        setDragState(true, dragStartData, { roomId, date });
        updateDragHighlight();
    }
});

document.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    setDragState(false, dragStartData, dragEndData);

    if (dragStartData && dragEndData) {
        const roomId = dragStartData.roomId;
        const date1 = dragStartData.date;
        const date2 = dragEndData.date;

        const startDateStr = date1 < date2 ? date1 : date2;
        const endDateStr = date1 < date2 ? date2 : date1;

        const checkInDate = startDateStr;
        const endDateObj = new Date(endDateStr + 'T00:00:00');
        const checkOutDateObj = addDays(endDateObj, 1);
        const checkOutDate = formatDateISO(checkOutDateObj);

        setDragState(false, null, null);

        openCreateReservationModal(roomId, checkInDate, checkOutDate);
    } else {
        clearDragHighlight();
        setDragState(false, null, null);
    }
});

// Mobile Menu Event Listener
document.addEventListener('DOMContentLoaded', () => {
    const mobileBtn = document.getElementById('mobileMenuBtn');
    if (mobileBtn) {
        mobileBtn.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.toggle('-translate-x-full');
        });
    }
});

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

        // Trigger Eksekusi Tape Chart & Dashboard
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

        // Initialize Realtime Listener
        initRealtimeSubscriptions();

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
