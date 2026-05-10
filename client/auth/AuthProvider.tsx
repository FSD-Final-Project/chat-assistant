import { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  hasRocketIntegration?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refreshSession: () => Promise<void>;
  signInWithGoogle: () => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (user: AuthUser | null) => void;
}

interface SessionResponse {
  authenticated: boolean;
  user: AuthUser | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchSession(): Promise<SessionResponse> {
  const response = await fetch("/auth/session", {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch authentication session");
  }

  return (await response.json()) as SessionResponse;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const session = await fetchSession();
      setUser(session.authenticated ? session.user : null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, []);

  const signInWithGoogle = useCallback(() => {
    window.location.assign("/auth/google");
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const response = await fetch("/auth/login", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const payload = (await response.json()) as { message?: string };
    if (!response.ok) {
      throw new Error(payload.message ?? "Failed to sign in");
    }

    await refreshSession();
  }, [refreshSession]);

  const registerWithEmail = useCallback(async (email: string, password: string, name?: string) => {
    const response = await fetch("/auth/register", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, name }),
    });

    const payload = (await response.json()) as { message?: string };
    if (!response.ok) {
      throw new Error(payload.message ?? "Failed to register");
    }

    await refreshSession();
  }, [refreshSession]);

  const signOut = useCallback(async () => {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((nextUser: AuthUser | null) => {
    setUser(nextUser);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        refreshSession,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        signOut,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
