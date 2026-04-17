import { Request, Response } from "express";
import { googleClient } from "../config/oauth";
import { generateToken } from "../utils/jwt";

// Simulación temporal de usuarios
// Después esto lo puedes cambiar por MySQL
let fakeUsers: any[] = [];
let nextId = 1;

// Controlador para iniciar sesión con Google
export async function googleLogin(req: Request, res: Response) {
  // Extrae el token enviado por el frontend
  const { token } = req.body;

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

    // Si no existe, lo crea
    if (!user) {
      user = {
        id: nextId++,
        email: payload.email,
        name: payload.name || "Sin nombre",
        picture: payload.picture || null,
      };

      fakeUsers.push(user);
    }

    // Crea un JWT propio del sistema
    const appToken = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    // Devuelve respuesta exitosa
    return res.status(200).json({
      message: "Inicio de sesión exitoso",
      token: appToken,
      user,
    });
  } catch (error) {
    // Error general en autenticación con Google
    return res.status(500).json({
      error: "Error en autenticación SSO",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
}