import { describe, expect, it, vi } from "vitest";
import { AUTH_STORAGE_KEY, type AuthSession } from "./auth";
import {
  ClaimApiError,
  createClaim,
  fetchClaims,
  updateClaimStatus,
  type ClaimItem,
} from "./claims";

const session: AuthSession = {
  token: "claims-token",
  user: {
    id: "22",
    name: "Residente Dos",
    email: "residente2@example.com",
    username: "residente2",
    role: "residente",
  },
};

const claim: ClaimItem = {
  id: 8,
  package_id: 3,
  resident_id: 22,
  description: "La encomienda no corresponde al remitente esperado.",
  status: "open",
  created_at: "2026-06-23T10:00:00.000Z",
  package_recipient_name: "Residente Dos",
  package_recipient_email: "residente2@example.com",
  package_apartment_number: "404",
  package_sender: "Tienda",
  resident_name: "Residente Dos",
  resident_email: "residente2@example.com",
};

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

const storeSession = (role: AuthSession["user"]["role"] = "residente") => {
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({ ...session, user: { ...session.user, role } })
  );
};

describe("claims service", () => {
  it("lista reclamos del usuario autenticado sin depender del servidor", async () => {
    storeSession("residente");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ claims: [claim] }));

    await expect(fetchClaims()).resolves.toEqual([claim]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/claims",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer claims-token" },
      })
    );
  });

  it("usa el mismo endpoint para admin/conserje porque el filtro real vive en backend", async () => {
    storeSession("administrador");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ claims: [claim] }));

    await fetchClaims();

    // # Este test deja claro que la unidad frontend no simula RBAC:
    // # solo verifica que mande el token para que backend aplique el rol.
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/claims",
      expect.objectContaining({
        headers: { Authorization: "Bearer claims-token" },
      })
    );
  });

  it("crea un reclamo asociado a una encomienda especifica", async () => {
    storeSession();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ id: claim.id, claim }));

    await expect(
      createClaim({
        package_id: claim.package_id,
        description: claim.description,
      })
    ).resolves.toEqual(claim);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/claims",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          package_id: claim.package_id,
          description: claim.description,
        }),
      })
    );
  });

  it("actualiza estado y expone advertencia de notificacion cuando backend la devuelve", async () => {
    storeSession("conserje");
    const reviewedClaim = { ...claim, status: "in_review" as const };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        id: reviewedClaim.id,
        claim: reviewedClaim,
        notification_warning: "No se pudo enviar correo",
      })
    );

    await expect(updateClaimStatus(claim.id, "in_review")).resolves.toEqual({
      id: reviewedClaim.id,
      claim: reviewedClaim,
      message: undefined,
      notification_warning: "No se pudo enviar correo",
    });
  });

  it("prepara la regla de negocio: un reclamo cerrado no se reabre si backend responde conflicto", async () => {
    storeSession("administrador");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ message: "Un reclamo cerrado no puede volver a abrirse." }, { status: 409 })
    );

    await expect(updateClaimStatus(claim.id, "open")).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Un reclamo cerrado no puede volver a abrirse.",
      status: 409,
    });
  });

  it("rechaza colecciones mal formadas", async () => {
    storeSession();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ claims: [{ ...claim, status: "reopened" }] })
    );

    await expect(fetchClaims()).rejects.toBeInstanceOf(ClaimApiError);
  });
});
