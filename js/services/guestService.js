import { supabaseClient } from '../config/supabase.js';

/**
/ Guest Card File (GCF) Service Module
/ Handles searching, fetching, saving guest cards, and auto-filling reservation form.
*/

/**
 * 1. searchGuestCards(query, cardType)
 * Calls RPC `rpc_search_guest_cards` with search query and optional card type filter.
 * Falls back to querying public.guest_card_files directly if RPC encounters an error.
 */
export async function searchGuestCards(query = '', cardType = null) {
    const trimmedQuery = (query || '').trim();
    try {
        // Attempt RPC call with flexible parameter naming
        const rpcParams = {
            p_query: trimmedQuery,
            p_card_type: cardType || null,
            query: trimmedQuery,
            card_type: cardType || null
        };

        const { data, error } = await supabaseClient.rpc('rpc_search_guest_cards', rpcParams);

        if (!error && data) {
            return data;
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
            q = q.or(`full_name.ilike.%${trimmedQuery}%,company_name.ilike.%${trimmedQuery}%,email.ilike.%${trimmedQuery}%,phone_number.ilike.%${trimmedQuery}%,id_card_no.ilike.%${trimmedQuery}%`);
        }

        const { data: fallbackData, error: fallbackError } = await q.limit(20);
        if (fallbackError) throw fallbackError;
        return fallbackData || [];
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
        // Query guest_card_files with optional joins or additional fetches
        const { data: guestCard, error } = await supabaseClient
            .from('guest_card_files')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            // Try fetching from guest_profiles as fallback
            const { data: profile, error: profErr } = await supabaseClient
                .from('guest_profiles')
                .select('*')
                .eq('id', id)
                .single();

            if (profErr) throw profErr;
            return profile;
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

    const payload = {
        full_name: guestData.full_name || guestData.guest_name || '',
        company_name: guestData.company_name || null,
        card_type: guestData.card_type || 'Individual',
        email: guestData.email || null,
        phone_number: guestData.phone_number || guestData.phone || null,
        id_card_no: guestData.id_card_no || guestData.id_card || null,
        address: guestData.address || null,
        city: guestData.city || null,
        nationality: guestData.nationality || 'Indonesia',
        birth_date: guestData.birth_date || null,
        special_discount: guestData.special_discount || guestData.discount || 0,
        notes: guestData.notes || guestData.comment || null,
        updated_at: new Date().toISOString()
    };

    if (guestData.id) {
        // Update existing guest card
        const { data, error } = await supabaseClient
            .from('guest_card_files')
            .update(payload)
            .eq('id', guestData.id)
            .select()
            .single();

        if (error) throw error;
        return data;
    } else {
        // Insert new guest card
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
        const emailInput = document.getElementById('res-email');
        const phoneInput = document.getElementById('res-phone');
        const idCardInput = document.getElementById('res-id-card');
        const profileIdInput = document.getElementById('res-guest-profile-id');
        const addressInput = document.getElementById('res-address');
        const cityInput = document.getElementById('res-city');
        const nationalityInput = document.getElementById('res-nationality');
        const birthDateInput = document.getElementById('res-birth-date');
        const commentInput = document.getElementById('res-comment');

        if (profileIdInput) profileIdInput.value = guest.id || guestId;
        if (nameInput) nameInput.value = guest.full_name || guest.name || '';
        if (emailInput) emailInput.value = guest.email || '';
        if (phoneInput) phoneInput.value = guest.phone_number || guest.phone || '';
        if (idCardInput) idCardInput.value = guest.id_card_no || guest.id_card || '';
        if (addressInput) addressInput.value = guest.address || '';
        if (cityInput) cityInput.value = guest.city || '';
        if (nationalityInput) nationalityInput.value = guest.nationality || 'Indonesia';
        if (birthDateInput && guest.birth_date) birthDateInput.value = guest.birth_date;

        // Populate special terms / discount if present
        if (guest.special_discount || guest.discount) {
            const discountNote = `Diskon Khusus GCF: ${guest.special_discount || guest.discount}%`;
            if (commentInput) {
                const currentComment = commentInput.value ? commentInput.value.trim() : '';
                if (!currentComment.includes(discountNote)) {
                    commentInput.value = currentComment ? `${currentComment} | ${discountNote}` : discountNote;
                }
            }
        }

        if (guest.notes) {
            if (commentInput) {
                const currentComment = commentInput.value ? commentInput.value.trim() : '';
                if (!currentComment.includes(guest.notes)) {
                    commentInput.value = currentComment ? `${currentComment} | Notes: ${guest.notes}` : `Notes: ${guest.notes}`;
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
