import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { AUTH_CHANGED_EVENT, api, type AuthUser } from "./api";

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_EVENTS: Array<keyof DocumentEventMap> = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const lastActivityRef = useRef<number>(Date.now());
  const timeoutRef = useRef<number | null>(null);

  const resetInactivityTimer = () => {
    lastActivityRef.current = Date.now();
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(async () => {
      await api.logout();
      setUser(null);
    }, INACTIVITY_TIMEOUT_MS);
  };

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
        const next = await api.me();
        // Only swap the object when it actually changed. A new identity object
        // re-renders the whole tree (and re-runs the route guard), which was
        // tearing down open dialogs mid-entry.
        setUser((prev) =>
          prev && next && prev.id === next.id && prev.username === next.username ? prev : next,
        );
      } catch {
        setUser(null);
      }
    };

    window.addEventListener(AUTH_CHANGED_EVENT, syncAuthState);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, syncAuthState);
  }, []);


  useEffect(() => {
    if (!user) return;
    resetInactivityTimer();

    const handleActivity = () => {
      resetInactivityTimer();
    };

    ACTIVITY_EVENTS.forEach((eventName) => document.addEventListener(eventName, handleActivity));
    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => document.removeEventListener(eventName, handleActivity));
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [user]);

  useEffect(() => {
    if (loading) return;
    const path = window.location.pathname;
    const publicPaths = ["/login", "/forgot-password", "/reset-password"];

    if (!user && !publicPaths.includes(path)) {
      router.navigate({ to: "/login", replace: true });
    } else if (user && path === "/login") {
      router.navigate({ to: "/", replace: true });
    }
  }, [user, loading, router]);


  const value: AuthState = useMemo(
    () => ({
      user,
      loading,
      login: async (username, password) => {
        const u = await api.login(username, password);
        setUser(u);
        resetInactivityTimer();
      },
      logout: async () => {
        try { await api.logout(); } finally {
          setUser(null);
          // Replace history so Back can't return to a protected page.
          if (typeof window !== "undefined") {
            window.location.replace("/login");
          }
        }
      },

    }),
    [user, loading],
  );

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
