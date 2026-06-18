import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { api, type AuthUser } from "./api";

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Prime CSRF cookie so unsafe requests can succeed.
      await api.ensureCsrf();
      try {
        const me = await api.me();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Redirect logic: anything but /login requires auth.
  useEffect(() => {
    if (loading) return;
    const path = window.location.pathname;
    if (!user && path !== "/login") {
      router.navigate({ to: "/login" });
    } else if (user && path === "/login") {
      router.navigate({ to: "/" });
    }
  }, [user, loading, router]);

  const value: AuthState = {
    user,
    loading,
    login: async (username, password) => {
      const u = await api.login(username, password);
      setUser(u);
    },
    logout: async () => {
      await api.logout();
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
