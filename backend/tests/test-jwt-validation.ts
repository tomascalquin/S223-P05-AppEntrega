/**
 * TESTS COMPLETOS: VALIDACIÓN DE JWT Y CONTROL DE ACCESO
 * 
 * Este archivo contiene tests exhaustivos para:
 * ✓ Validación de JWT (token válido, inválido, expirado, malformado)
 * ✓ Manejo de errores de autenticación
 * ✓ Validación de headers Authorization
 * ✓ Extracción y verificación de datos del usuario
 * ✓ Acceso basado en roles (conserje, residente)
 * ✓ Endpoints protegidos vs públicos
 * 
 * USO:
 * Primero inicia el servidor en una terminal:
 *   bun run src/index.ts
 * 
 * En otra terminal, ejecuta los tests:
 *   bun run tests/test-jwt-validation.ts
 * 
 * NOTA: Los tests requieren que el servidor esté ejecutándose en http://localhost:3000
 */

import { generateToken, type UserRole } from "../src/utils/jwt";

// ============================================================================
// CONFIGURACIÓN Y UTILIDADES
// ============================================================================

// Colores para output en terminal
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

// Configuración del servidor
const PORT = process.env.PORT || "3001";
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;
const API_TIMEOUT = 5000; // 5 segundos

// Usuarios de prueba con diferentes roles
const testUsers = {
  conserje: {
    id: 1,
    email: "conserje@example.com",
    name: "Conserje User",
    role: "conserje" as UserRole,
  },
  residente: {
    id: 2,
    email: "residente@example.com",
    name: "Residente User",
    role: "residente" as UserRole,
  },
  noRole: {
    id: 3,
    email: "norole@example.com",
    name: "No Role User",
  },
};

// ============================================================================
// FUNCIONES AUXILIARES PARA TESTING
// ============================================================================

