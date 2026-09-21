import { supabaseClient } from '../config/supabase.js';

/**
 * Guest Card File (GCF) Service Module
 * Handles searching, fetching, saving guest cards, and auto-filling reservation form.
 */

/**
 * 1. searchGuestCards(query, cardType)
 * Calls RPC `rpc_search_guest_cards` with search query and optional card type filter.
 * Falls back to querying public.guest_card_files directly if RPC encounters an error.
 */
export async function searchGuestCards(query = '', cardType = null) {
    const trimmedQuery = (query || '').trim();
    try {
        const rpcParams = {
            p_query: trimmedQuery,
            p_card_type: cardType || null,
            query: trimmedQuery,
            card_type: cardType || null
        };

        const { data, error } = await supabaseClient.rpc('rpc_search_guest_cards', rpcParams);

        if (!error && data) {
            return data.map(item => ({
                ...item,
                full_name: item.full_name || item.name || item.company_name || '',
                phone: item.phone || item.mobile_no || item.phone_number || '',
                mobile_no: item.mobile_no || item.phone || item.phone_number || '',
                discount_pct: item.discount_pct || item.special_discount || item.discount || 0
            }));
        }

        if (error) {
            console.warn('rpc_search_guest_cards error, falling back to direct query on guest_card_files:', error);
        }
    } catch (err) {
        console.warn('RPC searchGuestCards exception, falling back to table query:', err);
    }

    // Fallback: Query guest_card_files table directly
    try {
        let q = supabaseClient.from('guest_card_files').select('*');

        if (cardType) {
            q = q.eq('card_type', cardType);
        }

        if (trimmedQuery) {
            q = q.or(`name.ilike.%${trimmedQuery}%,email.ilike.%${trimmedQuery}%,phone.ilike.%${trimmedQuery}%,mobile_no.ilike.%${trimmedQuery}%,id_card_no.ilike.%${trimmedQuery}%`);
        }

        const { data: fallbackData, error: fallbackError } = await q.limit(20);
        if (fallbackError) throw fallbackError;
        return (fallbackData || []).map(item => ({
            ...item,
            full_name: item.full_name || item.name || item.company_name || '',
            phone: item.phone || item.mobile_no || item.phone_number || '',
            mobile_no: item.mobile_no || item.phone || item.phone_number || '',
            discount_pct: item.discount_pct || item.special_discount || item.discount || 0
        }));
    } catch (err) {
        console.error('Error fetching guest cards fallback:', err);
        return [];
    }
}

/**
 * 2. getGuestCardById(id)
 * Fetches full detail of a guest card profile including contact person & contract rates.
 */
export async function getGuestCardById(id) {
    if (!id) return null;

    try {
        const { data: guestCard, error } = await supabaseClient
            .from('guest_card_files')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            const { data: profile, error: profErr } = await supabaseClient
                .from('guest_profiles')
                .select('*')
                .eq('id', id)
                .single();

            if (profErr) throw profErr;
            if (profile) {
                profile.full_name = profile.full_name || profile.name || '';
                profile.phone = profile.phone || profile.phone_number || profile.mobile_no || '';
            }
            return profile;
        }

        if (guestCard) {
            guestCard.full_name = guestCard.full_name || guestCard.name || guestCard.company_name || '';
            guestCard.phone = guestCard.phone || guestCard.mobile_no || guestCard.phone_number || '';
            guestCard.mobile_no = guestCard.mobile_no || guestCard.phone || guestCard.phone_number || '';
            guestCard.discount_pct = guestCard.discount_pct || guestCard.special_discount || guestCard.discount || 0;
        }

        // Fetch contacts if separate table exists
        try {
            const { data: contacts } = await supabaseClient
                .from('guest_card_contacts')
                .select('*')
                .eq('guest_card_id', id);

            if (contacts) guestCard.contacts = contacts;
        } catch (_) {}

        // Fetch contract rates if separate table exists
        try {
            const { data: contractRates } = await supabaseClient
                .from('guest_card_contract_rates')
                .select('*')
                .eq('guest_card_id', id);

            if (contractRates) guestCard.contract_rates = contractRates;
        } catch (_) {}

        return guestCard;
    } catch (err) {
        console.error('Error getting guest card by ID:', err);
        return null;
    }
}

