import { useState } from "react";
import type { PackageItem, PackageStatus } from "../services/packages";

type RecentPackagesProps = {
  title: string;
  packages: PackageItem[];
  localeTag: string;
  isLoading?: boolean;
  emptyMessage: string;
  loadingMessage: string;
  noDateLabel: string;
  invalidDateLabel: string;
  apartmentLabel: string;
  senderLabel: string;
  dateLabel: string;
  statusLabel: string;
  statusLabels: Record<PackageStatus, string>;
  isConserje?: boolean;
  onStatusChange?: (packageId: number, newStatus: PackageStatus) => Promise<void>;
  changeStatusLabel?: string;
};

const statusClasses: Record<PackageStatus, string> = {
  received: "border border-blue-500/30 bg-blue-500/15 text-blue-300",
  delivered: "border border-green-500/30 bg-green-500/15 text-green-300",
  pending: "border border-yellow-500/30 bg-yellow-500/15 text-yellow-300",
};

const formatDate = (
  value: string | null,
  localeTag: string,
  noDateLabel: string,
  invalidDateLabel: string
) => {
  if (!value) {
    return noDateLabel;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return invalidDateLabel;
  }

  return parsedDate.toLocaleDateString(localeTag, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const RecentPackages = ({
  title,
  packages,
  localeTag,
  isLoading = false,
  emptyMessage,
  loadingMessage,
  noDateLabel,
  invalidDateLabel,
  apartmentLabel,
  senderLabel,
  dateLabel,
  statusLabel,
  statusLabels,
  isConserje = false,
  onStatusChange,
  changeStatusLabel = "Cambiar estado",
}: RecentPackagesProps) => {
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const handleStatusChange = async (
    packageId: number,
    newStatus: PackageStatus
  ) => {
    if (!onStatusChange) return;

    setUpdatingId(packageId);
    try {
      await onStatusChange(packageId, newStatus);
      setOpenMenuId(null);
    } finally {
      setUpdatingId(null);
    }
  };
  return (
    <section className="rounded-xl border border-white/10 bg-[#2a2a2a] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <span className="text-xs text-gray-500">{packages.length}</span>
      </div>

      {/* # El componente muestra sus propios estados para que la página no tenga que duplicar este bloque. */}
      {isLoading && <p className="text-sm text-gray-400">{loadingMessage}</p>}

      {!isLoading && packages.length === 0 && (
        <p className="text-sm text-gray-400">{emptyMessage}</p>
      )}

      {!isLoading && packages.length > 0 && (
        // # Tabla responsive: permite scroll horizontal si no cabe en pantallas pequeñas.
        <div className="overflow-x-auto">
          <table className="min-w-[640px] w-full table-auto text-left text-sm">
            <thead className="text-gray-400">
              <tr>
                {/* # Evita que los encabezados de la tabla se rompan y asegura una fila compacta en móvil. */}
                <th className="pb-3 pr-3 whitespace-nowrap">{apartmentLabel}</th>
                <th className="pb-3 pr-3 whitespace-nowrap">{senderLabel}</th>
                <th className="pb-3 pr-3 whitespace-nowrap">{dateLabel}</th>
                <th className="pb-3 whitespace-nowrap">{statusLabel}</th>
              </tr>
            </thead>

            <tbody>
              {packages.map((item) => (
                <tr key={item.id} className="border-t border-white/10 text-gray-200">
                  <td className="py-3 pr-3 whitespace-nowrap">{item.apartment_number}</td>
                  <td className="py-3 pr-3 whitespace-nowrap">{item.sender}</td>
                  <td className="py-3 pr-3 whitespace-nowrap">
                    {formatDate(
                      item.delivery_date,
                      localeTag,
                      noDateLabel,
                      invalidDateLabel
                    )}
                  </td>
                  <td className="py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[item.status]}`}
                      >
                        {statusLabels[item.status]}
                      </span>

                      {/* Botón de cambio de estado solo para conserjes */}
                      {isConserje && onStatusChange && (
                        <div className="relative">
                          <button
                            onClick={() =>
                              setOpenMenuId(
                                openMenuId === item.id ? null : item.id
                              )
                            }
                            disabled={updatingId === item.id}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-gray-300 hover:bg-white/10 disabled:opacity-50"
                            title={changeStatusLabel}
                          >
                            {updatingId === item.id ? (
                              <>
                                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-500 border-t-gray-300" />
                              </>
                            ) : (
                              <>
                                <svg
                                  className="h-3 w-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                                  />
                                </svg>
                              </>
                            )}
                          </button>

                          {/* Menú desplegable de estados */}
                          {openMenuId === item.id && updatingId !== item.id && (
                            <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-md border border-white/10 bg-[#1a1a1a] shadow-lg">
                              {(
                                [
                                  "received",
                                  "pending",
                                  "delivered",
                                  "atraso",
                                ] as const
                              ).map((status) => (
                                <button
                                  key={status}
                                  onClick={() =>
                                    handleStatusChange(item.id, status)
                                  }
                                  className="block w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-white/5"
                                >
                                  {statusLabels[status]}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default RecentPackages;
