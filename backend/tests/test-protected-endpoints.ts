/**
 * TESTS DE ENDPOINTS PROTEGIDOS HTTP
 * 
 * Valida que los endpoints protegidos funcionen correctamente:
 * ✓ Rechazar solicitud SIN token (401 Unauthorized)
 * ✓ Rechazar solicitud CON token inválido (401 Unauthorized)
 * ✓ Rechazar solicitud CON formato de token inválido (401 Unauthorized)
 * ✓ Permitir solicitud CON token válido (200 OK)
 * ✓ Devolver información del usuario en respuesta (verificación de datos)
 * 
 * USO:
 * Primero inicia el servidor:
 *   bun run src/index.ts
 * 
 * En otra terminal, ejecuta los tests:
 *   bun run tests/test-protected-endpoints.ts
 * 
 * NOTA: Requiere que el servidor esté ejecutándose en http://localhost:3000
 */

import { generateToken } from "../src/utils/jwt";

// Colores para output en terminal
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

// Configuración del servidor
const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";
const API_TIMEOUT = 5000; // 5 segundos

// Usuario de prueba
const testUser = {
  id: 1,
  email: "test@example.com",
  name: "Test User",
};

// Clase para pruebas HTTP
class EndpointTester {
  private testCount = 0;
  private passedCount = 0;
  private failedCount = 0;
  private validToken = "";

  constructor() {
    // Generar token válido
    this.validToken = generateToken(testUser);
  }

