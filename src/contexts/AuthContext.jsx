import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { supabase } from "../lib/supabase.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (sess) => {
    try {
      const res = await fetch("/api/user/profile", {
        headers: { Authorization: `Bearer ${sess.access_token}` },
      });
      if (res.ok) {
        const { profile: p } = await res.json();
        setProfile(p);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        if (s) fetchProfile(s);
        else setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });

    let subscription;
    try {
      const result = supabase.auth.onAuthStateChange((_event, s) => {
        setSession(s);
        if (s) fetchProfile(s);
        else {
          setProfile(null);
          setLoading(false);
        }
      });
      subscription = result.data.subscription;
    } catch {
      setLoading(false);
    }

    return () => subscription?.unsubscribe();
  }, [fetchProfile]);

  const user = session?.user ?? null;
  const isPremium = true;

  const signIn = useCallback(
    (email, password) => supabase.auth.signInWithPassword({ email, password }),
    [],
  );

  const signUp = useCallback(
    (email, password) => supabase.auth.signUp({ email, password }),
    [],
  );

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isPremium,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
