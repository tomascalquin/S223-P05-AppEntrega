import { Request, Response } from "express";
import { googleClient } from "../config/oauth";
import { generateToken, type UserRole } from "../utils/jwt";

// Simulación temporal de usuarios
// Después esto lo puedes cambiar por MySQL
interface AppUser {
  id: number;
  email: string;
  name: string;
  picture?: string | null;
  role: UserRole;
  username?: string;
}

let fakeUsers: AppUser[] = [];
let nextId = 1;

/**
 * FUNCIÓN: Asignar rol por defecto
 * 
 * Determina el rol del usuario basado en su email o parámetro.
 * En el futuro esto vendría de la base de datos.
 * 
 * Lógica temporal:
 * - Si el email contiene "conserje", asignar rol "conserje"
 * - Si contiene "admin", asignar rol "conserje"
 * - De lo contrario, asignar "residente"
 */
function assignDefaultRole(email: string, requestRole?: UserRole): UserRole {
  // Si se especifica un rol en la solicitud, usarlo (para registro)
  if (requestRole) {
    return requestRole;
  }

  // Lógica para auto-asignar basada en email
  const lowerEmail = email.toLowerCase();
  if (lowerEmail.includes("conserje") || lowerEmail.includes("admin")) {
    return "conserje";
  }

  return "residente";
}

// Controlador para iniciar sesión con Google
export async function googleLogin(req: Request, res: Response) {
  // Extrae el token enviado por el frontend
  // También puede incluir un rol específico en el cuerpo de la solicitud
  const { token, role: requestRole } = req.body;

  // Valida que efectivamente haya llegado un token
  if (!token) {
    return res.status(400).json({
      error: "El token de Google es obligatorio",
    });
  }

  try {
    // Valida el token con Google
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    // Obtiene los datos del usuario desde el token validado
    const payload = ticket.getPayload();

    // Si por alguna razón no hay datos en el payload, algo salió mal
    if (!payload || !payload.email) {
      return res.status(401).json({
        error: "No se pudo validar la identidad del usuario",
      });
    }

    // Busca si el usuario ya existe en la "base de datos"
    let user = fakeUsers.find((u) => u.email === payload.email);

    // Si no existe, lo crea con rol asignado
    if (!user) {
      const assignedRole = assignDefaultRole(payload.email, requestRole);
      user = {
        id: nextId++,
        email: payload.email,
        name: payload.name || "Sin nombre",
        picture: payload.picture || null,
        role: assignedRole,
      };

      fakeUsers.push(user);
    }

    // Crea un JWT propio del sistema INCLUYENDO EL ROL
    const appToken = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      username: user.username,
    });

    // Devuelve respuesta exitosa CON EL ROL
    return res.status(200).json({
      message: "Inicio de sesión exitoso",
      token: appToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        picture: user.picture,
      },
    });
  } catch (error) {
    // Error general en autenticación con Google
    return res.status(500).json({
      error: "Error en autenticación SSO",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
}