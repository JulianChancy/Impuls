import { isSupabaseConfigured, requireSupabase, supabase } from './supabaseClient';

export async function signUp(email, password) {
  const { data, error } = await requireSupabase().auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await requireSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const { data, error } = await requireSupabase().auth.updateUser({ password: newPassword });
  if (error) throw error;
  return data;
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured) {
    console.log('[LOCAL FALLBACK] Supabase auth not configured.');
    return null;
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) {
    console.log('[AUTH] No Supabase session found.');
    return null;
  }
  return data.session.user;
}

export function onAuthStateChange(callback) {
  if (!isSupabaseConfigured) {
    return { unsubscribe: () => {} };
  }
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null, session);
  });
  return data.subscription;
}
