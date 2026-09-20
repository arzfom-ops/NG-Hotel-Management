import { supabaseClient } from '../config/supabase.js';
import { getStatusBadgeHTML } from '../utils/formatters.js';

// State variables
export let outletsCache = [];

        export async function fetchBedTypes() {
            try {
                const { data, error } = await supabaseClient.from('bed_types').select('*');
                if (error) throw error;

                const tbody = document.getElementById('bed-types-tbody');
                if (tbody) {
                    tbody.innerHTML = (data || []).map(bt => {
                        const escapedName = (bt.name || '').replace(/'/g, "\\'");
                        return `
                            <tr class="hover:bg-slate-50/80 transition-colors">
                                <td class="py-3 px-4 font-medium">${bt.name}</td>
                                <td class="py-3 px-4 text-right space-x-2">
                                    <button onclick="openEditBedType('${bt.id}', '${escapedName}')" class="text-blue-600 hover:text-blue-800 transition-colors p-1 cursor-pointer" title="Edit"><i class="ph ph-pencil text-lg"></i></button>
                                    <button onclick="deleteBedType('${bt.id}')" class="text-red-600 hover:text-red-800 transition-colors p-1" title="Delete"><i class="ph ph-trash text-lg"></i></button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }

                // Populate dynamic select options for Room Category modal
                const dropdown = document.getElementById('roomCategoryBedType');
                if (dropdown) {
                    if (data && data.length > 0) {
                        dropdown.innerHTML = data.map(bt => `<option value="${bt.id}">${bt.name}</option>`).join('');
                    } else {
                        dropdown.innerHTML = `<option value="">-- No Bed Types --</option>`;
                    }
                }
            } catch (err) {
                console.error('Error fetching bed types:', err);
            }
        }

        export function openBedTypeModal() {
            document.getElementById('edit-bed-type-id').value = '';
            document.getElementById('bedTypeModalTitle').textContent = 'Add Bed Type';
            document.getElementById('bedTypeSubmitBtn').textContent = 'Save';
            const modal = document.getElementById('bedTypeModal');
            if (modal) modal.classList.remove('hidden');
        }

        export function openEditBedType(id, currentName) {
            document.getElementById('edit-bed-type-id').value = id;
            document.getElementById('bedTypeName').value = currentName;
            document.getElementById('bedTypeModalTitle').textContent = 'Update Bed Type';
            document.getElementById('bedTypeSubmitBtn').textContent = 'Update';
            const modal = document.getElementById('bedTypeModal');
            if (modal) modal.classList.remove('hidden');
        }

        export function closeBedTypeModal() {
            const modal = document.getElementById('bedTypeModal');
            if (modal) modal.classList.add('hidden');
            document.getElementById('edit-bed-type-id').value = '';
            const form = document.getElementById('bedTypeForm');
            if (form) form.reset();
        }

        export async function handleSaveBedType(event) {
            event.preventDefault();
            const editId = document.getElementById('edit-bed-type-id').value;
            const nameVal = document.getElementById('bedTypeName').value.trim();
            if (!nameVal) return;

            try {
                if (editId) {
                    const { error } = await supabaseClient.from('bed_types').update({ name: nameVal }).eq('id', editId);
                    if (error) throw error;
                } else {
                    const { error } = await supabaseClient.from('bed_types').insert([{ name: nameVal }]);
                    if (error) throw error;
                }
                closeBedTypeModal();
                fetchBedTypes();
                fetchRoomTypes();
            } catch (err) {
                console.error('Error saving bed type:', err);
                alert('Gagal menyimpan bed type: ' + err.message);
            }
        }

        export async function deleteBedType(id) {
            try {
                const { error } = await supabaseClient.from('bed_types').delete().eq('id', id);
                if (error) throw error;
                fetchBedTypes();
                fetchRoomTypes();
            } catch (err) {
                console.error('Error deleting bed type:', err);
                alert('Gagal menghapus bed type: ' + err.message);
            }
        }

        // --- Room Categories CRUD ---
        export async function fetchRoomTypes() {
            try {
                const { data, error } = await supabaseClient.from('room_types').select('id, name, base_price, bed_type_id, bed_types(name)');
                if (error) throw error;

                const tbody = document.getElementById('room-types-tbody');
                if (tbody) {
                    tbody.innerHTML = (data || []).map(rt => {
                        const bedTypeName = rt.bed_types ? (Array.isArray(rt.bed_types) ? rt.bed_types[0]?.name : rt.bed_types.name) : '-';
                        const priceFormatted = rt.base_price !== null && rt.base_price !== undefined
                            ? `Rp ${Number(rt.base_price).toLocaleString('id-ID')}`
                            : '-';
                        const escapedName = (rt.name || '').replace(/'/g, "\\'");
                        const priceVal = rt.base_price !== null && rt.base_price !== undefined ? rt.base_price : 0;
                        const bedTypeId = rt.bed_type_id || '';
                        return `
                            <tr class="hover:bg-slate-50/80 transition-colors">
                                <td class="py-3 px-4 font-medium">${rt.name}</td>
                                <td class="py-3 px-4">${bedTypeName || '-'}</td>
                                <td class="py-3 px-4">${priceFormatted}</td>
                                <td class="py-3 px-4 text-right space-x-2">
                                    <button onclick="openEditRoomType('${rt.id}', '${escapedName}', ${priceVal}, '${bedTypeId}')" class="text-blue-600 hover:text-blue-800 transition-colors p-1 cursor-pointer" title="Edit"><i class="ph ph-pencil text-lg"></i></button>
                                    <button onclick="deleteRoomType('${rt.id}')" class="text-red-600 hover:text-red-800 transition-colors p-1" title="Delete"><i class="ph ph-trash text-lg"></i></button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }
            } catch (err) {
                console.error('Error fetching room types:', err);
            }
        }

        export function openRoomCategoryModal() {
            document.getElementById('edit-room-type-id').value = '';
            document.getElementById('roomCategoryModalTitle').textContent = 'Add Room Category';
            document.getElementById('roomCategorySubmitBtn').textContent = 'Save';
            const modal = document.getElementById('roomCategoryModal');
            if (modal) modal.classList.remove('hidden');
        }

        export function openEditRoomType(id, name, price, bedTypeId) {
            document.getElementById('edit-room-type-id').value = id;
            document.getElementById('roomCategoryName').value = name;
            document.getElementById('roomCategoryBasePrice').value = price;
            const bedTypeSelect = document.getElementById('roomCategoryBedType');
            if (bedTypeSelect) bedTypeSelect.value = bedTypeId;

            document.getElementById('roomCategoryModalTitle').textContent = 'Update Room Category';
            document.getElementById('roomCategorySubmitBtn').textContent = 'Update';
            const modal = document.getElementById('roomCategoryModal');
            if (modal) modal.classList.remove('hidden');
        }

        export function closeRoomCategoryModal() {
            const modal = document.getElementById('roomCategoryModal');
            if (modal) modal.classList.add('hidden');
            document.getElementById('edit-room-type-id').value = '';
            const form = document.getElementById('roomCategoryForm');
            if (form) form.reset();
        }

        export async function handleSaveRoomCategory(event) {
            event.preventDefault();
            const editId = document.getElementById('edit-room-type-id').value;
            const nameVal = document.getElementById('roomCategoryName').value.trim();
            const bedTypeIdVal = document.getElementById('roomCategoryBedType').value;
            const priceVal = parseFloat(document.getElementById('roomCategoryBasePrice').value);

            if (!nameVal || !bedTypeIdVal) {
                alert('Silakan lengkapi data form.');
                return;
            }

            try {
                if (editId) {
                    const { error } = await supabaseClient.from('room_types').update({
                        name: nameVal,
                        base_price: priceVal,
                        bed_type_id: bedTypeIdVal
                    }).eq('id', editId);
                    if (error) throw error;
                } else {
                    const { error } = await supabaseClient.from('room_types').insert([{
                        name: nameVal,
                        base_price: priceVal,
                        bed_type_id: bedTypeIdVal
                    }]);
                    if (error) throw error;
                }
                closeRoomCategoryModal();
                fetchRoomTypes();
            } catch (err) {
                console.error('Error saving room category:', err);
                alert('Gagal menyimpan room category: ' + err.message);
            }
        }

        export async function deleteRoomType(id) {
            try {
                const { error } = await supabaseClient.from('room_types').delete().eq('id', id);
                if (error) throw error;
                fetchRoomTypes();
            } catch (err) {
                console.error('Error deleting room category:', err);
                alert('Gagal menghapus room category: ' + err.message);
            }
        }

        // --- Rooms CRUD ---
        export async function populateRoomTypeDropdown() {
            try {
                const { data, error } = await supabaseClient.from('room_types').select('id, name');
                if (error) throw error;
                const dropdown = document.getElementById('roomTypeSelect');
                if (dropdown) {
                    if (data && data.length > 0) {
                        dropdown.innerHTML = data.map(rt => `<option value="${rt.id}">${rt.name}</option>`).join('');
                    } else {
                        dropdown.innerHTML = `<option value="">-- No Room Types --</option>`;
                    }
                }
            } catch (err) {
                console.error('Error populating room types:', err);
            }
        }

        export async function fetchRooms() {
            try {
                const { data, error } = await supabaseClient.from('rooms').select('id, room_number, room_view, floor, building, status, room_type_id, room_types(name)');
                if (error) throw error;

                if (typeof window !== "undefined") { window.roomsCache = data || []; }

                const tbody = document.getElementById('rooms-tbody');
                if (tbody) {
                    tbody.innerHTML = (data || []).map(r => {
                        const roomTypeName = r.room_types ? (Array.isArray(r.room_types) ? r.room_types[0]?.name : r.room_types.name) : '-';
                        const roomView = r.room_view || '-';
                        const floor = r.floor || '-';
                        const building = r.building || '-';
                        const status = r.status || 'VC';

                        const escapedNumber = (r.room_number || '').replace(/'/g, "\\'");
                        const escapedView = (r.room_view || 'No View').replace(/'/g, "\\'");
                        const escapedFloor = (r.floor || '').replace(/'/g, "\\'");
                        const escapedBuilding = (r.building || '').replace(/'/g, "\\'");
                        const roomTypeId = r.room_type_id || '';

                        return `
                            <tr class="hover:bg-slate-50/80 transition-colors">
                                <td class="py-3 px-4 font-medium">${r.room_number || '-'}</td>
                                <td class="py-3 px-4">${roomTypeName}</td>
                                <td class="py-3 px-4">${roomView}</td>
                                <td class="py-3 px-4">${floor}</td>
                                <td class="py-3 px-4">${building}</td>
                                <td class="py-3 px-4">${getStatusBadgeHTML(status)}</td>
                                <td class="py-3 px-4 text-right space-x-2">
                                    <button onclick="openEditRoom('${r.id}', '${escapedNumber}', '${roomTypeId}', '${escapedView}', '${escapedFloor}', '${escapedBuilding}')" class="text-blue-600 hover:text-blue-800 transition-colors p-1 cursor-pointer" title="Edit"><i class="ph ph-pencil text-lg"></i></button>
                                    <button onclick="deleteRoom('${r.id}')" class="text-red-600 hover:text-red-800 transition-colors p-1 cursor-pointer" title="Delete"><i class="ph ph-trash text-lg"></i></button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }
            } catch (err) {
                console.error('Error fetching rooms:', err);
            }
        }

        export async function openRoomModal() {
            await populateRoomTypeDropdown();
            document.getElementById('edit-room-id').value = '';
            document.getElementById('room-number-input').value = '';
            document.getElementById('roomViewSelect').value = 'No View';
            document.getElementById('roomFloor').value = '';
            document.getElementById('roomBuilding').value = '';
            document.getElementById('roomModalTitle').textContent = 'Add New Room';
            document.getElementById('roomSubmitBtn').textContent = 'Save';
            const modal = document.getElementById('roomModal');
            if (modal) modal.classList.remove('hidden');
        }

        export async function openEditRoom(id, room_number, room_type_id, room_view, floor, building) {
            await populateRoomTypeDropdown();
            document.getElementById('edit-room-id').value = id;
            document.getElementById('room-number-input').value = room_number;
            const roomTypeSelect = document.getElementById('roomTypeSelect');
            if (roomTypeSelect) roomTypeSelect.value = room_type_id;
            const roomViewSelect = document.getElementById('roomViewSelect');
            if (roomViewSelect) roomViewSelect.value = room_view || 'No View';
            document.getElementById('roomFloor').value = floor || '';
            document.getElementById('roomBuilding').value = building || '';

            document.getElementById('roomModalTitle').textContent = 'Update Room';
            document.getElementById('roomSubmitBtn').textContent = 'Update';
            const modal = document.getElementById('roomModal');
            if (modal) modal.classList.remove('hidden');
        }

        export function closeRoomModal() {
            const modal = document.getElementById('roomModal');
            if (modal) modal.classList.add('hidden');
            document.getElementById('edit-room-id').value = '';
            const form = document.getElementById('roomForm');
            if (form) form.reset();
        }

        export async function handleSaveRoom(event) {
            event.preventDefault();
            const editId = document.getElementById('edit-room-id').value;
            const roomNumberVal = document.getElementById('room-number-input').value;
            const roomTypeIdVal = document.getElementById('roomTypeSelect').value;
            const roomViewVal = document.getElementById('roomViewSelect').value;
            const roomFloorVal = document.getElementById('roomFloor').value.trim();
            const roomBuildingVal = document.getElementById('roomBuilding').value.trim();

            if (!roomNumberVal.trim() || !roomTypeIdVal) {
                alert('Silakan lengkapi data form.');
                return;
            }

            try {
                if (editId) {
                    const roomData = {
                        room_number: roomNumberVal.trim(),
                        room_type_id: roomTypeIdVal,
                        room_view: roomViewVal,
                        floor: roomFloorVal,
                        building: roomBuildingVal
                    };
                    const { error } = await supabaseClient.from('rooms').update(roomData).eq('id', editId);
                    if (error) throw error;
                } else {
                    const numbers = roomNumberVal
                        .split(',')
                        .map(n => n.trim())
                        .filter(n => n !== '');

                    if (numbers.length === 0) {
                        alert('Silakan masukkan nomor kamar.');
                        return;
                    }

                    const arrayOfObjects = numbers.map(num => ({
                        room_number: num,
                        room_type_id: roomTypeIdVal,
                        room_view: roomViewVal,
                        floor: roomFloorVal,
                        building: roomBuildingVal
                    }));

                    const { error } = await supabaseClient.from('rooms').insert(arrayOfObjects);
                    if (error) throw error;
                }
                closeRoomModal();
                fetchRooms();
            } catch (err) {
                console.error('Error saving room:', err);
                alert('Gagal menyimpan kamar: ' + err.message);
            }
        }

        export async function deleteRoom(id) {
            try {
                const { error } = await supabaseClient.from('rooms').delete().eq('id', id);
                if (error) throw error;
                fetchRooms();
            } catch (err) {
                console.error('Error deleting room:', err);
                alert('Gagal menghapus kamar: ' + err.message);
            }
        }

        // --- Extra Charges CRUD ---
        export async function fetchExtraCharges() {
            try {
                const { data, error } = await supabaseClient.from('extra_charges').select('*');
                if (error) throw error;

                const tbody = document.getElementById('extra-charges-tbody');
                if (tbody) {
                    tbody.innerHTML = (data || []).map(item => {
                        const escapedName = (item.name || '').replace(/'/g, "\\'");
                        const category = item.category || '-';
                        const priceFormatted = item.price !== null && item.price !== undefined
                            ? `Rp ${Number(item.price).toLocaleString('id-ID')}`
                            : 'Rp 0';
                        const isTaxable = item.is_taxable === true || item.is_taxable === 'true' || item.taxable === true || item.taxable === 'true';
                        const taxableBadge = isTaxable
                            ? `<span class="px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-700 font-medium">Yes</span>`
                            : `<span class="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-600 font-medium">No</span>`;

                        return `
                            <tr class="hover:bg-slate-50/80 transition-colors">
                                <td class="py-3 px-4 font-medium">${item.name}</td>
                                <td class="py-3 px-4">${category}</td>
                                <td class="py-3 px-4">${priceFormatted}</td>
                                <td class="py-3 px-4">${taxableBadge}</td>
                                <td class="py-3 px-4 text-right space-x-2">
                                    <button onclick="openEditExtraCharge('${item.id}', '${escapedName}', '${category}', ${item.price || 0}, ${isTaxable})" class="text-blue-600 hover:text-blue-800 transition-colors p-1 cursor-pointer" title="Edit"><i class="ph ph-pencil text-lg"></i></button>
                                    <button onclick="deleteExtraCharge('${item.id}')" class="text-red-600 hover:text-red-800 transition-colors p-1 cursor-pointer" title="Delete"><i class="ph ph-trash text-lg"></i></button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }
            } catch (err) {
                console.error('Error fetching extra charges:', err);
            }
        }

        export function openExtraChargeModal() {
            document.getElementById('extra-charge-id').value = '';
            document.getElementById('extra-charge-name').value = '';
            document.getElementById('extra-charge-category').value = 'F&B';
            document.getElementById('extra-charge-price').value = '';
            document.getElementById('extra-charge-taxable').value = 'true';
            document.getElementById('extraChargeModalTitle').textContent = 'Add Extra Charge';
            document.getElementById('extraChargeSubmitBtn').textContent = 'Save';
            const modal = document.getElementById('extraChargeModal');
            if (modal) modal.classList.remove('hidden');
        }

        export function openEditExtraCharge(id, name, category, price, taxable) {
            document.getElementById('extra-charge-id').value = id;
            document.getElementById('extra-charge-name').value = name;
            document.getElementById('extra-charge-category').value = category || 'F&B';
            document.getElementById('extra-charge-price').value = price || 0;
            document.getElementById('extra-charge-taxable').value = taxable ? 'true' : 'false';

            document.getElementById('extraChargeModalTitle').textContent = 'Update Extra Charge';
            document.getElementById('extraChargeSubmitBtn').textContent = 'Update';
            const modal = document.getElementById('extraChargeModal');
            if (modal) modal.classList.remove('hidden');
        }

        export function closeExtraChargeModal() {
            const modal = document.getElementById('extraChargeModal');
            if (modal) modal.classList.add('hidden');
            document.getElementById('extra-charge-id').value = '';
            const form = document.getElementById('extraChargeForm');
            if (form) form.reset();
        }

        export async function handleSaveExtraCharge(event) {
            event.preventDefault();
            const id = document.getElementById('extra-charge-id').value;
            const name = document.getElementById('extra-charge-name').value.trim();
            const category = document.getElementById('extra-charge-category').value;
            const price = parseFloat(document.getElementById('extra-charge-price').value);
            const isTaxable = document.getElementById('extra-charge-taxable').value === 'true';

            if (!name || isNaN(price)) {
                alert('Silakan isi Name dan Price dengan benar.');
                return;
            }

            const payload = {
                name: name,
                category: category,
                price: price,
                is_taxable: isTaxable
            };

            try {
                if (id) {
                    const { error } = await supabaseClient.from('extra_charges').update(payload).eq('id', id);
                    if (error) throw error;
                } else {
                    const { error } = await supabaseClient.from('extra_charges').insert([payload]);
                    if (error) throw error;
                }
                closeExtraChargeModal();
                fetchExtraCharges();
            } catch (err) {
                console.error('Error saving extra charge:', err);
                alert('Gagal menyimpan extra charge: ' + err.message);
            }
        }

        export async function deleteExtraCharge(id) {
            try {
                const { error } = await supabaseClient.from('extra_charges').delete().eq('id', id);
                if (error) throw error;
                fetchExtraCharges();
            } catch (err) {
                console.error('Error deleting extra charge:', err);
                alert('Gagal menghapus extra charge: ' + err.message);
            }
        }

        // --- Payment Methods CRUD ---
        export async function fetchPaymentMethods() {
            try {
                const { data, error } = await supabaseClient.from('payment_methods').select('*');
                if (error) throw error;

                const tbody = document.getElementById('payment-methods-tbody');
                if (tbody) {
                    tbody.innerHTML = (data || []).map(item => {
                        const escapedName = (item.name || '').replace(/'/g, "\\'");
                        const type = item.method_type || item.type || '-';
                        const isActive = item.is_active === true || item.is_active === 'true' || (typeof item.status === 'string' && item.status.toLowerCase() === 'active');
                        const statusBadge = isActive
                            ? `<span class="px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-700 font-medium">Active</span>`
                            : `<span class="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-600 font-medium">Inactive</span>`;

                        const statusText = isActive ? 'Active' : 'Inactive';

                        return `
                            <tr class="hover:bg-slate-50/80 transition-colors">
                                <td class="py-3 px-4 font-medium">${item.name}</td>
                                <td class="py-3 px-4">${type}</td>
                                <td class="py-3 px-4">${statusBadge}</td>
                                <td class="py-3 px-4 text-right space-x-2">
                                    <button onclick="openEditPaymentMethod('${item.id}', '${escapedName}', '${type}', '${statusText}')" class="text-blue-600 hover:text-blue-800 transition-colors p-1 cursor-pointer" title="Edit"><i class="ph ph-pencil text-lg"></i></button>
                                    <button onclick="deletePaymentMethod('${item.id}')" class="text-red-600 hover:text-red-800 transition-colors p-1 cursor-pointer" title="Delete"><i class="ph ph-trash text-lg"></i></button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }
            } catch (err) {
                console.error('Error fetching payment methods:', err);
            }
        }

        export function openPaymentMethodModal() {
            document.getElementById('payment-method-id').value = '';
            document.getElementById('payment-method-name').value = '';
            document.getElementById('payment-method-type').value = 'Cash';
            document.getElementById('payment-method-status').value = 'Active';
            document.getElementById('paymentMethodModalTitle').textContent = 'Add Payment Method';
            document.getElementById('paymentMethodSubmitBtn').textContent = 'Save';
            const modal = document.getElementById('paymentMethodModal');
            if (modal) modal.classList.remove('hidden');
        }

        export function openEditPaymentMethod(id, name, type, status) {
            document.getElementById('payment-method-id').value = id;
            document.getElementById('payment-method-name').value = name;
            document.getElementById('payment-method-type').value = type || 'Cash';
            document.getElementById('payment-method-status').value = (status === 'Active' || status === true || status === 'true') ? 'Active' : 'Inactive';

            document.getElementById('paymentMethodModalTitle').textContent = 'Update Payment Method';
            document.getElementById('paymentMethodSubmitBtn').textContent = 'Update';
            const modal = document.getElementById('paymentMethodModal');
            if (modal) modal.classList.remove('hidden');
        }

        export function closePaymentMethodModal() {
            const modal = document.getElementById('paymentMethodModal');
            if (modal) modal.classList.add('hidden');
            document.getElementById('payment-method-id').value = '';
            const form = document.getElementById('paymentMethodForm');
            if (form) form.reset();
        }

        export async function handleSavePaymentMethod(event) {
            event.preventDefault();
            const id = document.getElementById('payment-method-id').value;
            const name = document.getElementById('payment-method-name').value.trim();
            const type = document.getElementById('payment-method-type').value;
            const statusVal = document.getElementById('payment-method-status').value;
            const isActive = statusVal === 'Active';

            if (!name) {
                alert('Silakan isi Name.');
                return;
            }

            const payload = {
                name: name,
                method_type: type,
                is_active: isActive
            };

            try {
                if (id) {
                    const { error } = await supabaseClient.from('payment_methods').update(payload).eq('id', id);
                    if (error) throw error;
                } else {
                    const { error } = await supabaseClient.from('payment_methods').insert([payload]);
                    if (error) throw error;
                }
                closePaymentMethodModal();
                fetchPaymentMethods();
            } catch (err) {
                console.error('Error saving payment method:', err);
                alert('Gagal menyimpan payment method: ' + err.message);
            }
        }

        export async function deletePaymentMethod(id) {
            try {
                const { error } = await supabaseClient.from('payment_methods').delete().eq('id', id);
                if (error) throw error;
                fetchPaymentMethods();
            } catch (err) {
                console.error('Error deleting payment method:', err);
                alert('Gagal menghapus payment method: ' + err.message);
            }
        }

        // --- Invoice Setting Single Form ---
        export async function fetchInvoiceSetting() {
            try {
                const { data, error } = await supabaseClient.from('invoice_settings').select('*').limit(1);
                if (error) throw error;

                if (data && data.length > 0) {
                    const item = data[0];
                    document.getElementById('invoice-setting-id').value = item.id || '';
                    document.getElementById('invoice-prefix').value = item.prefix || item.invoice_prefix || '';
                    document.getElementById('invoice-footer-notes').value = item.footer_notes || item.terms || item.notes || '';
                    document.getElementById('invoice-rc-terms').value = item.rc_terms || '';
                } else {
                    document.getElementById('invoice-setting-id').value = '';
                    document.getElementById('invoice-prefix').value = '';
                    document.getElementById('invoice-footer-notes').value = '';
                    document.getElementById('invoice-rc-terms').value = '';
                }
            } catch (err) {
                console.error('Error fetching invoice settings:', err);
            }
        }

        export async function handleSaveInvoiceSetting(event) {
            event.preventDefault();
            const id = document.getElementById('invoice-setting-id').value;
            const prefix = document.getElementById('invoice-prefix').value.trim();
            const footerNotes = document.getElementById('invoice-footer-notes').value.trim();
            const rcTerms = document.getElementById('invoice-rc-terms').value.trim();

            if (!prefix) {
                alert('Silakan isi Invoice Prefix.');
                return;
            }

            const payload = {
                prefix: prefix,
                footer_notes: footerNotes,
                rc_terms: rcTerms
            };

            try {
                if (id) {
                    const { error } = await supabaseClient.from('invoice_settings').update(payload).eq('id', id);
                    if (error) throw error;
                } else {
                    const { data, error } = await supabaseClient.from('invoice_settings').insert([payload]).select();
                    if (error) throw error;
                    if (data && data.length > 0) {
                        document.getElementById('invoice-setting-id').value = data[0].id;
                    }
                }
                alert('Invoice settings berhasil disimpan!');
                fetchInvoiceSetting();
            } catch (err) {
                console.error('Error saving invoice settings:', err);
                alert('Gagal menyimpan invoice settings: ' + err.message);
            }
        }

        // --- Segment Codes CRUD ---
        export async function fetchSegmentCodes() {
            try {
                const { data, error } = await supabaseClient
                    .from('segment_codes')
                    .select('id, segment_code, description, main_group_id, main_group_segments(name)');
                if (error) throw error;

                const tbody = document.getElementById('segment-codes-tbody');
                if (tbody) {
                    tbody.innerHTML = (data || []).map(sc => {
                        const mainGroupName = sc.main_group_segments ? (Array.isArray(sc.main_group_segments) ? sc.main_group_segments[0]?.name : sc.main_group_segments.name) : '-';
                        const escapedCode = (sc.segment_code || '').replace(/'/g, "\\'");
                        const escapedDesc = (sc.description || '').replace(/'/g, "\\'");
                        const mainGroupId = sc.main_group_id || '';

                        return `
                            <tr class="hover:bg-slate-50/80 transition-colors">
                                <td class="py-3 px-4 font-medium">${sc.segment_code}</td>
                                <td class="py-3 px-4">${sc.description || '-'}</td>
                                <td class="py-3 px-4">${mainGroupName || '-'}</td>
                                <td class="py-3 px-4 text-right space-x-2">
                                    <button onclick="openEditSegmentCode('${sc.id}', '${escapedCode}', '${escapedDesc}', '${mainGroupId}')" class="text-blue-600 hover:text-blue-800 transition-colors p-1 cursor-pointer" title="Edit"><i class="ph ph-pencil text-lg"></i></button>
                                    <button onclick="deleteSegmentCode('${sc.id}')" class="text-red-600 hover:text-red-800 transition-colors p-1 cursor-pointer" title="Delete"><i class="ph ph-trash text-lg"></i></button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }

                // Populate Option pada Select Dropdown Market Segment
                const segmentSelect = document.getElementById('ratePlanSegment');
                if (segmentSelect) {
                    const currentVal = segmentSelect.value;
                    let optionsHTML = '<option value="">-- Select Market Segment --</option>';
                    (data || []).forEach(sc => {
                        const label = sc.description ? `${sc.segment_code} - ${sc.description}` : sc.segment_code;
                        optionsHTML += `<option value="${sc.id}">${label}</option>`;
                    });
                    segmentSelect.innerHTML = optionsHTML;
                    segmentSelect.value = currentVal;
                }
            } catch (err) {
                console.error('Error fetching segment codes:', err);
            }
        }

        export async function openSegmentCodeModal() {
            await fetchMainGroups();
            document.getElementById('edit-segment-code-id').value = '';
            document.getElementById('segmentCodeInput').value = '';
            document.getElementById('segmentCodeDescription').value = '';
            document.getElementById('segmentCodeModalTitle').textContent = 'Add Segment Code';
            document.getElementById('segmentCodeSubmitBtn').textContent = 'Save';
            const modal = document.getElementById('segmentCodeModal');
            if (modal) modal.classList.remove('hidden');
        }

        export async function openEditSegmentCode(id, segmentCode, description, mainGroupId) {
            await fetchMainGroups();
            document.getElementById('edit-segment-code-id').value = id;
            document.getElementById('segmentCodeInput').value = segmentCode;
            document.getElementById('segmentCodeDescription').value = description;
            const mainGroupSelect = document.getElementById('segmentCodeMainGroup');
            if (mainGroupSelect) mainGroupSelect.value = mainGroupId;

            document.getElementById('segmentCodeModalTitle').textContent = 'Update Segment Code';
            document.getElementById('segmentCodeSubmitBtn').textContent = 'Update';
            const modal = document.getElementById('segmentCodeModal');
            if (modal) modal.classList.remove('hidden');
        }

        export function closeSegmentCodeModal() {
            const modal = document.getElementById('segmentCodeModal');
            if (modal) modal.classList.add('hidden');
            document.getElementById('edit-segment-code-id').value = '';
            const form = document.getElementById('segmentCodeForm');
            if (form) form.reset();
        }

        export async function handleSaveSegmentCode(event) {
            event.preventDefault();
            const editId = document.getElementById('edit-segment-code-id').value;
            const segmentCodeVal = document.getElementById('segmentCodeInput').value.trim();
            const descriptionVal = document.getElementById('segmentCodeDescription').value.trim();
            const mainGroupIdVal = document.getElementById('segmentCodeMainGroup').value;

            if (!segmentCodeVal || !mainGroupIdVal) {
                alert('Silakan lengkapi data form.');
                return;
            }

            const payload = {
                segment_code: segmentCodeVal,
                description: descriptionVal,
                main_group_id: mainGroupIdVal
            };

            try {
                if (editId) {
                    const { error } = await supabaseClient.from('segment_codes').update(payload).eq('id', editId);
                    if (error) throw error;
                } else {
                    const { error } = await supabaseClient.from('segment_codes').insert([payload]);
                    if (error) throw error;
                }
                closeSegmentCodeModal();
                fetchSegmentCodes();
            } catch (err) {
                console.error('Error saving segment code:', err);
                alert('Gagal menyimpan segment code: ' + err.message);
            }
        }

        export async function deleteSegmentCode(id) {
            try {
                const { error } = await supabaseClient.from('segment_codes').delete().eq('id', id);
                if (error) throw error;
                fetchSegmentCodes();
            } catch (err) {
                console.error('Error deleting segment code:', err);
                alert('Gagal menghapus segment code: ' + err.message);
            }
        }

        // --- Main Group Segments CRUD ---
        export async function fetchMainGroups() {
            try {
                const { data, error } = await supabaseClient.from('main_group_segments').select('*');
                if (error) throw error;

                const tbody = document.getElementById('main-groups-tbody');
                if (tbody) {
                    tbody.innerHTML = (data || []).map(mg => {
                        const escapedName = (mg.name || '').replace(/'/g, "\\'");
                        return `
                            <tr class="hover:bg-slate-50/80 transition-colors">
                                <td class="py-3 px-4 font-medium">${mg.name}</td>
                                <td class="py-3 px-4 text-right space-x-2">
                                    <button onclick="openEditMainGroup('${mg.id}', '${escapedName}')" class="text-blue-600 hover:text-blue-800 transition-colors p-1 cursor-pointer" title="Edit"><i class="ph ph-pencil text-lg"></i></button>
                                    <button onclick="deleteMainGroup('${mg.id}')" class="text-red-600 hover:text-red-800 transition-colors p-1 cursor-pointer" title="Delete"><i class="ph ph-trash text-lg"></i></button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }

                // Populate Option pada Select Dropdown "Main Group" untuk Segment Code Modal
                const dropdown = document.getElementById('segmentCodeMainGroup');
                if (dropdown) {
                    if (data && data.length > 0) {
                        dropdown.innerHTML = data.map(mg => `<option value="${mg.id}">${mg.name}</option>`).join('');
                    } else {
                        dropdown.innerHTML = `<option value="">-- No Main Groups --</option>`;
                    }
                }
            } catch (err) {
                console.error('Error fetching main group segments:', err);
            }
        }

        export function openMainGroupModal() {
            document.getElementById('edit-main-group-id').value = '';
            document.getElementById('mainGroupName').value = '';
            document.getElementById('mainGroupModalTitle').textContent = 'Add Main Group';
            document.getElementById('mainGroupSubmitBtn').textContent = 'Save';
            const modal = document.getElementById('mainGroupModal');
            if (modal) modal.classList.remove('hidden');
        }

        export function openEditMainGroup(id, currentName) {
            document.getElementById('edit-main-group-id').value = id;
            document.getElementById('mainGroupName').value = currentName;
            document.getElementById('mainGroupModalTitle').textContent = 'Update Main Group';
            document.getElementById('mainGroupSubmitBtn').textContent = 'Update';
            const modal = document.getElementById('mainGroupModal');
            if (modal) modal.classList.remove('hidden');
        }

        export function closeMainGroupModal() {
            const modal = document.getElementById('mainGroupModal');
            if (modal) modal.classList.add('hidden');
            document.getElementById('edit-main-group-id').value = '';
            const form = document.getElementById('mainGroupForm');
            if (form) form.reset();
        }

        export async function handleSaveMainGroup(event) {
            event.preventDefault();
            const editId = document.getElementById('edit-main-group-id').value;
            const nameVal = document.getElementById('mainGroupName').value.trim();
            if (!nameVal) return;

            try {
                if (editId) {
                    const { error } = await supabaseClient.from('main_group_segments').update({ name: nameVal }).eq('id', editId);
                    if (error) throw error;
                } else {
                    const { error } = await supabaseClient.from('main_group_segments').insert([{ name: nameVal }]);
                    if (error) throw error;
                }
                closeMainGroupModal();
                fetchMainGroups();
                fetchSegmentCodes();
            } catch (err) {
                console.error('Error saving main group segment:', err);
                alert('Gagal menyimpan main group: ' + err.message);
            }
        }

        export async function deleteMainGroup(id) {
            try {
                const { error } = await supabaseClient.from('main_group_segments').delete().eq('id', id);
                if (error) throw error;
                fetchMainGroups();
                fetchSegmentCodes();
            } catch (err) {
                console.error('Error deleting main group segment:', err);
                alert('Gagal menghapus main group: ' + err.message);
            }
        }

        // --- Tax & Service CRUD ---
        export async function fetchTaxService() {
            try {
                const { data, error } = await supabaseClient.from('tax_and_service').select('*');
                if (error) throw error;

                const items = data || [];
                const serviceItems = items.filter(item => item.type === 'service');
                const taxItems = items.filter(item => item.type === 'tax');

                const serviceTbody = document.getElementById('service-menu-tbody');
                if (serviceTbody) {
                    serviceTbody.innerHTML = serviceItems.map(item => {
                        const escapedName = (item.name || '').replace(/'/g, "\\'");
                        const pctVal = item.percentage !== null && item.percentage !== undefined ? item.percentage : 0;
                        return `
                            <tr class="hover:bg-slate-50/80 transition-colors">
                                <td class="py-3 px-4 font-medium">${item.name}</td>
                                <td class="py-3 px-4">${pctVal}%</td>
                                <td class="py-3 px-4 text-right space-x-2">
                                    <button onclick="openTaxServiceModal('service', '${item.id}', '${escapedName}', ${pctVal})" class="text-blue-600 hover:text-blue-800 transition-colors p-1 cursor-pointer" title="Edit"><i class="ph ph-pencil text-lg"></i></button>
                                    <button onclick="deleteTaxService('${item.id}')" class="text-red-600 hover:text-red-800 transition-colors p-1 cursor-pointer" title="Delete"><i class="ph ph-trash text-lg"></i></button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }

                const taxTbody = document.getElementById('tax-menu-tbody');
                if (taxTbody) {
                    taxTbody.innerHTML = taxItems.map(item => {
                        const escapedName = (item.name || '').replace(/'/g, "\\'");
                        const pctVal = item.percentage !== null && item.percentage !== undefined ? item.percentage : 0;
                        return `
                            <tr class="hover:bg-slate-50/80 transition-colors">
                                <td class="py-3 px-4 font-medium">${item.name}</td>
                                <td class="py-3 px-4">${pctVal}%</td>
                                <td class="py-3 px-4 text-right space-x-2">
                                    <button onclick="openTaxServiceModal('tax', '${item.id}', '${escapedName}', ${pctVal})" class="text-blue-600 hover:text-blue-800 transition-colors p-1 cursor-pointer" title="Edit"><i class="ph ph-pencil text-lg"></i></button>
                                    <button onclick="deleteTaxService('${item.id}')" class="text-red-600 hover:text-red-800 transition-colors p-1 cursor-pointer" title="Delete"><i class="ph ph-trash text-lg"></i></button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }
            } catch (err) {
                console.error('Error fetching tax & service:', err);
            }
        }

        export function openTaxServiceModal(modeType, id = '', name = '', percentage = '') {
            const modal = document.getElementById('taxServiceModal');
            const titleEl = document.getElementById('taxServiceModalTitle');
            const submitBtn = document.getElementById('taxServiceSubmitBtn');

            document.getElementById('tax-service-id').value = id;
            document.getElementById('tax-service-type').value = modeType || 'service';
            document.getElementById('tax-service-name').value = name;
            document.getElementById('tax-service-percentage').value = percentage;

            const modeLabel = (modeType === 'tax') ? 'Tax' : 'Service';
            if (id) {
                if (titleEl) titleEl.textContent = `Update ${modeLabel}`;
                if (submitBtn) submitBtn.textContent = 'Update';
            } else {
                if (titleEl) titleEl.textContent = `Add ${modeLabel}`;
                if (submitBtn) submitBtn.textContent = 'Save';
            }

            if (modal) modal.classList.remove('hidden');
        }

        export function closeTaxServiceModal() {
            const modal = document.getElementById('taxServiceModal');
            if (modal) modal.classList.add('hidden');
            document.getElementById('tax-service-id').value = '';
            const form = document.getElementById('taxServiceForm');
            if (form) form.reset();
        }

        export async function handleSaveTaxService(event) {
            event.preventDefault();
            const id = document.getElementById('tax-service-id').value;
            const type = document.getElementById('tax-service-type').value;
            const name = document.getElementById('tax-service-name').value.trim();
            const percentage = parseFloat(document.getElementById('tax-service-percentage').value);

            if (!name || isNaN(percentage)) {
                alert('Silakan isi Name dan Percentage dengan benar.');
                return;
            }

            const payload = {
                type: type,
                name: name,
                percentage: percentage
            };

            try {
                if (id) {
                    const { error } = await supabaseClient.from('tax_and_service').update(payload).eq('id', id);
                    if (error) throw error;
                } else {
                    const { error } = await supabaseClient.from('tax_and_service').insert([payload]);
                    if (error) throw error;
                }
                closeTaxServiceModal();
                fetchTaxService();
            } catch (err) {
                console.error('Error saving tax & service:', err);
                alert('Gagal menyimpan tax & service: ' + err.message);
            }
        }

        export async function deleteTaxService(id) {
            try {
                const { error } = await supabaseClient.from('tax_and_service').delete().eq('id', id);
                if (error) throw error;
                fetchTaxService();
            } catch (err) {
                console.error('Error deleting tax & service:', err);
                alert('Gagal menghapus data: ' + err.message);
            }
        }

        // --- Revenue Centers (Departments & Outlets) CRUD ---
        export async function fetchDepartments() {
            try {
                const { data, error } = await supabaseClient.from('departments').select('*').order('created_at', { ascending: true });
                if (error) throw error;

                const tbody = document.getElementById('departments-tbody');
                if (tbody) {
                    tbody.innerHTML = (data || []).map(dept => {
                        const escapedName = (dept.name || '').replace(/'/g, "\\'");
                        return `
                            <tr class="hover:bg-slate-50/80 transition-colors">
                                <td class="py-3 px-4 font-medium">${dept.name}</td>
                                <td class="py-3 px-4 text-right space-x-2">
                                    <button onclick="openEditDepartment('${dept.id}', '${escapedName}')" class="text-blue-600 hover:text-blue-800 transition-colors p-1 cursor-pointer" title="Edit"><i class="ph ph-pencil text-lg"></i></button>
                                    <button onclick="deleteDepartment('${dept.id}')" class="text-red-600 hover:text-red-800 transition-colors p-1 cursor-pointer" title="Delete"><i class="ph ph-trash text-lg"></i></button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }

                // Populate Option pada Select Dropdown "Department" untuk Outlet Modal
                const dropdown = document.getElementById('outletDepartment');
                if (dropdown) {
                    if (data && data.length > 0) {
                        dropdown.innerHTML = data.map(dept => `<option value="${dept.id}">${dept.name}</option>`).join('');
                    } else {
                        dropdown.innerHTML = `<option value="">-- No Departments --</option>`;
                    }
                }
            } catch (err) {
                console.error('Error fetching departments:', err);
            }
        }

        export function openDepartmentModal() {
            document.getElementById('edit-department-id').value = '';
            document.getElementById('departmentName').value = '';
            document.getElementById('departmentModalTitle').textContent = 'Add Department';
            document.getElementById('departmentSubmitBtn').textContent = 'Save';
            const modal = document.getElementById('departmentModal');
            if (modal) modal.classList.remove('hidden');
        }

        export function openEditDepartment(id, currentName) {
            document.getElementById('edit-department-id').value = id;
            document.getElementById('departmentName').value = currentName;
            document.getElementById('departmentModalTitle').textContent = 'Update Department';
            document.getElementById('departmentSubmitBtn').textContent = 'Update';
            const modal = document.getElementById('departmentModal');
            if (modal) modal.classList.remove('hidden');
        }

        export function closeDepartmentModal() {
            const modal = document.getElementById('departmentModal');
            if (modal) modal.classList.add('hidden');
            document.getElementById('edit-department-id').value = '';
            const form = document.getElementById('departmentForm');
            if (form) form.reset();
        }

        export async function handleSaveDepartment(event) {
            event.preventDefault();
            const editId = document.getElementById('edit-department-id').value;
            const nameVal = document.getElementById('departmentName').value.trim();
            if (!nameVal) return;

            try {
                if (editId) {
                    const { error } = await supabaseClient.from('departments').update({ name: nameVal }).eq('id', editId);
                    if (error) throw error;
                } else {
                    const { error } = await supabaseClient.from('departments').insert([{ name: nameVal }]);
                    if (error) throw error;
                }
                closeDepartmentModal();
                fetchDepartments();
                fetchOutlets();
            } catch (err) {
                console.error('Error saving department:', err);
                alert('Gagal menyimpan department: ' + err.message);
            }
        }

        export async function deleteDepartment(id) {
            try {
                const { error } = await supabaseClient.from('departments').delete().eq('id', id);
                if (error) throw error;
                fetchDepartments();
                fetchOutlets();
            } catch (err) {
                console.error('Error deleting department:', err);
                alert('Gagal menghapus department: ' + err.message);
            }
        }

        export async function fetchOutlets() {
            try {
                await fetchDepartments();
                const { data, error } = await supabaseClient.from('outlets').select('id, name, department_id, departments(name)').order('created_at', { ascending: true });
                if (error) throw error;

                const tbody = document.getElementById('outlets-tbody');
                if (tbody) {
                    tbody.innerHTML = (data || []).map(outlet => {
                        const escapedName = (outlet.name || '').replace(/'/g, "\\'");
                        const deptName = outlet.departments ? outlet.departments.name : '-';
                        return `
                            <tr class="hover:bg-slate-50/80 transition-colors">
                                <td class="py-3 px-4 font-medium">${outlet.name}</td>
                                <td class="py-3 px-4">${deptName}</td>
                                <td class="py-3 px-4 text-right space-x-2">
                                    <button onclick="openEditOutlet('${outlet.id}', '${escapedName}', '${outlet.department_id}')" class="text-blue-600 hover:text-blue-800 transition-colors p-1 cursor-pointer" title="Edit"><i class="ph ph-pencil text-lg"></i></button>
                                    <button onclick="deleteOutlet('${outlet.id}')" class="text-red-600 hover:text-red-800 transition-colors p-1 cursor-pointer" title="Delete"><i class="ph ph-trash text-lg"></i></button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }
            } catch (err) {
                console.error('Error fetching outlets:', err);
            }
        }

        export async function openOutletModal() {
            await fetchDepartments();
            document.getElementById('edit-outlet-id').value = '';
            document.getElementById('outletName').value = '';
            document.getElementById('outletModalTitle').textContent = 'Add Outlet';
            document.getElementById('outletSubmitBtn').textContent = 'Save';
            const modal = document.getElementById('outletModal');
            if (modal) modal.classList.remove('hidden');
        }

        export async function openEditOutlet(id, currentName, currentDeptId) {
            await fetchDepartments();
            document.getElementById('edit-outlet-id').value = id;
            document.getElementById('outletName').value = currentName;
            document.getElementById('outletDepartment').value = currentDeptId;
            document.getElementById('outletModalTitle').textContent = 'Update Outlet';
            document.getElementById('outletSubmitBtn').textContent = 'Update';
            const modal = document.getElementById('outletModal');
            if (modal) modal.classList.remove('hidden');
        }

        export function closeOutletModal() {
            const modal = document.getElementById('outletModal');
            if (modal) modal.classList.add('hidden');
            document.getElementById('edit-outlet-id').value = '';
            const form = document.getElementById('outletForm');
            if (form) form.reset();
        }

        export async function handleSaveOutlet(event) {
            event.preventDefault();
            const editId = document.getElementById('edit-outlet-id').value;
            const nameVal = document.getElementById('outletName').value.trim();
            const deptId = document.getElementById('outletDepartment').value;
            if (!nameVal || !deptId) return;

            const payload = {
                name: nameVal,
                department_id: deptId
            };

            try {
                if (editId) {
                    const { error } = await supabaseClient.from('outlets').update(payload).eq('id', editId);
                    if (error) throw error;
                } else {
                    const { error } = await supabaseClient.from('outlets').insert([payload]);
                    if (error) throw error;
                }
                closeOutletModal();
                fetchOutlets();
            } catch (err) {
                console.error('Error saving outlet:', err);
                alert('Gagal menyimpan outlet: ' + err.message);
            }
        }

        export async function deleteOutlet(id) {
            try {
                const { error } = await supabaseClient.from('outlets').delete().eq('id', id);
                if (error) throw error;
                fetchOutlets();
            } catch (err) {
                console.error('Error deleting outlet:', err);
                alert('Gagal menghapus outlet: ' + err.message);
            }
        }

        // --- Meal Plans & Breakdowns CRUD ---


        export async function fetchMealPlans() {
            try {
                const { data, error } = await supabaseClient
                    .from('meal_plans')
                    .select('id, code, name, meal_plan_breakdowns(id, item_name, amount, outlet_id)')
                    .order('created_at', { ascending: true });
                if (error) throw error;

                const tbody = document.getElementById('meal-plans-tbody');
                if (tbody) {
                    tbody.innerHTML = (data || []).map(mp => {
                        const escapedName = (mp.name || '').replace(/'/g, "\\'");
                        const totalValue = (mp.meal_plan_breakdowns || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
                        const formattedTotal = `Rp ${totalValue.toLocaleString('id-ID')}`;
                        return `
                            <tr class="hover:bg-slate-50/80 transition-colors">
                                <td class="py-3 px-4 font-mono font-semibold text-slate-700">${mp.code || ''}</td>
                                <td class="py-3 px-4 font-medium">${mp.name || ''}</td>
                                <td class="py-3 px-4">${formattedTotal}</td>
                                <td class="py-3 px-4 text-right space-x-2">
                                    <button onclick="openEditMealPlan('${mp.id}')" class="text-blue-600 hover:text-blue-800 transition-colors p-1 cursor-pointer" title="Edit"><i class="ph ph-pencil text-lg"></i></button>
                                    <button onclick="deleteMealPlan('${mp.id}')" class="text-red-600 hover:text-red-800 transition-colors p-1 cursor-pointer" title="Delete"><i class="ph ph-trash text-lg"></i></button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }

                // Populate Option pada Select Dropdown Meal Plan
                const mealPlanSelect = document.getElementById('ratePlanMealPlan');
                if (mealPlanSelect) {
                    const currentVal = mealPlanSelect.value;
                    let optionsHTML = '<option value="">-- None / Select Meal Plan --</option>';
                    (data || []).forEach(mp => {
                        const label = mp.name ? `${mp.code} - ${mp.name}` : mp.code;
                        optionsHTML += `<option value="${mp.id}">${label}</option>`;
                    });
                    mealPlanSelect.innerHTML = optionsHTML;
                    mealPlanSelect.value = currentVal;
                }
            } catch (err) {
                console.error('Error fetching meal plans:', err);
            }
        }

        export async function loadOutletsCache() {
            try {
                const { data, error } = await supabaseClient.from('outlets').select('id, name').order('created_at', { ascending: true });
                if (error) throw error;
                outletsCache = data || [];
            } catch (err) {
                console.error('Error loading outlets cache:', err);
                outletsCache = [];
            }
        }

        export function buildOutletOptionsHTML(selectedId = '') {
            if (!outletsCache || outletsCache.length === 0) {
                return `<option value="">-- No Outlets Available --</option>`;
            }
            return outletsCache.map(o => `
                <option value="${o.id}" ${o.id === selectedId ? 'selected' : ''}>${o.name}</option>
            `).join('');
        }

        export function addMealPlanBreakdownRow(item = { item_name: '', amount: '', outlet_id: '' }) {
            const container = document.getElementById('meal-plan-breakdowns-container');
            if (!container) return;

            const rowDiv = document.createElement('div');
            rowDiv.className = 'meal-plan-breakdown-row grid grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200';
            rowDiv.innerHTML = `
                <div class="col-span-4">
                    <input type="text" class="breakdown-item-name w-full px-3 py-1.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-primary" placeholder="Item Name (e.g. Breakfast)" value="${item.item_name || ''}" required>
                </div>
                <div class="col-span-3">
                    <input type="number" class="breakdown-value w-full px-3 py-1.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-primary" placeholder="Value (Rp)" value="${item.amount !== undefined && item.amount !== '' ? item.amount : ''}" required min="0">
                </div>
                <div class="col-span-4">
                    <select class="breakdown-outlet w-full px-3 py-1.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-primary bg-white" required>
                        ${buildOutletOptionsHTML(item.outlet_id)}
                    </select>
                </div>
                <div class="col-span-1 text-center">
                    <button type="button" onclick="removeMealPlanBreakdownRow(this)" class="text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-50 transition-colors" title="Remove row">
                        <i class="ph ph-x text-lg"></i>
                    </button>
                </div>
            `;
            container.appendChild(rowDiv);
        }

        export function removeMealPlanBreakdownRow(btn) {
            const row = btn.closest('.meal-plan-breakdown-row');
            if (row) {
                row.remove();
            }
        }

        export function clearMealPlanBreakdownRows() {
            const container = document.getElementById('meal-plan-breakdowns-container');
            if (container) container.innerHTML = '';
        }

        export async function openMealPlanModal() {
            await loadOutletsCache();
            document.getElementById('edit-meal-plan-id').value = '';
            document.getElementById('mealPlanPackageCode').value = '';
            document.getElementById('mealPlanPackageName').value = '';
            document.getElementById('mealPlanModalTitle').textContent = 'Add Meal Plan';
            document.getElementById('mealPlanSubmitBtn').textContent = 'Save';
            clearMealPlanBreakdownRows();
            addMealPlanBreakdownRow(); // baris default
            const modal = document.getElementById('mealPlanModal');
            if (modal) modal.classList.remove('hidden');
        }

        export async function openEditMealPlan(id) {
            await loadOutletsCache();
            try {
                const { data, error } = await supabaseClient
                    .from('meal_plans')
                    .select('id, code, name, meal_plan_breakdowns(id, item_name, amount, outlet_id)')
                    .eq('id', id)
                    .single();
                if (error) throw error;

                document.getElementById('edit-meal-plan-id').value = data.id;
                document.getElementById('mealPlanPackageCode').value = data.code || '';
                document.getElementById('mealPlanPackageName').value = data.name || '';
                document.getElementById('mealPlanModalTitle').textContent = 'Update Meal Plan';
                document.getElementById('mealPlanSubmitBtn').textContent = 'Update';
                clearMealPlanBreakdownRows();

                if (data.meal_plan_breakdowns && data.meal_plan_breakdowns.length > 0) {
                    data.meal_plan_breakdowns.forEach(item => {
                        addMealPlanBreakdownRow(item);
                    });
                } else {
                    addMealPlanBreakdownRow();
                }

                const modal = document.getElementById('mealPlanModal');
                if (modal) modal.classList.remove('hidden');
            } catch (err) {
                console.error('Error opening edit meal plan modal:', err);
                alert('Gagal mengambil data meal plan: ' + err.message);
            }
        }

        export function closeMealPlanModal() {
            const modal = document.getElementById('mealPlanModal');
            if (modal) modal.classList.add('hidden');
            document.getElementById('edit-meal-plan-id').value = '';
            document.getElementById('mealPlanPackageCode').value = '';
            document.getElementById('mealPlanPackageName').value = '';
            const form = document.getElementById('mealPlanForm');
            if (form) form.reset();
            clearMealPlanBreakdownRows();
        }

        export async function handleSaveMealPlan(event) {
            event.preventDefault();
            const editId = document.getElementById('edit-meal-plan-id').value;
            const packageCode = document.getElementById('mealPlanPackageCode').value.trim();
            const packageName = document.getElementById('mealPlanPackageName').value.trim();
            if (!packageCode || !packageName) return;

            // Collect rows
            const rows = document.querySelectorAll('#meal-plan-breakdowns-container .meal-plan-breakdown-row');
            const breakdownItems = [];
            for (const row of rows) {
                const itemName = row.querySelector('.breakdown-item-name').value.trim();
                const amountVal = parseFloat(row.querySelector('.breakdown-value').value) || 0;
                const outletId = row.querySelector('.breakdown-outlet').value;

                if (!itemName) {
                    alert('Harap isi Item Name untuk semua baris rincian.');
                    return;
                }
                if (!outletId) {
                    alert('Harap pilih Outlet untuk semua baris rincian.');
                    return;
                }
                breakdownItems.push({
                    item_name: itemName,
                    amount: amountVal,
                    outlet_id: outletId
                });
            }

            try {
                let mealPlanId = editId;
                if (editId) {
                    const { error } = await supabaseClient.from('meal_plans').update({ code: packageCode, name: packageName }).eq('id', editId);
                    if (error) throw error;

                    // Hapus data lama di meal_plan_breakdowns untuk ID tersebut
                    const { error: deleteErr } = await supabaseClient.from('meal_plan_breakdowns').delete().eq('meal_plan_id', editId);
                    if (deleteErr) throw deleteErr;
                } else {
                    const { data: newPlan, error } = await supabaseClient.from('meal_plans').insert([{ code: packageCode, name: packageName }]).select().single();
                    if (error) throw error;
                    mealPlanId = newPlan.id;
                }

                // Bulk Insert rincian baru
                if (breakdownItems.length > 0) {
                    const payload = breakdownItems.map(item => ({
                        meal_plan_id: mealPlanId,
                        item_name: item.item_name,
                        amount: item.amount,
                        outlet_id: item.outlet_id
                    }));
                    const { error: insertBreakdownErr } = await supabaseClient.from('meal_plan_breakdowns').insert(payload);
                    if (insertBreakdownErr) throw insertBreakdownErr;
                }

                closeMealPlanModal();
                fetchMealPlans();
            } catch (err) {
                console.error('Error saving meal plan:', err);
                alert('Gagal menyimpan meal plan: ' + err.message);
            }
        }

        export async function deleteMealPlan(id) {
            try {
                // Delete breakdowns first if foreign key constraint isn't ON DELETE CASCADE (safe practice)
                await supabaseClient.from('meal_plan_breakdowns').delete().eq('meal_plan_id', id);
                const { error } = await supabaseClient.from('meal_plans').delete().eq('id', id);
                if (error) throw error;
                fetchMealPlans();
            } catch (err) {
                console.error('Error deleting meal plan:', err);
                alert('Gagal menghapus meal plan: ' + err.message);
            }
        }


        export async function renderRoomTypePriceInputs(existingPricesMap = {}) {
            const container = document.getElementById('rate-plan-prices-container');
            if (!container) return;
            container.innerHTML = `<p class="text-xs text-slate-400">Loading room types...</p>`;

            try {
                const { data: roomTypes, error } = await supabaseClient.from('room_types').select('id, name').order('name', { ascending: true });
                if (error) throw error;

                if (!roomTypes || roomTypes.length === 0) {
                    container.innerHTML = `<p class="text-xs text-slate-400 font-normal">Tidak ada tipe kamar tersedia.</p>`;
                    return;
                }

                container.innerHTML = roomTypes.map(rt => {
                    const currentPrice = existingPricesMap[rt.id] !== undefined && existingPricesMap[rt.id] !== null ? existingPricesMap[rt.id] : '';
                    return `
                        <div class="flex items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            <span class="text-xs font-medium text-slate-700 w-1/2 truncate" title="${rt.name}">${rt.name}</span>
                            <div class="w-1/2">
                                <input type="number" step="any" min="0" data-room-type-id="${rt.id}" value="${currentPrice}" placeholder="e.g. 500000" class="rate-plan-room-price-input w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:outline-none focus:border-primary">
                            </div>
                        </div>
                    `;
                }).join('');
            } catch (err) {
                console.error('Error rendering room type price inputs:', err);
                container.innerHTML = `<p class="text-xs text-red-500">Gagal memuat tipe kamar.</p>`;
            }
        }

        export async function fetchRatePlans() {
            const tbody = document.getElementById('rate-plans-tbody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="7" class="p-4"><div class="space-y-3"><div class="bg-slate-200/60 backdrop-blur-xs animate-pulse rounded-xl h-6 w-full"></div><div class="bg-slate-200/60 backdrop-blur-xs animate-pulse rounded-xl h-6 w-3/4"></div></div></td></tr>`;
            }

            try {
                const { data, error } = await supabaseClient
                    .from('rate_plans')
                    .select('id, rate_code, rate_name, segment_id, meal_plan_id, allow_override, cancellation_policy, segment_codes(id, segment_code, description), meal_plans(id, code, name)')
                    .order('created_at', { ascending: true });
                if (error) throw error;

                if (tbody) {
                    if (!data || data.length === 0) {
                        tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-400">Tidak ada data rate plan.</td></tr>`;
                    } else {
                        tbody.innerHTML = data.map(rp => {
                            const sc = rp.segment_codes ? (Array.isArray(rp.segment_codes) ? rp.segment_codes[0] : rp.segment_codes) : null;
                            const segmentDisplay = sc ? (sc.description ? `${sc.segment_code} - ${sc.description}` : sc.segment_code) : '-';

                            const mp = rp.meal_plans ? (Array.isArray(rp.meal_plans) ? rp.meal_plans[0] : rp.meal_plans) : null;
                            const mealPlanDisplay = mp ? (mp.name ? `${mp.code} - ${mp.name}` : mp.code) : '-';

                            const allowOverrideBadge = rp.allow_override
                                ? `<span class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 font-medium">Yes</span>`
                                : `<span class="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-600 font-medium">No</span>`;

                            const escapedCode = (rp.rate_code || '').replace(/'/g, "\\'");
                            const escapedName = (rp.rate_name || '').replace(/'/g, "\\'");
                            const escapedPolicy = (rp.cancellation_policy || '').replace(/'/g, "\\'");
                            const segId = rp.segment_id || '';
                            const mpId = rp.meal_plan_id || '';
                            const allowOverrideBool = Boolean(rp.allow_override);

                            return `
                                <tr class="hover:bg-slate-50/80 transition-colors">
                                    <td class="py-3 px-4 font-mono font-semibold text-slate-700">${rp.rate_code || ''}</td>
                                    <td class="py-3 px-4 font-medium">${rp.rate_name || ''}</td>
                                    <td class="py-3 px-4">${segmentDisplay}</td>
                                    <td class="py-3 px-4">${mealPlanDisplay}</td>
                                    <td class="py-3 px-4">${allowOverrideBadge}</td>
                                    <td class="py-3 px-4 text-slate-600">${rp.cancellation_policy || '-'}</td>
                                    <td class="py-3 px-4 text-right space-x-2">
                                        <button onclick="openEditRatePlan('${rp.id}', '${escapedCode}', '${escapedName}', '${segId}', '${mpId}', ${allowOverrideBool}, '${escapedPolicy}')" class="text-blue-600 hover:text-blue-800 transition-colors p-1 cursor-pointer" title="Edit"><i class="ph ph-pencil text-lg"></i></button>
                                        <button onclick="deleteRatePlan('${rp.id}')" class="text-red-600 hover:text-red-800 transition-colors p-1 cursor-pointer" title="Delete"><i class="ph ph-trash text-lg"></i></button>
                                    </td>
                                </tr>
                            `;
                        }).join('');
                    }
                }
            } catch (err) {
                console.error('Error fetching rate plans:', err);
                const tbody = document.getElementById('rate-plans-tbody');
                if (tbody) {
                    tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-red-500">Gagal memuat rate plan.</td></tr>`;
                }
            }
        }

        export async function openRatePlanModal() {
            await fetchSegmentCodes();
            await fetchMealPlans();
            document.getElementById('edit-rate-plan-id').value = '';
            document.getElementById('ratePlanCode').value = '';
            document.getElementById('ratePlanName').value = '';
            document.getElementById('ratePlanSegment').value = '';
            document.getElementById('ratePlanMealPlan').value = '';
            document.getElementById('ratePlanAllowOverride').value = 'false';
            document.getElementById('ratePlanCancellationPolicy').value = '';

            await renderRoomTypePriceInputs({});

            document.getElementById('ratePlanModalTitle').textContent = 'Add Rate Plan';
            document.getElementById('ratePlanSubmitBtn').textContent = 'Save';
            const modal = document.getElementById('ratePlanModal');
            if (modal) modal.classList.remove('hidden');
        }

        export async function openEditRatePlan(id, code, name, segmentId, mealPlanId, allowOverride, policy) {
            await fetchSegmentCodes();
            await fetchMealPlans();
            document.getElementById('edit-rate-plan-id').value = id;
            document.getElementById('ratePlanCode').value = code;
            document.getElementById('ratePlanName').value = name;
            document.getElementById('ratePlanSegment').value = segmentId;
            document.getElementById('ratePlanMealPlan').value = mealPlanId;
            document.getElementById('ratePlanAllowOverride').value = allowOverride ? 'true' : 'false';
            document.getElementById('ratePlanCancellationPolicy').value = policy;

            let existingPricesMap = {};
            try {
                const { data: priceData, error } = await supabaseClient.from('rate_plan_prices').select('room_type_id, price').eq('rate_plan_id', id);
                if (error) throw error;
                if (priceData) {
                    priceData.forEach(item => {
                        existingPricesMap[item.room_type_id] = item.price;
                    });
                }
            } catch (err) {
                console.error('Error fetching rate plan prices for edit:', err);
            }

            await renderRoomTypePriceInputs(existingPricesMap);

            document.getElementById('ratePlanModalTitle').textContent = 'Update Rate Plan';
            document.getElementById('ratePlanSubmitBtn').textContent = 'Update';
            const modal = document.getElementById('ratePlanModal');
            if (modal) modal.classList.remove('hidden');
        }

        export function closeRatePlanModal() {
            const modal = document.getElementById('ratePlanModal');
            if (modal) modal.classList.add('hidden');
            document.getElementById('edit-rate-plan-id').value = '';
            const form = document.getElementById('ratePlanForm');
            if (form) form.reset();
            const container = document.getElementById('rate-plan-prices-container');
            if (container) container.innerHTML = '';
        }

        export async function handleSaveRatePlan(e) {
            e.preventDefault();
            const editId = document.getElementById('edit-rate-plan-id').value;
            const codeVal = document.getElementById('ratePlanCode').value.trim();
            const nameVal = document.getElementById('ratePlanName').value.trim();
            const segmentIdVal = document.getElementById('ratePlanSegment').value || null;
            const mealPlanIdVal = document.getElementById('ratePlanMealPlan').value || null;
            const allowOverrideVal = document.getElementById('ratePlanAllowOverride').value === 'true';
            const cancellationPolicyVal = document.getElementById('ratePlanCancellationPolicy').value.trim() || null;

            const payload = {
                rate_code: codeVal,
                rate_name: nameVal,
                segment_id: segmentIdVal,
                meal_plan_id: mealPlanIdVal,
                allow_override: allowOverrideVal,
                cancellation_policy: cancellationPolicyVal
            };

            try {
                let ratePlanId = editId;
                if (editId) {
                    const { error } = await supabaseClient.from('rate_plans').update(payload).eq('id', editId);
                    if (error) throw error;

                    const { error: delErr } = await supabaseClient.from('rate_plan_prices').delete().eq('rate_plan_id', editId);
                    if (delErr) throw delErr;
                } else {
                    const { data: newRatePlan, error } = await supabaseClient.from('rate_plans').insert([payload]).select().single();
                    if (error) throw error;
                    ratePlanId = newRatePlan.id;
                }

                const priceInputs = document.querySelectorAll('.rate-plan-room-price-input');
                const pricePayload = [];
                priceInputs.forEach(input => {
                    const roomTypeId = input.dataset.roomTypeId;
                    const rawVal = input.value.trim();
                    if (rawVal !== '') {
                        const priceVal = parseFloat(rawVal);
                        if (!isNaN(priceVal)) {
                            pricePayload.push({
                                rate_plan_id: ratePlanId,
                                room_type_id: roomTypeId,
                                price: priceVal
                            });
                        }
                    }
                });

                if (pricePayload.length > 0) {
                    const { error: priceErr } = await supabaseClient.from('rate_plan_prices').insert(pricePayload);
                    if (priceErr) throw priceErr;
                }

                closeRatePlanModal();
                fetchRatePlans();
            } catch (err) {
                console.error('Error saving rate plan:', err);
                alert('Gagal menyimpan rate plan: ' + err.message);
            }
        }

        export async function deleteRatePlan(id) {
            if (!confirm('Apakah Anda yakin ingin menghapus Rate Plan ini?')) return;
            try {
                const { error } = await supabaseClient.from('rate_plans').delete().eq('id', id);
                if (error) throw error;
                fetchRatePlans();
            } catch (err) {
                console.error('Error deleting rate plan:', err);
                alert('Gagal menghapus rate plan: ' + err.message);
            }
        }

        export function switchSettingsTab(tabId) {
            const tabs = ['room-types', 'rooms', 'meal-plans', 'rate-structure', 'tax-service', 'extra-charges', 'payment-methods', 'invoice-setting', 'market-segments', 'revenue-centers'];

            tabs.forEach(t => {
                const btn = document.getElementById(`tab-btn-${t}`);
                const content = document.getElementById(`tab-content-${t}`);
                if (btn && content) {
                    if (t === tabId) {
                        btn.classList.remove('border-transparent', 'text-slate-500', 'font-medium');
                        btn.classList.add('border-primary', 'text-primary', 'font-bold');
                        content.classList.remove('hidden');
                        if (t === 'room-types') {
                            fetchBedTypes();
                            fetchRoomTypes();
                        } else if (t === 'rooms') {
                            fetchRooms();
                        } else if (t === 'meal-plans') {
                            fetchMealPlans();
                        } else if (t === 'rate-structure') {
                            fetchSegmentCodes();
                            fetchMealPlans();
                            fetchRatePlans();
                        } else if (t === 'tax-service') {
                            fetchTaxService();
                        } else if (t === 'extra-charges') {
                            fetchExtraCharges();
                        } else if (t === 'payment-methods') {
                            fetchPaymentMethods();
                        } else if (t === 'invoice-setting') {
                            fetchInvoiceSetting();
                        } else if (t === 'market-segments') {
                            fetchMainGroups();
                            fetchSegmentCodes();
                        } else if (t === 'revenue-centers') {
                            fetchDepartments();
                            fetchOutlets();
                        }
                    } else {
                        btn.classList.remove('border-primary', 'text-primary', 'font-bold');
                        btn.classList.add('border-transparent', 'text-slate-500', 'font-medium');
                        content.classList.add('hidden');
                    }
                }
            });
        }