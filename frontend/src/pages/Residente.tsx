import { useEffect, useEffectEvent, useState } from "react";
import DashboardStats from "../components/DashboardStats";
import RecentPackages from "../components/RecentPackages";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import {
  fetchPackages,
  type PackageItem,
  type PackageStatus,
} from "../services/packages";

const Residente = () => {
  const { t, localeTag } = useI18n();
  const { user } = useAuth();

  // # El residente ve únicamente sus propios paquetes,
  // # usando su nombre autenticado como filtro contra el backend.
  const residentName = user?.role === "residente" ? user.name : "";

  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadPackages = useEffectEvent(async () => {
    if (!residentName) {
      setPackages([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const nextPackages = await fetchPackages({
        recipient_name: residentName,
      });

      setPackages(nextPackages);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error ? error.message : t("residente.error.load")
      );
    } finally {
      setIsLoading(false);
    }
  });

  useEffect(() => {
    void loadPackages();
  }, [residentName]);

  const statusLabels: Record<PackageStatus, string> = {
    received: t("historial.status.received"),
    delivered: t("historial.status.delivered"),
    pending: t("historial.status.pending"),
  };

  // # Estos contadores se recalculan desde los datos reales cada vez que cambia la lista.
  const stats = [
    {
      label: t("residente.stats.received"),
      value: packages.filter((item) => item.status === "received").length,
      tone: "blue" as const,
    },
    {
      label: t("residente.stats.pending"),
      value: packages.filter((item) => item.status === "pending").length,
      tone: "yellow" as const,
    },
    {
      label: t("residente.stats.delivered"),
      value: packages.filter((item) => item.status === "delivered").length,
      tone: "green" as const,
    },
  ];

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-white">
            {t("residente.title")}
          </h1>
          <p className="text-sm text-gray-400">{t("residente.description")}</p>
          {residentName && (
            <p className="text-xs text-gray-500">
              {t("residente.filter.mine", { recipient: residentName })}
            </p>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={() => void loadPackages()}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            {t("common.refresh")}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      <DashboardStats items={stats} />

      <RecentPackages
        title={t("residente.section.recent")}
        packages={packages.slice(0, 5)}
        localeTag={localeTag}
        isLoading={isLoading}
        emptyMessage={t("residente.empty")}
        loadingMessage={t("residente.loading")}
        noDateLabel={t("historial.date.none")}
        invalidDateLabel={t("historial.date.invalid")}
        apartmentLabel={t("historial.table.apartment")}
        senderLabel={t("historial.table.sender")}
        dateLabel={t("historial.table.deliveryDate")}
        statusLabel={t("historial.table.status")}
        statusLabels={statusLabels}
      />
    </section>
  );
};

export default Residente;
