import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";

/**
 * INTERFAZ: AuthRequest
 * Extiende Request de Express para incluir datos del usuario autenticado
 * permitiendo acceso a user dentro de rutas protegidas
 */
export interface AuthRequest extends Request {
  user?: any;
}

/**
 * MIDDLEWARE: authMiddleware
 * 
 * Valida JWT en el header Authorization de cada solicitud a rutas protegidas.
 * Extrae el token, lo verifica, y permite continuar si es válido.
 * 
 * Formato esperado del header:
 * Authorization: Bearer <token_jwt>
 * 
 * Errores manejados:
 * - 401: Token faltante, formato inválido, expirado o inválido
 * - Token expirado: expira después de 2 horas
 */
export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // 1. Obtiene el header Authorization
    const authHeader = req.headers.authorization;

    // 2. Valida que el header Authorization exista
    if (!authHeader) {
      return res.status(401).json({
        error: "No autorizado",
        message: "Token requerido en header Authorization",
        code: "MISSING_TOKEN",
      });
    }

    // 3. Extrae el token del formato "Bearer <token>"
    // El header viene en formato: "Authorization: Bearer eyJhbGciOi..."
    const parts = authHeader.split(" ");

    // 4. Valida que el formato sea correcto (debe tener 2 partes: "Bearer" y token)
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        error: "No autorizado",
        message: "Formato de token inválido. Use: Authorization: Bearer <token>",
        code: "INVALID_TOKEN_FORMAT",
      });
    }

    const token = parts[1];

    // 5. Valida que el token no esté vacío
    if (!token || token.trim() === "") {
      return res.status(401).json({
        error: "No autorizado",
        message: "Token vacío",
        code: "EMPTY_TOKEN",
      });
    }

    // 6. Verifica que el token sea válido usando la función verifyToken
    // Esto incluye validar la firma y la expiración
    const decoded = verifyToken(token);

    // 7. Guarda los datos del usuario en la request para uso posterior
    // Ahora las rutas protegidas pueden acceder a req.user
    req.user = decoded;

    // 8. Continúa con la siguiente función o controlador
    next();
  } catch (error) {
    // 9. Manejo de errores específicos de JWT
    if (error instanceof Error) {
      // Token expirado
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          error: "No autorizado",
          message: "Token expirado",
          code: "TOKEN_EXPIRED",
          expiredAt: (error as any).expiredAt,
        });
      }

      // Formato de token inválido o firma inválida
      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          error: "No autorizado",
          message: "Token inválido o corrupido",
          code: "INVALID_TOKEN",
        });
      }

      // Error general
      return res.status(401).json({
        error: "No autorizado",
        message: error.message || "Error en validación de token",
        code: "AUTH_ERROR",
      });
    }

    // Error desconocido
    return res.status(500).json({
      error: "Error interno del servidor",
      message: "Error procesando autenticación",
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

/**
 * MIDDLEWARE: optionalAuthMiddleware
 * 
 * Similar a authMiddleware pero no bloquea si no hay token.
 * Útil para endpoints que pueden ser públicos pero también aprovechar
 * datos del usuario si está autenticado.
 * 
 * Uso: Para endpoints que muestran diferentes datos según si está autenticado
 */
export function optionalAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    // Si no hay token, continúa sin autenticación
    if (!authHeader) {
      return next();
    }

    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0] === "Bearer" && parts[1]) {
      try {
        const decoded = verifyToken(parts[1]);
        req.user = decoded;
      } catch {
        // Si hay token pero es inválido, lo ignoramos en modo optional
        // No bloqueamos la solicitud
      }
    }

    next();
  } catch (error) {
    // En modo opcional, los errores no bloquean
    next();
  }
}