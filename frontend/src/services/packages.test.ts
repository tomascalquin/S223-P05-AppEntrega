import { describe, expect, it, vi } from "vitest";
import { AUTH_STORAGE_KEY, type AuthSession } from "./auth";
import {
  PackageApiError,
  createPackage,
  fetchPackages,
  updatePackage,
  verifyPackageQr,
  type PackageItem,
} from "./packages";

const session: AuthSession = {
  token: "package-token",
  user: {
    id: "11",
    name: "Residente Uno",
    email: "residente@example.com",
    username: "residente",
    role: "residente",
  },
};

const packageItem: PackageItem = {
  id: 3,
  recipient_name: "Residente Uno",
  recipient_email: "residente@example.com",
  apartment_number: "404",
  description: null,
  sender: "Tienda",
  delivery_date: "2026-06-23",
  status: "pending",
  retrieval_code: "QR-1",
  created_at: "2026-06-23T10:00:00.000Z",
  retrieved_at: null,
};

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

const storeSession = () => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

describe("packages service", () => {
  it("lista encomiendas usando filtros limpios y token JWT", async () => {
    storeSession();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ packages: [packageItem] }));

    await expect(
      fetchPackages({
        recipient_name: "  Residente Uno  ",
        apartment_number: "404",
        status: "pending",
      })
    ).resolves.toEqual([packageItem]);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/packages?recipient_name=Residente+Uno&apartment_number=404&status=pending",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer package-token" },
      })
    );
  });

  it("crea encomienda enviando JSON y Authorization", async () => {
    storeSession();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ id: packageItem.id, package: packageItem }));

    await expect(
      createPackage({
        recipient_name: packageItem.recipient_name,
        recipient_email: packageItem.recipient_email,
        apartment_number: packageItem.apartment_number,
        sender: packageItem.sender,
        delivery_date: packageItem.delivery_date ?? "",
      })
    ).resolves.toEqual(packageItem);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/packages",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer package-token",
        },
      })
    );
  });

  it.each([
    [401, "UNAUTHORIZED"],
    [403, "FORBIDDEN"],
    [400, "VALIDATION_ERROR"],
    [404, "NOT_FOUND"],
  ] as const)("mapea HTTP %s a %s", async (status, code) => {
    storeSession();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ message: "Error de API" }, { status })
    );

    await expect(fetchPackages()).rejects.toMatchObject({
      code,
      message: "Error de API",
      status,
    });
  });

  it("rechaza respuestas con estructura invalida antes de llegar a la UI", async () => {
    storeSession();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ packages: [{ ...packageItem, status: "lost" }] })
    );

    await expect(fetchPackages()).rejects.toBeInstanceOf(PackageApiError);
  });

  it("falla como no autorizado cuando no hay token local", async () => {
    await expect(fetchPackages()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("actualiza estados relevantes y verifica QR sin tocar servidor real", async () => {
    storeSession();
    const deliveredPackage = { ...packageItem, status: "delivered" as const };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ id: deliveredPackage.id, package: deliveredPackage })
      )
      .mockResolvedValueOnce(jsonResponse({ package: deliveredPackage }));

    await expect(updatePackage(packageItem.id, { status: "delivered" })).resolves.toEqual(
      deliveredPackage
    );
    await expect(verifyPackageQr("QR-1")).resolves.toEqual({
      package: deliveredPackage,
      message: undefined,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
