import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AppUser, Hospital, HospitalMember, ROLE } from "@agam/shared";
import { apiClient, authApi, setUnauthorizedHandler } from "./api";

interface Session {
  user: AppUser;
  role: ROLE;
  hospitals: HospitalMember[];
  currentHospital: Hospital | null;
}

interface AuthState {
  session: Session | null;
  /** True until the stored token has been checked on cold start. */
  bootstrapping: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  selectHospital: (hospitalId: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  // A 401 that survives the client's retries means the token is dead; drop the
  // session so the router redirects to /login.
  useEffect(() => {
    setUnauthorizedHandler(() => setSession(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await apiClient.tokenStore.get();
      if (!token) {
        if (!cancelled) setBootstrapping(false);
        return;
      }

      try {
        const restored = await authApi.getSession();
        if (!cancelled) {
          setSession({
            user: restored.user,
            role: restored.role,
            hospitals: restored.hospitals ?? [],
            currentHospital: restored.currentHospital ?? null,
          });
        }
      } catch {
        // Expired or revoked — the client has already cleared the token.
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const result = await authApi.loginWithPassword(username, password);
    setSession({
      user: result.user,
      role: result.role,
      hospitals: result.hospitals ?? [],
      currentHospital: result.currentHospital ?? null,
    });
  }, []);

  const signOut = useCallback(async () => {
    await authApi.logout();
    setSession(null);
  }, []);

  const selectHospital = useCallback(async (hospitalId: string) => {
    const result = await authApi.switchHospital(hospitalId);
    setSession({
      user: result.user,
      role: result.role,
      hospitals: result.hospitals ?? [],
      currentHospital: result.currentHospital ?? null,
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({ session, bootstrapping, signIn, signOut, selectHospital }),
    [session, bootstrapping, signIn, signOut, selectHospital],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Throws if called outside an authenticated screen — routes guard for this. */
export function useHospitalId(): string {
  const { session } = useAuth();
  const hospitalId =
    session?.currentHospital?.id ?? session?.hospitals[0]?.hospitalId;
  if (!hospitalId) throw new Error("No hospital selected");
  return hospitalId;
}
