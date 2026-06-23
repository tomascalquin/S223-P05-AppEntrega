import { describe, expect, it, vi } from "vitest";
import {
  AUTH_STORAGE_KEY,
  AuthError,
  authenticateUser,
  clearStoredSession,
  getHomePathForRole,
  getStoredAccessToken,
  getStoredSession,
  saveStoredSession,
  validateStoredSession,
  type AuthSession,
} from "./auth";

const validUser = {
  id: "7",
  name: "Patricia Francia",
  email: "patricia@example.com",
  username: "patricia",
  role: "residente" as const,
};

const validSession: AuthSession = {
  token: "jwt-token",
  user: validUser,
};

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

describe("auth service", () => {
  it("autentica con credenciales validas y normaliza espacios antes de enviar", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ token: "jwt-token", user: validUser }));

    const result = await authenticateUser({
      role: "residente",
      identifier: "  patricia@example.com  ",
      password: "password123",
    });

    expect(result).toEqual({
      status: "authenticated",
      session: validSession,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/http:\/\/(localhost|127\.0\.0\.1):3001\/api\/auth\/login/),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "residente",
          identifier: "patricia@example.com",
          password: "password123",
        }),
      })
    );
  });

  it.each([
    [401, "INVALID_CREDENTIALS"],
    [403, "INVALID_CREDENTIALS"],
  ] as const)("convierte HTTP %s en error de credenciales", async (status, code) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ message: "Credenciales invalidas" }, { status })
    );

    await expect(
      authenticateUser({
        role: "conserje",
        identifier: "wrong",
        password: "password123",
      })
    ).rejects.toMatchObject({ code, message: "Credenciales invalidas" });
  });

  it("convierte HTTP 500 en error de red controlado", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ message: "Servidor caido" }, { status: 500 })
    );

    await expect(
      authenticateUser({
        role: "residente",
        identifier: "patricia",
        password: "password123",
      })
    ).rejects.toMatchObject({ code: "NETWORK_ERROR", message: "Servidor caido" });
  });

  it("rechaza respuestas exitosas sin token o usuario completo", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ token: "", user: { ...validUser, role: "sin-rol" } })
    );

    await expect(
      authenticateUser({
        role: "residente",
        identifier: "patricia",
        password: "password123",
      })
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("guarda, recupera y limpia la sesion local", () => {
    saveStoredSession(validSession);

    expect(getStoredSession()).toEqual(validSession);
    expect(getStoredAccessToken()).toBe("jwt-token");

    clearStoredSession();

    expect(getStoredSession()).toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it("ignora sesiones antiguas o corruptas en localStorage", () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: "old" }));

    expect(getStoredSession()).toBeNull();

    localStorage.setItem(AUTH_STORAGE_KEY, "{bad json");

    expect(getStoredSession()).toBeNull();
  });

  it("valida sesion almacenada enviando token Bearer al perfil", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ user: validUser }));

    await expect(validateStoredSession("jwt-token")).resolves.toEqual(validUser);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/http:\/\/(localhost|127\.0\.0\.1):3001\/api\/auth\/profile/),
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer jwt-token" },
      })
    );
  });

  it("mapea roles a su ruta inicial", () => {
    expect(getHomePathForRole("administrador")).toBe("/admin");
    expect(getHomePathForRole("conserje")).toBe("/conserje");
    expect(getHomePathForRole("residente")).toBe("/residente");
  });
});
