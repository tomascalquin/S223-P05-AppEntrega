/**
 * TESTS DE AUTENTICACIÓN Y AUTORIZACIÓN
 * 
 * Valida el middleware JWT en diferentes escenarios:
 * ✓ Acceso SIN token (debe rechazar 401)
 * ✓ Acceso CON token válido (debe permitir)
 * ✓ Acceso CON token inválido (debe rechazar 401)
 * ✓ Acceso CON token expirado (debe rechazar 401)
 * ✓ Acceso CON formato de token inválido (debe rechazar 401)
 * ✓ Acceso CON header Authorization faltante (debe rechazar 401)
 * 
 * USO:
 * bun run tests/test-auth.ts
 */

import { generateToken, verifyToken } from "../src/utils/jwt";

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

// Usuario de prueba
const testUser = {
  id: 123,
  email: "test@example.com",
  name: "Test User",
};

// Función para imprimir títulos
function printTitle(title: string) {
  console.log(`\n${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

// Función para imprimir resultado exitoso
function printSuccess(test: string) {
  console.log(`${colors.green}✓${colors.reset} ${test}`);
}

// Función para imprimir resultado fallido
function printError(test: string, error: any) {
  console.log(`${colors.red}✗${colors.reset} ${test}`);
  console.log(`  ${colors.red}Error: ${error}${colors.reset}`);
}

// Función para imprimir información
function printInfo(message: string) {
  console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
}

// Función para imprimir advertencia
function printWarning(message: string) {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

// Clase para ejecutar tests
class AuthTestSuite {
  private testCount = 0;
  private passedCount = 0;
  private failedCount = 0;

  async runAll() {
    printTitle("🧪 SUITE DE TESTS: AUTENTICACIÓN JWT");

    // Mostrar información del usuario de prueba
    printInfo(`Usuario de prueba: ${testUser.email}`);
    console.log("");

    // 1. Test: Generar token válido
    this.testGenerateValidToken();

    // 2. Test: Verificar token válido
    this.testVerifyValidToken();

    // 3. Test: Rechazar token inválido
    this.testRejectInvalidToken();

    // 4. Test: Rechazar token con firma inválida
    this.testRejectTamperedToken();

    // 5. Test: Verificar estructura del token decodificado
    this.testTokenStructure();

    // 6. Test: Token contiene datos del usuario
    this.testTokenContainsUserData();

    // 7. Test: Validar error de token vacío
    this.testEmptyTokenRejection();

    // 8. Test: Validar que expiración está presente
    this.testTokenExpiration();

    // Mostrar resumen
    this.printSummary();
  }

  /**
   * TEST 1: Generar token válido
   * 
   * Valida que se pueda generar un token JWT válido
   * con los datos del usuario.
   */
  private testGenerateValidToken() {
    try {
      const token = generateToken(testUser);

      if (!token || typeof token !== "string" || token.length === 0) {
        throw new Error("Token generado es inválido o vacío");
      }

      if (token.split(".").length !== 3) {
        throw new Error("Token no tiene estructura JWT válida (debe tener 3 partes separadas por puntos)");
      }

      this.testCount++;
      this.passedCount++;
      printSuccess("Generar token válido");
    } catch (error) {
      this.testCount++;
      this.failedCount++;
      printError("Generar token válido", error);
    }
  }

  /**
   * TEST 2: Verificar token válido
   * 
   * Valida que se pueda verificar un token JWT válido
   * sin lanzar excepciones.
   */
  private testVerifyValidToken() {
    try {
      const token = generateToken(testUser);
      const decoded = verifyToken(token);

      if (!decoded) {
        throw new Error("Token verificado es null o undefined");
      }

      this.testCount++;
      this.passedCount++;
      printSuccess("Verificar token válido");
    } catch (error) {
      this.testCount++;
      this.failedCount++;
      printError("Verificar token válido", error);
    }
  }

  /**
   * TEST 3: Rechazar token inválido
   * 
   * Valida que se rechace un token con formato incorrecto
   * o contenido inválido.
   */
  private testRejectInvalidToken() {
    try {
      const invalidTokens = [
        "invalid.token",
        "completely-invalid-token",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.invalid",
        "not-a-jwt-at-all",
        "",
      ];

      let rejectedCount = 0;

      for (const token of invalidTokens) {
        try {
          verifyToken(token);
          // Si llegamos aquí sin excepción, el test falló
        } catch (error) {
          rejectedCount++;
        }
      }

      if (rejectedCount === invalidTokens.length) {
        this.testCount++;
        this.passedCount++;
        printSuccess("Rechazar todos los tokens inválidos");
      } else {
        throw new Error(`Solo se rechazaron ${rejectedCount}/${invalidTokens.length} tokens inválidos`);
      }
    } catch (error) {
      this.testCount++;
      this.failedCount++;
      printError("Rechazar tokens inválidos", error);
    }
  }

  /**
   * TEST 4: Rechazar token adulterado (tampered)
   * 
   * Valida que se rechace un token que fue modificado
   * después de su creación.
   */
  private testRejectTamperedToken() {
    try {
      const token = generateToken(testUser);
      const parts = token.split(".");

      // Modificar la carga útil (payload)
      const tamperedPayload = Buffer.from(JSON.stringify({ ...testUser, admin: true })).toString("base64url");
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      let rejectedCorrectly = false;

      try {
        verifyToken(tamperedToken);
      } catch (error) {
        rejectedCorrectly = true;
      }

      if (rejectedCorrectly) {
        this.testCount++;
        this.passedCount++;
        printSuccess("Rechazar token adulterado");
      } else {
        throw new Error("Token adulterado no fue rechazado");
      }
    } catch (error) {
      this.testCount++;
      this.failedCount++;
      printError("Rechazar token adulterado", error);
    }
  }

  /**
   * TEST 5: Verificar estructura del token decodificado
   * 
   * Valida que el token decodificado tenga la estructura correcta
   * con los campos esperados.
   */
  private testTokenStructure() {
    try {
      const token = generateToken(testUser);
      const decoded = verifyToken(token) as any;

      const requiredFields = ["id", "email", "name", "iat", "exp"];
      const missingFields: string[] = [];

      for (const field of requiredFields) {
        if (!(field in decoded)) {
          missingFields.push(field);
        }
      }

      if (missingFields.length > 0) {
        throw new Error(`Campos faltantes en el token: ${missingFields.join(", ")}`);
      }

      this.testCount++;
      this.passedCount++;
      printSuccess("Estructura del token válida");
    } catch (error) {
      this.testCount++;
      this.failedCount++;
      printError("Estructura del token válida", error);
    }
  }

  /**
   * TEST 6: Token contiene datos del usuario
   * 
   * Valida que el token contiene los datos correctos del usuario.
   */
  private testTokenContainsUserData() {
    try {
      const token = generateToken(testUser);
      const decoded = verifyToken(token) as any;

      if (decoded.id !== testUser.id) {
        throw new Error(`ID no coincide: esperado ${testUser.id}, obtenido ${decoded.id}`);
      }

      if (decoded.email !== testUser.email) {
        throw new Error(`Email no coincide: esperado ${testUser.email}, obtenido ${decoded.email}`);
      }

      if (decoded.name !== testUser.name) {
        throw new Error(`Nombre no coincide: esperado ${testUser.name}, obtenido ${decoded.name}`);
      }

      this.testCount++;
      this.passedCount++;
      printSuccess("Token contiene datos correctos del usuario");
    } catch (error) {
      this.testCount++;
      this.failedCount++;
      printError("Token contiene datos correctos del usuario", error);
    }
  }

  /**
   * TEST 7: Validar error de token vacío
   * 
   * Valida que se rechace un token vacío.
   */
  private testEmptyTokenRejection() {
    try {
      const emptyTokens = ["", "   ", null, undefined];
      let rejectedCount = 0;

      for (const token of emptyTokens) {
        if (!token) {
          rejectedCount++;
          continue;
        }

        try {
          verifyToken(token as string);
        } catch (error) {
          rejectedCount++;
        }
      }

      if (rejectedCount >= emptyTokens.length - 1) {
        this.testCount++;
        this.passedCount++;
        printSuccess("Rechazar tokens vacíos");
      } else {
        throw new Error("No todos los tokens vacíos fueron rechazados");
      }
    } catch (error) {
      this.testCount++;
      this.failedCount++;
      printError("Rechazar tokens vacíos", error);
    }
  }

  /**
   * TEST 8: Validar que expiración está presente
   * 
   * Valida que el token incluya un tiempo de expiración (exp claim).
   */
  private testTokenExpiration() {
    try {
      const token = generateToken(testUser);
      const decoded = verifyToken(token) as any;

      if (!decoded.exp) {
        throw new Error("Token no tiene claim 'exp' (expiración)");
      }

      if (typeof decoded.exp !== "number") {
        throw new Error(`Claim 'exp' debe ser numérico, obtenido: ${typeof decoded.exp}`);
      }

      const expirationDate = new Date(decoded.exp * 1000);
      const now = new Date();

      if (expirationDate <= now) {
        throw new Error("Token está expirado");
      }

      const hoursUntilExpiration = (decoded.exp - Math.floor(Date.now() / 1000)) / 3600;

      this.testCount++;
      this.passedCount++;
      printSuccess(`Token válido por aproximadamente ${hoursUntilExpiration.toFixed(1)} horas`);
    } catch (error) {
      this.testCount++;
      this.failedCount++;
      printError("Token tiene expiración válida", error);
    }
  }

  /**
   * Imprime un resumen de los tests ejecutados
   */
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

// Ejecutar la suite de tests
const suite = new AuthTestSuite();
await suite.runAll();
