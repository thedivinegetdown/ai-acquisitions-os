import { supabase } from "../../supabaseClient";

export async function getSession() {
  return supabase.auth.getSession();
}

export async function getUser() {
  return supabase.auth.getUser();
}

export async function signInWithPassword({ email, password }) {
  return supabase.auth.signInWithPassword({
    email,
    password,
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function sendPasswordResetEmail(email, redirectTo) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
}

export async function refreshSession() {
  return supabase.auth.refreshSession();
}

export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}
