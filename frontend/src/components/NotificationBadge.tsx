/**
 * COMPONENTE: NotificationBadge
 * 
 * Badge que muestra el contador de notificaciones sin leer en la navbar.
 * Se integra en la parte superior derecha del navbar.
 * 
 * Características:
 * - Muestra contador de notificaciones sin leer
 * - Se oculta si no hay notificaciones sin leer
 * - Click abre el panel de notificaciones
 * - Animación suave de entrada/salida
 */

import { useNotifications } from "../context/NotificationContext";
import { useI18n } from "../context/I18nContext";

interface NotificationBadgeProps {
  /** Callback cuando se hace click en el badge */
  onClick?: () => void;
  /** Clase CSS adicional para personalizar estilos */
  className?: string;
}

/**
 * COMPONENTE: NotificationBadge
 * 
 * Muestra un badge con el número de notificaciones sin leer
 * 
 * @param onClick - Función a ejecutar cuando se hace click
 * @param className - Clases Tailwind CSS adicionales
 * @returns JSX Element con el badge
 */
const NotificationBadge = ({
  onClick,
  className = "",
}: NotificationBadgeProps) => {
  const { unreadCount } = useNotifications();
  const { t } = useI18n();
  const unreadLabel = t("notifications.unreadAriaLabel", { count: unreadCount });

  return (
    <button
      onClick={onClick}
      className={`relative inline-flex items-center justify-center ${className}`}
      aria-label={unreadLabel}
      title={unreadLabel}
    >
      {/* ICONO DE CAMPANA */}
      <div className="text-white transition-colors hover:text-gray-300">
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
      </div>

      {/* BADGE CON CONTADOR */}
      {unreadCount > 0 && (
        <span
          className={`absolute right-0 top-0 inline-flex items-center justify-center
            h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold
            transform -translate-y-2 translate-x-2
            animation-in fade-in-0 duration-200`}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
};

export default NotificationBadge;
