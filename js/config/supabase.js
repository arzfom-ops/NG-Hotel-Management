const SUPABASE_URL = 'https://xvoibranzxbtcyvaphll.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9JNXq091DMUBkfsJhtdgcw_lWU54FXO';

export const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Attach to window so legacy non-module scripts in index.html can access supabaseClient
if (typeof window !== 'undefined') {
    window.supabaseClient = supabaseClient;
}
