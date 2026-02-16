/**
 * Spanish Coast Properties - Supabase Module
 * Extracted from app.js
 */
window.SCP_SUPABASE = (() => {
    const { toText } = window.SCP_UTILS;

    let client = null;
    let user = null;
    let role = '';

    const getClient = () => {
        if (!client) client = window.scpSupabase || null;
        return client;
    };

    const getSession = async () => {
        const c = getClient();
        if (!c) return { session: null };
        try {
            const { data } = await c.auth.getSession();
            user = data && data.session ? data.session.user : null;
            return data;
        } catch {
            return { session: null };
        }
    };

    const getRole = async (userId) => {
        const c = getClient();
        if (!c || !userId) return '';
        try {
            const { data, error } = await c
                .from('profiles')
                .select('role')
                .eq('user_id', userId)
                .maybeSingle();
            if (error) return '';
            return toText(data && data.role).trim();
        } catch {
            return '';
        }
    };

    const fetchFavorites = async (userId) => {
        const c = getClient();
        if (!c || !userId) return [];
        try {
            const { data, error } = await c
                .from('favourites')
                .select('property_id')
                .eq('user_id', userId);
            if (error) return [];
            return (data || []).map(r => r.property_id).filter(Boolean);
        } catch {
            return [];
        }
    };

    const upsertFavorite = async (userId, property) => {
        const c = getClient();
        if (!c || !userId || !property) return;
        const pid = toText(property.id || property.ref);
        try {
            await c.from('favourites').upsert({
                user_id: userId,
                property_id: pid,
                data: property
            });
        } catch (error) {
            console.error('Error upserting favorite:', error);
        }
    };

    const deleteFavorite = async (userId, propertyId) => {
        const c = getClient();
        if (!c || !userId || !propertyId) return;
        try {
            await c.from('favourites')
                .delete()
                .eq('user_id', userId)
                .eq('property_id', propertyId);
        } catch (error) {
            console.error('Error deleting favorite:', error);
        }
    };

    const fetchPropertyListings = async () => {
        const c = getClient();
        if (!c) return [];
        try {
            const { data, error } = await c
                .from('property_listings')
                .select('*')
                .eq('published', true)
                .order('created_at', { ascending: false })
                .limit(500);
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching property listings:', error);
            return [];
        }
    };

    const onAuth = (callback) => {
        const c = getClient();
        if (!c) return;
        c.auth.onAuthStateChange(async (event, session) => {
            user = session && session.user ? session.user : null;
            let role = '';
            if (user) {
                // Simplified role resolution for the module
                const { data } = await c.from('user_roles').select('role').eq('user_id', user.id).single();
                role = data ? data.role : '';
            }
            callback(event, session, { user, role });
        });
    };

    return {
        getClient,
        getSession,
        getRole,
        fetchFavorites,
        upsertFavorite,
        deleteFavorite,
        fetchPropertyListings,
        onAuth,
        getUser: () => user,
        setUser: (u) => { user = u; }
    };
})();
