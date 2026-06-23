import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import {
  ClaimApiError,
  createClaim,
  fetchClaims,
  updateClaimStatus,
  type ClaimItem,
  type ClaimStatus,
} from "../services/claims";
import {
  PackageApiError,
  fetchPackages,
  type PackageItem,
} from "../services/packages";
import { toastApiError, toastSuccess, toastWarning } from "../lib/toast";

const statusLabels: Record<ClaimStatus, string> = {
  open: "Abierto",
  in_review: "En revisión",
  closed: "Cerrado",
};

const statusClasses: Record<ClaimStatus, string> = {
  open: "border border-blue-500/30 bg-blue-500/15 text-blue-300",
  in_review: "border border-yellow-500/30 bg-yellow-500/15 text-yellow-300",
  closed: "border border-green-500/30 bg-green-500/15 text-green-300",
};

const Claims = () => {
  const { user, logout } = useAuth();
  const { localeTag } = useI18n();
  const navigate = useNavigate();

  const isResident = user?.role === "residente";
  const canManageClaims = user?.role === "conserje" || user?.role === "administrador";

  const [claims, setClaims] = useState<ClaimItem[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [description, setDescription] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingClaimId, setUpdatingClaimId] = useState<number | null>(null);

  const availablePackages = useMemo(
    // # Permitimos reclamar cualquier encomienda propia, incluso si ya fue entregada.
    () => packages,
    [packages]
  );

  const formatDateTime = (value: string) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Fecha no válida";
    }

    return new Intl.DateTimeFormat(localeTag, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const loadClaims = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      // # El backend aplica el filtro final por rol; la UI solo consume la lista permitida.
      const [nextClaims, nextPackages] = await Promise.all([
        fetchClaims(),
        isResident && user?.name
          ? fetchPackages({ recipient_name: user.name })
          : Promise.resolve([]),
      ]);

      setClaims(nextClaims);
      setPackages(nextPackages);

      const firstPackage = nextPackages[0];

      if (firstPackage) {
        // # Seleccionamos una encomienda por defecto solo si el usuario aún no eligió otra.
        setSelectedPackageId((currentPackageId) =>
          currentPackageId || String(firstPackage.id)
        );
      }
    } catch (error) {
      console.error(error);

      if (
        (error instanceof ClaimApiError || error instanceof PackageApiError) &&
        error.code === "UNAUTHORIZED"
      ) {
        logout();
        navigate("/", { replace: true });
        return;
      }

      setErrorMessage(
        error instanceof Error ? error.message : "No se pudieron cargar los reclamos."
      );
      toastApiError(error);
    } finally {
      setIsLoading(false);
    }
  }, [isResident, logout, navigate, user?.name]);

  useEffect(() => {
    void loadClaims();
  }, [loadClaims]);

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const packageId = Number(selectedPackageId);
    const normalizedDescription = description.trim();

    if (!Number.isInteger(packageId) || packageId <= 0) {
      toastWarning("Selecciona una encomienda para asociar el reclamo.");
      return;
    }

    if (normalizedDescription.length < 10) {
      toastWarning("Describe el problema con al menos 10 caracteres.");
      return;
    }

    setIsSubmitting(true);

    try {
      // # El residente solo envía paquete y descripción; resident_id lo fija el backend desde el JWT.
      const createdClaim = await createClaim({
        package_id: packageId,
        description: normalizedDescription,
      });

      setClaims((currentClaims) => [createdClaim, ...currentClaims]);
      setDescription("");
      toastSuccess("Reclamo creado correctamente.");
    } catch (error) {
      console.error(error);
      toastApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (
    claim: ClaimItem,
    event: ChangeEvent<HTMLSelectElement>
  ) => {
    const nextStatus = event.target.value as ClaimStatus;

    if (claim.status === nextStatus) {
      return;
    }

    setUpdatingClaimId(claim.id);

    try {
      // # El backend bloquea la reapertura de reclamos cerrados; aquí solo reflejamos el resultado.
      const response = await updateClaimStatus(claim.id, nextStatus);

      setClaims((currentClaims) =>
        currentClaims.map((currentClaim) =>
          currentClaim.id === response.claim.id ? response.claim : currentClaim
        )
      );

      if (response.notification_warning) {
        toastWarning(response.notification_warning);
      } else {
        toastSuccess("Estado del reclamo actualizado y notificado.");
      }
    } catch (error) {
      console.error(error);
      toastApiError(error);
    } finally {
      setUpdatingClaimId(null);
    }
  };

  return (
    <section className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-white">Reclamos</h1>
        <p className="text-sm text-gray-400">
          {isResident
            ? "Reporta problemas asociados a tus encomiendas y revisa su seguimiento."
            : "Gestiona los reclamos abiertos por residentes y actualiza su estado."}
        </p>
      </div>

      {isResident && (
        <section className="rounded-xl border border-white/10 bg-[#2a2a2a] p-5">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">Abrir reclamo</h2>
            <p className="mt-1 text-sm text-gray-400">
              El reclamo quedará asociado a la encomienda seleccionada.
            </p>
          </div>

          <form onSubmit={handleCreateSubmit} className="grid gap-4 md:grid-cols-2">
            {/* # Solo mostramos paquetes disponibles del residente autenticado. */}
            <div>
              <label htmlFor="claim_package_id" className="text-sm text-gray-300">
                Encomienda
              </label>
              <select
                id="claim_package_id"
                value={selectedPackageId}
                onChange={(event) => setSelectedPackageId(event.target.value)}
                disabled={isSubmitting || availablePackages.length === 0}
                className="mt-1 w-full rounded border border-gray-600 bg-[#1f1f1f] p-2 text-white focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                {availablePackages.length === 0 ? (
                  <option value="">No hay encomiendas disponibles</option>
                ) : (
                  availablePackages.map((packageItem) => (
                    <option key={packageItem.id} value={packageItem.id}>
                      #{packageItem.id} - {packageItem.sender} - Depto {packageItem.apartment_number}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* # La descripción es obligatoria para que conserjería tenga contexto mínimo de gestión. */}
            <div className="md:col-span-2">
              <label htmlFor="claim_description" className="text-sm text-gray-300">
                Descripción del problema
              </label>
              <textarea
                id="claim_description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Ej: Mi encomienda aparece recibida, pero no corresponde al remitente esperado."
                className="mt-1 w-full rounded border border-gray-600 bg-[#1f1f1f] p-2 text-white placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={isSubmitting || availablePackages.length === 0}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Creando..." : "Crear reclamo"}
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">
          {isResident ? "Mis reclamos" : "Reclamos registrados"}
        </h2>
        <button
          type="button"
          onClick={() => void loadClaims()}
          disabled={isLoading}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Cargando..." : "Actualizar"}
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      {isLoading && (
        <div className="rounded-xl border border-white/10 bg-[#2a2a2a] p-5 text-sm text-gray-300">
          Cargando reclamos...
        </div>
      )}

      {!isLoading && !errorMessage && claims.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-[#2a2a2a] p-5 text-sm text-gray-300">
          {isResident
            ? "Todavía no has abierto reclamos."
            : "No hay reclamos registrados."}
        </div>
      )}

      {!isLoading && !errorMessage && claims.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#2a2a2a]">
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full table-auto text-left text-sm text-white">
              <thead className="bg-white/5 text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Residente</th>
                  <th className="px-4 py-3 font-medium">Encomienda</th>
                  <th className="px-4 py-3 font-medium">Descripción</th>
                  <th className="px-4 py-3 font-medium">Creado</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  {canManageClaims && (
                    <th className="px-4 py-3 font-medium">Gestión</th>
                  )}
                </tr>
              </thead>

              <tbody>
                {claims.map((claim) => {
                  const isUpdating = updatingClaimId === claim.id;

                  return (
                    <tr key={claim.id} className="border-t border-white/10">
                      <td className="px-4 py-3 whitespace-nowrap">#{claim.id}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{claim.resident_name}</div>
                        <div className="text-xs text-gray-500">{claim.resident_email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">
                          #{claim.package_id} - {claim.package_sender}
                        </div>
                        <div className="text-xs text-gray-500">
                          Depto {claim.package_apartment_number}
                        </div>
                      </td>
                      <td className="max-w-sm px-4 py-3 text-gray-200">
                        {claim.description}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDateTime(claim.created_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[claim.status]}`}
                        >
                          {statusLabels[claim.status]}
                        </span>
                      </td>
                      {canManageClaims && (
                        <td className="px-4 py-3 whitespace-nowrap">
                          <select
                            value={claim.status}
                            onChange={(event) => void handleStatusChange(claim, event)}
                            disabled={isUpdating || claim.status === "closed"}
                            className="rounded border border-gray-600 bg-[#1f1f1f] p-2 text-white focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <option value="open">Abierto</option>
                            <option value="in_review">En revisión</option>
                            <option value="closed">Cerrado</option>
                          </select>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};

export default Claims;
