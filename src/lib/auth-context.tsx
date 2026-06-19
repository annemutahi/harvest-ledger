import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { AUTH_CHANGED_EVENT, api, type AuthUser } from "./api";

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

  useEffect(() => {
    const syncAuthState = async () => {
      try {
        setUser(await api.me());
      } catch {
        setUser(null);
      }
    };

    window.addEventListener(AUTH_CHANGED_EVENT, syncAuthState);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, syncAuthState);
  }, []);

  // Redirect logic: anything but /login requires auth.
  useEffect(() => {
    if (loading) return;
    const path = window.location.pathname;

    if (!user && path !== "/login") {
      router.navigate({ to: "/login", replace: true });
    } else if (user && path === "/login") {
      router.navigate({ to: "/", replace: true });
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

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <p className="text-sm text-muted-foreground">Checking your session…</p>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
