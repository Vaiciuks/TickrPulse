import { supabase } from "./supabase.js";

export async function authFetch(url, options = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers = { ...options.headers };
  if (session) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  return fetch(url, { ...options, headers });
}
