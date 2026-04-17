import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";

// Extiende el tipo Request para poder guardar el usuario autenticado
export interface AuthRequest extends Request {
  user?: any;
}

// Middleware que revisa si el usuario envió un token válido
export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  // Obtiene el header Authorization
  const authHeader = req.headers.authorization;

  // Si no existe el header, no puede entrar
  if (!authHeader) {
    return res.status(401).json({
      error: "No autorizado: falta token",
    });
  }

  // Normalmente el header viene así:
  // Authorization: Bearer eyJhbGciOi...
  const token = authHeader.split(" ")[1];

  // Si no se pudo extraer el token, se rechaza
  if (!token) {
    return res.status(401).json({
      error: "No autorizado: formato de token inválido",
    });
  }

  try {
    // Verifica que el token sea válido
    const decoded = verifyToken(token);

    // Guarda los datos del usuario en la request
    req.user = decoded;

    // Continúa con la siguiente función o ruta
    next();
  } catch (error) {
    // Si falla la verificación, el token es inválido o expiró
    return res.status(401).json({
      error: "Token inválido o expirado",
    });
  }
}