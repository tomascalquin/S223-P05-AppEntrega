import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardStats from "./DashboardStats";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import {
  PackageApiError,
  fetchConserjeDashboardStats,
  type ConserjeDashboardStats,
} from "../services/packages";
import { toastApiError } from "../lib/toast";

const formatDateTime = (
  value: string | null,
  localeTag: string,
  emptyLabel: string,
  invalidLabel: string
) => {
  if (!value) {
    return emptyLabel;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return invalidLabel;
  }

  return new Intl.DateTimeFormat(localeTag, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const emptyStats: ConserjeDashboardStats = {
  pending_total: 0,
  delivered_today: 0,
  oldest_pending_package: null,
};

const DashboardConserje = () => {
  const { t, localeTag } = useI18n();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<ConserjeDashboardStats>(emptyStats);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const nextStats = await fetchConserjeDashboardStats();
      setStats(nextStats);
    } catch (error) {
      console.error(error);

      if (error instanceof PackageApiError && error.code === "UNAUTHORIZED") {
        logout();
        navigate("/", { replace: true });
        return;
      }

      setErrorMessage(
        error instanceof Error ? error.message : t("conserjeDashboard.error.load")
      );
      toastApiError(error);
    } finally {
      setIsLoading(false);
    }
  }, [logout, navigate, t]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const oldestPackage = stats.oldest_pending_package;
  const statItems = [
    {
      label: t("conserjeDashboard.stats.pending"),
      value: stats.pending_total,
      tone: "yellow" as const,
    },
    {
      label: t("conserjeDashboard.stats.deliveredToday"),
      value: stats.delivered_today,
      tone: "green" as const,
    },
    {
      label: t("conserjeDashboard.stats.oldestPending"),
      value: oldestPackage ? 1 : 0,
      tone: "blue" as const,
    },
  ];

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-white">
            {t("conserjeDashboard.title")}
          </h1>
          <p className="text-sm text-gray-400">
            {t("conserjeDashboard.description")}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void loadStats()}
            disabled={isLoading}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? t("common.loading") : t("common.refresh")}
          </button>
          <Link
            to="/conserje/registrar"
            className="rounded-lg bg-green-600 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-green-700"
          >
            {t("conserjeDashboard.action.register")}
          </Link>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      <DashboardStats items={statItems} />

      <article className="rounded-xl border border-white/10 bg-[#2a2a2a] p-4 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {t("conserjeDashboard.oldest.title")}
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              {t("conserjeDashboard.oldest.description")}
            </p>
          </div>
          {oldestPackage && (
            <span className="w-fit rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-200">
              {t("historial.status.pending")}
            </span>
          )}
        </div>

        {isLoading && (
          <p className="mt-6 text-sm text-gray-400">
            {t("conserjeDashboard.loading")}
          </p>
        )}

        {!isLoading && !oldestPackage && (
          <div className="mt-6 rounded-lg border border-dashed border-white/15 bg-[#1f1f1f] p-4 text-sm text-gray-400">
            {t("conserjeDashboard.empty")}
          </div>
        )}

        {!isLoading && oldestPackage && (
          <dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-gray-500">
                {t("historial.table.resident")}
              </dt>
              <dd className="mt-1 font-medium text-white">
                {oldestPackage.recipient_name}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">
                {t("historial.table.apartment")}
              </dt>
              <dd className="mt-1 font-medium text-white">
                {oldestPackage.apartment_number}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">
                {t("historial.table.sender")}
              </dt>
              <dd className="mt-1 font-medium text-white">
                {oldestPackage.sender}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">
                {t("historial.table.createdAt")}
              </dt>
              <dd className="mt-1 font-medium text-white">
                {formatDateTime(
                  oldestPackage.created_at,
                  localeTag,
                  t("historial.date.none"),
                  t("historial.date.invalid")
                )}
              </dd>
            </div>
          </dl>
        )}
      </article>
    </section>
  );
};

export default DashboardConserje;
