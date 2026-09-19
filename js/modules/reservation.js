import { supabaseClient } from '../config/supabase.js';
import { formatDateISO, addDays, formatStayDatesCompact } from '../utils/formatters.js';

// Global/Module Caches & State
export let guestSearchDebounceTimer = null;
export let mealPlansCache = [];
export let roomTypesCache = [];
export let ratePlansCache = [];
export let isReactivateMode = false;

// 1. Dropdown & Form State
export async function populateReservationFormDropdowns() {
    try {
        // 1. Room Types & Rooms
        const { data: rTypes, error: rtErr } = await supabaseClient.from('room_types').select('id, name, base_price').order('name', { ascending: true });
        if (rtErr) throw rtErr;
        roomTypesCache = rTypes || [];
        if (typeof window !== 'undefined') window.roomTypesCache = roomTypesCache;

        const roomTypeSelect = document.getElementById('res-room-type');
        if (roomTypeSelect) {
            roomTypeSelect.innerHTML = `<option value="">-- Select Room Type --</option>` +
                roomTypesCache.map(rt => `<option value="${rt.id}">${rt.name}</option>`).join('');
        }

        // 2. Rate Plans
        const { data: rPlans, error: rpErr } = await supabaseClient.from('rate_plans').select('id, rate_code, rate_name, allow_override, meal_plan_id, segment_id').order('rate_code', { ascending: true });
        if (rpErr) throw rpErr;
        ratePlansCache = rPlans || [];
        if (typeof window !== 'undefined') window.ratePlansCache = ratePlansCache;

        const rateCodeSelect = document.getElementById('res-rate-code');
        if (rateCodeSelect) {
            rateCodeSelect.innerHTML = `<option value="">-- Select Rate Code --</option>` +
                ratePlansCache.map(rp => `<option value="${rp.id}">${rp.rate_code} - ${rp.rate_name}</option>`).join('');
        }

        // 3. Meal Plans
        const { data: mPlans, error: mpErr } = await supabaseClient.from('meal_plans').select('id, code, name').order('code', { ascending: true });
        if (mpErr) throw mpErr;
        mealPlansCache = mPlans || [];
        if (typeof window !== 'undefined') window.mealPlansCache = mealPlansCache;

        const mealPlanSelect = document.getElementById('res-meal-plan');
        if (mealPlanSelect) {
            mealPlanSelect.innerHTML = `<option value="">-- None --</option>` +
                (mPlans || []).map(mp => `<option value="${mp.id}">${mp.code} - ${mp.name}</option>`).join('');
        }

        // 4. Market Segments
        const { data: sCodes, error: scErr } = await supabaseClient.from('segment_codes').select('id, segment_code, description').order('segment_code', { ascending: true });
        if (scErr) throw scErr;
        const segmentSelect = document.getElementById('res-segment');
        if (segmentSelect) {
            segmentSelect.innerHTML = `<option value="">-- Select Segment --</option>` +
                (sCodes || []).map(sc => `<option value="${sc.id}">${sc.segment_code}${sc.description ? ' - ' + sc.description : ''}</option>`).join('');
        }

        // 5. Payment Methods
        const { data: pMethods, error: pmErr } = await supabaseClient.from('payment_methods').select('id, name, type, method_type').eq('is_active', true).order('name', { ascending: true });
        if (pmErr) throw pmErr;
        const paymentMethodSelect = document.getElementById('res-new-deposit-method');
        if (paymentMethodSelect) {
            paymentMethodSelect.innerHTML = `<option value="">-- Select Payment Method --</option>` +
                (pMethods || []).map(pm => {
                    const mType = pm.type || pm.method_type || '';
                    const label = mType ? `${pm.name} - ${mType}` : pm.name;
                    return `<option value="${pm.id}">${label}</option>`;
                }).join('');
        }

        // 6. Corporate Profiles (Bill Receiver)
        const { data: cProfiles, error: cpErr } = await supabaseClient.from('corporate_profiles').select('id, company_name').order('company_name', { ascending: true });
        if (cpErr) throw cpErr;
        const corporateSelect = document.getElementById('res-corporate-id');
        if (corporateSelect) {
            corporateSelect.innerHTML = `<option value="">-- Personal / Individual --</option>` +
                (cProfiles || []).map(cp => `<option value="${cp.id}">${cp.company_name}</option>`).join('');
        }

    } catch (err) {
        console.error('Error populating reservation form dropdowns:', err);
    }
}

