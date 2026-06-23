import mysql, { type RowDataPacket } from "mysql2/promise";

/**
 * Interface que define la estructura de un paquete en la base de datos
 * Se utiliza para validar los datos recuperados de la BD
 */
interface Package extends RowDataPacket {
  id: number;
  recipient_name: string;
  apartment_number: string;
  description: string;
  sender: string;
  delivery_date: string | null;
  status: "received" | "delivered" | "pending";
  created_at: string;
}

/**
 * URL base del servidor backend
 * El servidor debe estar corriendo en http://localhost:3001
 */
const BASE_URL = "http://localhost:3001";

/**
 * SCRIPT DE VALIDACIÓN DE ENDPOINTS REST API
 * 
 * Este script realiza pruebas exhaustivas de:
 * 1. Conectividad al servidor
 * 2. Operaciones CRUD (CREATE, READ, UPDATE, DELETE)
 * 3. Validaciones de entrada en los endpoints
 * 4. Manejo de errores (404, 400, etc.)
 * 5. Integridad de datos en la BD después de operaciones API
 * 
 * Uso: bun tests/validate-api.ts
 * 
 * Requiere que:
 * - El servidor esté corriendo en puerto 3001
 * - MySQL esté disponible en localhost:3306
 */

async function testAPIs() {
  let connection: any;
  try {
    console.log("\n╔════════════════════════════════════════════╗");
    console.log("║     VALIDACIÓN DE ENDPOINTS REST API       ║");
    console.log("╚════════════════════════════════════════════╝\n");

    // Conectar a BD para verificar datos
    connection = await mysql.createConnection({
      host: "localhost",
      port: 3306,
      user: "root",
      password: "clave123",
      database: "appdb",
    });

    // Limpiar datos de pruebas anteriores
    // Esto garantiza que cada ejecución comienza con estado limpio
    await connection.query("DELETE FROM packages WHERE sender = 'API Test Suite'");
    console.log("✅ Base de datos limpia\n");

    // ==========================================
    // PASO 1: PRUEBA DE CONEXIÓN AL SERVIDOR
    // ==========================================
    // Se verifica que el servidor esté respondiendo correctamente
    // Este es el endpoint raíz que también prueba la conexión a MySQL desde el servidor
    console.log("📋 PASO 1: Probando conexión al servidor...");
    let response = await fetch(`${BASE_URL}/`);
    let data = await response.json();
    if (response.ok) {
      console.log("  ✓ Servidor respondiendo: OK");
      console.log(`  Respuesta: ${data.message}\n`);
    } else {
      console.error("  ❌ Error de conexión");
      process.exit(1);
    }

    // ==========================================
    // PASO 2: PRUEBA POST - CREAR PAQUETES
    // ==========================================
    // Se prueban las operaciones CREATE (POST) del CRUD
    // Se envían 3 paquetes nuevos al servidor
    console.log("📋 PASO 2: Probando creación de paquetes (POST)...");

    const newPackages = [
      {
        recipient_name: "Pedro Sánchez",
        apartment_number: "501",
        description: "Electrónica",
        sender: "API Test Suite",
      },
      {
        recipient_name: "Isabel Martínez",
        apartment_number: "602",
        description: "Ropa y accesorios",
        sender: "API Test Suite",
      },
      {
        recipient_name: "Roberto Flores",
        apartment_number: "703",
        description: "Libros",
        sender: "API Test Suite",
      },
    ];

    const createdIds: number[] = [];

    // Crear cada paquete y guardar su ID para pruebas posteriores
    for (const pkg of newPackages) {
      response = await fetch(`${BASE_URL}/api/packages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pkg),
      });

      data = await response.json();
      if (response.ok && data.id) {
        createdIds.push(data.id);
        console.log(`  ✓ Paquete creado: ID ${data.id} - ${pkg.recipient_name}`);
      } else {
        console.error(`  ❌ Error creando paquete: ${data.error || data.message}`);
        process.exit(1);
      }
    }
    console.log(`✅ Se crearon ${createdIds.length} paquetes\n`);

    // ==========================================
    // PASO 3: PRUEBA GET - OBTENER TODOS LOS PAQUETES
    // ==========================================
    // Se prueban las operaciones READ (GET) para obtener todos los registros
    console.log("📋 PASO 3: Probando obtención de paquetes (GET /api/packages)...");

    response = await fetch(`${BASE_URL}/api/packages`);
    data = await response.json();

    if (response.ok && data.packages) {
      console.log(`  ✓ Se recuperaron ${data.packages.length} paquetes`);
      console.log(`  Últimos 3 paquetes:`);
      // Mostrar los últimos 3 paquetes creados
      data.packages.slice(0, 3).forEach((pkg: Package) => {
        console.log(`    - ${pkg.recipient_name} (Apt: ${pkg.apartment_number}) - ${pkg.status}`);
      });
      console.log("✅ Obtención de paquetes: OK\n");
    } else {
      console.error("  ❌ Error obteniendo paquetes");
      process.exit(1);
    }

    // ==========================================
    // PASO 4: PRUEBA GET - OBTENER PAQUETE POR ID
    // ==========================================
    // Se prueba el endpoint para obtener un paquete específico por su ID
    console.log("📋 PASO 4: Probando obtención de paquete específico (GET /api/packages/:id)...");

    const testId = createdIds[0];
    response = await fetch(`${BASE_URL}/api/packages/${testId}`);
    data = await response.json();

    if (response.ok && data.package) {
      console.log(`  ✓ Paquete recuperado:`);
      console.log(`    - ID: ${data.package.id}`);
      console.log(`    - Destinatario: ${data.package.recipient_name}`);
      console.log(`    - Apartamento: ${data.package.apartment_number}`);
      console.log(`    - Estado: ${data.package.status}`);
      console.log("✅ Obtención de paquete específico: OK\n");
    } else {
      console.error("  ❌ Error obteniendo paquete específico");
      process.exit(1);
    }

    // ==========================================
    // PASO 5: PRUEBA PUT - ACTUALIZAR ESTADO
    // ==========================================
    // Se prueban las operaciones UPDATE (PUT) para cambiar el estado de un paquete
    // Se realizan dos cambios de estado secuenciales
    console.log("📋 PASO 5: Probando actualización de estado (PUT /api/packages/:id)...");

    const updates = [
      { status: "pending", description: "Paquete pendiente de entrega" },
      { status: "delivered", description: "Paquete entregado" },
    ];

    for (const update of updates) {
      response = await fetch(`${BASE_URL}/api/packages/${testId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });

      data = await response.json();
      if (response.ok) {
        console.log(`  ✓ Estado actualizado a: ${update.status}`);
      } else {
        console.error(`  ❌ Error actualizando paquete`);
        process.exit(1);
      }
    }

    // Verificar que el cambio se reflejó en la BD
    const [updatedPackage] = await connection.query<Package[]>(
      "SELECT status, description FROM packages WHERE id = ?",
      [testId]
    );

    if (updatedPackage[0].status === "delivered") {
      console.log(`  ✓ Cambio confirmado en BD: estado = ${updatedPackage[0].status}`);
      console.log("✅ Actualización de estado: OK\n");
    } else {
      console.error("  ❌ El cambio no se reflejó en la BD");
      process.exit(1);
    }

    // ==========================================
    // PASO 6: VALIDACIÓN DE INTEGRIDAD
    // ==========================================
    // Se verifica que todos los datos creados vía API
    // estén correctamente almacenados en la BD
    console.log("📋 PASO 6: Validando integridad de datos en BD...");

    const [allCreatedPackages] = await connection.query<Package[]>(
      "SELECT * FROM packages WHERE sender = 'API Test Suite'"
    );

    console.log(`  ✓ Total de paquetes creados: ${allCreatedPackages.length}`);

    // Verificar que todos tienen datos obligatorios
    const missingData = allCreatedPackages.filter(
      (p) => !p.recipient_name || !p.apartment_number || !p.sender
    );

    if (missingData.length > 0) {
      console.error("  ❌ Se encontraron paquetes con datos incompletos");
      process.exit(1);
    }
    console.log(`  ✓ Todos los paquetes tienen datos completos`);

    // Verificar que los estados son válidos
    const invalidStates = allCreatedPackages.filter(
      (p) => !["received", "pending", "delivered"].includes(p.status)
    );

    if (invalidStates.length > 0) {
      console.error("  ❌ Se encontraron estados inválidos");
      process.exit(1);
    }
    console.log(`  ✓ Todos los estados son válidos`);

    console.log("✅ Integridad de datos: OK\n");

    // ==========================================
    // PASO 7: PRUEBA DELETE
    // ==========================================
    // Se prueba el endpoint para eliminar un paquete (DELETE)
    console.log("📋 PASO 7: Probando eliminación de paquete (DELETE /api/packages/:id)...");

    const deleteId = createdIds[createdIds.length - 1];
    response = await fetch(`${BASE_URL}/api/packages/${deleteId}`, {
      method: "DELETE",
    });

    data = await response.json();
    if (response.ok) {
      console.log(`  ✓ Paquete ID ${deleteId} eliminado correctamente`);

      // Verificar en BD que el paquete realmente fue eliminado
      const [deletedCheck] = await connection.query<Package[]>(
        "SELECT id FROM packages WHERE id = ?",
        [deleteId]
      );

      if (deletedCheck.length === 0) {
        console.log(`  ✓ Eliminación confirmada en BD`);
        console.log("✅ Eliminación de paquete: OK\n");
      } else {
        console.error("  ❌ El paquete aún existe en la BD");
        process.exit(1);
      }
    } else {
      console.error("  ❌ Error eliminando paquete");
      process.exit(1);
    }

    // ==========================================
    // PASO 8: PRUEBA DE VALIDACIONES
    // ==========================================
    // Se valida que el servidor rechace correctamente
    // datos incompletos o incorrectos
    console.log("📋 PASO 8: Probando validaciones de entrada...");

    // Intentar crear un paquete sin el campo requerido "recipient_name"
    response = await fetch(`${BASE_URL}/api/packages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apartment_number: "999",
        sender: "Test",
      }),
    });

    if (response.status === 400) {
      console.log(`  ✓ Validación de recipient_name: OK (rechazado correctamente)`);
    } else {
      console.error("  ❌ Falta validación de recipient_name");
      process.exit(1);
    }

    // Intentar obtener un paquete con ID que no existe
    response = await fetch(`${BASE_URL}/api/packages/99999`);
    if (response.status === 404) {
      console.log(`  ✓ Validación de paquete inexistente: OK (404)`);
    } else {
      console.error("  ❌ No devuelve 404 para paquete inexistente");
      process.exit(1);
    }

    console.log("✅ Todas las validaciones: OK\n");

    // ==========================================
    // RESUMEN FINAL
    // ==========================================
    // Mostrar un resumen visual de todas las operaciones realizadas
    console.log("╔════════════════════════════════════════════╗");
    console.log("║  ✅ VALIDACIÓN API COMPLETADA EXITOSAMENTE ║");
    console.log("╚════════════════════════════════════════════╝");
    console.log("\n📊 RESUMEN DE PRUEBAS:");
    console.log("  ✓ Conexión al servidor: OK");
    console.log("  ✓ POST /api/packages (crear): OK");
    console.log("  ✓ GET /api/packages (obtener todos): OK");
    console.log("  ✓ GET /api/packages/:id (obtener uno): OK");
    console.log("  ✓ PUT /api/packages/:id (actualizar estado): OK");
    console.log("  ✓ DELETE /api/packages/:id (eliminar): OK");
    console.log("  ✓ Integridad de datos en BD: OK");
    console.log("  ✓ Validaciones de entrada: OK\n");

    await connection.end();
    console.log("🔌 Conexión a BD cerrada\n");

  } catch (error) {
    console.error("\n❌ ERROR EN LA VALIDACIÓN DE API:");
    console.error(error);
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

// Ejecutar la función de validación de APIs
testAPIs();
