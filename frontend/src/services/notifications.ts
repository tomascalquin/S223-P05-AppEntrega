/**
 * SERVICIO: Notificaciones (Frontend)
 * 
 * Maneja todas las peticiones HTTP a los endpoints de notificaciones.
 * Usa fetch optimizado para Bun con tipos TypeScript completos.
 */

import type {
  Notification,
  ApiNotificationResponse,
  PaginatedNotificationsResponse,
} from "../types/notification";
import { getStoredAccessToken } from "./auth";

/**
 * CONFIGURACIÓN: Base URL de la API
 * Usa la variable de entorno VITE_API_URL si está disponible
 */
const API_BASE_URL = import.meta.env.VITE_API_URL?.trim() || "http://localhost:3001";

/**
 * CLASE: NotificationService
 * Proporciona métodos para interactuar con los endpoints de notificaciones
 */
export class NotificationService {
  /**
   * MÉTODO: fetchNotifications
   * Obtiene las notificaciones del usuario autenticado
   *
   * @param page - Número de página (default: 1)
   * @param limit - Cantidad de resultados por página (default: 10)
   * @returns Respuesta con notificaciones paginadas
   * @throws Error si la solicitud falla o el usuario no está autenticado
   */
  static async fetchNotifications(
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedNotificationsResponse> {
    try {
      const token = getStoredAccessToken();
      if (!token) {
        throw new Error("No hay token de autenticación");
      }

      const url = new URL(`${API_BASE_URL}/api/notifications`);
      url.searchParams.append("page", page.toString());
      url.searchParams.append("limit", limit.toString());

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error obteniendo notificaciones");
      }

      const data: ApiNotificationResponse<PaginatedNotificationsResponse> =
        await response.json();

      return data.data;
    } catch (error) {
      throw new Error(
        `Error fetching notifications: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
    }
  }

  /**
   * MÉTODO: markNotificationAsRead
   * Marca una notificación específica como leída
   *
   * @param notificationId - ID de la notificación a marcar como leída
   * @returns Notificación actualizada
   * @throws Error si la solicitud falla o el usuario no tiene permisos
   */
  static async markNotificationAsRead(
    notificationId: number
  ): Promise<Notification> {
    try {
      const token = getStoredAccessToken();
      if (!token) {
        throw new Error("No hay token de autenticación");
      }

      const response = await fetch(
        `${API_BASE_URL}/api/notifications/${notificationId}/read`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.message || "Error marcando notificación como leída"
        );
      }

      const data: ApiNotificationResponse<Notification> =
        await response.json();

      return data.data;
    } catch (error) {
      throw new Error(
        `Error marking notification as read: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
    }
  }

  /**
   * MÉTODO: markAllNotificationsAsRead
   * Marca todas las notificaciones del usuario como leídas
   *
   * @returns Número de notificaciones actualizadas
   * @throws Error si la solicitud falla
   */
  static async markAllNotificationsAsRead(): Promise<number> {
    try {
      const token = getStoredAccessToken();
      if (!token) {
        throw new Error("No hay token de autenticación");
      }

      const response = await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.message || "Error marcando notificaciones como leídas"
        );
      }

      const data: ApiNotificationResponse<{ updated: number }> =
        await response.json();

      return data.data.updated;
    } catch (error) {
      throw new Error(
        `Error marking all notifications as read: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
    }
  }
}
