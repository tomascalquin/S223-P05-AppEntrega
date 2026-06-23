/**
 * TEST: JWT Authentication System
 * 
 * Pruebas para validar que el sistema de autenticación JWT funcione correctamente.
 * 
 * Ejecutar:
 * bun run tests/test-jwt-complete.ts
 */

import type { Server } from "bun";

const BASE_URL = "http://localhost:3001";

// Variables globales para almacenar tokens y datos
let accessToken: string = "";
let refreshToken: string = "";
let userId: number = 0;

/**
 * FUNCIÓN: Hacer solicitud HTTP
 */
async function request(
  method: string,
  endpoint: string,
  body?: any,
  headers: Record<string, string> = {}
) {
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  const data = await response.json();

  return {
    status: response.status,
    data,
  };
}

/**
 * TEST 1: Registro de usuario
 */
async function testRegister() {
  console.log("\n📝 TEST 1: Registro de usuario");
  console.log("─".repeat(50));

  const result = await request("POST", "/auth/register", {
    email: "test@example.com",
    password: "password123",
    name: "Test User",
    username: "testuser",
  });

  if (result.status === 201) {
    console.log("✅ Registro exitoso");
    console.log(`   Email: ${result.data.data.user.email}`);
    console.log(`   Name: ${result.data.data.user.name}`);
    console.log(`   Role: ${result.data.data.user.role}`);

    accessToken = result.data.data.accessToken;
    refreshToken = result.data.data.refreshToken;
    userId = result.data.data.user.id;

    console.log(`   Access Token: ${accessToken.substring(0, 20)}...`);
    console.log(`   Refresh Token: ${refreshToken.substring(0, 20)}...`);
  } else {
    console.log(`❌ Error: ${result.status}`);
    console.log(`   ${result.data.error}`);
  }
}

/**
 * TEST 2: Login con credenciales
 */
async function testLogin() {
  console.log("\n🔐 TEST 2: Login con credenciales");
  console.log("─".repeat(50));

  const result = await request("POST", "/auth/login", {
    email: "test@example.com",
    password: "password123",
  });

  if (result.status === 200) {
    console.log("✅ Login exitoso");
    console.log(`   Email: ${result.data.data.user.email}`);
    console.log(`   Role: ${result.data.data.user.role}`);

    accessToken = result.data.data.accessToken;
    refreshToken = result.data.data.refreshToken;

    console.log(`   Access Token generado`);
    console.log(`   Refresh Token generado`);
  } else {
    console.log(`❌ Error: ${result.status}`);
    console.log(`   ${result.data.error}`);
  }
}

/**
 * TEST 3: Acceder a ruta protegida
 */
async function testProtectedRoute() {
  console.log("\n🛡️  TEST 3: Acceder a ruta protegida");
  console.log("─".repeat(50));

  const result = await request("GET", "/auth/profile", null, {
    Authorization: `Bearer ${accessToken}`,
  });

  if (result.status === 200) {
    console.log("✅ Acceso permitido a ruta protegida");
    console.log(`   User ID: ${result.data.user.id}`);
    console.log(`   Email: ${result.data.user.email}`);
    console.log(`   Role: ${result.data.user.role}`);
  } else {
    console.log(`❌ Error: ${result.status}`);
    console.log(`   ${result.data.error}`);
  }
}

/**
 * TEST 4: Renovar token
 */
async function testRefreshToken() {
  console.log("\n🔄 TEST 4: Renovar Access Token");
  console.log("─".repeat(50));

  const result = await request("POST", "/auth/refresh-token", {
    refreshToken: refreshToken,
  });

  if (result.status === 200) {
    console.log("✅ Token renovado exitosamente");

    const newAccessToken = result.data.data.accessToken;
    accessToken = newAccessToken;

    console.log(`   Nuevo Access Token: ${newAccessToken.substring(0, 20)}...`);
    console.log(`   Usuario: ${result.data.data.user.email}`);
  } else {
    console.log(`❌ Error: ${result.status}`);
    console.log(`   ${result.data.error}`);
  }
}

/**
 * TEST 5: Token inválido
 */