/**
 * 3. saveGuestCard(guestData)
 * Inserts a new guest card profile or updates an existing record in public.guest_card_files.
 */
export async function saveGuestCard(guestData) {
    if (!guestData) throw new Error('Guest data is required.');

    const nameVal = guestData.name || guestData.full_name || guestData.guest_name || '';
    const payload = {
        name: nameVal,
        card_type: guestData.card_type || 'Individual',
        email: guestData.email || null,
        phone: guestData.phone || guestData.phone_number || guestData.mobile_no || null,
        mobile_no: guestData.mobile_no || guestData.phone || guestData.phone_number || null,
        id_card_no: guestData.id_card_no || guestData.id_card || null,
        address: guestData.address || null,
        city: guestData.city || null,
        discount_pct: parseFloat(guestData.discount_pct || guestData.special_discount || guestData.discount || 0),
        comments: guestData.notes || guestData.comments || guestData.comment || null
    };

    if (guestData.id) {
        const { data, error } = await supabaseClient
            .from('guest_card_files')
            .update(payload)
            .eq('id', guestData.id)
            .select()
            .single();

        if (error) throw error;
        return data;
    } else {
        payload.created_at = new Date().toISOString();
        const { data, error } = await supabaseClient
            .from('guest_card_files')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;
        return data;
    }
}

/**
 * 4. applyGuestCardToReservation(guestId)
 * Helper function for Reservation Form auto-fill:
 * Fetches guest card profile and populates full_name, email, phone_number,
 * id_card_no, and special discount/notes into reservation form inputs.
 */
export async function applyGuestCardToReservation(guestId) {
    if (!guestId) return false;

    try {
        const guest = await getGuestCardById(guestId);
        if (!guest) {
            console.warn('Guest card profile not found for ID:', guestId);
            return false;
        }

        const nameInput = document.getElementById('res-guest-name');
        const bookerInput = document.getElementById('res-booker-name');
        const emailInput = document.getElementById('res-email');
        const phoneInput = document.getElementById('res-phone');
        const idCardInput = document.getElementById('res-id-card');
        const profileIdInput = document.getElementById('res-guest-profile-id');
        const cardIdInput = document.getElementById('res-guest-card-id');
        const addressInput = document.getElementById('res-address');
        const cityInput = document.getElementById('res-city');
        const nationalityInput = document.getElementById('res-nationality');
        const birthDateInput = document.getElementById('res-birth-date');
        const commentInput = document.getElementById('res-comment');
        const discountInput = document.getElementById('res-discount-pct');

        const fullName = guest.full_name || guest.name || '';

        if (cardIdInput) cardIdInput.value = guest.id || guestId;
        if (profileIdInput && !profileIdInput.value) profileIdInput.value = guest.id || guestId;
        if (nameInput) nameInput.value = fullName;
        if (bookerInput) bookerInput.value = fullName;
        if (emailInput) emailInput.value = guest.email || '';
        if (phoneInput) phoneInput.value = guest.phone || guest.mobile_no || guest.phone_number || '';
        if (idCardInput) idCardInput.value = guest.id_card_no || guest.id_card || '';
        if (addressInput) addressInput.value = guest.address || '';
        if (cityInput) cityInput.value = guest.city || '';
        if (nationalityInput) nationalityInput.value = guest.nationality || guest.nationality_code || 'Indonesia';
        if (birthDateInput && guest.birthdate) birthDateInput.value = guest.birthdate;

        const discountVal = guest.discount_pct || guest.special_discount || guest.discount || 0;
        if (discountInput) discountInput.value = discountVal;

        if (guest.comments) {
            if (commentInput) {
                const currentComment = commentInput.value ? commentInput.value.trim() : '';
                if (!currentComment.includes(guest.comments)) {
                    commentInput.value = currentComment ? `${currentComment} | ${guest.comments}` : guest.comments;
                }
            }
        }

        return true;
    } catch (err) {
        console.error('Error applying guest card to reservation form:', err);
        return false;
    }
}

// Attach to window for backward compatibility with legacy non-module scripts
if (typeof window !== 'undefined') {
    window.searchGuestCards = searchGuestCards;
    window.getGuestCardById = getGuestCardById;
    window.saveGuestCard = saveGuestCard;
    window.applyGuestCardToReservation = applyGuestCardToReservation;
}
