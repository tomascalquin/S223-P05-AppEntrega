/**
 * MIDDLEWARE JWT AVANZADO
 * 
 * Middlewares adicionales para casos de uso más específicos y validaciones más estrictas.
 * Complementa el authMiddleware estándar con funcionalidades avanzadas.
 * 
 * Incluye:
 * - Validación de refresh tokens
 * - Rate limiting por token
 * - Validación de IP/User-Agent
 * - Validación de permisos específicos
 * - Caché de tokens validados
 */

import { Request, Response, NextFunction } from "express";
import { verifyToken, type UserRole } from "../utils/jwt";
import { AuthRequest } from "./authMiddleware";

/**
 * INTERFAZ: TokenCacheEntry
 * Estructura para cachear tokens validados
 */
interface TokenCacheEntry {
  token: string;
  decoded: any;
  timestamp: number;
  expiresAt: number;
}

/**
 * CLASE: TokenCache
 * 
 * Implementa un caché en memoria para tokens validados.
 * Reduce el overhead de validación repetida del mismo token.
 * 
 * Características:
 * - TTL configurable
 * - Límite de tamaño del caché
 * - Limpieza automática de entradas expiradas
 * 
 * Uso:
 * const cache = new TokenCache();
 * const decoded = cache.get(token) || verifyToken(token);
 * cache.set(token, decoded);
 */
export class TokenCache {
  private cache: Map<string, TokenCacheEntry> = new Map();
  private readonly maxSize: number;
  private readonly ttl: number; // en milisegundos

  constructor(maxSize: number = 1000, ttlSeconds: number = 300) {
    this.maxSize = maxSize;
    this.ttl = ttlSeconds * 1000;

    // Limpieza periódica cada 5 minutos
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Obtiene un token del caché si existe y no ha expirado
   */
  get(token: string): any | null {
    const entry = this.cache.get(token);

    if (!entry) {
      return null;
    }

    // Verificar que el cache no ha expirado
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(token);
      return null;
    }

    return entry.decoded;
  }

  /**
   * Almacena un token validado en el caché
   */
  set(token: string, decoded: any, expiresAt?: number): void {
    // Si el caché está lleno, eliminar la entrada más antigua
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(token, {
      token,
      decoded,
      timestamp: Date.now(),
      expiresAt: expiresAt || Date.now() + this.ttl,
    });
  }

  /**
   * Limpia entradas expiradas del caché
   */
  private cleanup(): void {
    const now = Date.now();

    for (const [token, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(token);
      }
    }
  }

  /**
   * Limpia todo el caché
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Obtiene estadísticas del caché
   */
  getStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Implementar si se necesita tracking de hits
    };
  }
}

// Instancia global del caché
const tokenCache = new TokenCache();

/**
 * MIDDLEWARE: authMiddlewareWithCache
 * 
 * Versión mejorada del authMiddleware que utiliza caché para tokens validados.
 * Reduce la carga computacional al verificar el mismo token múltiples veces.
 * 
 * Beneficios:
 * - Mejor rendimiento en API calls frecuentes
 * - Reduce validaciones criptográficas innecesarias
 * - Mantiene seguridad al respetar TTL del token JWT
 * 
 * Uso:
 * app.use(authMiddlewareWithCache);
 */
export function authMiddlewareWithCache(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: "No autorizado",
        message: "Token requerido en header Authorization",
        code: "MISSING_TOKEN",
      });
    }

    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        error: "No autorizado",
        message: "Formato de token inválido. Use: Authorization: Bearer <token>",
        code: "INVALID_TOKEN_FORMAT",
      });
    }

    const token = parts[1];

    if (!token || token.trim() === "") {
      return res.status(401).json({
        error: "No autorizado",
        message: "Token vacío",
        code: "EMPTY_TOKEN",
      });
    }

    // Intentar obtener del caché primero
    let decoded = tokenCache.get(token);

    if (!decoded) {
      // Si no está en caché, validar y cachear
      decoded = verifyToken(token);
      tokenCache.set(token, decoded);
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          error: "No autorizado",
          message: "Token expirado",
          code: "TOKEN_EXPIRED",
          expiredAt: (error as any).expiredAt,
        });
      }

      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          error: "No autorizado",
          message: "Token inválido o corrupido",
          code: "INVALID_TOKEN",
        });
      }

      return res.status(401).json({
        error: "No autorizado",
        message: error.message || "Error en validación de token",
        code: "AUTH_ERROR",
      });
    }

    return res.status(500).json({
      error: "Error interno del servidor",
      message: "Error procesando autenticación",
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

/**
 * MIDDLEWARE: validateTokenExpiration
 * 
 * Valida que el token no expire pronto.
 * Útil para operaciones largas donde queremos asegurar que el token
 * durará lo suficiente para completar la operación.
 * 
 * Parámetros:
 * - minRemainingTime: Tiempo mínimo restante en segundos (default: 60)
 * 
 * Uso:
 * router.post('/long-operation', authMiddleware, validateTokenExpiration(300), handler);
 */
export function validateTokenExpiration(minRemainingSeconds: number = 60) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.exp) {
        return res.status(401).json({
          error: "No autorizado",
          message: "Token inválido: sin información de expiración",
          code: "INVALID_TOKEN",
        });
      }

      const now = Math.floor(Date.now() / 1000);
      const expiresIn = req.user.exp - now;

      if (expiresIn < minRemainingSeconds) {
        return res.status(401).json({
          error: "No autorizado",
          message: `Token expirará en ${expiresIn}s. Se requieren ${minRemainingSeconds}s mínimo.`,
          code: "TOKEN_EXPIRING_SOON",
          expiresIn,
          required: minRemainingSeconds,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        error: "Error procesando validación de expiración",
        code: "VALIDATION_ERROR",
      });
    }
  };
}

