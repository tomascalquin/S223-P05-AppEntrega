import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Login from "./Login";

const navigateMock = vi.hoisted(() => vi.fn());
const authMock = vi.hoisted(() => ({
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
  verifyOtp: vi.fn(),
  register: vi.fn(),
  clearAuthError: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    ...authMock,
    authError: "",
    isAuthenticating: false,
  }),
}));

vi.mock("../context/I18nContext", () => ({
  useI18n: () => ({
    locale: "es",
    localeLabels: { es: "ES", en: "EN" },
    setLocale: vi.fn(),
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

vi.mock("../lib/toast", () => ({
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
}));

describe("Login page", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    Object.values(authMock).forEach((mock) => mock.mockClear());
  });

  it("muestra validaciones cuando faltan campos obligatorios", async () => {
    render(<Login />);

    await userEvent.click(screen.getByRole("button", { name: /auth.loginButton/ }));

    expect(await screen.findByText("auth.validation.identifier.required")).toBeVisible();
    expect(screen.getByText("auth.validation.password.required")).toBeVisible();
    expect(authMock.login).not.toHaveBeenCalled();
  });

  it("envia el formulario con credenciales validas", async () => {
    const user = userEvent.setup();
    authMock.login.mockResolvedValue({
      status: "otp_required",
      challenge: {
        otpSessionId: "otp-1",
        otpExpiresAt: "2026-06-23T20:00:00.000Z",
      },
    });

    render(<Login />);

    await user.type(screen.getByLabelText("auth.field.identifier"), " residente ");
    await user.type(screen.getByLabelText("auth.field.password"), "password123");
    await user.click(screen.getByRole("button", { name: /auth.loginButton/ }));

    await waitFor(() =>
      expect(authMock.login).toHaveBeenCalledWith({
        role: "residente",
        identifier: "residente",
        password: "password123",
      })
    );
  });

  it("muestra error visible si las credenciales fallan", async () => {
    const user = userEvent.setup();
    authMock.login.mockRejectedValue(new Error("Credenciales invalidas"));

    render(<Login />);

    await user.type(screen.getByLabelText("auth.field.identifier"), "residente");
    await user.type(screen.getByLabelText("auth.field.password"), "password123");
    await user.click(screen.getByRole("button", { name: /auth.loginButton/ }));

    // # El error se delega al toast; se mockea para no depender de Sonner ni del DOM global.
    const { toastError } = await import("../lib/toast");
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });

  it("navega a la ruta que corresponde al rol autenticado", async () => {
    const user = userEvent.setup();
    authMock.login.mockResolvedValue({
      status: "authenticated",
      session: {
        token: "login-token",
        user: {
          id: "1",
          name: "Conserje",
          email: "conserje@test.cl",
          username: "conserje",
          role: "conserje",
        },
      },
    });

    render(<Login />);

    await user.click(screen.getByText("common.roleLabel.concierge"));
    await user.type(screen.getByLabelText("auth.field.identifier"), "conserje");
    await user.type(screen.getByLabelText("auth.field.password"), "password123");
    await user.click(screen.getByRole("button", { name: /auth.loginButton/ }));

    await waitFor(() => expect(authMock.login).toHaveBeenCalled());
    await waitFor(
      () => expect(navigateMock).toHaveBeenCalledWith("/conserje", { replace: true }),
      { timeout: 1500 }
    );
  });
});
