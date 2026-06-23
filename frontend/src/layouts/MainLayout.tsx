import { useState } from "react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import type { TranslationKey } from "../i18n";
import type { Role } from "../services/auth";

// # `satisfies` valida las claves sin ensancharlas a string.
const navigationByRole = {
  conserje: [
    { labelKey: "nav.home", to: "/conserje" },
    { labelKey: "nav.registerPackage", to: "/conserje/registrar" },
    { labelKey: "nav.history", to: "/conserje/historial" },
    { labelKey: "nav.claims", to: "/conserje/reclamos" },
  ],
  residente: [
    { labelKey: "nav.packageHistory", to: "/residente" },
    { labelKey: "nav.myPackages", to: "/residente/mis-encomiendas" },
    { labelKey: "nav.claims", to: "/residente/reclamos" },
  ],
  administrador: [
    { labelKey: "nav.userManagement", to: "/admin" },
    { labelKey: "nav.authorizedEmails", to: "/admin/correos" },
    { labelKey: "nav.auditLogs", to: "/admin/logs" },
    { labelKey: "nav.claims", to: "/admin/reclamos" },
  ],
} satisfies Record<Role, { labelKey: TranslationKey; to: string }[]>;

const MainLayout = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);

  const navigationItems = user ? navigationByRole[user.role] : [];

  const renderNavigation = (className: string) => (
    // # Reutilizamos la misma navegación en desktop y móvil para no duplicar reglas por rol.
    <nav className={className}>
      {navigationItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/conserje" || item.to === "/residente" || item.to === "/admin"}
          onClick={() => setIsMobileNavigationOpen(false)}
          className={({ isActive }) =>
            `rounded-xl px-3 py-2 text-left transition ${
              isActive
                ? "bg-green-600 text-white"
                : "text-gray-200 hover:bg-[#3a3a3a]"
            }`
          }
        >
          {t(item.labelKey)}
        </NavLink>
      ))}
    </nav>
  );

  return (
    // # Esta raíz evita que se genere scroll horizontal indeseado en dispositivos pequeños.
    <div className="min-h-screen bg-[#1f1f1f] text-white overflow-x-hidden">
      <Navbar
        onToggleMobileNavigation={() =>
          setIsMobileNavigationOpen((current) => !current)
        }
      />

      {/* # Menú inferior para mobile: solo visible en pantallas pequeñas y permite scroll horizontal. */}
      <div className="border-b border-white/10 bg-[#222] px-4 py-3 md:hidden">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
          {t("layout.navigation")}
        </p>
        {isMobileNavigationOpen ? (
          renderNavigation("flex flex-col gap-2")
        ) : (
          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-2">
              {navigationItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/conserje" || item.to === "/residente" || item.to === "/admin"}
                  className={({ isActive }) =>
                    `rounded-full px-3 py-2 text-sm transition ${
                      isActive
                        ? "bg-green-600 text-white"
                        : "bg-white/5 text-gray-200 hover:bg-[#3a3a3a]"
                    }`
                  }
                >
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* # En desktop mostramos sidebar, en mobile queda oculta para ganar espacio. */}
      <div className="md:flex">
        <aside className="hidden w-64 bg-[#2a2a2a] p-4 md:block">
          <h1 className="mb-6 text-lg font-bold text-green-400">
            {t("common.appName")}
          </h1>

          {renderNavigation("flex flex-col gap-3")}
        </aside>

        {/* # min-w-0 evita que los hijos flex se desborden en pantallas pequeñas. */}
        <main className="flex-1 min-w-0 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
};

export default MainLayout;
