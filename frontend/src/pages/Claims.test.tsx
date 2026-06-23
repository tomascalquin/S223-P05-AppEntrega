import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Claims from "./Claims";
import type { AuthUser } from "../services/auth";
import type { ClaimItem } from "../services/claims";
import type { PackageItem } from "../services/packages";

const navigateMock = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  user: null as AuthUser | null,
  logout: vi.fn(),
}));
const claimMocks = vi.hoisted(() => ({
  fetchClaims: vi.fn(),
  createClaim: vi.fn(),
  updateClaimStatus: vi.fn(),
}));
const packageMocks = vi.hoisted(() => ({
  fetchPackages: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("../context/I18nContext", () => ({
  useI18n: () => ({
    localeTag: "es-CL",
  }),
}));

vi.mock("../services/claims", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/claims")>()),
  fetchClaims: claimMocks.fetchClaims,
  createClaim: claimMocks.createClaim,
  updateClaimStatus: claimMocks.updateClaimStatus,
}));

vi.mock("../services/packages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/packages")>()),
  fetchPackages: packageMocks.fetchPackages,
}));

vi.mock("../lib/toast", () => ({
  toastApiError: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
}));

const resident: AuthUser = {
  id: "22",
  name: "Residente Dos",
  email: "residente2@example.com",
  username: "residente2",
  role: "residente",
};

const admin: AuthUser = {
  ...resident,
  id: "1",
  name: "Admin",
  email: "admin@example.com",
  username: "admin",
  role: "administrador",
};

const packageItem: PackageItem = {
  id: 3,
  recipient_name: resident.name,
  recipient_email: resident.email,
  apartment_number: "404",
  description: null,
  sender: "Tienda",
  delivery_date: "2026-06-23",
  status: "pending",
  retrieval_code: "QR-1",
  created_at: "2026-06-23T10:00:00.000Z",
  retrieved_at: null,
};

const claim: ClaimItem = {
  id: 8,
  package_id: packageItem.id,
  resident_id: 22,
  description: "La encomienda no corresponde al remitente esperado.",
  status: "open",
  created_at: "2026-06-23T10:00:00.000Z",
  package_recipient_name: resident.name,
  package_recipient_email: resident.email,
  package_apartment_number: packageItem.apartment_number,
  package_sender: packageItem.sender,
  resident_name: resident.name,
  resident_email: resident.email,
};

describe("Claims page", () => {
  beforeEach(() => {
    authState.user = resident;
    authState.logout.mockClear();
    navigateMock.mockClear();
    Object.values(claimMocks).forEach((mock) => mock.mockClear());
    Object.values(packageMocks).forEach((mock) => mock.mockClear());
  });

  it("muestra estado loading mientras carga reclamos", () => {
    claimMocks.fetchClaims.mockReturnValue(new Promise(() => undefined));
    packageMocks.fetchPackages.mockReturnValue(new Promise(() => undefined));

    render(<Claims />);

    expect(screen.getByText("Cargando reclamos...")).toBeVisible();
  });

  it("muestra formulario de residente y estado vacio sin reclamos", async () => {
    claimMocks.fetchClaims.mockResolvedValue([]);
    packageMocks.fetchPackages.mockResolvedValue([packageItem]);

    render(<Claims />);

    expect(await screen.findByText("Abrir reclamo")).toBeVisible();
    expect(await screen.findByText("Todavía no has abierto reclamos.")).toBeVisible();
    expect(packageMocks.fetchPackages).toHaveBeenCalledWith({
      recipient_name: resident.name,
    });
  });

  it("permite a residente crear un reclamo asociado a una encomienda", async () => {
    const user = userEvent.setup();
    claimMocks.fetchClaims.mockResolvedValue([]);
    packageMocks.fetchPackages.mockResolvedValue([packageItem]);
    claimMocks.createClaim.mockResolvedValue(claim);

    render(<Claims />);

    await screen.findByText("Abrir reclamo");
    await user.type(
      screen.getByLabelText("Descripción del problema"),
      "La encomienda no corresponde al remitente esperado."
    );
    await user.click(screen.getByRole("button", { name: "Crear reclamo" }));

    await waitFor(() =>
      expect(claimMocks.createClaim).toHaveBeenCalledWith({
        package_id: packageItem.id,
        description: "La encomienda no corresponde al remitente esperado.",
      })
    );
    expect(await screen.findByText(claim.description)).toBeVisible();
  });

  it("muestra estado error cuando falla la carga", async () => {
    claimMocks.fetchClaims.mockRejectedValue(new Error("No se pudieron cargar"));
    packageMocks.fetchPackages.mockResolvedValue([]);

    render(<Claims />);

    expect(await screen.findByText("No se pudieron cargar")).toBeVisible();
  });

  it("lista reclamos para admin/conserje y permite cambiar estado", async () => {
    const user = userEvent.setup();
    authState.user = admin;
    claimMocks.fetchClaims.mockResolvedValue([claim]);
    claimMocks.updateClaimStatus.mockResolvedValue({
      id: claim.id,
      claim: { ...claim, status: "in_review" },
      notification_warning: null,
    });

    render(<Claims />);

    expect(await screen.findByText("Reclamos registrados")).toBeVisible();
    expect(screen.getByText(claim.description)).toBeVisible();

    // # El cambio se prueba contra el servicio mockeado; el backend conserva la regla final de no reabrir cerrados.
    await user.selectOptions(screen.getByDisplayValue("Abierto"), "in_review");

    await waitFor(() =>
      expect(claimMocks.updateClaimStatus).toHaveBeenCalledWith(claim.id, "in_review")
    );
    expect(screen.getAllByText("En revisión").length).toBeGreaterThan(0);
  });
});
