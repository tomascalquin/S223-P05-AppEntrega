/**
 * CONFIGURACIÓN DE EXPRESS
 * 
 * Este archivo configura la aplicación Express con todas las rutas
 * y middleware necesarios para manejar autenticación JWT y endpoints protegidos.
 * 
 * RUTAS CONFIGURADAS:
 * - POST /auth/google            → Login con Google (público)
 * - GET  /auth/profile           → Perfil del usuario (protegido)
 * - GET  /api/protected/*        → Rutas protegidas con JWT
 */

import express, { Express } from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import protectedRoutes from "./routes/protectedRoutes";

/**
 * FUNCIÓN: createApp
 * 
 * Crea y configura la aplicación Express con todos los middlewares
 * y rutas necesarias.
 * 
 * @returns {Express} Aplicación Express configurada
 */
export function createApp(): Express {
  const app = express();

  /**
   * MIDDLEWARE: Parseo de JSON
   * 
   * Permite que Express interprete el cuerpo de las solicitudes
   * como JSON cuando el Content-Type es application/json
   */
  app.use(express.json());

  /**
   * MIDDLEWARE: Parseo de URL-encoded
   * 
   * Permite parsear datos enviados en formato application/x-www-form-urlencoded
   */
  app.use(express.urlencoded({ extended: true }));

  /**
   * MIDDLEWARE: CORS (Cross-Origin Resource Sharing)
   * 
   * Permite que aplicaciones frontend desde diferentes orígenes
   * accedan a esta API.
   * 
   * Configuración:
   * - origin: Permite solicitudes de cualquier origen (en producción, restringir)
   * - credentials: Permite envío de credenciales (cookies, tokens)
   * - methods: Métodos HTTP permitidos
   * - allowedHeaders: Headers que los clientes pueden enviar
   */
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || "*",
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  /**
   * RUTA: Health Check
   * 
   * Endpoint simple para verificar que el servidor está activo
   * 
   * Solicitud: GET /
   * Respuesta:
   * {
   *   "status": "OK",
   *   "message": "Servidor de encomiendas activo",
   *   "timestamp": "2026-05-26T10:30:00.000Z"
   * }
   */
  app.get("/", (req, res) => {
    res.json({
      status: "OK",
      message: "Servidor de encomiendas activo",
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * RUTAS DE AUTENTICACIÓN (público)
   * 
   * Incluye:
   * - POST /auth/google   → Login con Google
   * - GET  /auth/profile  → Perfil del usuario (protegido)
   */
  app.use("/auth", authRoutes);

  /**
   * RUTAS PROTEGIDAS (requieren JWT)
   * 
   * Todas estas rutas están protegidas por el middleware authMiddleware
   * que valida el token JWT en el header Authorization.
   * 
   * Incluye:
   * - GET    /api/protected/profile           → Obtener perfil del usuario
   * - GET    /api/protected/me                → Obtener datos del usuario actual
   * - PUT    /api/protected/profile           → Actualizar perfil
   * - GET    /api/protected/packages          → Listar paquetes
   * - POST   /api/protected/packages          → Crear paquete
   * - GET    /api/protected/packages/:id      → Obtener paquete específico
   * - DELETE /api/protected/packages/:id      → Eliminar paquete
   */
  app.use("/api/protected", protectedRoutes);

  /**
   * MANEJO DE RUTAS NO ENCONTRADAS (404)
   * 
   * Si una solicitud llega a una ruta que no existe,
   * retornamos error 404 con mensaje descriptivo.
   */
  app.use((req, res) => {
    res.status(404).json({
      error: "Ruta no encontrada",
      path: req.path,
      method: req.method,
      message: `No existe ruta ${req.method} ${req.path}`,
    });
  });

  /**
   * MIDDLEWARE: Manejo global de errores
   * 
   * Captura cualquier error no manejado en las rutas
   * y retorna una respuesta de error consistente.
   */
  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Error no manejado:", error);

    const statusCode = error.statusCode || 500;
    const message = error.message || "Error interno del servidor";

    res.status(statusCode).json({
      error: "Error del servidor",
      message: message,
      ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
    });
  });

  return app;
}

export default createApp;
