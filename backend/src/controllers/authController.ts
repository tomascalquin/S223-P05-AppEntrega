import { Request, Response } from "express";
import bcryptjs from "bcryptjs";
import { generateToken, generateRefreshToken, verifyRefreshToken, type TokenPayload } from "../utils/jwt";
import { googleClient } from "../config/oauth";
import db from "../db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// ========================================
// TIPOS
// ========================================

interface AppUser extends RowDataPacket {
  id: number;
  email: string;
  name: string;
  username?: string;
  picture?: string | null;
  role: "conserje" | "residente";
  password_hash?: string;
  is_active: boolean;
}

// ========================================
// FUNCIONES AUXILIARES
// ========================================

/**
 * Roles de alto privilegio que NUNCA pueden auto-asignarse desde un endpoint
 * público (registro o alta automática vía Google). Solo se otorgan desde el
 * panel de administración interno.
 */
const PRIVILEGED_ROLES = new Set(["conserje", "administrador", "admin"]);

const FORBIDDEN_ROLE_MESSAGE = "No está permitido registrarse directamente con este rol";

/**
 * FUNCIÓN: Rechazar intentos de auto-asignación de roles privilegiados
 *
 * Si el cliente envía un rol privilegiado en una alta pública, responde
 * 403 de inmediato. Cualquier otro valor (o ausencia de rol) se ignora:
 * el registro público siempre crea cuentas "residente".
 */
function rejectPrivilegedSelfRegistration(
  res: Response,
  requestRole?: unknown
): boolean {
  if (typeof requestRole === "string" && PRIVILEGED_ROLES.has(requestRole.toLowerCase())) {
    res.status(403).json({ error: FORBIDDEN_ROLE_MESSAGE });
    return true;
  }
  return false;
}

/**
 * FUNCIÓN: Enviar respuesta de login exitoso
 */
function sendLoginSuccess(
  res: Response,
  user: AppUser,
  accessToken: string,
  refreshToken?: string
) {
  return res.status(200).json({
    message: "Inicio de sesión exitoso",
    data: {
      accessToken,
      refreshToken: refreshToken || null,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        username: user.username,
        picture: user.picture,
      },
    },
  });
}

// ========================================
// CONTROLADOR: REGISTRO DE USUARIO
// ========================================

/**
 * POST /auth/register
 * 
 * Registra un nuevo usuario en el sistema.
 * 
 * Body requerido:
 * {
 *   "email": "usuario@example.com",
 *   "password": "contraseña_segura",
 *   "name": "Juan Pérez",
 *   "username": "juanperez", (opcional)
 *   "role": "residente" (opcional, default: "residente")
 * }
 * 
 * Validaciones:
 * - Email debe ser único
 * - Contraseña mínimo 6 caracteres
 * - Email debe ser válido
 */
