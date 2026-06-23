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
}: RecentPackagesProps) => {
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
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[item.status]}`}
                    >
                      {statusLabels[item.status]}
                    </span>
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