export async function openModal() {
    await populateReservationFormDropdowns();
    switchReservationTab('details');

    // Reset IDs, pending deposits, and document preview
    const editResId = document.getElementById('edit-reservation-id');
    if (editResId) editResId.value = '';
    const editResNum = document.getElementById('edit-reservation-number');
    if (editResNum) editResNum.value = '';

    if (typeof window !== 'undefined' && typeof window.clearDocPreview === 'function') {
        window.clearDocPreview();
    } else if (typeof clearDocPreview === 'function') {
        clearDocPreview();
    }

    if (typeof window !== 'undefined') window.pendingNewReservationDeposits = [];

    if (typeof window !== 'undefined' && typeof window.toggleAddDepositForm === 'function') {
        window.toggleAddDepositForm(false);
    } else if (typeof toggleAddDepositForm === 'function') {
        toggleAddDepositForm(false);
    }

    if (typeof window !== 'undefined' && typeof window.renderReservationDepositHistory === 'function') {
        window.renderReservationDepositHistory([]);
    } else if (typeof renderReservationDepositHistory === 'function') {
        renderReservationDepositHistory([]);
    }

    // Modal Header (New Mode)
    const titleIcon = document.getElementById('reservationModalIcon');
    const titleText = document.getElementById('reservationModalTitleText');
    const subTitle = document.getElementById('reservationModalSubTitle');
    if (titleIcon) titleIcon.className = 'ph ph-calendar-plus text-primary text-2xl';
    if (titleText) titleText.textContent = 'New Reservation';
    if (subTitle) subTitle.textContent = 'Buat reservasi kamar baru dengan informasi tamu dan rincian menginap.';

    // Status Badge (New Mode)
    const statusBadge = document.getElementById('res-status-badge');
    const statusText = document.getElementById('res-status-text');
    if (statusBadge) statusBadge.className = 'flex items-center gap-1.5 bg-emerald-100 text-emerald-800 text-xs px-3 py-1 rounded-full font-bold';
    if (statusText) statusText.textContent = 'Status: Reserved';

    // Footer buttons toggle
    const createFooter = document.getElementById('resModalCreateFooter');
    const editFooter = document.getElementById('resModalEditFooter');
    if (createFooter) createFooter.classList.remove('hidden');
    if (editFooter) editFooter.classList.add('hidden');

    // Set default dates & fields
    const checkInInput = document.getElementById('res-check-in');
    const checkOutInput = document.getElementById('res-check-out');
    const currentToday = (typeof window !== 'undefined' && window.todayDate) ? window.todayDate : new Date();
    const checkInISO = formatDateISO(currentToday);
    const checkOutISO = formatDateISO(addDays(currentToday, 1));

    if (checkInInput) {
        checkInInput.min = checkInISO;
        checkInInput.value = checkInISO;
    }
    if (checkOutInput) {
        checkOutInput.value = checkOutISO;
    }

    const nightsEl = document.getElementById('res-nights');
    if (nightsEl) nightsEl.value = 1;
    const etaEl = document.getElementById('res-eta');
    if (etaEl) etaEl.value = '14:00';
    const etdEl = document.getElementById('res-etd');
    if (etdEl) etdEl.value = '12:00';
    const adultEl = document.getElementById('res-adult');
    if (adultEl) adultEl.value = 2;
    const childEl = document.getElementById('res-child');
    if (childEl) childEl.value = 0;
    const qtyEl = document.getElementById('res-qty');
    if (qtyEl) qtyEl.value = 1;
    const extrabedEl = document.getElementById('res-extrabed');
    if (extrabedEl) extrabedEl.value = 0;

    const sourceEl = document.getElementById('res-source');
    if (sourceEl) sourceEl.value = 'Direct';

    const guestTypeSelect = document.getElementById('res-guest-type');
    if (guestTypeSelect) {
        guestTypeSelect.value = 'Staying Guest';
    }
    const corpSelect = document.getElementById('res-corporate-id');
    if (corpSelect) corpSelect.value = '';

    const bookerEl = document.getElementById('res-booker-name');
    if (bookerEl) bookerEl.value = '';
    clearSelectedGuest();

    const modal = document.getElementById('reservationModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

export async function openViewReservationModal(id) {
    if (typeof window !== 'undefined' && typeof window.openEditReservation === 'function') {
        await window.openEditReservation(id);
    } else if (typeof openEditReservation === 'function') {
        await openEditReservation(id);
    }
}

export async function openReactivateReservationModal(id) {
    if (typeof window !== 'undefined' && typeof window.openEditReservation === 'function') {
        await window.openEditReservation(id);
    } else if (typeof openEditReservation === 'function') {
        await openEditReservation(id);
    }
    isReactivateMode = true;
    if (typeof window !== 'undefined') window.isReactivateMode = true;

    // 1. Auto-populate all data (done by openEditReservation)
    // 2. Kosongkan / reset pilihan Room Number
    const roomNumberSelect = document.getElementById('res-room-number');
    if (roomNumberSelect) {
        roomNumberSelect.value = '';
    }

    // 3. Ubah header & tombol submit
    const titleIcon = document.getElementById('reservationModalIcon');
    const titleText = document.getElementById('reservationModalTitleText');
    const subTitle = document.getElementById('reservationModalSubTitle');
    if (titleIcon) titleIcon.className = 'ph ph-arrow-counter-clockwise text-emerald-600 text-2xl';
    if (titleText) titleText.textContent = `Reactivate Reservation`;
    if (subTitle) subTitle.textContent = 'Pilih kamar yang tersedia lalu simpan untuk menghidupkan kembali reservasi.';

    const updateBtn = document.getElementById('resUpdateBtn');
    if (updateBtn) {
        updateBtn.className = 'px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm flex items-center gap-2';
        updateBtn.innerHTML = `<i class="ph ph-floppy-disk text-lg"></i> Save & Reactivate`;
    }
}

export function switchReservationTab(tabName) {
    const btnDetails = document.getElementById('res-tab-btn-details');
    const btnRouting = document.getElementById('res-tab-btn-routing');
    const containerDetails = document.getElementById('res-tab-container-details');
    const containerRouting = document.getElementById('res-tab-container-routing');

    if (tabName === 'routing') {
        if (btnDetails) btnDetails.className = 'py-2.5 px-3 text-xs font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700 flex items-center gap-1.5 transition-colors';
        if (btnRouting) btnRouting.className = 'py-2.5 px-3 text-xs font-bold border-b-2 border-primary text-primary flex items-center gap-1.5 transition-colors';
        if (containerDetails) containerDetails.classList.add('hidden');
        if (containerRouting) containerRouting.classList.remove('hidden');

        if (typeof window !== 'undefined' && typeof window.populateFolioRoutingDualList === 'function') {
            window.populateFolioRoutingDualList();
        } else if (typeof populateFolioRoutingDualList === 'function') {
            populateFolioRoutingDualList();
        }
    } else {
        if (btnRouting) btnRouting.className = 'py-2.5 px-3 text-xs font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700 flex items-center gap-1.5 transition-colors';
        if (btnDetails) btnDetails.className = 'py-2.5 px-3 text-xs font-bold border-b-2 border-primary text-primary flex items-center gap-1.5 transition-colors';
        if (containerRouting) containerRouting.classList.add('hidden');
        if (containerDetails) containerDetails.classList.remove('hidden');
    }
}

// 2. Pencarian Tamu
export async function handleGuestSearchInput(query) {
    const suggestionsDiv = document.getElementById('res-guest-suggestions');
    if (!suggestionsDiv) return;

    const trimmed = query.trim();
    if (trimmed.length < 1) {
        suggestionsDiv.classList.add('hidden');
        suggestionsDiv.innerHTML = '';
        return;
    }

    if (guestSearchDebounceTimer) clearTimeout(guestSearchDebounceTimer);

    guestSearchDebounceTimer = setTimeout(async () => {
        try {
            const { data, error } = await supabaseClient
                .from('guest_profiles')
                .select('*')
                .ilike('full_name', `%${trimmed}%`)
                .limit(8);

            if (error) throw error;

            if (!data || data.length === 0) {
                suggestionsDiv.innerHTML = `
                    <div class="px-3 py-2 text-xs text-slate-500 italic">
                        Tidak ditemukan tamu dengan nama "${trimmed}".
                    </div>
                `;
            } else {
                suggestionsDiv.innerHTML = data.map(g => {
                    const escapedName = (g.full_name || '').replace(/'/g, "\\'");
                    const escapedPhone = (g.phone_number || '').replace(/'/g, "\\'");
                    const escapedEmail = (g.email || '').replace(/'/g, "\\'");
                    const escapedIdCard = (g.id_card_no || '').replace(/'/g, "\\'");
                    const escapedAddress = (g.address || '').replace(/'/g, "\\'");
                    const escapedCity = (g.city || '').replace(/'/g, "\\'");
                    const escapedNationality = (g.nationality || '').replace(/'/g, "\\'");
                    const birthDate = g.birth_date || '';

                    return `
                        <div onclick="selectGuestProfile('${g.id}', '${escapedName}', '${escapedIdCard}', '${escapedPhone}', '${escapedEmail}', '${birthDate}', '${escapedAddress}', '${escapedCity}', '${escapedNationality}')" class="px-3 py-2 hover:bg-slate-100 cursor-pointer border-b border-slate-100 last:border-b-0">
                            <div class="font-medium text-xs text-slate-800">${g.full_name}</div>
                            <div class="text-[11px] text-slate-500 flex gap-2">
                                <span>${g.phone_number || 'No phone'}</span>
                                <span>•</span>
                                <span>${g.id_card_no || 'No ID'}</span>
                            </div>
                        </div>
                    `;
                }).join('');
            }
            suggestionsDiv.classList.remove('hidden');
        } catch (err) {
            console.error('Error searching guest profiles:', err);
        }
    }, 250);
}

export function selectGuestProfile(id, name, idCard, phone, email, birthDate, address, city, nationality) {
    document.getElementById('res-guest-profile-id').value = id;
    document.getElementById('res-guest-name').value = name;
    document.getElementById('res-id-card').value = idCard || '';
    document.getElementById('res-phone').value = phone || '';
    document.getElementById('res-email').value = email || '';
    document.getElementById('res-birth-date').value = birthDate || '';
    document.getElementById('res-address').value = address || '';
    document.getElementById('res-city').value = city || '';
    document.getElementById('res-nationality').value = nationality || 'Indonesia';

    const suggestionsDiv = document.getElementById('res-guest-suggestions');
    if (suggestionsDiv) suggestionsDiv.classList.add('hidden');
    const guestNameInput = document.getElementById('res-guest-name');
    if (guestNameInput) guestNameInput.focus();
}

export function clearSelectedGuest() {
    document.getElementById('res-guest-profile-id').value = '';
    document.getElementById('res-guest-name').value = '';
    document.getElementById('res-id-card').value = '';
    document.getElementById('res-phone').value = '';
    document.getElementById('res-email').value = '';
    document.getElementById('res-birth-date').value = '';
    document.getElementById('res-address').value = '';
    document.getElementById('res-city').value = '';
    document.getElementById('res-nationality').value = 'Indonesia';

    const suggestionsDiv = document.getElementById('res-guest-suggestions');
    if (suggestionsDiv) suggestionsDiv.classList.add('hidden');
}

// 3. Kalkulasi Tanggal & Daily Rates
export function handleStayDatesChange(triggerSource) {
    const checkInInput = document.getElementById('res-check-in');
    const checkOutInput = document.getElementById('res-check-out');
    const nightsInput = document.getElementById('res-nights');

    const checkInVal = checkInInput.value;
    const checkOutVal = checkOutInput.value;
    let nightsVal = parseInt(nightsInput.value, 10);

    if (!checkInVal) return;
    const checkInDateObj = new Date(checkInVal + 'T00:00:00');

    if (triggerSource === 'nights') {
        if (isNaN(nightsVal) || nightsVal < 1) {
            nightsVal = 1;
            nightsInput.value = 1;
        }
        const newCheckOutObj = addDays(checkInDateObj, nightsVal);
        checkOutInput.value = formatDateISO(newCheckOutObj);
    } else if (triggerSource === 'check-out' || triggerSource === 'check-in') {
        if (checkInVal && checkOutVal) {
            const checkOutDateObj = new Date(checkOutVal + 'T00:00:00');
            const diffTime = checkOutDateObj - checkInDateObj;
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays >= 1) {
                nightsInput.value = diffDays;
            } else {
                // Reset check-out to check-in + 1 night if check-out <= check-in
                const autoCheckOut = addDays(checkInDateObj, 1);
                checkOutInput.value = formatDateISO(autoCheckOut);
                nightsInput.value = 1;
            }
        } else if (checkInVal && !checkOutVal) {
            const defaultNights = isNaN(nightsVal) || nightsVal < 1 ? 1 : nightsVal;
            const autoCheckOut = addDays(checkInDateObj, defaultNights);
            checkOutInput.value = formatDateISO(autoCheckOut);
        }
    }

    renderDailyBreakdownGrid();
    updateTotalPreview();
}

export function renderDailyBreakdownGrid(existingDailyRates = null) {
    const tbody = document.getElementById('daily-breakdown-tbody');
    if (!tbody) return;

    const checkInVal = document.getElementById('res-check-in').value;
    const checkOutVal = document.getElementById('res-check-out').value;
    const nights = parseInt(document.getElementById('res-nights').value, 10) || 1;
    const masterRate = parseFloat(document.getElementById('res-room-rate').value) || 0;
    const masterMealPlanId = document.getElementById('res-meal-plan').value || '';

    if (!checkInVal) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-slate-400 italic">Pilih tanggal Check-in terlebih dahulu.</td></tr>`;
        return;
    }

    const checkInDateObj = new Date(checkInVal + 'T00:00:00');
    let rowsHtml = '';

    const mealOptionsHtml = `<option value="">-- None --</option>` +
        mealPlansCache.map(mp => `<option value="${mp.id}">${mp.code} - ${mp.name}</option>`).join('');

    for (let i = 0; i < nights; i++) {
        const stayDateObj = addDays(checkInDateObj, i);
        const stayDateStr = formatDateISO(stayDateObj);
        const stayDateFormatted = stayDateObj.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

        let rowRate = masterRate;
        let rowMealPlanId = masterMealPlanId;

        if (existingDailyRates && Array.isArray(existingDailyRates)) {
            const found = existingDailyRates.find(dr => dr.stay_date === stayDateStr);
            if (found) {
                rowRate = found.room_rate !== undefined && found.room_rate !== null ? found.room_rate : masterRate;
                rowMealPlanId = found.meal_plan_id || '';
            }
        } else {
            // Check if row element already exists in DOM to preserve user edits when nights change or re-render
            const existingRateInput = document.getElementById(`daily-rate-${i}`);
            const existingMealSelect = document.getElementById(`daily-meal-${i}`);
            if (existingRateInput) rowRate = parseFloat(existingRateInput.value) || 0;
            if (existingMealSelect) rowMealPlanId = existingMealSelect.value || '';
        }

        const applyAllBtn = i === 0
            ? `<button type="button" onclick="applyFirstRowToAllDailyRates()" class="px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded text-[11px] font-semibold transition-colors flex items-center gap-1 mx-auto" title="Samakan harga & meal plan baris pertama ke semua malam">
                <i class="ph ph-copy"></i> Apply to All
               </button>`
            : `<span class="text-slate-300 text-[10px] italic flex justify-center">-</span>`;

        rowsHtml += `
            <tr class="hover:bg-slate-50 transition-colors" data-stay-date="${stayDateStr}">
                <td class="py-2 px-3 text-center font-bold text-slate-500">${i + 1}</td>
                <td class="py-2 px-3 font-semibold text-slate-700 whitespace-nowrap">
                    ${stayDateFormatted}
                    <input type="hidden" class="daily-stay-date" value="${stayDateStr}">
                </td>
                <td class="py-2 px-3">
                    <input type="number" id="daily-rate-${i}" step="any" min="0" value="${rowRate}" oninput="updateTotalPreview()" onchange="updateTotalPreview()" class="daily-rate-input w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-bold text-slate-800 focus:outline-none focus:border-primary">
                </td>
                <td class="py-2 px-3">
                    <select id="daily-meal-${i}" class="daily-meal-select w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-700 bg-white focus:outline-none focus:border-primary">
                        ${mealOptionsHtml}
                    </select>
                </td>
                <td class="py-2 px-3 text-center align-middle">
                    ${applyAllBtn}
                </td>
            </tr>
        `;
    }

    tbody.innerHTML = rowsHtml;

    // Set select values for meal plan
    for (let i = 0; i < nights; i++) {
        const stayDateObj = addDays(checkInDateObj, i);
        const stayDateStr = formatDateISO(stayDateObj);
        let selVal = masterMealPlanId;
        if (existingDailyRates && Array.isArray(existingDailyRates)) {
            const found = existingDailyRates.find(dr => dr.stay_date === stayDateStr);
            if (found) selVal = found.meal_plan_id || '';
        } else {
            const el = document.getElementById(`daily-meal-${i}`);
            if (el && el.getAttribute('data-prev-val')) selVal = el.getAttribute('data-prev-val');
        }
        const mealSelect = document.getElementById(`daily-meal-${i}`);
        if (mealSelect) mealSelect.value = selVal;
    }
}

export function applyFirstRowToAllDailyRates() {
    const firstRateInput = document.getElementById('daily-rate-0');
    const firstMealSelect = document.getElementById('daily-meal-0');
    if (!firstRateInput || !firstMealSelect) return;

    const firstRate = firstRateInput.value;
    const firstMeal = firstMealSelect.value;

    const allRateInputs = document.querySelectorAll('.daily-rate-input');
    const allMealSelects = document.querySelectorAll('.daily-meal-select');

    allRateInputs.forEach(input => input.value = firstRate);
    allMealSelects.forEach(select => select.value = firstMeal);

    updateTotalPreview();
}

export function syncMasterRateToGrid() {
    const masterRate = parseFloat(document.getElementById('res-room-rate').value) || 0;
    const allRateInputs = document.querySelectorAll('.daily-rate-input');
    allRateInputs.forEach(input => input.value = masterRate);
    updateTotalPreview();
}

export function syncMasterMealPlanToGrid() {
    const masterMeal = document.getElementById('res-meal-plan').value;
    const allMealSelects = document.querySelectorAll('.daily-meal-select');
    allMealSelects.forEach(select => select.value = masterMeal);
}

export function handleGuestTypeChange() {
    handleRoomTypeChange();
}

export function handleRoomTypeChange() {
    const selectedRoomTypeId = document.getElementById('res-room-type').value;
    const guestTypeVal = document.getElementById('res-guest-type') ? document.getElementById('res-guest-type').value : 'Staying Guest';
    const roomNumberSelect = document.getElementById('res-room-number');

    const roomsCache = (typeof window !== 'undefined' && window.roomsCache) ? window.roomsCache : [];

    if (roomNumberSelect) {
        const currentVal = roomNumberSelect.value;
        let filteredRooms = selectedRoomTypeId ? roomsCache.filter(r => r.room_type_id === selectedRoomTypeId) : roomsCache;

        if (guestTypeVal === 'Non-Staying Guest') {
            // Filter only rooms starting with "PM-" (Paymaster)
            filteredRooms = filteredRooms.filter(r => (r.room_number || '').toUpperCase().startsWith('PM-'));
        }

        let optionsHTML = `<option value="">Belum Dialokasikan</option>`;
        filteredRooms.forEach(r => {
            const upperStatus = (r.status || '').toUpperCase();
            const isOOO = upperStatus === 'OOO' || upperStatus === 'OUT OF ORDER';
            optionsHTML += `<option value="${r.id}" ${isOOO ? 'disabled' : ''}>Kamar ${r.room_number}${isOOO ? ' (OOO)' : ''}</option>`;
        });
        roomNumberSelect.innerHTML = optionsHTML;

        if (currentVal && filteredRooms.some(r => r.id === currentVal)) {
            roomNumberSelect.value = currentVal;
        } else {
            roomNumberSelect.value = '';
        }
    }

    lookupAndSetRoomRate();
}

export function handleRateCodeChange() {
    const selectedRatePlanId = document.getElementById('res-rate-code').value;
    const rPlans = ratePlansCache.length > 0 ? ratePlansCache : ((typeof window !== 'undefined' && window.ratePlansCache) || []);
    const ratePlanObj = rPlans.find(rp => rp.id === selectedRatePlanId);

    if (ratePlanObj) {
        // Auto-set meal plan & segment if defined on rate plan
        if (ratePlanObj.meal_plan_id) {
            const mpSelect = document.getElementById('res-meal-plan');
            if (mpSelect) mpSelect.value = ratePlanObj.meal_plan_id;
        }
        if (ratePlanObj.segment_id) {
            const segSelect = document.getElementById('res-segment');
            if (segSelect) segSelect.value = ratePlanObj.segment_id;
        }
    }

    lookupAndSetRoomRate();
}

export async function lookupAndSetRoomRate() {
    const roomTypeId = document.getElementById('res-room-type').value;
    const ratePlanId = document.getElementById('res-rate-code').value;
    const roomRateInput = document.getElementById('res-room-rate');
    const badgeEl = document.getElementById('rate-override-badge');

    let rateValue = 0;
    let allowOverride = true;

    const rPlans = ratePlansCache.length > 0 ? ratePlansCache : ((typeof window !== 'undefined' && window.ratePlansCache) || []);
    const rTypes = roomTypesCache.length > 0 ? roomTypesCache : ((typeof window !== 'undefined' && window.roomTypesCache) || []);

    const ratePlanObj = rPlans.find(rp => rp.id === ratePlanId);
    if (ratePlanObj) {
        allowOverride = ratePlanObj.allow_override !== false;
    }

    if (roomTypeId && ratePlanId) {
        try {
            const { data, error } = await supabaseClient
                .from('rate_plan_prices')
                .select('price')
                .eq('rate_plan_id', ratePlanId)
                .eq('room_type_id', roomTypeId)
                .maybeSingle();

            if (!error && data && data.price !== null && data.price !== undefined) {
                rateValue = data.price;
            } else {
                // Fallback to room type base_price
                const rtObj = rTypes.find(rt => rt.id === roomTypeId);
                rateValue = rtObj ? (rtObj.base_price || 0) : 0;
            }
        } catch (err) {
            console.error('Error looking up room rate:', err);
        }
    } else if (roomTypeId) {
        const rtObj = rTypes.find(rt => rt.id === roomTypeId);
        rateValue = rtObj ? (rtObj.base_price || 0) : 0;
    }

    if (roomRateInput) {
        roomRateInput.value = rateValue;
        if (!allowOverride && ratePlanId) {
            roomRateInput.readOnly = true;
            roomRateInput.classList.add('bg-slate-100', 'cursor-not-allowed');
            if (badgeEl) {
                badgeEl.textContent = 'Locked Price (Override Disabled)';
                badgeEl.className = 'text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800';
            }
        } else {
            roomRateInput.readOnly = false;
            roomRateInput.classList.remove('bg-slate-100', 'cursor-not-allowed');
            if (badgeEl) {
                badgeEl.textContent = 'Override Allowed';
                badgeEl.className = 'text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800';
            }
        }
    }

    syncMasterRateToGrid();
    updateTotalPreview();
}

export function updateTotalPreview() {
    const qty = parseInt(document.getElementById('res-qty').value, 10) || 1;
    const dailyInputs = document.querySelectorAll('.daily-rate-input');

    let totalRoomRatesSum = 0;
    if (dailyInputs.length > 0) {
        dailyInputs.forEach(input => {
            totalRoomRatesSum += parseFloat(input.value) || 0;
        });
    } else {
        const roomRate = parseFloat(document.getElementById('res-room-rate').value) || 0;
        const nights = parseInt(document.getElementById('res-nights').value, 10) || 1;
        totalRoomRatesSum = roomRate * nights;
    }

    const total = totalRoomRatesSum * qty;
    const totalPreviewDiv = document.getElementById('res-total-preview');
    if (totalPreviewDiv) {
        totalPreviewDiv.textContent = `Rp ${total.toLocaleString('id-ID')}`;
    }
}

export let webcamStream = null;
export let pendingNewReservationDeposits = [];

export async function openWebcamModal() {
    const modal = document.getElementById('webcamModal');
    if (modal) modal.classList.remove('hidden');

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            webcamStream = stream;
            const video = document.getElementById('webcam-video');
            if (video) {
                video.srcObject = stream;
                video.play();
            }
        } catch (err) {
            console.error('Error accessing webcam:', err);
            alert('Gagal mengakses kamera: ' + (err.message || err));
        }
    } else {
        alert('Browser Anda tidak mendukung akses webcam.');
    }
}

export function closeWebcamModal() {
    const modal = document.getElementById('webcamModal');
    if (modal) modal.classList.add('hidden');

    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }
    const video = document.getElementById('webcam-video');
    if (video) {
        video.srcObject = null;
    }
}

export function captureWebcamPhoto() {
    const video = document.getElementById('webcam-video');
    const canvas = document.getElementById('webcam-canvas');
    const preview = document.getElementById('res-doc-preview');

    if (video && canvas && preview) {
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 480;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        preview.src = dataUrl;
        preview.classList.remove('hidden');
    }
    closeWebcamModal();
}

export function handleDocUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
            const preview = document.getElementById('res-doc-preview');
            if (preview) {
                preview.src = evt.target.result;
                preview.classList.remove('hidden');
            }
        };
        reader.readAsDataURL(file);
    }
}

export function clearDocPreview() {
    const preview = document.getElementById('res-doc-preview');
    if (preview) {
        preview.src = '';
        preview.classList.add('hidden');
    }
    const docInput = document.getElementById('res-upload-doc');
    if (docInput) {
        docInput.value = '';
    }
}

export function getCompressedDocBlob() {
    return new Promise((resolve) => {
        const preview = document.getElementById('res-doc-preview');
        if (!preview || preview.classList.contains('hidden') || !preview.src || preview.src === '' || preview.src === window.location.href) {
            resolve(null);
            return;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;

            if (!width || !height) {
                resolve(null);
                return;
            }

            const maxWidth = 800;
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    resolve(blob);
                },
                'image/jpeg',
                0.7
            );
        };
        img.onerror = (err) => {
            console.error('Error loading preview image for compression:', err);
            resolve(null);
        };
        img.src = preview.src;
    });
}

