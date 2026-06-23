/**
 * CONTEXTO: NotificationContext
 * 
 * Proporciona acceso global a las notificaciones y sus acciones.
 * Maneja el estado centralizado de notificaciones para toda la aplicación.
 * 
 * Uso:
 * ```tsx
 * const { notifications, unreadCount } = useNotifications();
 * ```
 */

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { NotificationService } from "../services/notifications";
import type {
  Notification,
  NotificationContextType,
} from "../types/notification";

/**
 * CREAR CONTEXTO
 * Tipo: NotificationContextType | undefined
 * Se inicializa como undefined, luego se llena en el proveedor
 */
const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

/**
 * PROVEEDOR: NotificationProvider
 * Envuelve la aplicación y proporciona acceso al contexto de notificaciones
 *
 * Props:
 * - children: Componentes hijos que tendrán acceso al contexto
 *
 * Estados:
 * - notifications: Array de notificaciones
 * - unreadCount: Número de notificaciones sin leer
 * - isLoading: Indica si se están cargando notificaciones
 * - error: Mensaje de error si hay alguno
 * - hasMore: Indica si hay más notificaciones para cargar
 * - currentPage: Página actual de paginación
 */
export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);

  /**
   * ACCIÓN: fetchNotifications
   * Obtiene las notificaciones del servidor
   * Con reintentos automáticos en caso de error de red
   */
  const fetchNotifications = useCallback(
    async (page: number = 1, limit: number = 10) => {
      try {
        setIsLoading(true);
        setError(null);

        const data = await NotificationService.fetchNotifications(page, limit);

        if (page === 1) {
          // Si es la primera página, reemplazar todas las notificaciones
          setNotifications(data.notifications);
        } else {
          // Si no, agregar a las existentes
          setNotifications((prev) => [...prev, ...data.notifications]);
        }

        setUnreadCount(data.unread);
        setHasMore(data.hasMore);
        setCurrentPage(page);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Error desconocido";
        setError(errorMessage);
        console.error("Error fetching notifications:", err);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * ACCIÓN: markAsRead
   * Marca una notificación específica como leída
   * Actualiza optimista el estado local antes de esperar respuesta del servidor
   */
  const markAsRead = useCallback(async (notificationId: number) => {
    try {
      setError(null);

      // Actualización optimista: cambiar estado local inmediatamente
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, read: true } : notif
        )
      );

      // Actualizar contador de sin leer
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // Llamar al servidor
      await NotificationService.markNotificationAsRead(notificationId);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error desconocido";
      setError(errorMessage);

      // Revertir cambios locales si la solicitud falla
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, read: false } : notif
        )
      );

      // Restaurar contador
      setUnreadCount((prev) => prev + 1);

      console.error("Error marking notification as read:", err);
    }
  }, []);

  /**
   * ACCIÓN: markAllAsRead
   * Marca todas las notificaciones como leídas
   */
  const markAllAsRead = useCallback(async () => {
    try {
      setError(null);

      // Actualización optimista
      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, read: true }))
      );
      setUnreadCount(0);

      // Llamar al servidor
      await NotificationService.markAllNotificationsAsRead();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error desconocido";
      setError(errorMessage);

      // Si falla, recargar desde el servidor
      fetchNotifications(1);

      console.error("Error marking all notifications as read:", err);
    }
  }, [fetchNotifications]);

  /**
   * ACCIÓN: loadMoreNotifications
   * Carga más notificaciones (página siguiente)
   */
  const loadMoreNotifications = useCallback(async () => {
    if (!hasMore || isLoading) return;

    const nextPage = currentPage + 1;
    await fetchNotifications(nextPage);
  }, [currentPage, hasMore, isLoading, fetchNotifications]);

  /**
   * ACCIÓN: clearError
   * Limpia el estado de error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * EFECTO: Cargar notificaciones cuando hay una sesión activa
   * Sin usuario autenticado no hay token, así que evitamos la llamada
   * (y la limpiamos al cerrar sesión para no dejar datos de otro usuario).
   */
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setHasMore(true);
      setCurrentPage(1);
      setError(null);
      return;
    }

    fetchNotifications(1);
  }, [user, fetchNotifications]);

  /**
   * VALOR DEL CONTEXTO
   * Todos estos valores y funciones estarán disponibles
   * para cualquier componente que use useNotifications()
   */
  const value: NotificationContextType = {
    notifications,
    unreadCount,
    isLoading,
    error,
    hasMore,
    currentPage,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    loadMoreNotifications,
    clearError,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

/**
 * HOOK: useNotifications
 * 
 * Hook personalizado para acceder al contexto de notificaciones
 * 
 * Uso:
 * ```tsx
 * const { notifications, unreadCount, markAsRead } = useNotifications();
 * ```
 * 
 * @returns NotificationContextType con todos los valores y acciones
 * @throws Error si se usa fuera de NotificationProvider
 */
export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error(
      "useNotifications debe ser usado dentro de NotificationProvider"
    );
  }

  return context;
};