async function testInvalidToken() {
  console.log("\n❌ TEST 5: Intentar acceso con token inválido");
  console.log("─".repeat(50));

  const result = await request("GET", "/auth/profile", null, {
    Authorization: "Bearer invalid_token_12345",
  });

  if (result.status === 401) {
    console.log("✅ Acceso denegado correctamente");
    console.log(`   Error: ${result.data.error}`);
    console.log(`   Código: ${result.data.code}`);
  } else {
    console.log(`❌ Respuesta inesperada: ${result.status}`);
  }
}

/**
 * TEST 6: Credenciales incorrectas
 */
async function testWrongCredentials() {
  console.log("\n🔓 TEST 6: Credenciales incorrectas");
  console.log("─".repeat(50));

  const result = await request("POST", "/auth/login", {
    email: "test@example.com",
    password: "wrong_password",
  });

  if (result.status === 401) {
    console.log("✅ Login rechazado correctamente");
    console.log(`   Error: ${result.data.error}`);
  } else {
    console.log(`❌ Respuesta inesperada: ${result.status}`);
  }
}

/**
 * TEST 7: Email ya registrado
 */
async function testDuplicateEmail() {
  console.log("\n📧 TEST 7: Intento de registrar email duplicado");
  console.log("─".repeat(50));

  const result = await request("POST", "/auth/register", {
    email: "test@example.com",
    password: "password123",
    name: "Another User",
  });

  if (result.status === 409) {
    console.log("✅ Registro rechazado correctamente");
    console.log(`   Error: ${result.data.error}`);
  } else {
    console.log(`❌ Respuesta inesperada: ${result.status}`);
  }
}

/**
 * TEST 8: Validar estructura del payload
 */
async function testTokenPayload() {
  console.log("\n📦 TEST 8: Validar estructura del payload del token");
  console.log("─".repeat(50));

  // Decodificar JWT (sin verificar)
  const parts = accessToken.split(".");
  if (parts.length !== 3) {
    console.log("❌ JWT tiene formato inválido");
    return;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf8")
    );

    console.log("✅ Payload decodificado:");
    console.log(`   ID: ${payload.id}`);
    console.log(`   Email: ${payload.email}`);
    console.log(`   Name: ${payload.name}`);
    console.log(`   Role: ${payload.role}`);
    console.log(`   IAT: ${new Date(payload.iat * 1000).toISOString()}`);
    console.log(`   EXP: ${new Date(payload.exp * 1000).toISOString()}`);

    // Calcular tiempo restante
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = payload.exp - now;
    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);

    console.log(`   ⏱️  Expira en: ${hours}h ${minutes}m`);
  } catch (error) {
    console.log("❌ Error al decodificar payload");
  }
}

/**
 * TEST 9: Logout
 */
async function testLogout() {
  console.log("\n🚪 TEST 9: Logout");
  console.log("─".repeat(50));

  const result = await request("POST", "/auth/logout", null, {
    Authorization: `Bearer ${accessToken}`,
  });

  if (result.status === 200) {
    console.log("✅ Logout exitoso");
    console.log(`   ${result.data.message}`);
  } else {
    console.log(`❌ Error: ${result.status}`);
  }
}

/**
 * MAIN: Ejecutar todos los tests
 */
async function runAllTests() {
  console.log(
    "\n╔════════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║       🧪 PRUEBAS DEL SISTEMA DE AUTENTICACIÓN JWT       ║"
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════╝"
  );

  try {
    // Primero, limpiar email de prueba (opcional)
    await testRegister();
    await testLogin();
    await testProtectedRoute();
    await testRefreshToken();
    await testInvalidToken();
    await testWrongCredentials();
    await testDuplicateEmail();
    await testTokenPayload();
    await testLogout();

    console.log("\n" + "═".repeat(50));
    console.log("✅ TODAS LAS PRUEBAS COMPLETADAS");
    console.log("═".repeat(50) + "\n");
  } catch (error) {
    console.error("❌ Error durante las pruebas:", error);
  }
}

// Ejecutar tests
runAllTests();
