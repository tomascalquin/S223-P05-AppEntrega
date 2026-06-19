import jwt from "jsonwebtoken";

// ========================================
// TIPOS Y CONSTANTES
// ========================================

/**
 * Roles disponibles en el sistema
 */
export type UserRole = "conserje" | "residente";

/**
 * Payload del JWT que se guardaré en el token
 * Incluye información del usuario que se usa en toda la aplicación
 */
export interface TokenPayload {
  id: number;           // ID del usuario en la BD
  email: string;        // Email único del usuario
  name: string;         // Nombre completo
  role: UserRole;       // Rol (conserje o residente)
  username?: string;    // Nombre de usuario (opcional)
  iat?: number;         // Issued At (agregado automáticamente por JWT)
  exp?: number;         // Expiration (agregado automáticamente por JWT)
}

/**
 * Configuración de expiración de tokens
 * Define cuánto tiempo son válidos los diferentes tipos de tokens
 */
export const TOKEN_EXPIRATION = {
  ACCESS: process.env.JWT_EXPIRATION || "2h",          // Token de acceso: 2 horas
  REFRESH: process.env.JWT_REFRESH_EXPIRATION || "7d", // Refresh token: 7 días
};

// ========================================
// GENERACIÓN DE TOKENS
// ========================================

/**
 * FUNCIÓN: generateToken
 * 
 * Genera un JWT de acceso para un usuario autenticado.
 * 
 * El token contiene:
 * - ID del usuario
 * - Email
 * - Nombre
 * - Rol
 * - Firma digital (usando JWT_SECRET)
 * - Fecha de expiración (configurable en .env)
 * 
 * @param user - Información del usuario
 * @returns Token JWT válido
 * @throws Error si JWT_SECRET no está configurado
 */
export function generateToken(user: TokenPayload): string {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error(
      "JWT_SECRET no está configurado en variables de entorno"
    );
  }

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      username: user.username,
    } as TokenPayload,
    secret,
    {
      expiresIn: TOKEN_EXPIRATION.ACCESS,
      algorithm: "HS256", // Algoritmo de firma
      issuer: "app-encomiendas", // Emisor del token
      subject: String(user.id), // Sujeto (usuario)
    }
  );
}

/**
 * FUNCIÓN: generateRefreshToken
 * 
 * Genera un Refresh Token con expiración más larga.
 * Se usa para renovar el Access Token sin necesidad de re-autenticar.
 * 
 * @param userId - ID del usuario
 * @returns Refresh Token JWT
 */
export function generateRefreshToken(userId: number): string {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error(
      "JWT_SECRET no está configurado en variables de entorno"
    );
  }

  return jwt.sign(
    {
      id: userId,
      type: "refresh", // Identificar que es un refresh token
    },
    secret,
    {
      expiresIn: TOKEN_EXPIRATION.REFRESH,
      algorithm: "HS256",
      issuer: "app-encomiendas",
    }
  );
}

// ========================================
// VERIFICACIÓN DE TOKENS
// ========================================

/**
 * FUNCIÓN: verifyToken
 * 
 * Valida que un JWT sea:
 * - Sintácticamente correcto
 * - Firmado con la clave correcta
 * - No haya expirado
 * - No haya sido tampoco
 * 
 * @param token - JWT a validar
 * @returns Payload decodificado si es válido
 * @throws Error si el token es inválido o ha expirado
 */
export function verifyToken(token: string): TokenPayload {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error(
      "JWT_SECRET no está configurado en variables de entorno"
    );
  }

  return jwt.verify(token, secret, {
    algorithms: ["HS256"],
    issuer: "app-encomiendas",
  }) as TokenPayload;
}

/**
 * FUNCIÓN: verifyRefreshToken
 * 
 * Valida un Refresh Token específicamente.
 * Se usa cuando el usuario quiere renovar su Access Token.
 * 
 * @param token - Refresh Token a validar
 * @returns Payload decodificado
 */
export function verifyRefreshToken(token: string): any {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error(
      "JWT_SECRET no está configurado en variables de entorno"
    );
  }

  return jwt.verify(token, secret, {
    algorithms: ["HS256"],
    issuer: "app-encomiendas",
  });
}

/**
 * FUNCIÓN: decodeToken (sin verificación)
 * 
 * Decodifica un JWT sin verificar su validez.
 * ÚSALO SOLO PARA VER QUÉ CONTIENE, NO PARA AUTENTICACIÓN.
 * 
 * @param token - JWT a decodificar
 * @returns Payload o null si es inválido
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch {
    return null;
  }
}