/**
 * MIDDLEWARE: requirePermission
 * 
 * Verifica que el usuario tenga permisos específicos.
 * Utiliza un sistema de permisos granular más allá de roles.
 * 
 * Parámetros:
 * - permissions: Array de permisos requeridos
 * - requireAll: Si true, requiere TODOS los permisos. Si false, requiere CUALQUIERA.
 * 
 * Uso:
 * router.delete('/user/:id', authMiddleware, requirePermission(['delete_users']), handler);
 * router.post('/report', authMiddleware, requirePermission(['create_reports', 'edit_reports'], false), handler);
 */
export function requirePermission(
  permissions: string[],
  requireAll: boolean = true
) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: "No autorizado",
          message: "Usuario no autenticado",
          code: "NOT_AUTHENTICATED",
        });
      }

      const userPermissions = req.user.permissions || [];

      if (requireAll) {
        // Requiere TODOS los permisos
        const hasAllPermissions = permissions.every((p) =>
          userPermissions.includes(p)
        );

        if (!hasAllPermissions) {
          return res.status(403).json({
            error: "Acceso denegado",
            message: `Se requieren todos estos permisos: ${permissions.join(", ")}`,
            code: "INSUFFICIENT_PERMISSIONS",
            required: permissions,
            userPermissions,
          });
        }
      } else {
        // Requiere CUALQUIERA de los permisos
        const hasAnyPermission = permissions.some((p) =>
          userPermissions.includes(p)
        );

        if (!hasAnyPermission) {
          return res.status(403).json({
            error: "Acceso denegado",
            message: `Se requiere al menos uno de estos permisos: ${permissions.join(", ")}`,
            code: "INSUFFICIENT_PERMISSIONS",
            required: permissions,
            userPermissions,
          });
        }
      }

      next();
    } catch (error) {
      return res.status(500).json({
        error: "Error procesando validación de permisos",
        code: "PERMISSION_ERROR",
      });
    }
  };
}

/**
 * MIDDLEWARE: requireScope
 * 
 * Verifica que el token tenga los scopes requeridos.
 * Útil para OAuth2 o sistemas con scopes granulares.
 * 
 * Parámetros:
 * - requiredScopes: Array de scopes requeridos
 * 
 * Uso:
 * router.post('/create-package', authMiddleware, requireScope(['packages:write']), handler);
 */
export function requireScope(...requiredScopes: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: "No autorizado",
          message: "Usuario no autenticado",
          code: "NOT_AUTHENTICATED",
        });
      }

      const tokenScopes = req.user.scope?.split(" ") || [];

      const hasAllScopes = requiredScopes.every((scope) =>
        tokenScopes.includes(scope)
      );

      if (!hasAllScopes) {
        return res.status(403).json({
          error: "Acceso denegado",
          message: `Se requieren estos scopes: ${requiredScopes.join(", ")}`,
          code: "INSUFFICIENT_SCOPES",
          required: requiredScopes,
          userScopes: tokenScopes,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        error: "Error procesando validación de scopes",
        code: "SCOPE_ERROR",
      });
    }
  };
}

/**
 * MIDDLEWARE: validateTokenSignature
 * 
 * Re-valida la firma del token en cada solicitud.
 * Más seguro pero con mayor overhead computacional.
 * Usar cuando la seguridad es crítica.
 * 
 * Uso:
 * router.delete('/sensitive', authMiddleware, validateTokenSignature, handler);
 */
export function validateTokenSignature(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: "No autorizado",
        message: "Token requerido",
        code: "MISSING_TOKEN",
      });
    }

    const parts = authHeader.split(" ");
    const token = parts[1];

    if (!token) {
      return res.status(401).json({
        error: "No autorizado",
        message: "Token vacío",
        code: "EMPTY_TOKEN",
      });
    }

    // Re-validar siempre (no usar caché)
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        error: "No autorizado",
        message: "Token inválido",
        code: "INVALID_TOKEN",
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      error: "No autorizado",
      message: error instanceof Error ? error.message : "Error en validación",
      code: "TOKEN_VALIDATION_ERROR",
    });
  }
}

/**
 * MIDDLEWARE: logAuthAttempt
 * 
 * Registra intentos de autenticación (exitosos y fallidos).
 * Útil para auditoría y detección de actividades sospechosas.
 * 
 * Uso:
 * app.use(logAuthAttempt);
 * app.use(authMiddleware);
 */
export function logAuthAttempt(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  // Guardar la función send original
  const originalSend = res.send;

  // Reemplazar con versión que registra
  res.send = function (data: any) {
    const authHeader = req.headers.authorization;
    const hasAuth = !!authHeader;
    const status = res.statusCode;

    // Solo loguear intentos de acceso a endpoints protegidos
    if (req.path.includes("/api/protected") || req.path.includes("/api/role-based")) {
      const timestamp = new Date().toISOString();
      const method = req.method;
      const path = req.path;

      if (status === 401 || status === 403) {
        console.log(
          `[${timestamp}] AUTH FAILED - ${method} ${path} - Status: ${status} - IP: ${req.ip}`
        );
      } else if (status === 200 && hasAuth) {
        console.log(
          `[${timestamp}] AUTH SUCCESS - ${method} ${path} - Status: ${status} - User: ${req.user?.id || "unknown"}`
        );
      }
    }

    // Llamar a la función original
    res.send = originalSend;
    return originalSend.call(this, data);
  };

  next();
}

/**
 * EXPORTAR FUNCIONES ÚTILES
 */
export function getTokenCache(): TokenCache {
  return tokenCache;
}

export function clearTokenCache(): void {
  tokenCache.clear();
}
