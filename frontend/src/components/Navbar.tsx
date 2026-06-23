import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../context/I18nContext";
import LanguageSwitcher from "./LanguageSwitcher";
import NotificationBadge from "./NotificationBadge";
import NotificationsList from "./NotificationsList";

type NavbarProps = {
  onToggleMobileNavigation?: () => void;
};

const Navbar = ({ onToggleMobileNavigation }: NavbarProps) => {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    // # Navbar responsive: apila en mobile y cambia a fila en pantallas mayores.
    <div className="relative flex w-full min-w-0 flex-col gap-4 border-b border-white/10 bg-[#252525] p-4 text-white sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {user && onToggleMobileNavigation && (
            <button
              type="button"
              onClick={onToggleMobileNavigation}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white transition hover:bg-white/10 md:hidden"
              aria-label={t("common.openMenu")}
            >
              {t("layout.menu")}
            </button>
          )}
          <h1 className="font-bold">{t("common.appName")}</h1>
        </div>

        {!user && <LanguageSwitcher />}
      </div>

      {user && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <LanguageSwitcher />
          
          {/* NOTIFICATION BADGE */}
          <div className="relative">
            <NotificationBadge
              onClick={() => setShowNotifications(!showNotifications)}
              className="transition-transform hover:scale-110"
            />
          </div>

          <div className="min-w-0 text-left sm:text-right">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <p className="text-xs text-gray-400 truncate">
              {t(`common.roleLabel.${user.role}`)} · {user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-500"
          >
            {t("common.logout")}
          </button>
        </div>
      )}

      {/* PANEL DE NOTIFICACIONES (desplegable) */}
      {user && showNotifications && (
        <div className="absolute right-4 top-full z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-lg border border-white/10 bg-[#252525] p-4 shadow-2xl">
          <NotificationsList />
          <button
            onClick={() => setShowNotifications(false)}
            className="absolute right-2 top-2 text-gray-400 hover:text-white"
            aria-label={t("notifications.closePanel")}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default Navbar;
