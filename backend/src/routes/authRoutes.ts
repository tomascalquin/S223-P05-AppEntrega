import { Router } from "express";
import { googleLogin, login, register, refreshAccessToken } from "../controllers/authController";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

// ========================================
// RUTAS PÚBLICAS (sin autenticación)
// ========================================

/**
 * POST /auth/register
 * 
 * Registra un nuevo usuario con email y contraseña.
 * 
 * Body:
 * {
 *   "email": "usuario@example.com",
 *   "password": "contraseña123",
 *   "name": "Juan Pérez",
 *   "username": "juanperez" (opcional),
 *   "role": "residente" (opcional)
 * }
 */
router.post("/register", register);

/**
 * POST /auth/login
 * 
 * Inicia sesión con credenciales de email y contraseña.
 * 
 * Body:
 * {
 *   "email": "usuario@example.com",
 *   "password": "contraseña123"
 * }
 * 
 * Respuesta:
 * {
 *   "accessToken": "eyJhbGc...",
 *   "refreshToken": "eyJhbGc...",
 *   "user": { id, email, name, role, ... }
 * }
 */
router.post("/login", login);

/**
 * POST /auth/refresh-token
 * 
 * Genera un nuevo access token usando un refresh token.
 * 
 * Body:
 * {
 *   "refreshToken": "eyJhbGc..."
 * }
 */
router.post("/refresh-token", refreshAccessToken);

/**
 * POST /auth/google
 * 
 * Inicia sesión con Google OAuth.
 * 
 * Body:
 * {
 *   "token": "google_id_token",
 *   "role": "residente" (opcional)
 * }
 */
router.post("/google", googleLogin);

// ========================================
// RUTAS PROTEGIDAS (requieren autenticación)
// ========================================

/**
 * GET /auth/profile
 * 
 * Obtiene la información del usuario autenticado.
 * Requiere: Authorization: Bearer <token>
 */
router.get("/profile", authMiddleware, (req, res) => {
  return res.status(200).json({
    message: "Acceso permitido a ruta protegida",
    user: req.user,
  });
});

/**
 * POST /auth/logout
 * 
 * Cierra la sesión del usuario.
 * Requiere: Authorization: Bearer <token>
 * 
 * Nota: El logout es principalmente en el cliente (eliminar tokens).
 * El backend puede mantener una lista de tokens revocados si es necesario.
 */
router.post("/logout", authMiddleware, (req, res) => {
  return res.status(200).json({
    message: "Sesión cerrada exitosamente",
  });
});

export default router;