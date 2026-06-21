import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import type { Role } from "../context/AuthContext";

const Sidebar = () => {
  const { user } = useAuth();
  const { t } = useI18n();

  if (!user) return null;

  // # El menú es exhaustivo para los tres roles soportados por autenticación.
  const menu: Record<Role, { key: string; label: string }[]> = {
    conserje: [
      { key: "nav.home", label: t("nav.home") },
      { key: "nav.registerPackage", label: t("nav.registerPackage") },
      { key: "nav.history", label: t("nav.history") },
    ],
    residente: [
      { key: "nav.myPackages", label: t("nav.myPackages") },
      { key: "nav.notifications", label: t("nav.notifications") },
    ],
    administrador: [
      { key: "nav.userManagement", label: t("nav.userManagement") },
      { key: "nav.authorizedEmails", label: t("nav.authorizedEmails") },
      { key: "nav.auditLogs", label: t("nav.auditLogs") },
    ],
  };

  return (
    <div className="w-64 h-screen bg-gray-100 p-4">
      <ul className="flex flex-col gap-3">
        {menu[user.role].map((item) => (
          <li
            key={item.key}
            className="cursor-pointer rounded p-2 hover:bg-gray-200"
          >
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Sidebar;
