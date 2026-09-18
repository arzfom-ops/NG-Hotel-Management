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
