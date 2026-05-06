import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);
const AUTH_TIMEOUT_MS = 5000;

function withTimeout(promise, fallback = null) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      window.setTimeout(() => resolve(fallback), AUTH_TIMEOUT_MS);
    })
  ]);
}

function clearSupabaseStorage() {
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith('sb-') && key.includes('-auth-token'))
    .forEach((key) => window.localStorage.removeItem(key));
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId) {
    // Try to get existing profile
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Profile fetch error:', error.message);
      setProfile(null);
      return null;
    }

    // If profile exists, use it
    if (data) {
      setProfile(data);
      return data;
    }

    // Profile doesn't exist — create one from auth user metadata
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setProfile(null);
      return null;
    }

    const meta = user.user_metadata || {};
    const newProfile = {
      id: userId,
      full_name: meta.full_name || meta.name || user.email?.split('@')[0] || 'User',
      phone: meta.phone || '',
      role: 'patient'
    };

    const { data: inserted, error: insertError } = await supabase
      .from('profiles')
      .upsert(newProfile, { onConflict: 'id' })
      .select()
      .single();

    if (insertError) {
      console.warn('Profile create error:', insertError.message);
      // Even if insert fails, set a local profile so the app doesn't break
      setProfile(newProfile);
      return newProfile;
    }

    setProfile(inserted);
    return inserted;
  }

  useEffect(() => {
    let mounted = true;

    withTimeout(supabase.auth.getSession(), { data: { session: null } }).then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) {
        await withTimeout(loadProfile(data.session.user.id));
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      if (nextSession?.user) {
        await withTimeout(loadProfile(nextSession.user.id));
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isAdmin: profile?.role === 'admin',
      refreshProfile: () => (session?.user ? loadProfile(session.user.id) : null),
      signOut: async () => {
        setLoading(false);
        clearSupabaseStorage();
        const { error } = await withTimeout(supabase.auth.signOut({ scope: 'local' }), {});
        if (error) {
          console.warn('Supabase sign out warning:', error.message);
        }
        clearSupabaseStorage();
        setSession(null);
        setProfile(null);
      }
    }),
    [session, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