export async function openEditReservation(id) {
    isReactivateMode = false;
    await populateReservationFormDropdowns();
    switchReservationTab('details');
    clearDocPreview();

    try {
        const { data: res, error } = await supabaseClient
            .from('reservations')
            .select('*, guest_profiles(*)')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!res) throw new Error('Data reservasi tidak ditemukan.');

        document.getElementById('edit-reservation-id').value = res.id;
        document.getElementById('edit-reservation-number').value = res.reservation_number || '';

        if (res.document_url) {
            const preview = document.getElementById('res-doc-preview');
            if (preview) {
                preview.src = res.document_url;
                preview.classList.remove('hidden');
            }
        }

        const titleIcon = document.getElementById('reservationModalIcon');
        const titleText = document.getElementById('reservationModalTitleText');
        const subTitle = document.getElementById('reservationModalSubTitle');
        if (titleIcon) titleIcon.className = 'ph ph-pencil-simple-line text-primary text-2xl';
        if (titleText) titleText.textContent = `Edit Reservation (${res.reservation_number || ''})`;
        if (subTitle) subTitle.textContent = 'Lihat atau ubah rincian data reservasi tamu.';

        const updateBtn = document.getElementById('resUpdateBtn');
        if (updateBtn) {
            updateBtn.className = 'px-6 py-2.5 bg-primary hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm flex items-center gap-2';
            updateBtn.innerHTML = `<i class="ph ph-floppy-disk text-lg"></i> Update Data`;
        }

        const guestProfile = res.guest_profiles ? (Array.isArray(res.guest_profiles) ? res.guest_profiles[0] : res.guest_profiles) : null;
        const guestProfileId = res.guest_profile_id || (guestProfile ? guestProfile.id : '');
        const guestName = guestProfile ? (guestProfile.full_name || '') : '';

        document.getElementById('res-guest-profile-id').value = guestProfileId;
        document.getElementById('res-booker-name').value = res.booker_name || '';
        document.getElementById('res-guest-name').value = guestName;
        document.getElementById('res-id-card').value = guestProfile ? (guestProfile.id_card_no || '') : '';
        document.getElementById('res-phone').value = guestProfile ? (guestProfile.phone_number || '') : '';
        document.getElementById('res-email').value = guestProfile ? (guestProfile.email || '') : '';
        document.getElementById('res-birth-date').value = guestProfile ? (guestProfile.birth_date || '') : '';
        document.getElementById('res-address').value = guestProfile ? (guestProfile.address || '') : '';
        document.getElementById('res-city').value = guestProfile ? (guestProfile.city || '') : '';
        document.getElementById('res-nationality').value = guestProfile ? (guestProfile.nationality || 'Indonesia') : 'Indonesia';

        const checkInInput = document.getElementById('res-check-in');
        checkInInput.removeAttribute('min');
        checkInInput.value = res.check_in_date || '';
        document.getElementById('res-check-out').value = res.check_out_date || '';
        document.getElementById('res-nights').value = res.nights || 1;
        document.getElementById('res-eta').value = res.eta ? res.eta.slice(0, 5) : '14:00';
        document.getElementById('res-etd').value = res.etd ? res.etd.slice(0, 5) : '12:00';
        document.getElementById('res-adult').value = res.adult || 1;
        document.getElementById('res-child').value = res.child || 0;

        document.getElementById('res-room-type').value = res.room_type_id || '';
        handleRoomTypeChange();
        document.getElementById('res-room-number').value = res.room_id || '';
        document.getElementById('res-rate-code').value = res.rate_plan_id || '';
        document.getElementById('res-room-rate').value = res.room_rate || 0;
        document.getElementById('res-meal-plan').value = res.meal_plan_id || '';
        document.getElementById('res-segment').value = res.segment_id || '';
        document.getElementById('res-source').value = res.reservation_source || 'Direct';
        document.getElementById('res-voucher').value = res.voucher_number || '';
        document.getElementById('res-corporate-id').value = res.corporate_id || '';
        document.getElementById('res-qty').value = res.qty || 1;
        document.getElementById('res-extrabed').value = res.extrabed_qty || 0;

        document.getElementById('res-comment').value = res.comment || '';

        let dailyRates = null;
        try {
            const { data: drData, error: drErr } = await supabaseClient
                .from('reservation_daily_rates')
                .select('*')
                .eq('reservation_id', res.id)
                .order('stay_date', { ascending: true });

            if (!drErr && drData && drData.length > 0) {
                dailyRates = drData;
            }
        } catch (err) {
            console.error('Error fetching reservation_daily_rates:', err);
        }

        renderDailyBreakdownGrid(dailyRates);
        updateTotalPreview();

        fetchAndRenderReservationDepositHistory(res.id);

        const currentStatus = res.status || 'Reserved';
        const statusBadge = document.getElementById('res-status-badge');
        const statusText = document.getElementById('res-status-text');
        if (statusText) statusText.textContent = `Status: ${currentStatus}`;

        if (currentStatus === 'Reserved') {
            if (statusBadge) statusBadge.className = 'flex items-center gap-1.5 bg-emerald-100 text-emerald-800 text-xs px-3 py-1 rounded-full font-bold';
        } else if (currentStatus === 'Checkin') {
            if (statusBadge) statusBadge.className = 'flex items-center gap-1.5 bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full font-bold';
        } else if (currentStatus === 'Cancelled') {
            if (statusBadge) statusBadge.className = 'flex items-center gap-1.5 bg-red-100 text-red-800 text-xs px-3 py-1 rounded-full font-bold';
        } else {
            if (statusBadge) statusBadge.className = 'flex items-center gap-1.5 bg-slate-100 text-slate-800 text-xs px-3 py-1 rounded-full font-bold';
        }

        const createFooter = document.getElementById('resModalCreateFooter');
        const editFooter = document.getElementById('resModalEditFooter');
        if (createFooter) createFooter.classList.add('hidden');
        if (editFooter) editFooter.classList.remove('hidden');

        const checkInBtn = document.getElementById('resCheckInBtn');
        const cancelBookingBtn = document.getElementById('resCancelBookingBtn');
        const openFolioBtn = document.getElementById('resOpenFolioBtn');

        if (currentStatus === 'Reserved') {
            if (checkInBtn) checkInBtn.classList.remove('hidden');
            if (cancelBookingBtn) cancelBookingBtn.classList.remove('hidden');
            if (openFolioBtn) openFolioBtn.classList.add('hidden');
        } else {
            if (checkInBtn) checkInBtn.classList.add('hidden');
            if (cancelBookingBtn) cancelBookingBtn.classList.add('hidden');
            if (openFolioBtn) openFolioBtn.classList.remove('hidden');
        }

        const modal = document.getElementById('reservationModal');
        if (modal) modal.classList.remove('hidden');

    } catch (err) {
        console.error('Error opening edit reservation modal:', err);
        alert('Gagal memuat reservasi: ' + err.message);
    }
}

