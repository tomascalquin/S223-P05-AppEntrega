/**
 * TIPOS Y INTERFACES PARA NOTIFICACIONES (Frontend)
 * 
 * Define la estructura de datos para las notificaciones
 * que se usan en componentes React.
 */

/**
 * INTERFAZ: Notification
 * Representa una notificación individual
 */
export interface Notification {
  id: number;
  user_id: number;
  message: string;
  type: string | null;
  params: Record<string, string | number> | null;
  read: boolean;
  created_at: string; // ISO 8601 string
}

/**
 * INTERFAZ: PaginatedNotificationsResponse
 * Respuesta del servidor con notificaciones paginadas
 */
export interface PaginatedNotificationsResponse {
  notifications: Notification[];
  total: number;
  unread: number;
  hasMore: boolean;
}

/**
 * INTERFAZ: ApiNotificationResponse
 * Estructura general de respuesta del servidor
 */
export interface ApiNotificationResponse<T = unknown> {
  message: string;
  data: T;
}

/**
 * INTERFAZ: NotificationContextType
 * Define el estado y acciones disponibles en el contexto de notificaciones
 */
export interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  currentPage: number;
  
  // Acciones
  fetchNotifications: (page?: number, limit?: number) => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  loadMoreNotifications: () => Promise<void>;
  clearError: () => void;
}
