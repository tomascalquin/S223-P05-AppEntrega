// Importa el cliente oficial de Google para validar tokens
import { OAuth2Client } from "google-auth-library";

// Crea una instancia del cliente OAuth usando el CLIENT_ID de Google
export const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);