export function toggleAddDepositForm(show) {
    const formContainer = document.getElementById('res-add-deposit-form');
    if (!formContainer) return;

    if (show === undefined) {
        formContainer.classList.toggle('hidden');
    } else if (show) {
        formContainer.classList.remove('hidden');
    } else {
        formContainer.classList.add('hidden');
    }

    if (!formContainer.classList.contains('hidden')) {
        const amtInput = document.getElementById('res-new-deposit-amount');
        if (amtInput) amtInput.value = '';
        const pmSelect = document.getElementById('res-new-deposit-method');
        if (pmSelect) pmSelect.value = '';
    }
}

export async function fetchAndRenderReservationDepositHistory(reservationId) {
    const tbody = document.getElementById('res-deposit-history-tbody');
    const totalText = document.getElementById('res-deposit-total-text');
    if (!tbody) return;

    if (!reservationId) {
        renderReservationDepositHistory([]);
        return;
    }

    tbody.innerHTML = `<tr><td colspan="3" class="p-3 text-center text-slate-400">Loading deposit history...</td></tr>`;

    try {
        const { data, error } = await supabaseClient
            .from('folio_transactions')
            .select('*, payment_methods:payment_method_id(id, name, type, method_type)')
            .eq('reservation_id', reservationId)
            .eq('transaction_type', 'PAYMENT')
            .order('transaction_date', { ascending: true });

        if (error) throw error;

        renderReservationDepositHistory(data || []);
    } catch (err) {
        console.error('Error fetching deposit history:', err);
        tbody.innerHTML = `<tr><td colspan="3" class="p-3 text-center text-red-500">Gagal memuat history deposit: ${err.message}</td></tr>`;
        if (totalText) totalText.textContent = 'Rp 0';
    }
}

