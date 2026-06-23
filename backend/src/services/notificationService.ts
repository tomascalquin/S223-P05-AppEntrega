/**
 * SERVICIO: NotificationService
 * 
 * Contiene toda la lógica de negocio para manejar notificaciones.
 * Abstrae la interacción con la base de datos y proporciona
 * métodos reutilizables para crear, obtener y actualizar notificaciones.
 */

import db from "../db";
import type {
  Notification,
  CreateNotificationDto,
  NotificationResponse,
  PaginatedNotificationsResponse,
} from "../types/notification";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

/**
 * CLASE: NotificationService
 * Proporciona métodos estáticos para operaciones de notificaciones
 */
export class NotificationService {
  /**
   * MÉTODO: createNotification
   * Crea una nueva notificación en la base de datos
   *
   * @param data - Datos de la notificación a crear
   * @returns Notificación creada con su ID
   * @throws Error si no se puede crear la notificación
   */
  static async createNotification(
    data: CreateNotificationDto
  ): Promise<Notification> {
    try {
      const [result] = await db.query<ResultSetHeader>(
        "INSERT INTO notifications (user_id, message, type, params) VALUES (?, ?, ?, ?)",
        [
          data.user_id,
          data.message,
          data.type ?? null,
          data.params ? JSON.stringify(data.params) : null,
        ]
      );

      return {
        id: result.insertId,
        user_id: data.user_id,
        message: data.message,
        type: data.type ?? null,
        params: data.params ?? null,
        read: false,
        created_at: new Date(),
      };
    } catch (error) {
      throw new Error(
        `Error creando notificación: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
    }
  }

  /**
   * MÉTODO: getNotificationsByUserId
   * Obtiene todas las notificaciones de un usuario con paginación
   *
   * @param userId - ID del usuario
   * @param page - Número de página (default: 1)
   * @param limit - Cantidad de resultados por página (default: 10)
   * @returns Notificaciones del usuario con metadata de paginación
   * @throws Error si no se pueden obtener las notificaciones
   */
  static async getNotificationsByUserId(
    userId: number,
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedNotificationsResponse> {
    try {
      const offset = (page - 1) * limit;

      // Obtener notificaciones con paginación
      const [notifications] = await db.query<RowDataPacket[]>(
        `SELECT id, user_id, message, type, params, \`read\`, created_at
         FROM notifications
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      );

      // Obtener total de notificaciones del usuario
      const [countResult] = await db.query<RowDataPacket[]>(
        "SELECT COUNT(*) as total FROM notifications WHERE user_id = ?",
        [userId]
      );

      // Obtener cantidad de notificaciones sin leer
      const [unreadResult] = await db.query<RowDataPacket[]>(
        "SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND `read` = FALSE",
        [userId]
      );

      const total = (countResult[0] as any).total;
      const unread = (unreadResult[0] as any).unread;
      const hasMore = offset + limit < total;

      // Formatear respuesta
      const formattedNotifications: NotificationResponse[] = notifications.map(
        (row: any) => ({
          id: row.id,
          user_id: row.user_id,
          message: row.message,
          type: row.type ?? null,
          params: this.parseParams(row.params),
          read: Boolean(row.read),
          created_at: new Date(row.created_at).toISOString(),
        })
      );

      return {
        notifications: formattedNotifications,
        total,
        unread,
        hasMore,
      };
    } catch (error) {
      throw new Error(
        `Error obteniendo notificaciones: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
    }
  }

  /**
   * MÉTODO: getNotificationById
   * Obtiene una notificación específica por su ID
   *
   * @param notificationId - ID de la notificación
   * @returns Notificación encontrada o null
   * @throws Error si no se puede obtener la notificación
   */
  static async getNotificationById(
    notificationId: number
  ): Promise<NotificationResponse | null> {
    try {
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT id, user_id, message, type, params, `read`, created_at FROM notifications WHERE id = ?",
        [notificationId]
      );

      if (rows.length === 0) {
        return null;
      }

      const row = rows[0] as any;
      return {
        id: row.id,
        user_id: row.user_id,
        message: row.message,
        type: row.type ?? null,
        params: this.parseParams(row.params),
        read: Boolean(row.read),
        created_at: new Date(row.created_at).toISOString(),
      };
    } catch (error) {
      throw new Error(
        `Error obteniendo notificación: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
    }
  }

  /**
   * MÉTODO: parseParams
   * mysql2 devuelve las columnas JSON ya parseadas, pero algunos drivers/mocks
   * las entregan como string; este helper soporta ambos casos sin romper.
   */
  private static parseParams(
    rawParams: unknown
  ): Record<string, string | number> | null {
    if (!rawParams) {
      return null;
    }

    if (typeof rawParams === "string") {
      try {
        return JSON.parse(rawParams);
      } catch {
        return null;
      }
    }

    return rawParams as Record<string, string | number>;
  }

  /**
   * MÉTODO: markNotificationAsRead
   * Marca una notificación como leída (read: true)
   *
   * @param notificationId - ID de la notificación a marcar como leída
   * @returns Notificación actualizada
   * @throws Error si no se puede actualizar la notificación
   */
  static async markNotificationAsRead(
    notificationId: number
  ): Promise<NotificationResponse | null> {
    try {
      const [result] = await db.query<ResultSetHeader>(
        "UPDATE notifications SET `read` = TRUE WHERE id = ?",
        [notificationId]
      );

      if (result.affectedRows === 0) {
        return null;
      }

      return this.getNotificationById(notificationId);
    } catch (error) {
      throw new Error(
        `Error marcando notificación como leída: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
    }
  }

  /**
   * MÉTODO: markAllNotificationsAsRead
   * Marca todas las notificaciones de un usuario como leídas
   *
   * @param userId - ID del usuario
   * @returns Número de notificaciones actualizadas
   * @throws Error si no se pueden actualizar las notificaciones
   */
  static async markAllNotificationsAsRead(userId: number): Promise<number> {
    try {
      const [result] = await db.query<ResultSetHeader>(
        "UPDATE notifications SET `read` = TRUE WHERE user_id = ? AND `read` = FALSE",
        [userId]
      );

      return result.affectedRows;
    } catch (error) {
      throw new Error(
        `Error marcando notificaciones como leídas: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
    }
  }

  /**
   * MÉTODO: deleteNotification
   * Elimina una notificación específica
   *
   * @param notificationId - ID de la notificación a eliminar
   * @returns true si se eliminó, false si no se encontró
   * @throws Error si no se puede eliminar la notificación
   */
  static async deleteNotification(notificationId: number): Promise<boolean> {
    try {
      const [result] = await db.query<ResultSetHeader>(
        "DELETE FROM notifications WHERE id = ?",
        [notificationId]
      );

      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(
        `Error eliminando notificación: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
    }
  }

  /**
   * MÉTODO: deleteOldNotifications
   * Elimina notificaciones antiguas (más de X días) para mantener la BD limpia
   *
   * @param daysOld - Cantidad de días a retener (default: 30)
   * @returns Número de notificaciones eliminadas
   * @throws Error si no se pueden eliminar las notificaciones
   */
  static async deleteOldNotifications(daysOld: number = 30): Promise<number> {
    try {
      const [result] = await db.query<ResultSetHeader>(
        `DELETE FROM notifications
         WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [daysOld]
      );

      return result.affectedRows;
    } catch (error) {
      throw new Error(
        `Error eliminando notificaciones antiguas: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
    }
  }
}