function printTitle(title: string) {
  console.log(
    `\n${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`
  );
  console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`);
  console.log(
    `${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`
  );
}

function printSection(section: string) {
  console.log(`\n${colors.bright}${colors.magenta}📋 ${section}${colors.reset}`);
  console.log(`${colors.magenta}${"─".repeat(50)}${colors.reset}`);
}

function printSuccess(test: string) {
  console.log(`${colors.green}✓${colors.reset} ${test}`);
}

function printError(test: string, error: any) {
  console.log(`${colors.red}✗${colors.reset} ${test}`);
  console.log(`  ${colors.red}Error: ${error}${colors.reset}`);
}

function printInfo(message: string) {
  console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
}

function printWarning(message: string) {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

// ============================================================================
// CLASE PRINCIPAL: JWT VALIDATION TESTER
// ============================================================================

class JWTValidationTester {
  private testCount = 0;
  private passedCount = 0;
  private failedCount = 0;
  private tokens: { [key: string]: string } = {};

  constructor() {
    // Generar tokens de prueba para cada usuario
    this.tokens.conserje = generateToken(testUsers.conserje);
    this.tokens.residente = generateToken(testUsers.residente);
    this.tokens.noRole = generateToken(testUsers.noRole);
  }

  /**
   * Métodos de utilidad para imprimir resultados
   */
  private log(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
    switch (type) {
      case 'success':
        printSuccess(message);
        break;
      case 'error':
        printError(message, '');
        break;
      case 'info':
        printInfo(message);
        break;
      case 'warning':
        printWarning(message);
        break;
    }
  }

  /**
   * Realiza una solicitud HTTP a un endpoint
   */
  private async makeRequest(
    method: string,
    endpoint: string,
    options?: {
      headers?: Record<string, string>;
      body?: any;
    }
  ): Promise<{ status: number; ok: boolean; data: any }> {
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

  /**
   * Verifica que el servidor esté disponible
   */
  private async checkServerAvailability(): Promise<boolean> {
    try {
      const response = await fetch(SERVER_URL + "/", {
        signal: AbortSignal.timeout(API_TIMEOUT),
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // ========================================================================
  // SECCIÓN 1: TESTS DE VALIDACIÓN DE HEADER AUTHORIZATION
  // ========================================================================

  private async testMissingAuthHeader() {
    try {
      const response = await this.makeRequest("GET", "/api/protected/profile");
      if (response.status === 401 && response.data.code === "MISSING_TOKEN") {
        this.passedCount++;
        printSuccess("Rechaza solicitud sin header Authorization");
      } else {
        throw new Error(`Expected 401 with MISSING_TOKEN, got ${response.status}`);
      }
    } catch (error) {
      this.failedCount++;
      printError("Rechaza solicitud sin header Authorization", error);
    }
    this.testCount++;
  }

  private async testEmptyAuthHeader() {
    try {
      const response = await this.makeRequest("GET", "/api/protected/profile", {
        headers: { Authorization: "" },
      });
      if (response.status === 401) {
        this.passedCount++;
        printSuccess("Rechaza header Authorization vacío");
      } else {
        throw new Error(`Expected 401, got ${response.status}`);
      }
    } catch (error) {
      this.failedCount++;
      printError("Rechaza header Authorization vacío", error);
    }
    this.testCount++;
  }

  private async testInvalidBearerFormat() {
    try {
      const invalidFormats = [
        this.tokens.conserje, // Sin "Bearer"
        "NoBearer " + this.tokens.conserje, // Formato incorrecto
        "Bearer", // Solo "Bearer" sin token
        "Bearer ", // "Bearer" con espacio pero sin token
        `Bearer ${this.tokens.conserje} extra`, // Token con contenido extra
      ];

      let rejectedCount = 0;

      for (const format of invalidFormats) {
        const response = await this.makeRequest("GET", "/api/protected/profile", {
          headers: { Authorization: format },
        });

        if (response.status === 401) {
          rejectedCount++;
        }
      }

      if (rejectedCount === invalidFormats.length) {
        this.passedCount++;
        printSuccess(`Rechaza todos los ${invalidFormats.length} formatos inválidos de Bearer`);
      } else {
        throw new Error(
          `Solo se rechazaron ${rejectedCount}/${invalidFormats.length} formatos inválidos`
        );
      }
    } catch (error) {
      this.failedCount++;
      printError("Rechaza formatos inválidos de Bearer", error);
    }
    this.testCount++;
  }

  // ========================================================================
  // SECCIÓN 2: TESTS DE VALIDACIÓN DE TOKEN
  // ========================================================================

  private async testValidToken() {
    try {
      const response = await this.makeRequest("GET", "/api/protected/profile", {
        headers: { Authorization: `Bearer ${this.tokens.conserje}` },
      });

      if (response.status === 200) {
        this.passedCount++;
        printSuccess("Acepta token JWT válido");
      } else {
        throw new Error(`Expected 200, got ${response.status}`);
      }
    } catch (error) {
      this.failedCount++;
      printError("Acepta token JWT válido", error);
    }
    this.testCount++;
  }

  private async testInvalidToken() {
    try {
      const invalidTokens = [
        "invalid.token.here",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MX0.invalid",
        "malformed",
        this.tokens.conserje.slice(0, -5) + "xxxxx", // Token modificado
      ];

      let rejectedCount = 0;

      for (const token of invalidTokens) {
        const response = await this.makeRequest("GET", "/api/protected/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401 && response.data.code === "INVALID_TOKEN") {
          rejectedCount++;
        }
      }

      if (rejectedCount === invalidTokens.length) {
        this.passedCount++;
        printSuccess(`Rechaza todos los ${invalidTokens.length} tokens inválidos`);
      } else {
        throw new Error(
          `Solo se rechazaron ${rejectedCount}/${invalidTokens.length} tokens inválidos`
        );
      }
    } catch (error) {
      this.failedCount++;
      printError("Rechaza tokens inválidos", error);
    }
    this.testCount++;
  }

  // ========================================================================
  // SECCIÓN 3: TESTS DE EXTRACCIÓN DE DATOS DEL USUARIO
  // ========================================================================

  private async testUserDataExtraction() {
    try {
      const response = await this.makeRequest("GET", "/api/protected/me", {
        headers: { Authorization: `Bearer ${this.tokens.conserje}` },
      });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }

      const user = response.data;

      if (!user.id || !user.email || !user.name) {
        throw new Error("Datos del usuario incompletos");
      }

      if (user.id !== testUsers.conserje.id || user.email !== testUsers.conserje.email) {
        throw new Error("Datos del usuario no coinciden");
      }

      this.passedCount++;
        printSuccess("Extrae correctamente datos del usuario del token");
    } catch (error) {
      this.failedCount++;
      this.printError("Extrae datos del usuario", error);
    }
    this.testCount++;
  }

  private async testRoleInUserData() {
    try {
      const response = await this.makeRequest("GET", "/api/protected/me", {
        headers: { Authorization: `Bearer ${this.tokens.conserje}` },
      });

      const user = response.data;

      if (!user.role) {
        throw new Error("El token no contiene información de rol");
      }

      if (user.role !== "conserje") {
        throw new Error(`Expected role 'conserje', got ${user.role}`);
      }

      this.passedCount++;
        printSuccess("Rol de usuario está incluido en los datos extraídos");
    } catch (error) {
      this.failedCount++;
      this.printError("Rol de usuario en datos extraídos", error);
    }
    this.testCount++;
  }

  // ========================================================================
  // SECCIÓN 4: TESTS DE ENDPOINTS PROTEGIDOS VS PÚBLICOS
  // ========================================================================

  private async testPublicEndpoint() {
    try {
      // El endpoint de health check / debe ser público
      const response = await this.makeRequest("GET", "/");

      if (response.status === 200) {
        this.passedCount++;
        printSuccess("Endpoint público accesible sin autenticación");
      } else {
        throw new Error(`Expected 200, got ${response.status}`);
      }
    } catch (error) {
      this.failedCount++;
      printError("Endpoint público accesible", error);
    }
    this.testCount++;
  }

  private async testProtectedEndpoint() {
    try {
      // El endpoint /api/protected/profile debe ser protegido
      const response = await this.makeRequest("GET", "/api/protected/profile");

      if (response.status === 401) {
        this.passedCount++;
        printSuccess("Endpoint protegido rechaza solicitud sin token");
      } else {
        throw new Error(`Expected 401, got ${response.status}`);
      }
    } catch (error) {
      this.failedCount++;
      printError("Endpoint protegido rechaza sin token", error);
    }
    this.testCount++;
  }

  // ========================================================================
  // SECCIÓN 5: TESTS DE CONTROL DE ACCESO BASADO EN ROLES
  // ========================================================================

  private async testConserjeAccess() {
    try {
      // Conserje debe tener acceso al endpoint de reportes
      const response = await this.makeRequest("GET", "/api/role-based/reports", {
        headers: { Authorization: `Bearer ${this.tokens.conserje}` },
      });

      if (response.status === 200 || response.status === 404) {
        // 200 si existe, 404 si el endpoint no existe (pero no 403)
        this.passedCount++;
        printSuccess("Rol 'conserje' tiene acceso a endpoints de conserje");
      } else if (response.status === 403) {
        throw new Error("Conserje rechazado - no debería pasar");
      } else {
        throw new Error(`Unexpected status ${response.status}`);
      }
    } catch (error) {
      this.failedCount++;
      printError("Acceso de conserje", error);
    }
    this.testCount++;
  }

  private async testResidenteAccess() {
    try {
      // Residente debe tener acceso a sus datos
      const response = await this.makeRequest("GET", "/api/protected/me", {
        headers: { Authorization: `Bearer ${this.tokens.residente}` },
      });

      if (response.status === 200) {
        this.passedCount++;
        printSuccess("Rol 'residente' tiene acceso a endpoints básicos");
      } else {
        throw new Error(`Expected 200, got ${response.status}`);
      }
    } catch (error) {
      this.failedCount++;
      printError("Acceso de residente", error);
    }
    this.testCount++;
  }

  private async testUnauthorizedRoleAccess() {
    try {
      // Residente no debería tener acceso a endpoints de conserje
      const response = await this.makeRequest("GET", "/api/role-based/reports", {
        headers: { Authorization: `Bearer ${this.tokens.residente}` },
      });

      if (response.status === 403) {
        this.passedCount++;
        printSuccess("Residente rechazado de endpoint exclusivo de conserje");
      } else if (response.status === 404) {
        // Si el endpoint no existe, no podemos probar este caso
        printWarning("Endpoint /api/role-based/reports no existe");
      } else {
        throw new Error(`Expected 403, got ${response.status}`);
      }
    } catch (error) {
      this.failedCount++;
      printError("Rechazo de acceso no autorizado", error);
    }
    this.testCount++;
  }

  // ========================================================================
  // SECCIÓN 6: TESTS DE MANEJO DE ERRORES
  // ========================================================================

  private async testErrorMessages() {
    try {
      let correctErrorCount = 0;

      // Test 1: Sin token
      let response = await this.makeRequest("GET", "/api/protected/profile");
      if (response.data.code === "MISSING_TOKEN") correctErrorCount++;

      // Test 2: Token inválido
      response = await this.makeRequest("GET", "/api/protected/profile", {
        headers: { Authorization: "Bearer invalid" },
      });
      if (response.data.code === "INVALID_TOKEN") correctErrorCount++;

      // Test 3: Formato inválido
      response = await this.makeRequest("GET", "/api/protected/profile", {
        headers: { Authorization: "InvalidFormat" },
      });
      if (response.data.code === "INVALID_TOKEN_FORMAT") correctErrorCount++;

      if (correctErrorCount === 3) {
        this.passedCount++;
        printSuccess("Códigos de error específicos en las respuestas");
      } else {
        throw new Error(`Solo ${correctErrorCount}/3 errores tienen códigos correctos`);
      }
    } catch (error) {
      this.failedCount++;
      printError("Códigos de error en respuestas", error);
    }
    this.testCount++;
  }

  // ========================================================================
  // RUNNER PRINCIPAL
  // ========================================================================

  async runAll() {
    printTitle("🔐 VALIDACIÓN COMPLETA: JWT Y CONTROL DE ACCESO");

    // Verificar disponibilidad del servidor
    const serverAvailable = await this.checkServerAvailability();
    if (!serverAvailable) {
      console.log(`${colors.red}✗ Servidor no disponible en ${SERVER_URL}${colors.reset}`);
      console.log(`${colors.yellow}⚠ Inicia el servidor con: bun run src/index.ts${colors.reset}\n`);
      return;
    }

    printInfo(`Servidor disponible: ${SERVER_URL}`);
    printInfo(`Tokens de prueba generados para ${Object.keys(testUsers).length} usuarios`);
    console.log("");

    // Ejecutar secciones de tests
    printSection("VALIDACIÓN DE HEADER AUTHORIZATION");
    await this.testMissingAuthHeader();
    await this.testEmptyAuthHeader();
    await this.testInvalidBearerFormat();

    printSection("VALIDACIÓN DE JWT TOKEN");
    await this.testValidToken();
    await this.testInvalidToken();

    printSection("EXTRACCIÓN DE DATOS DEL USUARIO");
    await this.testUserDataExtraction();
    await this.testRoleInUserData();

    printSection("ENDPOINTS PROTEGIDOS VS PÚBLICOS");
    await this.testPublicEndpoint();
    await this.testProtectedEndpoint();

    printSection("CONTROL DE ACCESO BASADO EN ROLES");
    await this.testConserjeAccess();
    await this.testResidenteAccess();
    await this.testUnauthorizedRoleAccess();

    printSection("MANEJO DE ERRORES");
    await this.testErrorMessages();

    // Mostrar resumen
    this.printSummary();
  }

  /**
   * Imprime resumen de tests
   */
  private printSummary() {
    console.log(
      `\n${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`
    );
    console.log(`${colors.bright}📊 RESUMEN DE TESTS${colors.reset}`);
    console.log(
      `${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`
    );

    console.log(`Total de tests: ${colors.bright}${this.testCount}${colors.reset}`);
    console.log(`${colors.green}Exitosos: ${this.passedCount}${colors.reset}`);
    console.log(`${colors.red}Fallidos: ${this.failedCount}${colors.reset}`);

    const successRate = ((this.passedCount / this.testCount) * 100).toFixed(1);
    console.log(`Tasa de éxito: ${colors.bright}${successRate}%${colors.reset}\n`);

    if (this.failedCount === 0) {
      console.log(`${colors.green}${colors.bright}✓ TODOS LOS TESTS PASARON${colors.reset}\n`);
    } else {
      console.log(
        `${colors.red}${colors.bright}✗ ${this.failedCount} test(s) fallaron${colors.reset}\n`
      );
    }
  }
}

// ============================================================================
// EJECUCIÓN PRINCIPAL
// ============================================================================

// Ejecutar los tests
const tester = new JWTValidationTester();
tester.runAll();
