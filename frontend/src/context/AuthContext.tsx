import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  authenticateUser,
  authenticateWithGoogle,
  clearStoredSession,
  getAuthErrorMessage,
  getStoredSession,
  registerUser,
  saveStoredSession,
  type AuthUser,
  type LoginCredentials,
  type LoginResult,
  type PendingOtpChallenge,
  type RegisterData,
  type Role,
  validateStoredSession,
  verifyOtp as verifyOtpCode,
} from "../services/auth";

interface AuthContextType {
  user: AuthUser | null;
  authError: string;
  isAuthenticating: boolean;
  isCheckingSession: boolean;
  login: (credentials: LoginCredentials) => Promise<LoginResult>;
  loginWithGoogle: (googleCredential: string, role: Role) => Promise<AuthUser>;
  verifyOtp: (
    challenge: PendingOtpChallenge,
    otpCode: string
  ) => Promise<AuthUser>;
  register: (data: RegisterData) => Promise<AuthUser>;
  logout: () => void;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [initialSession] = useState(() => getStoredSession());

  const [user, setUser] = useState<AuthUser | null>(initialSession?.user ?? null);
  const [authError, setAuthError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(
    initialSession !== null
  );

  useEffect(() => {
    if (!initialSession) {
      return;
    }

    let isCancelled = false;

    const restoreSession = async () => {
      try {
        // # Revalidamos la sesión guardada contra el backend para impedir que
        // # una pestaña reutilice un token vencido solo porque seguía en localStorage.
        const validatedUser = await validateStoredSession(initialSession.token);

        if (isCancelled) {
          return;
        }

        saveStoredSession({
          token: initialSession.token,
          user: validatedUser,
        });
        setUser(validatedUser);
      } catch {
        if (isCancelled) {
          return;
        }

        clearStoredSession();
        setUser(null);
      } finally {
        if (!isCancelled) {
          setIsCheckingSession(false);
        }
      }
    };

    void restoreSession();

    return () => {
      isCancelled = true;
    };
  }, [initialSession]);

  const login = async (credentials: LoginCredentials) => {
    // # Login y registro comparten este estado para bloquear la UI y mostrar feedback consistente.
    setIsAuthenticating(true);
    setAuthError("");

    try {
      const loginResult = await authenticateUser(credentials);

      if (loginResult.status === "authenticated") {
        saveStoredSession(loginResult.session);
        setUser(loginResult.session.user);
      }

      return loginResult;
    } catch (error) {
      setAuthError(getAuthErrorMessage(error));
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const loginWithGoogle = async (googleCredential: string, role: Role) => {
    setIsAuthenticating(true);
    setAuthError("");

    try {
      const authenticatedSession = await authenticateWithGoogle(
        googleCredential,
        role
      );
      saveStoredSession(authenticatedSession);
      setUser(authenticatedSession.user);
      return authenticatedSession.user;
    } catch (error) {
      setAuthError(getAuthErrorMessage(error));
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const verifyOtp = async (
    challenge: PendingOtpChallenge,
    otpCode: string
  ) => {
    setIsAuthenticating(true);
    setAuthError("");

    try {
      const authenticatedSession = await verifyOtpCode(challenge, otpCode);
      saveStoredSession(authenticatedSession);
      setUser(authenticatedSession.user);
      return authenticatedSession.user;
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
      const registeredSession = await registerUser(data);
      saveStoredSession(registeredSession);
      setUser(registeredSession.user);
      return registeredSession.user;
    } catch (error) {
      setAuthError(getAuthErrorMessage(error));
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const logout = () => {
    clearStoredSession();
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
        isCheckingSession,
        login,
        loginWithGoogle,
        verifyOtp,
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
