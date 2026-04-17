import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useI18n } from "../context/I18nContext";

// # Este tipo describe exactamente la forma en que el backend devuelve cada encomienda.
type PackageItem = {
  id: number;
  recipient_name: string;
  apartment_number: string;
  description: string | null;
  sender: string;
  delivery_date: string | null;
  status: "received" | "delivered" | "pending";
  created_at: string;
};

// # Esta estructura representa la respuesta de GET /api/packages.
type PackagesResponse = {
  packages: PackageItem[];
};

// # Este estado opcional llega desde la pantalla de registro para marcar la encomienda nueva.
type HistorialLocationState = {
  recentlyCreatedId?: number;
  recentlyCreatedRecipient?: string;
};

// # URL base del backend actual.
const API_URL = "http://localhost:3001";

// # Este mapa define el color visual de cada estado.
const statusClasses: Record<PackageItem["status"], string> = {
  received: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  delivered: "bg-green-500/15 text-green-300 border border-green-500/30",
  pending: "bg-yellow-500/15 text-yellow-300 border border-yellow-500/30",
};

const HistorialEncomiendas = () => {
  const { t, localeTag } = useI18n();

  // # Esta función formatea fechas del backend a un texto simple para el usuario.
  const formatDate = (value: string | null) => {
    if (!value) {
      return t("historial.date.none");
    }

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
      return t("historial.date.invalid");
    }

    return parsedDate.toLocaleDateString(localeTag, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const statusLabels: Record<PackageItem["status"], string> = {
    received: t("historial.status.received"),
    delivered: t("historial.status.delivered"),
    pending: t("historial.status.pending"),
  };

  // # Leemos el estado de navegación para saber si venimos desde un registro recién creado.
  const location = useLocation();
  const navigationState = (location.state ?? {}) as HistorialLocationState;

  // # Aquí guardamos el listado real obtenido desde el backend.
  const [packages, setPackages] = useState<PackageItem[]>([]);

  // # Este estado muestra feedback mientras la carga está en curso.
  const [isLoading, setIsLoading] = useState(true);

  // # Este estado muestra problemas de red o del backend.
  const [errorMessage, setErrorMessage] = useState("");

  // # Esta función centraliza la carga para poder reutilizarla en el botón "reintentar".
  const loadPackages = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(`${API_URL}/api/packages`);

      const contentType = response.headers.get("content-type") ?? "";
      const responseData: PackagesResponse | { message?: string } | null =
        contentType.includes("application/json") ? await response.json() : null;

      if (!response.ok) {
        const backendMessage =
          responseData && "message" in responseData
            ? responseData.message
            : t("historial.error.load");

        throw new Error(backendMessage || t("historial.error.load"));
      }

      setPackages(
        responseData && "packages" in responseData ? responseData.packages : []
      );
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error ? error.message : t("historial.error.network")
      );
    } finally {
      setIsLoading(false);
    }
  };

  // # Al entrar a la pantalla cargamos automáticamente las encomiendas.
  useEffect(() => {
    void loadPackages();
  }, []);

  return (
    <section className="flex flex-col gap-6">
      {/* # Encabezado de la pantalla de historial. */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-white">
          {t("historial.title")}
        </h1>
        <p className="text-sm text-gray-400">
          {t("historial.description")}
        </p>
      </div>

      {/* # Si venimos desde el formulario, mostramos un aviso para confirmar el registro reciente. */}
      {navigationState.recentlyCreatedId && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-200">
          {t("historial.recentSuccess", {
            recipient:
              navigationState.recentlyCreatedRecipient ??
              t("historial.recentRecipientFallback"),
          })}
        </div>
      )}

      {/* # Estado de carga mientras esperamos la respuesta del backend. */}
      {isLoading && (
        <div className="rounded-xl border border-white/10 bg-[#2a2a2a] p-5 text-sm text-gray-300">
          {t("historial.loading")}
        </div>
      )}

      {/* # Estado de error con botón de reintento para no dejar la pantalla bloqueada. */}
      {!isLoading && errorMessage && (
        <div className="flex flex-col gap-4 rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
          <p>{errorMessage}</p>
          <div>
            <button
              type="button"
              onClick={() => void loadPackages()}
              className="rounded-lg bg-red-500 px-4 py-2 font-medium text-white transition hover:bg-red-400"
            >
              {t("common.retry")}
            </button>
          </div>
        </div>
      )}

      {/* # Estado vacío cuando la carga fue correcta, pero todavía no hay registros. */}
      {!isLoading && !errorMessage && packages.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-[#2a2a2a] p-5 text-sm text-gray-300">
          {t("historial.empty")}
        </div>
      )}

      {/* # Tabla principal del historial cuando ya tenemos datos válidos. */}
      {!isLoading && !errorMessage && packages.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#2a2a2a]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-white">
              <thead className="bg-white/5 text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">
                    {t("historial.table.resident")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("historial.table.apartment")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("historial.table.sender")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("historial.table.deliveryDate")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("historial.table.createdAt")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("historial.table.status")}
                  </th>
                </tr>
              </thead>

              <tbody>
                {packages.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-t border-white/10 ${
                      item.id === navigationState.recentlyCreatedId
                        ? "bg-green-500/10"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-3">{item.recipient_name}</td>
                    <td className="px-4 py-3">{item.apartment_number}</td>
                    <td className="px-4 py-3">{item.sender}</td>
                    <td className="px-4 py-3">
                      {formatDate(item.delivery_date)}
                    </td>
                    <td className="px-4 py-3">{formatDate(item.created_at)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[item.status]}`}
                      >
                        {statusLabels[item.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};

export default HistorialEncomiendas;
