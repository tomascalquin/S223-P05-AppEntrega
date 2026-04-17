import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  authenticateUser,
  getAuthErrorMessage,
  registerUser,
  type AuthUser,
  type LoginCredentials,
  type RegisterData,
  type Role,
} from "../services/auth";

const AUTH_STORAGE_KEY = "encombox.auth.session";

interface AuthContextType {
  user: AuthUser | null;
  authError: string;
  isAuthenticating: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthUser>;
  register: (data: RegisterData) => Promise<AuthUser>;
  logout: () => void;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isValidStoredUser = (value: unknown): value is AuthUser => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const user = value as Record<string, unknown>;

  return (
    typeof user.id === "string" &&
    typeof user.name === "string" &&
    typeof user.email === "string" &&
    typeof user.username === "string" &&
    (user.role === "conserje" || user.role === "residente")
  );
};

const getStoredUser = (): AuthUser | null => {
  const storedSession = window.localStorage.getItem(AUTH_STORAGE_KEY);

  if (!storedSession) {
    return null;
  }

  try {
    const parsedSession: unknown = JSON.parse(storedSession);
    return isValidStoredUser(parsedSession) ? parsedSession : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser);
  const [authError, setAuthError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    // # Persistimos solo la sesión limpia del usuario para restaurar acceso tras recargar la app.
    if (user) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      return;
    }

    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }, [user]);

  const login = async (credentials: LoginCredentials) => {
    // # Login y registro comparten este estado para bloquear la UI y mostrar feedback consistente.
    setIsAuthenticating(true);
    setAuthError("");

    try {
      const authenticatedUser = await authenticateUser(credentials);
      setUser(authenticatedUser);
      return authenticatedUser;
    } catch (error) {
      setAuthError(getAuthErrorMessage(error));
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const register = async (data: RegisterData) => {
    setIsAuthenticating(true);
    setAuthError("");

    try {
      const registeredUser = await registerUser(data);
      setUser(registeredUser);
      return registeredUser;
    } catch (error) {
      setAuthError(getAuthErrorMessage(error));
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const logout = () => {
    setUser(null);
    setAuthError("");
  };

  const clearAuthError = () => {
    setAuthError("");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authError,
        isAuthenticating,
        login,
        register,
        logout,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
};

export type { Role };
