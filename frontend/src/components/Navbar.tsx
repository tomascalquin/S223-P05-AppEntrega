import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../context/I18nContext";
import LanguageSwitcher from "./LanguageSwitcher";

type NavbarProps = {
  onToggleMobileNavigation?: () => void;
};

const Navbar = ({ onToggleMobileNavigation }: NavbarProps) => {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="flex w-full flex-col gap-4 border-b border-white/10 bg-[#252525] p-4 text-white sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center justify-between gap-3">
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
          <div className="text-left sm:text-right">
            <p className="text-sm font-medium text-white">{user.name}</p>
            <p className="text-xs text-gray-400">
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
    </div>
  );
};

export default Navbar;