export async function register(req: Request, res: Response) {
  try {
    const { email, password, name, username, role: requestRole } = req.body;

    // Seguridad: el registro público nunca puede crear cuentas con rol privilegiado.
    if (rejectPrivilegedSelfRegistration(res, requestRole)) {
      return;
    }

    // Validaciones básicas
    if (!email || !password || !name) {
      return res.status(400).json({
        error: "Email, contraseña y nombre son requeridos",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "La contraseña debe tener al menos 6 caracteres",
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: "Formato de email inválido",
      });
    }

    // Verificar si el usuario ya existe
    const [existingUsers] = await db.query<AppUser[]>(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        error: "El email ya está registrado",
      });
    }

    // Hashear la contraseña
    const salt = await bcryptjs.genSalt(10);
    const passwordHash = await bcryptjs.hash(password, salt);

    // El registro público siempre crea residentes; el rol del body se ignora a propósito.
    const userRole = "residente";

    // Crear usuario en la BD
    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO users (email, password_hash, name, username, role, is_active)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [email, passwordHash, name, username || null, userRole]
    );

    const userId = result.insertId;

    // Obtener usuario creado
    const [newUsers] = await db.query<AppUser[]>(
      "SELECT id, email, name, username, role, picture FROM users WHERE id = ?",
      [userId]
    );

    const newUser = newUsers[0];

    // Generar tokens
    const accessToken = generateToken({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      username: newUser.username,
    });

    const refreshToken = generateRefreshToken(newUser.id);

    // Guardar refresh token en BD (opcional pero recomendado)
    const refreshTokenHash = await bcryptjs.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 días

    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
      [userId, refreshTokenHash, expiresAt]
    );

    return res.status(201).json({
      message: "Usuario registrado exitosamente",
      data: {
        accessToken,
        refreshToken,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          username: newUser.username,
        },
      },
    });
  } catch (error) {
    console.error("Error en registro:", error);
    return res.status(500).json({
      error: "Error al registrar usuario",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
}

// ========================================
// CONTROLADOR: LOGIN CON CREDENCIALES
// ========================================

/**
 * POST /auth/login
 * 
 * Autentica un usuario con email y contraseña.
 * 
 * Body requerido:
 * {
 *   "email": "usuario@example.com",
 *   "password": "contraseña"
 * }
 * 
 * Respuesta exitosa:
 * {
 *   "accessToken": "eyJhbGc...",
 *   "refreshToken": "eyJhbGc...",
 *   "user": { id, email, name, role, ... }
 * }
 * 
 * Errores:
 * - 400: Email o contraseña faltantes
 * - 401: Credenciales inválidas
 * - 403: Usuario inactivo
 */
export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    // Validar que email y contraseña estén presentes
    if (!email || !password) {
      return res.status(400).json({
        error: "Email y contraseña son requeridos",
      });
    }

    // Buscar usuario por email
    const [users] = await db.query<AppUser[]>(
      `SELECT id, email, name, username, picture, role, password_hash, is_active 
       FROM users WHERE email = ?`,
      [email]
    );

    const user = users[0];

    // Usuario no encontrado
    if (!user) {
      return res.status(401).json({
        error: "Credenciales inválidas",
      });
    }

    // Usuario inactivo
    if (!user.is_active) {
      return res.status(403).json({
        error: "La cuenta ha sido desactivada",
      });
    }

    // Validar contraseña
    const isPasswordValid = await bcryptjs.compare(password, user.password_hash || "");

    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Credenciales inválidas",
      });
    }

    // Generar tokens
    const accessToken = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      username: user.username,
    });

    const refreshToken = generateRefreshToken(user.id);

    // Guardar refresh token en BD
    const refreshTokenHash = await bcryptjs.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 días

    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
      [user.id, refreshTokenHash, expiresAt]
    );

    // Actualizar último login
    await db.query(
      "UPDATE users SET last_login = NOW() WHERE id = ?",
      [user.id]
    );

    // Remover password_hash antes de devolver el usuario
    delete user.password_hash;

    return sendLoginSuccess(res, user, accessToken, refreshToken);
  } catch (error) {
    console.error("Error en login:", error);
    return res.status(500).json({
      error: "Error en autenticación",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
}

// ========================================
// CONTROLADOR: REFRESH TOKEN
// ========================================

/**
 * POST /auth/refresh-token
 * 
 * Genera un nuevo access token usando un refresh token válido.
 * 
 * Body requerido:
 * {
 *   "refreshToken": "eyJhbGc..."
 * }
 * 
 * Uso:
 * Cuando el access token expira, el frontend puede usar
 * el refresh token para obtener uno nuevo sin re-autenticar.
 */
export async function refreshAccessToken(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: "Refresh token es requerido",
      });
    }

    // Verificar validez del refresh token
    const decoded = verifyRefreshToken(refreshToken) as any;
    const userId = decoded.id;

    // Obtener usuario de la BD
    const [users] = await db.query<AppUser[]>(
      `SELECT id, email, name, username, role, picture FROM users WHERE id = ? AND is_active = TRUE`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        error: "Usuario no encontrado o inactivo",
      });
    }

    const user = users[0];

    // Generar nuevo access token
    const newAccessToken = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      username: user.username,
    });

    return res.status(200).json({
      message: "Token renovado exitosamente",
      data: {
        accessToken: newAccessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Refresh token ha expirado",
        code: "REFRESH_TOKEN_EXPIRED",
      });
    }

    return res.status(401).json({
      error: "Refresh token inválido",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
}

// ========================================
// CONTROLADOR: LOGIN CON GOOGLE (Existente)
// ========================================

export async function googleLogin(req: Request, res: Response) {
  try {
    const { token, role: requestRole } = req.body;

    if (!token) {
      return res.status(400).json({
        error: "El token de Google es obligatorio",
      });
    }

    // Validar con Google
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      return res.status(401).json({
        error: "No se pudo validar la identidad del usuario",
      });
    }

    // Buscar o crear usuario
    const [users] = await db.query<AppUser[]>(
      "SELECT * FROM users WHERE email = ?",
      [payload.email]
    );

    let user = users[0];

    if (!user) {
      // Seguridad: la alta automática vía Google tampoco puede otorgar roles privilegiados.
      if (rejectPrivilegedSelfRegistration(res, requestRole)) {
        return;
      }

      // Crear nuevo usuario desde Google (siempre como residente)
      const [result] = await db.query<ResultSetHeader>(
        `INSERT INTO users (email, name, picture, role, is_active)
         VALUES (?, ?, ?, 'residente', TRUE)`,
        [payload.email, payload.name || "Sin nombre", payload.picture || null]
      );

      const [newUsers] = await db.query<AppUser[]>(
        "SELECT id, email, name, username, role, picture FROM users WHERE id = ?",
        [result.insertId]
      );

      user = newUsers[0];
    }

    // Generar tokens
    const accessToken = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      username: user.username,
    });

    const refreshToken = generateRefreshToken(user.id);

    // Guardar refresh token
    const refreshTokenHash = await bcryptjs.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
      [user.id, refreshTokenHash, expiresAt]
    );

    return sendLoginSuccess(res, user, accessToken, refreshToken);
  } catch (error) {
    console.error("Error en Google login:", error);
    return res.status(500).json({
      error: "Error en autenticación SSO",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
}