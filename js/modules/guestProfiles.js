import { supabaseClient } from '../config/supabase.js';
import { searchGuestCards, getGuestCardById, saveGuestCard } from '../services/guestService.js';
import { roomTypesCache } from './reservation.js';
import { fetchRoomTypes } from './settings.js';

/**
 * Guest Card File (GCF) Master Module
 * Manages guest profiles, company/travel agent accounts, contact persons, contract rates, profile merging, and stay history.
 */

export let currentGcfTab = 'All'; // 'All', 'Individual', 'Company', 'TravelAgent'
export let gcfSearchQuery = '';
export let editingGcfId = null;
export let activeGcfModalTab = 'basic'; // 'basic', 'contacts', 'rates'
export let gcfContactsState = [];
export let gcfContractRatesState = [];

// Merge state
export let mergeSourceId = null;
export let mergeTargetId = null;

/**
 * Helper to show toast notification
 */
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    const bgColor = type === 'error' ? 'bg-red-600' : 'bg-emerald-600';
    toast.className = `fixed bottom-5 right-5 ${bgColor} text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold z-[100] transition-opacity duration-300 flex items-center gap-2`;
    toast.innerHTML = `<i class="ph ${type === 'error' ? 'ph-warning-circle' : 'ph-check-circle'} text-lg"></i> <span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Format currency IDR
 */
function formatIDR(amount) {
    const val = parseFloat(amount || 0);
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
}

/**
 * 1. renderGuestProfilesTable
 * Fetches and renders guest profiles in the GCF Master table according to tab filter and search query.
 */
export async function renderGuestProfilesTable() {
    const tbody = document.getElementById('gcf-table-body');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="py-8 text-center text-slate-500 font-medium">
                <i class="ph ph-spinner animate-spin text-2xl text-primary mb-2 block mx-auto"></i>
                Memuat data Guest Card Files...
            </td>
        </tr>
    `;

    try {
        let cardTypeFilter = null;
        if (currentGcfTab === 'Individual') cardTypeFilter = 'Individual';
        else if (currentGcfTab === 'Company') cardTypeFilter = 'Company';
        else if (currentGcfTab === 'TravelAgent') cardTypeFilter = 'Travel Agent';

        // Fetch using searchGuestCards service
        let profiles = await searchGuestCards(gcfSearchQuery, cardTypeFilter);

        // Additional fallback filtering if cardTypeFilter in search searchGuestCards was loose
        if (currentGcfTab !== 'All') {
            profiles = profiles.filter(p => {
                const cType = (p.card_type || '').toLowerCase();
                if (currentGcfTab === 'Individual') return cType === 'individual';
                if (currentGcfTab === 'Company') return cType === 'company';
                if (currentGcfTab === 'TravelAgent') return cType.includes('travel') || cType.includes('agent') || cType === 'travelagent';
                return true;
            });
        }

        if (!profiles || profiles.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="py-12 text-center text-slate-400 font-medium">
                        <i class="ph ph-address-book text-4xl mb-2 text-slate-300 block mx-auto"></i>
                        Tidak ada data profil tamu yang ditemukan.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = profiles.map(profile => {
            const id = profile.id;
            const cardType = profile.card_type || 'Individual';

            // Badge formatting
            let badgeClass = 'bg-blue-100 text-blue-700 border-blue-200';
            let iconClass = 'ph-user';
            if (cardType === 'Company') {
                badgeClass = 'bg-teal-100 text-teal-700 border-teal-200';
                iconClass = 'ph-buildings';
            } else if (cardType.toLowerCase().includes('travel') || cardType === 'TravelAgent') {
                badgeClass = 'bg-indigo-100 text-indigo-700 border-indigo-200';
                iconClass = 'ph-airplane-tilt';
            }

            const name = profile.full_name || profile.name || profile.company_name || '-';
            const phone = profile.phone || profile.mobile_no || profile.phone_number || '-';
            const email = profile.email || '-';
            const idCard = profile.id_card_no || profile.id_card || '-';
            const creditLimit = profile.credit_limit ? formatIDR(profile.credit_limit) : 'Rp 0';
            const discount = (profile.discount_pct || profile.special_discount || profile.discount || 0) + '%';

            return `
                <tr class="hover:bg-white/60 transition-colors border-b border-white/60 text-slate-700 text-sm">
                    <td class="py-3.5 px-4 font-semibold">
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${badgeClass}">
                            <i class="ph ${iconClass}"></i>
                            ${cardType}
                        </span>
                    </td>
                    <td class="py-3.5 px-4">
                        <div class="font-bold text-slate-800">${name}</div>
                        ${profile.address ? `<div class="text-xs text-slate-400 truncate max-w-xs">${profile.address}</div>` : ''}
                    </td>
                    <td class="py-3.5 px-4">
                        <div class="font-medium text-slate-700">${phone}</div>
                        <div class="text-xs text-slate-400">${email}</div>
                    </td>
                    <td class="py-3.5 px-4 font-mono text-xs text-slate-600">
                        ${idCard}
                    </td>
                    <td class="py-3.5 px-4 font-semibold text-slate-700">
                        ${creditLimit}
                    </td>
                    <td class="py-3.5 px-4 font-semibold text-emerald-600">
                        ${discount}
                    </td>
                    <td class="py-3.5 px-4 text-center">
                        <div class="flex items-center justify-center gap-1.5">
                            <button onclick="window.openGcfEditorModal('${id}')" title="Edit Profil" class="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 transition-colors">
                                <i class="ph ph-note-pencil text-base"></i>
                            </button>
                            <button onclick="window.viewGcfHistory('${id}')" title="Riwayat Reservasi" class="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 transition-colors">
                                <i class="ph ph-clock-counter-clockwise text-base"></i>
                            </button>
                            <button onclick="window.deleteGcfProfile('${id}')" title="Hapus Profil" class="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 transition-colors">
                                <i class="ph ph-trash text-base"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error('Error rendering GCF table:', err);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="py-8 text-center text-red-500 font-medium">
                    Gagal memuat data: ${err.message || err}
                </td>
            </tr>
        `;
    }
}

/**
 * 2. setGcfTab
 * Switch active category tab (All, Individual, Company, TravelAgent)
 */
export function setGcfTab(tab) {
    currentGcfTab = tab;

    const btnAll = document.getElementById('gcf-tab-all');
    const btnInd = document.getElementById('gcf-tab-individual');
    const btnComp = document.getElementById('gcf-tab-company');
    const btnTa = document.getElementById('gcf-tab-ta');

    const activeClass = 'px-4 py-2 text-sm font-bold rounded-lg bg-white text-primary shadow-sm transition-all';
    const inactiveClass = 'px-4 py-2 text-sm font-medium rounded-lg text-slate-600 hover:text-slate-900 transition-all';

    if (btnAll) btnAll.className = tab === 'All' ? activeClass : inactiveClass;
    if (btnInd) btnInd.className = tab === 'Individual' ? activeClass : inactiveClass;
    if (btnComp) btnComp.className = tab === 'Company' ? activeClass : inactiveClass;
    if (btnTa) btnTa.className = tab === 'TravelAgent' ? activeClass : inactiveClass;

    renderGuestProfilesTable();
}

/**
 * 3. handleGcfTableSearch
 */
export function handleGcfTableSearch(query) {
    gcfSearchQuery = query || '';
    renderGuestProfilesTable();
}

/**
 * 4. openGcfEditorModal
 * Opens editor modal for creating or editing GCF profile.
 */
export async function openGcfEditorModal(guestId = null) {
    editingGcfId = guestId || null;
    activeGcfModalTab = 'basic';
    gcfContactsState = [];
    gcfContractRatesState = [];

    const modal = document.getElementById('modal-gcf-editor');
    const titleEl = document.getElementById('gcf-modal-title');
    const form = document.getElementById('gcf-editor-form');

    if (form) form.reset();

    if (titleEl) {
        titleEl.textContent = editingGcfId ? 'Edit Guest Card Profile (GCF)' : 'Add New Guest Card Profile (GCF)';
    }

    if (editingGcfId) {
        try {
            const profile = await getGuestCardById(editingGcfId);
            if (profile) {
                const cardTypeSelect = document.getElementById('gcf-card-type');
                if (cardTypeSelect) {
                    let cType = profile.card_type || 'Individual';
                    if (cType === 'TravelAgent') cType = 'Travel Agent';
                    cardTypeSelect.value = cType;
                }

                // Individual inputs
                const fn = document.getElementById('gcf-first-name');
                const ln = document.getElementById('gcf-last-name');
                const title = document.getElementById('gcf-title');
                const idCard = document.getElementById('gcf-id-card');
                const idCardType = document.getElementById('gcf-id-card-type');
                const birthdate = document.getElementById('gcf-birthdate');
                const sex = document.getElementById('gcf-sex');
                const occupation = document.getElementById('gcf-occupation');
                const address = document.getElementById('gcf-address');
                const city = document.getElementById('gcf-city');
                const phone = document.getElementById('gcf-phone');
                const mobile = document.getElementById('gcf-mobile');
                const email = document.getElementById('gcf-email');

                // Company inputs
                const companyName = document.getElementById('gcf-company-name');
                const officeAddress = document.getElementById('gcf-office-address');
                const officePhone = document.getElementById('gcf-office-phone');
                const creditLimit = document.getElementById('gcf-credit-limit');
                const salesExec = document.getElementById('gcf-sales-exec');
                const contractExp = document.getElementById('gcf-contract-exp');
                const discountPct = document.getElementById('gcf-discount-pct');
                const comments = document.getElementById('gcf-comments');

                if (fn) fn.value = profile.first_name || '';
                if (ln) ln.value = profile.name || profile.full_name || '';
                if (title) title.value = profile.title || '';
                if (idCard) idCard.value = profile.id_card_no || profile.id_card || '';
                if (idCardType) idCardType.value = profile.id_card_type || 'KTP';
                if (birthdate) birthdate.value = profile.birthdate || '';
                if (sex) sex.value = profile.sex || '';
                if (occupation) occupation.value = profile.occupation || '';
                if (address) address.value = profile.address || '';
                if (city) city.value = profile.city || '';
                if (phone) phone.value = profile.phone || '';
                if (mobile) mobile.value = profile.mobile_no || profile.phone || '';
                if (email) email.value = profile.email || '';

                if (companyName) companyName.value = profile.name || profile.company_name || '';
                if (officeAddress) officeAddress.value = profile.address || '';
                if (officePhone) officePhone.value = profile.phone || profile.telefax || '';
                if (creditLimit) creditLimit.value = profile.credit_limit || 0;
                if (salesExec) salesExec.value = profile.sales_id || '';
                if (contractExp) contractExp.value = profile.contract_expired_date ? profile.contract_expired_date.split('T')[0] : '';
                if (discountPct) discountPct.value = profile.discount_pct || 0;
                if (comments) comments.value = profile.comments || profile.notes || '';

                // Load contacts from guest_contacts
                const { data: contacts } = await supabaseClient
                    .from('guest_contacts')
                    .select('*')
                    .eq('guest_card_id', editingGcfId);
                if (contacts && contacts.length > 0) {
                    gcfContactsState = contacts;
                }

                // Load contract rates from contract_rates
                const { data: rates } = await supabaseClient
                    .from('contract_rates')
                    .select('*')
                    .eq('guest_card_id', editingGcfId);
                if (rates && rates.length > 0) {
                    gcfContractRatesState = rates;
                }
            }
        } catch (err) {
            console.error('Error fetching profile detail for edit:', err);
        }
    }

    // Ensure room types cache is loaded for rates dropdown
    if (!roomTypesCache || roomTypesCache.length === 0) {
        fetchRoomTypes();
    }

    handleGcfCardTypeChange();
    switchGcfModalTab('basic');

    if (modal) modal.classList.remove('hidden');
}

/**
 * 5. closeGcfEditorModal
 */
export function closeGcfEditorModal() {
    const modal = document.getElementById('modal-gcf-editor');
    if (modal) modal.classList.add('hidden');
    editingGcfId = null;
}

/**
 * 6. handleGcfCardTypeChange
 * Adapts dynamic form fields and tab visibility based on selected card type.
 */
export function handleGcfCardTypeChange() {
    const cardTypeSelect = document.getElementById('gcf-card-type');
    if (!cardTypeSelect) return;

    const cardType = cardTypeSelect.value; // 'Individual', 'Company', 'Travel Agent'
    const indFields = document.getElementById('gcf-individual-fields');
    const compFields = document.getElementById('gcf-company-fields');
    const subtabsNav = document.getElementById('gcf-modal-subtabs');

    if (cardType === 'Individual') {
        if (indFields) indFields.classList.remove('hidden');
        if (compFields) compFields.classList.add('hidden');
        if (subtabsNav) subtabsNav.classList.add('hidden');
        switchGcfModalTab('basic');
    } else { // Company or Travel Agent
        if (indFields) indFields.classList.add('hidden');
        if (compFields) compFields.classList.remove('hidden');
        if (subtabsNav) subtabsNav.classList.remove('hidden');
    }
}

/**
 * 7. switchGcfModalTab
 * Toggles sub-tabs inside GCF Editor Modal (Basic Info, Contact Persons, Contract Rates)
 */
export function switchGcfModalTab(tabName) {
    activeGcfModalTab = tabName;

    const tabBasic = document.getElementById('gcf-modal-tab-basic');
    const tabContacts = document.getElementById('gcf-modal-tab-contacts');
    const tabRates = document.getElementById('gcf-modal-tab-rates');

    const contentBasic = document.getElementById('gcf-tab-content-basic');
    const contentContacts = document.getElementById('gcf-tab-content-contacts');
    const contentRates = document.getElementById('gcf-tab-content-rates');

    const activeClass = 'px-4 py-2 border-b-2 border-primary font-bold text-primary text-sm transition-all';
    const inactiveClass = 'px-4 py-2 border-b-2 border-transparent font-medium text-slate-500 hover:text-slate-800 text-sm transition-all';

    if (tabBasic) tabBasic.className = tabName === 'basic' ? activeClass : inactiveClass;
    if (tabContacts) tabContacts.className = tabName === 'contacts' ? activeClass : inactiveClass;
    if (tabRates) tabRates.className = tabName === 'rates' ? activeClass : inactiveClass;

    if (contentBasic) contentBasic.className = tabName === 'basic' ? 'block' : 'hidden';
    if (contentContacts) contentContacts.className = tabName === 'contacts' ? 'block' : 'hidden';
    if (contentRates) contentRates.className = tabName === 'rates' ? 'block' : 'hidden';

    if (tabName === 'contacts') renderGcfContactsTable();
    if (tabName === 'rates') renderGcfContractRatesTable();
}

/**
 * 8. Contacts Management Functions
 */
export function renderGcfContactsTable() {
    const tbody = document.getElementById('gcf-contacts-table-body');
    if (!tbody) return;

    if (gcfContactsState.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-6 text-center text-slate-400 text-sm italic">
                    Belum ada Contact Person (PIC) ditambahkan.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = gcfContactsState.map((contact, index) => `
        <tr class="border-b border-slate-100 text-xs">
            <td class="p-2">
                <input type="text" value="${contact.name || ''}" onchange="window.updateGcfContactField(${index}, 'name', this.value)" placeholder="Nama Lengkap PIC" class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none">
            </td>
            <td class="p-2">
                <input type="text" value="${contact.department || ''}" onchange="window.updateGcfContactField(${index}, 'department', this.value)" placeholder="Dept (mis. HR/Sales)" class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none">
            </td>
            <td class="p-2">
                <input type="text" value="${contact.function_title || ''}" onchange="window.updateGcfContactField(${index}, 'function_title', this.value)" placeholder="Jabatan" class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none">
            </td>
            <td class="p-2">
                <input type="text" value="${contact.phone || ''}" onchange="window.updateGcfContactField(${index}, 'phone', this.value)" placeholder="No. HP / Telp" class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none">
            </td>
            <td class="p-2">
                <input type="email" value="${contact.email || ''}" onchange="window.updateGcfContactField(${index}, 'email', this.value)" placeholder="Email" class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none">
            </td>
            <td class="p-2 text-center">
                <button type="button" onclick="window.removeGcfContactRow(${index})" class="p-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                    <i class="ph ph-trash text-sm"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

export function addGcfContactRow() {
    gcfContactsState.push({ name: '', department: '', function_title: '', phone: '', email: '' });
    renderGcfContactsTable();
}

export function removeGcfContactRow(index) {
    gcfContactsState.splice(index, 1);
    renderGcfContactsTable();
}

export function updateGcfContactField(index, field, value) {
    if (gcfContactsState[index]) {
        gcfContactsState[index][field] = value;
    }
}

/**
 * 9. Contract Rates Management Functions
 */
export function renderGcfContractRatesTable() {
    const tbody = document.getElementById('gcf-rates-table-body');
    if (!tbody) return;

    if (gcfContractRatesState.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-6 text-center text-slate-400 text-sm italic">
                    Belum ada Contract Rate khusus ditambahkan.
                </td>
            </tr>
        `;
        return;
    }

    const roomTypes = window.roomTypesCache || roomTypesCache || [];

    tbody.innerHTML = gcfContractRatesState.map((rate, index) => {
        const roomTypeOpts = roomTypes.map(rt => `
            <option value="${rt.id}" ${rate.room_type_id === rt.id ? 'selected' : ''}>${rt.name}</option>
        `).join('');

        return `
            <tr class="border-b border-slate-100 text-xs">
                <td class="p-2">
                    <select onchange="window.updateGcfContractRateField(${index}, 'room_type_id', this.value)" class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none">
                        <option value="">-- Pilih Tipe Kamar --</option>
                        ${roomTypeOpts}
                    </select>
                </td>
                <td class="p-2">
                    <input type="number" value="${rate.rate_amount || 0}" onchange="window.updateGcfContractRateField(${index}, 'rate_amount', this.value)" placeholder="Nominal Harga (Rp)" class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none">
                </td>
                <td class="p-2">
                    <input type="date" value="${rate.valid_from ? rate.valid_from.split('T')[0] : ''}" onchange="window.updateGcfContractRateField(${index}, 'valid_from', this.value)" class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none">
                </td>
                <td class="p-2">
                    <input type="date" value="${rate.valid_to ? rate.valid_to.split('T')[0] : ''}" onchange="window.updateGcfContractRateField(${index}, 'valid_to', this.value)" class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none">
                </td>
                <td class="p-2 text-center">
                    <button type="button" onclick="window.removeGcfContractRateRow(${index})" class="p-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                        <i class="ph ph-trash text-sm"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

export function addGcfContractRateRow() {
    gcfContractRatesState.push({ room_type_id: '', rate_amount: 0, valid_from: '', valid_to: '' });
    renderGcfContractRatesTable();
}

export function removeGcfContractRateRow(index) {
    gcfContractRatesState.splice(index, 1);
    renderGcfContractRatesTable();
}

export function updateGcfContractRateField(index, field, value) {
    if (gcfContractRatesState[index]) {
        gcfContractRatesState[index][field] = value;
    }
}

/**
 * 10. saveGcfProfile
 * Collects form fields, validates, updates/inserts in public.guest_card_files, and syncs PICs and Contract Rates.
 */
export async function saveGcfProfile(event) {
    if (event) event.preventDefault();

    const cardTypeSelect = document.getElementById('gcf-card-type');
    const cardType = cardTypeSelect ? cardTypeSelect.value : 'Individual';

    let nameVal = '';
    let addressVal = null;
    let phoneVal = null;
    let emailVal = null;

    const payload = {
        id: editingGcfId || undefined,
        card_type: cardType,
        comments: document.getElementById('gcf-comments')?.value || null
    };

    if (cardType === 'Individual') {
        const fn = document.getElementById('gcf-first-name')?.value || '';
        const ln = document.getElementById('gcf-last-name')?.value || '';
        nameVal = (fn + ' ' + ln).trim() || fn || ln;
        payload.first_name = fn || null;
        payload.name = nameVal;
        payload.title = document.getElementById('gcf-title')?.value || null;
        payload.id_card_no = document.getElementById('gcf-id-card')?.value || null;
        payload.id_card_type = document.getElementById('gcf-id-card-type')?.value || 'KTP';
        payload.birthdate = document.getElementById('gcf-birthdate')?.value || null;
        payload.sex = document.getElementById('gcf-sex')?.value || null;
        payload.occupation = document.getElementById('gcf-occupation')?.value || null;
        addressVal = document.getElementById('gcf-address')?.value || null;
        payload.address = addressVal;
        payload.city = document.getElementById('gcf-city')?.value || null;
        phoneVal = document.getElementById('gcf-mobile')?.value || document.getElementById('gcf-phone')?.value || null;
        payload.phone = phoneVal;
        payload.mobile_no = phoneVal;
        emailVal = document.getElementById('gcf-email')?.value || null;
        payload.email = emailVal;
    } else {
        nameVal = document.getElementById('gcf-company-name')?.value || '';
        payload.name = nameVal;
        addressVal = document.getElementById('gcf-office-address')?.value || null;
        payload.address = addressVal;
        phoneVal = document.getElementById('gcf-office-phone')?.value || null;
        payload.phone = phoneVal;
        payload.credit_limit = parseFloat(document.getElementById('gcf-credit-limit')?.value || 0);
        payload.sales_id = document.getElementById('gcf-sales-exec')?.value || null;
        payload.contract_expired_date = document.getElementById('gcf-contract-exp')?.value || null;
        payload.discount_pct = parseFloat(document.getElementById('gcf-discount-pct')?.value || 0);
    }

    if (!nameVal) {
        showToast('Nama Lengkap / Perusahaan wajib diisi.', 'error');
        return;
    }

    try {
        const savedProfile = await saveGuestCard(payload);
        const gcfId = savedProfile.id;

        // For Company/TravelAgent, sync contacts and contract rates
        if (cardType !== 'Individual' && gcfId) {
            // 1. Sync guest_contacts
            await supabaseClient.from('guest_contacts').delete().eq('guest_card_id', gcfId);
            const validContacts = gcfContactsState
                .filter(c => c.name && c.name.trim() !== '')
                .map(c => ({
                    guest_card_id: gcfId,
                    name: c.name.trim(),
                    department: c.department || null,
                    function_title: c.function_title || null,
                    phone: c.phone || null,
                    email: c.email || null
                }));

            if (validContacts.length > 0) {
                await supabaseClient.from('guest_contacts').insert(validContacts);
            }

            // 2. Sync contract_rates
            await supabaseClient.from('contract_rates').delete().eq('guest_card_id', gcfId);
            const validRates = gcfContractRatesState
                .filter(r => r.room_type_id && r.valid_from && r.valid_to)
                .map(r => ({
                    guest_card_id: gcfId,
                    room_type_id: r.room_type_id,
                    rate_amount: parseFloat(r.rate_amount || 0),
                    valid_from: r.valid_from,
                    valid_to: r.valid_to
                }));

            if (validRates.length > 0) {
                await supabaseClient.from('contract_rates').insert(validRates);
            }
        }

        showToast(editingGcfId ? 'Profil GCF berhasil diperbarui.' : 'Profil GCF baru berhasil dibuat.');
        closeGcfEditorModal();
        renderGuestProfilesTable();
    } catch (err) {
        console.error('Error saving GCF profile:', err);
        showToast(`Gagal menyimpan profil: ${err.message || err}`, 'error');
    }
}

/**
 * 11. deleteGcfProfile
 * Confirms and deletes GCF profile if not linked to active reservation history.
 */
export async function deleteGcfProfile(guestId) {
    if (!guestId) return;

    try {
        // Check if profile is attached to reservations
        const { data: resData, error: resErr } = await supabaseClient
            .from('reservations')
            .select('id, reservation_number, status')
            .or(`guest_profile_id.eq.${guestId},guest_card_id.eq.${guestId}`);

        if (!resErr && resData && resData.length > 0) {
            const activeRes = resData.filter(r => r.status !== 'Cancelled' && r.status !== 'Checkout' && r.status !== 'CHECKED_OUT');
            if (activeRes.length > 0) {
                alert(`Profil GCF tidak dapat dihapus karena terikat pada ${resData.length} transaksi/reservasi.`);
                return;
            }
        }

        if (!confirm('Apakah Anda yakin ingin menghapus profil Guest Card File ini?')) {
            return;
        }

        // Delete associated contacts and contract rates
        await supabaseClient.from('guest_contacts').delete().eq('guest_card_id', guestId);
        await supabaseClient.from('contract_rates').delete().eq('guest_card_id', guestId);

        // Delete profile record
        const { error: delErr } = await supabaseClient
            .from('guest_card_files')
            .delete()
            .eq('id', guestId);

        if (delErr) throw delErr;

        showToast('Profil GCF telah berhasil dihapus.');
        renderGuestProfilesTable();

    } catch (err) {
        console.error('Error deleting GCF profile:', err);
        showToast(`Gagal menghapus profil: ${err.message || err}`, 'error');
    }
}

/**
 * 12. viewGcfHistory
 * Displays reservation stay history for selected guest profile.
 */
export async function viewGcfHistory(guestId) {
    if (!guestId) return;

    const modal = document.getElementById('modal-gcf-history');
    const tbody = document.getElementById('gcf-history-table-body');
    const guestNameEl = document.getElementById('gcf-history-guest-name');

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-6 text-center text-slate-500 font-medium">
                    <i class="ph ph-spinner animate-spin text-xl text-primary mb-1 block mx-auto"></i>
                    Memuat riwayat reservasi...
                </td>
            </tr>
        `;
    }

    try {
        const profile = await getGuestCardById(guestId);
        if (guestNameEl && profile) {
            guestNameEl.textContent = profile.full_name || profile.name || profile.company_name || 'Guest Profile';
        }

        const { data: reservations, error } = await supabaseClient
            .from('reservations')
            .select(`
                id,
                reservation_number,
                check_in_date,
                check_out_date,
                status,
                room_rate,
                room_types ( name ),
                rooms ( room_number )
            `)
            .or(`guest_profile_id.eq.${guestId},guest_card_id.eq.${guestId}`)
            .order('check_in_date', { ascending: false });

        if (error) throw error;

        if (!reservations || reservations.length === 0) {
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="py-6 text-center text-slate-400 font-medium">
                            Tamu ini belum memiliki riwayat reservasi/menginap.
                        </td>
                    </tr>
                `;
            }
        } else if (tbody) {
            tbody.innerHTML = reservations.map(r => `
                <tr class="border-b border-slate-100 text-xs text-slate-700 hover:bg-slate-50/50">
                    <td class="py-2.5 px-3 font-mono font-bold text-slate-800">${r.reservation_number || '-'}</td>
                    <td class="py-2.5 px-3">${r.check_in_date || '-'} s.d ${r.check_out_date || '-'}</td>
                    <td class="py-2.5 px-3 font-medium">${r.room_types?.name || 'Standard'} ${r.rooms?.room_number ? `(${r.rooms.room_number})` : ''}</td>
                    <td class="py-2.5 px-3 font-semibold text-slate-800">${formatIDR(r.room_rate)}</td>
                    <td class="py-2.5 px-3 font-bold">
                        <span class="px-2 py-0.5 rounded text-[10px] uppercase ${r.status === 'Checkin' || r.status === 'CHECKED_IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}">
                            ${r.status || 'Reserved'}
                        </span>
                    </td>
                </tr>
            `).join('');
        }

    } catch (err) {
        console.error('Error viewing GCF history:', err);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-4 text-center text-red-500 text-xs">
                        Gagal memuat riwayat: ${err.message || err}
                    </td>
                </tr>
            `;
        }
    }

    if (modal) modal.classList.remove('hidden');
}

export function closeGcfHistoryModal() {
    const modal = document.getElementById('modal-gcf-history');
    if (modal) modal.classList.add('hidden');
}

/**
 * 13. Profile Merging Functions
 */
export async function openMergeProfilesModal() {
    const modal = document.getElementById('modal-gcf-merge');
    mergeSourceId = null;
    mergeTargetId = null;

    const sourceSelect = document.getElementById('gcf-merge-source');
    const targetSelect = document.getElementById('gcf-merge-target');

    if (sourceSelect) sourceSelect.innerHTML = '<option value="">-- Pilih Profil Sumber (Akan Dihapus) --</option>';
    if (targetSelect) targetSelect.innerHTML = '<option value="">-- Pilih Profil Tujuan (Tersimpan) --</option>';

    try {
        const profiles = await searchGuestCards('');
        const optionsHtml = profiles.map(p => `
            <option value="${p.id}">${p.full_name || p.name || p.company_name} (${p.card_type || 'Individual'} - ${p.phone || p.email || 'No Contact'})</option>
        `).join('');

        if (sourceSelect) sourceSelect.innerHTML += optionsHtml;
        if (targetSelect) targetSelect.innerHTML += optionsHtml;
    } catch (err) {
        console.error('Error loading profiles for merge:', err);
    }

    if (modal) modal.classList.remove('hidden');
}

export function closeMergeProfilesModal() {
    const modal = document.getElementById('modal-gcf-merge');
    if (modal) modal.classList.add('hidden');
    mergeSourceId = null;
    mergeTargetId = null;
}

export async function executeMergeProfiles(event) {
    if (event) event.preventDefault();

    const sourceSelect = document.getElementById('gcf-merge-source');
    const targetSelect = document.getElementById('gcf-merge-target');

    const sourceId = sourceSelect?.value;
    const targetId = targetSelect?.value;

    if (!sourceId || !targetId) {
        showToast('Silakan pilih profil sumber dan profil tujuan.', 'error');
        return;
    }

    if (sourceId === targetId) {
        showToast('Profil sumber dan tujuan tidak boleh sama.', 'error');
        return;
    }

    if (!confirm('Apakah Anda yakin ingin menggabungkan profil ini? Transaksi profil sumber akan dialihkan ke profil tujuan, dan profil sumber akan dihapus.')) {
        return;
    }

    try {
        // Re-link reservations to targetId
        await supabaseClient
            .from('reservations')
            .update({ guest_profile_id: targetId, guest_card_id: targetId })
            .or(`guest_profile_id.eq.${sourceId},guest_card_id.eq.${sourceId}`);

        // Re-link guest_contacts and contract_rates to targetId
        await supabaseClient
            .from('guest_contacts')
            .update({ guest_card_id: targetId })
            .eq('guest_card_id', sourceId);

        await supabaseClient
            .from('contract_rates')
            .update({ guest_card_id: targetId })
            .eq('guest_card_id', sourceId);

        // Delete source profile
        await supabaseClient
            .from('guest_card_files')
            .delete()
            .eq('id', sourceId);

        showToast('Penggabungan profil berhasil.');
        closeMergeProfilesModal();
        renderGuestProfilesTable();

    } catch (err) {
        console.error('Error merging profiles:', err);
        showToast(`Gagal menggabungkan profil: ${err.message || err}`, 'error');
    }
}

// Attach functions to window object
if (typeof window !== 'undefined') {
    window.renderGuestProfilesTable = renderGuestProfilesTable;
    window.setGcfTab = setGcfTab;
    window.handleGcfTableSearch = handleGcfTableSearch;
    window.openGcfEditorModal = openGcfEditorModal;
    window.closeGcfEditorModal = closeGcfEditorModal;
    window.handleGcfCardTypeChange = handleGcfCardTypeChange;
    window.switchGcfModalTab = switchGcfModalTab;
    window.renderGcfContactsTable = renderGcfContactsTable;
    window.addGcfContactRow = addGcfContactRow;
    window.removeGcfContactRow = removeGcfContactRow;
    window.updateGcfContactField = updateGcfContactField;
    window.renderGcfContractRatesTable = renderGcfContractRatesTable;
    window.addGcfContractRateRow = addGcfContractRateRow;
    window.removeGcfContractRateRow = removeGcfContractRateRow;
    window.updateGcfContractRateField = updateGcfContractRateField;
    window.saveGcfProfile = saveGcfProfile;
    window.deleteGcfProfile = deleteGcfProfile;
    window.viewGcfHistory = viewGcfHistory;
    window.closeGcfHistoryModal = closeGcfHistoryModal;
    window.openMergeProfilesModal = openMergeProfilesModal;
    window.closeMergeProfilesModal = closeMergeProfilesModal;
    window.executeMergeProfiles = executeMergeProfiles;
}
