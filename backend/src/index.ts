/**
 * PUNTO DE ENTRADA DEL SERVIDOR EXPRESS
 * 
 * Este archivo inicia el servidor Express que maneja:
 * - Autenticación con Google (OAuth)
 * - Rutas protegidas con JWT
 * - API REST de encomiendas
 * 
 * Puerto: 3000
 * 
 * USO:
 * bun run src/index.ts
 */

import createApp from "./app";

// Crear la aplicación Express
const app = createApp();

// Configurar el puerto (por defecto 3000)
const PORT = process.env.PORT || 3000;

// Iniciar el servidor
app.listen(PORT, () => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 SERVIDOR EXPRESS INICIADO");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📡 Puerto: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log("");
  console.log("📚 ENDPOINTS DISPONIBLES:");
  console.log("");
  console.log("  🔓 PÚBLICOS (sin autenticación):");
  console.log("    POST   /auth/google               Login con Google");
  console.log("");
  console.log("  🔐 AUTENTICADOS (requieren JWT):");
  console.log("    GET    /auth/profile              Obtener perfil");
  console.log("    GET    /api/protected/profile     Datos del usuario");
  console.log("    GET    /api/protected/me          Info del usuario actual");
  console.log("    PUT    /api/protected/profile     Actualizar perfil");
  console.log("    GET    /api/protected/packages    Listar paquetes");
  console.log("    POST   /api/protected/packages    Crear paquete");
  console.log("    GET    /api/protected/packages/:id Obtener paquete");
  console.log("    DELETE /api/protected/packages/:id Eliminar paquete");
  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log("💡 USAR JWT:");
  console.log("   Authorization: Bearer <token>");
  console.log("");
});
