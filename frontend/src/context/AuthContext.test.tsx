import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import type {
  AuthSession,
  AuthUser,
  LoginCredentials,
  RegisterData,
} from "../services/auth";

const serviceMocks = vi.hoisted(() => ({
  authenticateUser: vi.fn(),
  authenticateWithGoogle: vi.fn(),
  clearStoredSession: vi.fn(),
  getAuthErrorMessage: vi.fn((error: unknown) =>
    error instanceof Error ? error.message : "Error generico"
  ),
  getStoredSession: vi.fn(),
  registerUser: vi.fn(),
  saveStoredSession: vi.fn(),
  validateStoredSession: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("../services/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/auth")>()),
  authenticateUser: serviceMocks.authenticateUser,
  authenticateWithGoogle: serviceMocks.authenticateWithGoogle,
  clearStoredSession: serviceMocks.clearStoredSession,
  getAuthErrorMessage: serviceMocks.getAuthErrorMessage,
  getStoredSession: serviceMocks.getStoredSession,
  registerUser: serviceMocks.registerUser,
  saveStoredSession: serviceMocks.saveStoredSession,
  validateStoredSession: serviceMocks.validateStoredSession,
  verifyOtp: serviceMocks.verifyOtp,
}));

const residentUser: AuthUser = {
  id: "5",
  name: "Residente Test",
  email: "residente@test.cl",
  username: "residente",
  role: "residente",
};

const session: AuthSession = {
  token: "context-token",
  user: residentUser,
};

const AuthConsumer = () => {
  const {
    user,
    authError,
    isCheckingSession,
    login,
    logout,
    register,
    clearAuthError,
  } = useAuth();

  const doLogin = () => {
    void login({
      role: "residente",
      identifier: "residente",
      password: "password123",
    } satisfies LoginCredentials).catch(() => undefined);
  };

  const doRegister = () => {
    void register({
      role: "residente",
      name: "Nuevo",
      email: "nuevo@test.cl",
      username: "nuevo",
      password: "password123",
    } satisfies RegisterData).catch(() => undefined);
  };

  return (
    <div>
      <span data-testid="user">{user?.email ?? "sin usuario"}</span>
      <span data-testid="role">{user?.role ?? "sin rol"}</span>
      <span data-testid="checking">{String(isCheckingSession)}</span>
      <span data-testid="error">{authError || "sin error"}</span>
      <button type="button" onClick={doLogin}>
        login
      </button>
      <button type="button" onClick={doRegister}>
        register
      </button>
      <button type="button" onClick={logout}>
        logout
      </button>
      <button type="button" onClick={clearAuthError}>
        clear
      </button>
    </div>
  );
};

describe("AuthContext", () => {
  beforeEach(() => {
    Object.values(serviceMocks).forEach((mock) => mock.mockClear());
    serviceMocks.getStoredSession.mockReturnValue(null);
  });

  it("restaura y revalida una sesion guardada antes de exponerla como vigente", async () => {
    serviceMocks.getStoredSession.mockReturnValue(session);
    serviceMocks.validateStoredSession.mockResolvedValue({
      ...residentUser,
      name: "Residente Validado",
    });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId("user")).toHaveTextContent(residentUser.email);
    expect(screen.getByTestId("checking")).toHaveTextContent("true");

    await waitFor(() =>
      expect(serviceMocks.saveStoredSession).toHaveBeenCalledWith({
        token: "context-token",
        user: { ...residentUser, name: "Residente Validado" },
      })
    );
    expect(screen.getByTestId("checking")).toHaveTextContent("false");
  });

  it("limpia almacenamiento cuando la sesion guardada ya no es valida", async () => {
    serviceMocks.getStoredSession.mockReturnValue(session);
    serviceMocks.validateStoredSession.mockRejectedValue(new Error("Token vencido"));

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(serviceMocks.clearStoredSession).toHaveBeenCalled());
    expect(screen.getByTestId("user")).toHaveTextContent("sin usuario");
    expect(screen.getByTestId("checking")).toHaveTextContent("false");
  });

  it("guarda sesion despues de login autenticado y respeta el rol del usuario", async () => {
    serviceMocks.authenticateUser.mockResolvedValue({
      status: "authenticated",
      session,
    });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: "login" }));

    await waitFor(() => expect(serviceMocks.saveStoredSession).toHaveBeenCalledWith(session));
    expect(screen.getByTestId("role")).toHaveTextContent("residente");
  });

  it("mantiene usuario pendiente cuando backend exige OTP", async () => {
    serviceMocks.authenticateUser.mockResolvedValue({
      status: "otp_required",
      challenge: {
        otpSessionId: "otp-1",
        otpExpiresAt: "2026-06-23T20:00:00.000Z",
      },
    });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: "login" }));

    expect(serviceMocks.saveStoredSession).not.toHaveBeenCalled();
    expect(screen.getByTestId("user")).toHaveTextContent("sin usuario");
  });

  it("expone errores de autenticacion y permite limpiarlos", async () => {
    serviceMocks.authenticateUser.mockRejectedValue(new Error("Credenciales malas"));

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: "login" }));

    await screen.findByText("Credenciales malas");
    await userEvent.click(screen.getByRole("button", { name: "clear" }));

    expect(screen.getByTestId("error")).toHaveTextContent("sin error");
  });

  it("logout limpia estado y almacenamiento de sesion", async () => {
    serviceMocks.getStoredSession.mockReturnValue(session);
    serviceMocks.validateStoredSession.mockResolvedValue(residentUser);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent(residentUser.email));
    await userEvent.click(screen.getByRole("button", { name: "logout" }));

    expect(serviceMocks.clearStoredSession).toHaveBeenCalled();
    expect(screen.getByTestId("user")).toHaveTextContent("sin usuario");
  });
});