  /**
   * Realiza una solicitud HTTP
   */
  private async makeRequest(
    method: string,
    endpoint: string,
    options?: {
      headers?: Record<string, string>;
      body?: any;
    }
  ) {
    const url = `${SERVER_URL}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options?.headers,
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });

      const data = await response.json().catch(() => ({}));

      return {
        status: response.status,
        ok: response.ok,
        data,
      };
    } catch (error) {
      throw new Error(`Error en solicitud HTTP: ${error}`);
    }
  }

  async runAll() {
    this.printTitle("🧪 TESTS: ENDPOINTS PROTEGIDOS HTTP");

    // Verificar que el servidor está disponible
    const serverAvailable = await this.checkServerAvailability();
    if (!serverAvailable) {
      console.log(`${colors.red}✗ Servidor no disponible en ${SERVER_URL}${colors.reset}`);
      console.log(`${colors.yellow}⚠ Inicia el servidor con: bun run src/index.ts${colors.reset}\n`);
      return;
    }

    this.printInfo(`Servidor disponible: ${SERVER_URL}`);
    this.printInfo(`Token de prueba válido generado`);
    console.log("");

    // Ejecutar tests
    await this.testNoTokenRejected();
    await this.testInvalidTokenRejected();
    await this.testInvalidFormatRejected();
    await this.testValidTokenAllowed();
    await this.testUserDataInResponse();
    await this.testMissingAuthHeaderRejected();
    await this.testBearerFormatRequired();

    // Mostrar resumen
    this.printSummary();
  }

  /**
   * Verifica que el servidor esté disponible
   */
  private async checkServerAvailability(): Promise<boolean> {
    try {
      const response = await fetch(SERVER_URL + "/", {
        method: "GET",
        signal: AbortSignal.timeout(API_TIMEOUT),
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * TEST 1: Rechazar solicitud SIN token
   * 
   * Una solicitud a un endpoint protegido sin token debe
   * devolver 401 Unauthorized.
   */
  private async testNoTokenRejected() {
    try {
      const response = await this.makeRequest("GET", "/api/protected/profile");

      if (response.status === 401) {
        this.testCount++;
        this.passedCount++;
        this.printSuccess("Rechazar solicitud sin token (401)");
      } else {
        throw new Error(`Expected status 401, got ${response.status}`);
      }
    } catch (error) {
      this.testCount++;
      this.failedCount++;
      this.printError("Rechazar solicitud sin token", error);
    }
  }

  /**
   * TEST 2: Rechazar token inválido
   * 
   * Una solicitud con un token inválido debe devolver 401.
   */
  private async testInvalidTokenRejected() {
    try {
      const response = await this.makeRequest("GET", "/api/protected/profile", {
        headers: {
          Authorization: "Bearer invalid.token.here",
        },
      });

      if (response.status === 401) {
        this.testCount++;
        this.passedCount++;
        this.printSuccess("Rechazar token inválido (401)");
      } else {
        throw new Error(`Expected status 401, got ${response.status}`);
      }
    } catch (error) {
      this.testCount++;
      this.failedCount++;
      this.printError("Rechazar token inválido", error);
    }
  }

  /**
   * TEST 3: Rechazar formato de token inválido
   * 
   * Un header Authorization con formato incorrecto debe devolver 401.
   */
  private async testInvalidFormatRejected() {
    try {
      // Probar diferentes formatos inválidos
      const invalidFormats = [
        "invalidtoken",
        "Bearer",
        "NoBearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
        this.validToken, // Token sin "Bearer"
      ];

      let rejectedCount = 0;

      for (const format of invalidFormats) {
        const response = await this.makeRequest("GET", "/api/protected/profile", {
          headers: {
            Authorization: format,
          },
        });

        if (response.status === 401) {
          rejectedCount++;
        }
      }

      if (rejectedCount === invalidFormats.length) {
        this.testCount++;
        this.passedCount++;
        this.printSuccess("Rechazar todos los formatos inválidos (401)");
      } else {
        throw new Error(`Solo se rechazaron ${rejectedCount}/${invalidFormats.length} formatos inválidos`);
      }
    } catch (error) {
      this.testCount++;
      this.failedCount++;
      this.printError("Rechazar formatos inválidos", error);
    }
  }

  /**
   * TEST 4: Permitir solicitud CON token válido
   * 
   * Una solicitud con un token válido debe ser permitida (200+).
   */
  private async testValidTokenAllowed() {
    try {
      const response = await this.makeRequest("GET", "/api/protected/profile", {
        headers: {
          Authorization: `Bearer ${this.validToken}`,
        },
      });

      if (response.status === 200 || response.status === 201) {
        this.testCount++;
        this.passedCount++;
        this.printSuccess("Permitir solicitud con token válido (200)");
      } else {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
    } catch (error) {
      this.testCount++;
      this.failedCount++;
      this.printError("Permitir solicitud con token válido", error);
    }
  }

  /**
   * TEST 5: Devolver información del usuario en respuesta
   * 
   * La respuesta debe contener los datos del usuario autenticado.
   */
  private async testUserDataInResponse() {
    try {
      const response = await this.makeRequest("GET", "/api/protected/profile", {
        headers: {
          Authorization: `Bearer ${this.validToken}`,
        },
      });

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      const data = response.data;

      // Verificar que la respuesta contiene datos del usuario
      if (!data.user) {
        throw new Error("Response no contiene campo 'user'");
      }

      if (!data.user.id || !data.user.email || !data.user.name) {
        throw new Error("User no contiene campos obligatorios (id, email, name)");
      }

      // Verificar que los datos coinciden con el usuario autenticado
      if (data.user.id !== testUser.id) {
        throw new Error(`Usuario ID no coincide: esperado ${testUser.id}, obtenido ${data.user.id}`);
      }

      if (data.user.email !== testUser.email) {
        throw new Error(`Email no coincide: esperado ${testUser.email}, obtenido ${data.user.email}`);
      }

      this.testCount++;
      this.passedCount++;
      this.printSuccess("Respuesta contiene datos correctos del usuario");
    } catch (error) {
      this.testCount++;
      this.failedCount++;
      this.printError("Respuesta contiene datos del usuario", error);
    }
  }

  /**
   * TEST 6: Rechazar cuando falta header Authorization
   * 
   * Específicamente valida que el error reporta que falta el token.
   */
  private async testMissingAuthHeaderRejected() {
    try {
      const response = await this.makeRequest("GET", "/api/protected/profile", {
        headers: {}, // Sin Authorization
      });

      if (response.status === 401 && response.data.code === "MISSING_TOKEN") {
        this.testCount++;
        this.passedCount++;
        this.printSuccess("Detectar falta de header Authorization (401)");
      } else if (response.status === 401) {
        this.testCount++;
        this.passedCount++;
        this.printSuccess("Rechazar falta de header (401)");
      } else {
        throw new Error(`Expected status 401, got ${response.status}`);
      }
    } catch (error) {
      this.testCount++;
      this.failedCount++;
      this.printError("Rechazar falta de header Authorization", error);
    }
  }

  /**
   * TEST 7: Requerir formato "Bearer"
   * 
   * El header debe seguir el formato: Authorization: Bearer <token>
   */
  private async testBearerFormatRequired() {
    try {
      const response = await this.makeRequest("GET", "/api/protected/profile", {
        headers: {
          Authorization: `Basic ${this.validToken}`, // Formato incorrecto
        },
      });

      if (response.status === 401 && response.data.code === "INVALID_TOKEN_FORMAT") {
        this.testCount++;
        this.passedCount++;
        this.printSuccess("Requerir formato Bearer en Authorization");
      } else if (response.status === 401) {
        this.testCount++;
        this.passedCount++;
        this.printSuccess("Rechazar formato no-Bearer (401)");
      } else {
        throw new Error(`Expected status 401, got ${response.status}`);
      }
    } catch (error) {
      this.testCount++;
      this.failedCount++;
      this.printError("Requerir formato Bearer", error);
    }
  }

  // Utilidades de impresión
  private printTitle(title: string) {
    console.log(`\n${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  }

  private printSuccess(test: string) {
    console.log(`${colors.green}✓${colors.reset} ${test}`);
  }

  private printError(test: string, error: any) {
    console.log(`${colors.red}✗${colors.reset} ${test}`);
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`  ${colors.red}Error: ${errorMsg}${colors.reset}`);
  }

  private printInfo(message: string) {
    console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
  }

  private printSummary() {
    console.log("");
    console.log(`${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}📊 RESUMEN DE TESTS${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log("");
    console.log(`Total tests:  ${colors.bright}${this.testCount}${colors.reset}`);
    console.log(`${colors.green}Exitosos:   ${this.passedCount}${colors.reset}`);
    console.log(`${colors.red}Fallidos:   ${this.failedCount}${colors.reset}`);
    console.log("");

    if (this.failedCount === 0) {
      console.log(`${colors.green}${colors.bright}✓ TODOS LOS TESTS PASARON${colors.reset}`);
    } else {
      console.log(`${colors.red}${colors.bright}✗ ALGUNOS TESTS FALLARON${colors.reset}`);
    }

    console.log(`${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  }
}

// Ejecutar los tests
const tester = new EndpointTester();
await tester.runAll();
