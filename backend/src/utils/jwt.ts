// Importa la librería para crear y validar tokens JWT
import jwt from "jsonwebtoken";

// Define la estructura básica del payload que guardaremos en el token
type UserPayload = {
  id: number;
  email: string;
  name: string;
};

// Función para generar un JWT cuando el usuario inicia sesión correctamente
export function generateToken(user: UserPayload): string {
  // jwt.sign crea el token
  // Primer parámetro: datos que queremos guardar
  // Segundo parámetro: clave secreta
  // Tercer parámetro: configuración del token
  return jwt.sign(user, process.env.JWT_SECRET as string, {
    expiresIn: "2h", // El token dura 2 horas
  });
}

// Función para verificar si un JWT es válido
export function verifyToken(token: string) {
  // jwt.verify valida firma y expiración
  return jwt.verify(token, process.env.JWT_SECRET as string);
}