export function renderReservationDepositHistory(deposits) {
    const tbody = document.getElementById('res-deposit-history-tbody');
    const totalText = document.getElementById('res-deposit-total-text');
    if (!tbody) return;

    let total = 0;

    if (!deposits || deposits.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-3 text-center text-slate-400">Belum ada deposit recorded.</td></tr>`;
    } else {
        tbody.innerHTML = deposits.map(d => {
            const isVoided = d.is_voided === true;
            const amt = Number(d.amount || 0);
            if (!isVoided) total += amt;

            const dateStr = d.transaction_date ? new Date(d.transaction_date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

            let pmName = '';
            let pmType = '';
            if (d.payment_methods) {
                const pmObj = Array.isArray(d.payment_methods) ? d.payment_methods[0] : d.payment_methods;
                if (pmObj) {
                    pmName = pmObj.name || '';
                    pmType = pmObj.type || pmObj.method_type || '';
                }
            }

            let methodDisplay = '';
            if (pmName && pmType) {
                methodDisplay = `${pmName} (${pmType})`;
            } else if (pmName) {
                methodDisplay = pmName;
            } else if (d.reference_number) {
                methodDisplay = d.reference_number;
            } else {
                methodDisplay = 'Deposit';
            }

            const strikeClass = isVoided ? 'line-through text-slate-400' : '';
            const voidBadge = isVoided ? '<span class="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-600 text-white">[VOID]</span>' : '';

            return `
                <tr class="hover:bg-slate-50 border-b border-slate-100 last:border-none">
                    <td class="p-2.5 text-slate-600 whitespace-nowrap ${strikeClass}">${dateStr}</td>
                    <td class="p-2.5 font-medium text-slate-800 ${strikeClass}">${methodDisplay} ${voidBadge}</td>
                    <td class="p-2.5 text-right font-semibold ${isVoided ? 'text-slate-400 line-through' : 'text-emerald-600'}">Rp ${amt.toLocaleString('id-ID')}</td>
                </tr>
            `;
        }).join('');
    }

    if (totalText) {
        totalText.textContent = `Rp ${total.toLocaleString('id-ID')}`;
    }
}

export async function handleAddDepositSubmit() {
    const editId = document.getElementById('edit-reservation-id').value;

    const amountInput = document.getElementById('res-new-deposit-amount');
    const pmSelect = document.getElementById('res-new-deposit-method');

    const amount = parseFloat(amountInput ? amountInput.value : 0) || 0;
    const paymentMethodId = pmSelect ? pmSelect.value : null;

    if (isNaN(amount) || amount <= 0) {
        alert('Nominal deposit harus lebih besar dari 0.');
        return;
    }

    if (!paymentMethodId) {
        alert('Pilih Metode Pembayaran terlebih dahulu.');
        return;
    }

    const txPayload = {
        reservation_id: editId || null,
        transaction_type: 'PAYMENT',
        description: 'Deposit',
        amount: amount,
        payment_method_id: paymentMethodId,
        transaction_date: new Date().toISOString()
    };

    try {
        if (editId) {
            const { error } = await supabaseClient
                .from('folio_transactions')
                .insert([txPayload]);

            if (error) throw error;

            alert('Deposit berhasil ditambahkan!');
            toggleAddDepositForm(false);
            await fetchAndRenderReservationDepositHistory(editId);
        } else {
            const selectedOption = pmSelect.options[pmSelect.selectedIndex];
            const pmLabel = selectedOption ? selectedOption.text : 'Deposit';

            pendingNewReservationDeposits.push({
                amount: amount,
                payment_method_id: paymentMethodId,
                transaction_date: txPayload.transaction_date,
                payment_methods: { name: pmLabel.split(' - ')[0], type: pmLabel.split(' - ')[1] || '' }
            });

            toggleAddDepositForm(false);
            renderReservationDepositHistory(pendingNewReservationDeposits);
        }
    } catch (err) {
        console.error('Error adding deposit:', err);
        alert('Gagal menambahkan deposit: ' + err.message);
    }
}

export function closeModal() {
    const modal = document.getElementById('reservationModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    document.getElementById('edit-reservation-id').value = '';
    const form = document.getElementById('reservationForm');
    if (form) {
        form.reset();
    }
    pendingNewReservationDeposits = [];
    toggleAddDepositForm(false);
    renderReservationDepositHistory([]);

    clearSelectedGuest();
    clearDocPreview();
    closeWebcamModal();
}

export async function handleCheckInReservation() {
    const resId = document.getElementById('edit-reservation-id').value;
    if (!resId) return;

    const checkInBtn = document.getElementById('resCheckInBtn');
    if (checkInBtn) {
        checkInBtn.disabled = true;
        checkInBtn.innerHTML = `<i class="ph ph-spinner animate-spin text-lg"></i> Processing...`;
    }

    try {
        const { data: res, error: resErr } = await supabaseClient
            .from('reservations')
            .select('room_id')
            .eq('id', resId)
            .single();

        if (resErr) throw resErr;

        const roomId = res ? res.room_id : null;
        if (!roomId) throw new Error('Kamar belum dipilih untuk reservasi ini.');

        const { data: roomData, error: roomErr } = await supabaseClient
            .from('rooms')
            .select('status')
            .eq('id', roomId)
            .single();

        if (roomErr) throw roomErr;

        const currentRoomStatus = (roomData?.status || '').toUpperCase();
        if (currentRoomStatus !== 'VC') {
            alert('Check-in ditolak: Kamar belum dibersihkan. Status kamar harus VC (Vacant Clean).');
            return;
        }

        const { error } = await supabaseClient
            .from('reservations')
            .update({ status: 'Checkin' })
            .eq('id', resId);

        if (error) throw error;

        const { error: updateRoomErr } = await supabaseClient
            .from('rooms')
            .update({ status: 'OC' })
            .eq('id', roomId);

        if (updateRoomErr) console.error('Error updating room status to OC:', updateRoomErr);

        if (typeof window.fetchRooms === 'function') window.fetchRooms();

        alert('Berhasil check-in reservasi!');
        closeModal();
        if (typeof window.fetchFrontdeskDashboard === 'function') window.fetchFrontdeskDashboard();
        if (typeof window.renderTapeChart === 'function') window.renderTapeChart();
    } catch (err) {
        console.error('Error during check-in:', err);
        alert('Gagal melakukan check-in: ' + err.message);
    } finally {
        if (checkInBtn) {
            checkInBtn.disabled = false;
            checkInBtn.innerHTML = `<i class="ph ph-check-circle text-lg"></i> Check-in`;
        }
    }
}

export async function handlePrintRegistrationCard() {
    const editResId = document.getElementById('edit-reservation-id')?.value;
    if (!editResId) {
        alert('Tidak ada reservasi aktif yang dipilih.');
        return;
    }

    try {
        const { data: res, error: resErr } = await supabaseClient
            .from('reservations')
            .select('*, guest_profiles(*), room_types(name), rooms(room_number)')
            .eq('id', editResId)
            .single();

        if (resErr) throw resErr;
        if (!res) throw new Error('Data reservasi tidak ditemukan.');

        let rcTerms = '';
        try {
            const { data: invData, error: invErr } = await supabaseClient
                .from('invoice_settings')
                .select('rc_terms')
                .limit(1);

            if (!invErr && invData && invData.length > 0) {
                rcTerms = invData[0].rc_terms || '';
            }
        } catch (tErr) {
            console.error('Error fetching rc_terms from invoice_settings:', tErr);
        }

        const guestProfile = res.guest_profiles ? (Array.isArray(res.guest_profiles) ? res.guest_profiles[0] : res.guest_profiles) : null;
        const guestName = guestProfile ? (guestProfile.full_name || '-') : (res.booker_name || '-');
        const phone = guestProfile ? (guestProfile.phone_number || '-') : '-';
        const email = guestProfile ? (guestProfile.email || '-') : '-';
        const idCard = guestProfile ? (guestProfile.id_card_no || '-') : '-';
        const address = guestProfile ? (guestProfile.address || '-') : '-';
        const city = guestProfile ? (guestProfile.city || '-') : '-';
        const nationality = guestProfile ? (guestProfile.nationality || 'Indonesia') : 'Indonesia';

        const roomTypeName = res.room_types ? (Array.isArray(res.room_types) ? res.room_types[0]?.name : res.room_types.name) : '-';
        const roomNumber = res.rooms ? (Array.isArray(res.rooms) ? res.rooms[0]?.room_number : res.rooms.room_number) : '-';
        const checkIn = res.check_in_date || '-';
        const checkOut = res.check_out_date || '-';
        const nights = res.nights || 1;
        const adult = res.adult || 1;
        const child = res.child || 0;
        const roomRate = res.room_rate ? `Rp ${Number(res.room_rate).toLocaleString('id-ID')}` : 'Rp 0';
        const specialRequest = res.comment || '-';
        const resNo = res.reservation_number || '-';

        const printWindow = window.open('', '_blank', 'width=850,height=900');
        if (!printWindow) {
            alert('Pop-up terblokir. Izinkan pop-up browser untuk mencetak Registration Card.');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Registration Card - ${guestName}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 24px; color: #1e293b; background: #fff; line-height: 1.5; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
                    .header h1 { margin: 0; font-size: 22px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
                    .header p { margin: 4px 0 0 0; color: #64748b; font-size: 13px; font-weight: 600; }
                    .res-no-box { text-align: right; background: #f1f5f9; padding: 8px 14px; border-radius: 6px; border: 1px solid #cbd5e1; }
                    .res-no-box label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; }
                    .res-no-box span { font-family: monospace; font-size: 16px; font-weight: 700; color: #0f172a; }

                    .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 10px; margin-top: 16px; }

                    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                    .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; }

                    .info-group { background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
                    .info-group label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 2px; }
                    .info-group span { font-size: 13px; font-weight: 600; color: #1e293b; word-break: break-word; }

                    .terms-box { margin-top: 20px; background: #f8fafc; padding: 12px 16px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 11px; color: #475569; }
                    .terms-box h4 { margin: 0 0 6px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #334155; }
                    .terms-content { white-space: pre-wrap; line-height: 1.4; }

                    .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 12px; }
                    .sig-box { text-align: center; width: 40%; }
                    .sig-line { border-bottom: 1px solid #0f172a; margin-top: 60px; margin-bottom: 6px; }
                    .sig-label { font-size: 11px; font-weight: 600; color: #475569; }

                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h1>Registration Card</h1>
                        <p>Hotel Guest Registration & Stay Information</p>
                    </div>
                    <div class="res-no-box">
                        <label>Reservation No</label>
                        <span>${resNo}</span>
                    </div>
                </div>

                <div class="section-title">Guest Information</div>
                <div class="grid-2">
                    <div class="info-group"><label>Guest Name</label><span>${guestName}</span></div>
                    <div class="info-group"><label>ID Card / Passport No</label><span>${idCard}</span></div>
                    <div class="info-group"><label>Phone Number</label><span>${phone}</span></div>
                    <div class="info-group"><label>Email Address</label><span>${email}</span></div>
                    <div class="info-group"><label>Address</label><span>${address}, ${city}</span></div>
                    <div class="info-group"><label>Nationality</label><span>${nationality}</span></div>
                </div>

                <div class="section-title">Stay & Room Details</div>
                <div class="grid-4">
                    <div class="info-group"><label>Room Type</label><span>${roomTypeName}</span></div>
                    <div class="info-group"><label>Room Number</label><span>${roomNumber}</span></div>
                    <div class="info-group"><label>Check-In Date</label><span>${checkIn}</span></div>
                    <div class="info-group"><label>Check-Out Date</label><span>${checkOut}</span></div>
                    <div class="info-group"><label>Nights</label><span>${nights} night(s)</span></div>
                    <div class="info-group"><label>Guests (Adult / Child)</label><span>${adult} Adult(s) / ${child} Child</span></div>
                    <div class="info-group"><label>Room Rate / Night</label><span>${roomRate}</span></div>
                    <div class="info-group"><label>Special Request</label><span>${specialRequest}</span></div>
                </div>

                ${rcTerms ? `
                <div class="terms-box">
                    <h4>Terms & Conditions</h4>
                    <div class="terms-content">${rcTerms}</div>
                </div>
                ` : ''}

                <div class="signatures">
                    <div class="sig-box">
                        <div class="sig-line"></div>
                        <div class="sig-label">Guest Signature</div>
                    </div>
                    <div class="sig-box">
                        <div class="sig-line"></div>
                        <div class="sig-label">Receptionist / Front Desk</div>
                    </div>
                </div>

                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    } catch (err) {
        console.error('Error printing Registration Card:', err);
        alert('Gagal mencetak Registration Card: ' + err.message);
    }
}

export async function handleCheckIn(reservationId, roomId) {
    if (!reservationId) return;
    try {
        let targetRoomId = roomId;

        if (!targetRoomId) {
            const { data: res, error: resErr } = await supabaseClient
                .from('reservations')
                .select('room_id')
                .eq('id', reservationId)
                .single();

            if (resErr) throw resErr;
            targetRoomId = res?.room_id;
        }

        if (!targetRoomId) throw new Error('Kamar belum dipilih untuk reservasi ini.');

        const { data: roomData, error: roomErr } = await supabaseClient
            .from('rooms')
            .select('status')
            .eq('id', targetRoomId)
            .single();

        if (roomErr) throw roomErr;

        const currentRoomStatus = (roomData?.status || '').toUpperCase();
        if (currentRoomStatus !== 'VC') {
            alert('Check-in ditolak: Kamar belum dibersihkan. Status kamar harus VC (Vacant Clean).');
            return;
        }

        const { error } = await supabaseClient
            .from('reservations')
            .update({ status: 'Checkin' })
            .eq('id', reservationId);

        if (error) throw error;

        const { error: updateRoomErr } = await supabaseClient
            .from('rooms')
            .update({ status: 'OC' })
            .eq('id', targetRoomId);

        if (updateRoomErr) console.error('Error updating room status to OC:', updateRoomErr);

        if (typeof window.fetchRooms === 'function') window.fetchRooms();

        alert('Berhasil check-in reservasi!');
        closeModal();
        if (typeof window.fetchFrontdeskDashboard === 'function') window.fetchFrontdeskDashboard();
        if (typeof window.renderTapeChart === 'function') window.renderTapeChart();
    } catch (err) {
        console.error('Error during check-in:', err);
        alert('Gagal melakukan check-in: ' + err.message);
    }
}

export async function handleSaveReservation(event) {
    event.preventDefault();

    const editId = document.getElementById('edit-reservation-id').value;
    const submitBtn = editId ? document.getElementById('resUpdateBtn') : document.getElementById('resSubmitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="ph ph-spinner animate-spin text-lg"></i> ${editId ? 'Updating...' : 'Saving...'}`;
    }

    try {
        let guestProfileId = document.getElementById('res-guest-profile-id').value;
        const bookerNameVal = document.getElementById('res-booker-name').value.trim();
        const guestNameVal = document.getElementById('res-guest-name').value.trim();
        const idCardVal = document.getElementById('res-id-card').value.trim();
        const phoneVal = document.getElementById('res-phone').value.trim();
        const emailVal = document.getElementById('res-email').value.trim();
        const birthDateVal = document.getElementById('res-birth-date').value || null;
        const addressVal = document.getElementById('res-address').value.trim();
        const cityVal = document.getElementById('res-city').value.trim();
        const nationalityVal = document.getElementById('res-nationality').value.trim();

        if (!guestNameVal) {
            alert('Harap isi nama tamu.');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="ph ph-floppy-disk text-lg"></i> ${editId ? 'Update Data' : 'Save Reservation'}`;
            }
            return;
        }

        if (!guestProfileId) {
            const { data: newGuest, error: guestErr } = await supabaseClient
                .from('guest_profiles')
                .insert([{
                    full_name: guestNameVal,
                    id_card_no: idCardVal || null,
                    phone_number: phoneVal || null,
                    email: emailVal || null,
                    birth_date: birthDateVal,
                    address: addressVal || null,
                    city: cityVal || null,
                    nationality: nationalityVal || 'Indonesia'
                }])
                .select()
                .single();

            if (guestErr) throw guestErr;
            guestProfileId = newGuest.id;
        } else {
            await supabaseClient
                .from('guest_profiles')
                .update({
                    full_name: guestNameVal,
                    id_card_no: idCardVal || null,
                    phone_number: phoneVal || null,
                    email: emailVal || null,
                    birth_date: birthDateVal,
                    address: addressVal || null,
                    city: cityVal || null,
                    nationality: nationalityVal || 'Indonesia'
                })
                .eq('id', guestProfileId);
        }

        const checkInDate = document.getElementById('res-check-in').value;
        const checkOutDate = document.getElementById('res-check-out').value;
        const nights = parseInt(document.getElementById('res-nights').value) || 1;
        const eta = document.getElementById('res-eta').value || '14:00';
        const etd = document.getElementById('res-etd').value || '12:00';
        const adult = parseInt(document.getElementById('res-adult').value) || 1;
        const child = parseInt(document.getElementById('res-child').value) || 0;

        const guestType = document.getElementById('res-guest-type') ? document.getElementById('res-guest-type').value : 'Staying Guest';
        const roomTypeId = document.getElementById('res-room-type').value || null;
        const roomId = document.getElementById('res-room-number').value || null;
        const ratePlanId = document.getElementById('res-rate-code').value || null;
        const roomRate = parseFloat(document.getElementById('res-room-rate').value) || 0;
        const mealPlanId = document.getElementById('res-meal-plan').value || null;
        const segmentId = document.getElementById('res-segment').value || null;
        const reservationSource = document.getElementById('res-source').value || 'Direct';
        const voucherNumber = document.getElementById('res-voucher').value.trim() || null;
        const corporateId = document.getElementById('res-corporate-id').value || null;
        const qty = parseInt(document.getElementById('res-qty').value) || 1;
        const extrabedQty = parseInt(document.getElementById('res-extrabed').value) || 0;

        const comment = document.getElementById('res-comment').value.trim() || null;

        const reservationPayload = {
            guest_profile_id: guestProfileId,
            booker_name: bookerNameVal || null,
            guest_type: guestType,
            check_in_date: checkInDate,
            check_out_date: checkOutDate,
            nights: nights,
            eta: eta,
            etd: etd,
            adult: adult,
            child: child,
            room_type_id: roomTypeId,
            room_id: roomId,
            rate_plan_id: ratePlanId,
            room_rate: roomRate,
            qty: qty,
            extrabed_qty: extrabedQty,
            meal_plan_id: mealPlanId,
            segment_id: segmentId,
            reservation_source: reservationSource,
            voucher_number: voucherNumber,
            corporate_id: corporateId,
            comment: comment
        };

        let resNumber = editId ? (document.getElementById('edit-reservation-number').value || '') : '';
        if (!editId) {
            const randomNum = Math.floor(1000 + Math.random() * 9000);
            resNumber = `RES-${Date.now().toString().slice(-6)}-${randomNum}`;
            reservationPayload.reservation_number = resNumber;
            reservationPayload.status = 'Reserved';
        }

        const docPreview = document.getElementById('res-doc-preview');
        const hasDocPreview = docPreview && !docPreview.classList.contains('hidden') && docPreview.src && docPreview.src !== '' && docPreview.src !== window.location.href;

        if (hasDocPreview) {
            if (docPreview.src.startsWith('data:')) {
                const hotelNameRaw = (document.getElementById('active-property-name')?.textContent || 'Hotel').trim();
                const hotelName = hotelNameRaw.replace(/\s+/g, '_');
                const resNumStr = (resNumber || 'RES').replace(/\s+/g, '_');
                const guestNameStr = (guestNameVal || 'Guest').replace(/\s+/g, '_');
                const fileName = `${hotelName}_${resNumStr}_${guestNameStr}_ID.jpg`;

                const compressedBlob = await getCompressedDocBlob();
                if (compressedBlob) {
                    const { data: uploadData, error: uploadErr } = await supabaseClient
                        .storage
                        .from('guest_documents')
                        .upload(fileName, compressedBlob, {
                            contentType: 'image/jpeg',
                            upsert: true
                        });

                    if (uploadErr) {
                        console.error('Error uploading guest document to Supabase Storage:', uploadErr);
                    } else {
                        const { data: publicUrlData } = supabaseClient
                            .storage
                            .from('guest_documents')
                            .getPublicUrl(fileName);

                        if (publicUrlData && publicUrlData.publicUrl) {
                            reservationPayload.document_url = publicUrlData.publicUrl;
                        }
                    }
                }
            } else if (docPreview.src.startsWith('http')) {
                reservationPayload.document_url = docPreview.src;
            }
        } else {
            reservationPayload.document_url = null;
        }

        let savedReservationId = editId;

        if (editId) {
            if (isReactivateMode) {
                reservationPayload.status = 'Reserved';
            }

            const { error: updateResErr } = await supabaseClient
                .from('reservations')
                .update(reservationPayload)
                .eq('id', editId);

            if (updateResErr) throw updateResErr;

            if (isReactivateMode) {
                alert('Reservasi berhasil di-reactivate (status menjadi Reserved)!');
            } else {
                alert('Data reservasi berhasil diperbarui!');
            }
        } else {
            if (!reservationPayload.reservation_number) {
                const randomNum = Math.floor(1000 + Math.random() * 9000);
                reservationPayload.reservation_number = `RES-${Date.now().toString().slice(-6)}-${randomNum}`;
            }
            if (!reservationPayload.status) {
                reservationPayload.status = 'Reserved';
            }

            const { data: newResData, error: insertResErr } = await supabaseClient
                .from('reservations')
                .insert([reservationPayload])
                .select();

            if (insertResErr) throw insertResErr;

            if (newResData && newResData.length > 0) {
                savedReservationId = newResData[0].id;
            }

            if (savedReservationId && pendingNewReservationDeposits && pendingNewReservationDeposits.length > 0) {
                const txPayloads = pendingNewReservationDeposits.map(d => ({
                    reservation_id: savedReservationId,
                    transaction_type: 'PAYMENT',
                    description: 'Deposit',
                    amount: d.amount,
                    payment_method_id: d.payment_method_id,
                    transaction_date: d.transaction_date || new Date().toISOString()
                }));

                const { error: depositTxErr } = await supabaseClient
                    .from('folio_transactions')
                    .insert(txPayloads);

                if (depositTxErr) {
                    console.error('Error auto-posting pending deposits to folio_transactions:', depositTxErr);
                }
            }
        }

        if (savedReservationId) {
            const rows = document.querySelectorAll('#daily-breakdown-tbody tr');
            const dailyRatesPayload = [];

            rows.forEach(row => {
                const stayDateInput = row.querySelector('.daily-stay-date');
                const rateInput = row.querySelector('.daily-rate-input');
                const mealSelect = row.querySelector('.daily-meal-select');

                if (stayDateInput && rateInput) {
                    const sDate = stayDateInput.value;
                    const rRate = parseFloat(rateInput.value) || 0;
                    const mPlanId = mealSelect ? (mealSelect.value || null) : null;

                    dailyRatesPayload.push({
                        reservation_id: savedReservationId,
                        stay_date: sDate,
                        room_rate: rRate,
                        meal_plan_id: mPlanId
                    });
                }
            });

            if (dailyRatesPayload.length > 0) {
                if (editId) {
                    await supabaseClient
                        .from('reservation_daily_rates')
                        .delete()
                        .eq('reservation_id', savedReservationId);
                }

                const { error: dailyInsertErr } = await supabaseClient
                    .from('reservation_daily_rates')
                    .insert(dailyRatesPayload);

                if (dailyInsertErr) {
                    console.error('Error saving reservation_daily_rates:', dailyInsertErr);
                }
            }
        }

        const folioRoutingRulesState = window.folioRoutingRulesState || [];
        if (savedReservationId && folioRoutingRulesState && folioRoutingRulesState.length > 0) {
            try {
                await supabaseClient
                    .from('folio_routing_rules')
                    .delete()
                    .eq('source_reservation_id', savedReservationId);

                const insertPayload = folioRoutingRulesState.map(rule => ({
                    source_reservation_id: savedReservationId,
                    route_type: rule.route_type,
                    category_name: rule.category_name,
                    article_id: rule.article_id
                }));

                await supabaseClient
                    .from('folio_routing_rules')
                    .insert(insertPayload);
            } catch (rErr) {
                console.error('Error auto-saving routing rules:', rErr);
            }
        }

        closeModal();
        if (typeof window.fetchRooms === 'function') window.fetchRooms();
        if (typeof window.fetchFrontdeskDashboard === 'function') window.fetchFrontdeskDashboard();
        if (typeof window.renderTapeChart === 'function') window.renderTapeChart();
        if (typeof window.fetchCancelList === 'function') window.fetchCancelList();

    } catch (err) {
        console.error('Error saving reservation:', err);
        alert('Gagal menyimpan reservasi: ' + err.message);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="ph ph-floppy-disk text-lg"></i> ${editId ? 'Update Data' : 'Save Reservation'}`;
        }
    }
}
