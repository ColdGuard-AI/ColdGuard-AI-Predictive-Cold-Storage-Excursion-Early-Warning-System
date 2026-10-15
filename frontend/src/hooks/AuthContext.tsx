import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setAuthToken, setUnauthorizedHandler } from "../services/api";
import type { AuthUser, Permission } from "../types/api";

interface AuthState {
  user: AuthUser | null;
  checking: boolean; // restoring a saved session on page load
  sessionExpired: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);
const TOKEN_KEY = "coldguard.token";

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: session lasts until reload */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const clear = useCallback((expired: boolean) => {
    setAuthToken(null);
    writeToken(null);
    setUser(null);
    setSessionExpired(expired);
  }, []);

  // Restore a saved session (token is kept per browser tab).
  useEffect(() => {
    setUnauthorizedHandler(() => clear(true));
    const saved = readToken();
    if (!saved) {
      setChecking(false);
      return;
    }
    setAuthToken(saved);
    api
      .me()
      .then(setUser)
      .catch(() => clear(false))
      .finally(() => setChecking(false));
    return () => setUnauthorizedHandler(null);
  }, [clear]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password);
    setAuthToken(res.access_token);
    writeToken(res.access_token);
    setSessionExpired(false);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* already invalid server-side - sign out locally anyway */
    }
    clear(false);
  }, [clear]);

  const can = useCallback((p: Permission) => !!user?.permissions.includes(p), [user]);

  const value = useMemo(() => ({ user, checking, sessionExpired, login, logout, can }), [user, checking, sessionExpired, login, logout, can]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Landing page per role: managers see the facility overview, operators the live monitor. */
export function homePathFor(user: AuthUser | null): string {
  return user?.permissions.includes("manager_overview") ? "/manager" : "/";
}
