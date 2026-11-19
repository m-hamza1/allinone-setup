"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, getToken, setToken, User } from "@/lib/api";
import { getCachedUser, setCachedUser } from "@/lib/auth-store";
import { homeForRole } from "@/lib/portals";

type AuthContextValue = {
  token: string | null;
  user: User | null;
  ready: boolean;
  refreshing: boolean;
  logout: () => Promise<void>;
  setSession: (token: string, user: User) => void;
  ensureRole: (roles?: Array<User["role"]>, redirectTo?: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isUnauthorized(err: unknown) {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // Keep SSR + first client paint identical — read storage only after mount.
  const [token, setLocalToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const booted = useRef(false);

  const applyUser = useCallback((next: User | null) => {
    setUser(next);
    setCachedUser(next);
  }, []);

  const clearSession = useCallback(() => {
    setToken(null);
    setLocalToken(null);
    applyUser(null);
  }, [applyUser]);

  const setSession = useCallback(
    (nextToken: string, nextUser: User) => {
      setToken(nextToken);
      setLocalToken(nextToken);
      applyUser(nextUser);
      setReady(true);
      setRefreshing(false);
    },
    [applyUser],
  );

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    const stored = getToken();
    if (!stored) {
      setLocalToken(null);
      applyUser(null);
      setReady(true);
      return;
    }

    setLocalToken(stored);
    const cached = getCachedUser();
    if (cached) {
      setUser(cached);
      setReady(true);
    } else {
      setReady(false);
    }

    // Cached user unlocks UI immediately; /me refreshes in background.
    setRefreshing(true);
    const meTimeout = cached ? 15000 : 12000;
    api<{ user: User }>("/auth/me", { token: stored, timeoutMs: meTimeout })
      .then((me) => {
        applyUser(me.user);
      })
      .catch((err) => {
        // Hot reload / busy local API should NOT log the user out.
        if (isUnauthorized(err)) {
          clearSession();
        }
      })
      .finally(() => {
        setRefreshing(false);
        setReady(true);
      });
  }, [applyUser, clearSession]);

  const logout = useCallback(async () => {
    const current = getToken();
    if (current) {
      try {
        await api("/auth/logout", { method: "POST", token: current, timeoutMs: 5000 });
      } catch {
        /* ignore */
      }
    }
    clearSession();
    router.replace("/login");
  }, [clearSession, router]);

  const ensureRole = useCallback(
    (roles?: Array<User["role"]>, redirectTo = "/login") => {
      const stored = getToken();
      if (!stored) {
        router.replace(redirectTo);
        return false;
      }
      if (!user) return Boolean(stored);
      if (roles && !roles.includes(user.role)) {
        router.replace(homeForRole(user.role));
        return false;
      }
      return true;
    },
    [router, user],
  );

  const value = useMemo(
    () => ({ token, user, ready, refreshing, logout, setSession, ensureRole }),
    [token, user, ready, refreshing, logout, setSession, ensureRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
