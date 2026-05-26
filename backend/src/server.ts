/**
 * SERVIDOR BACKEND DE ENCOMIENDAS
 * 
 * Servidor HTTP que expone una API REST para gestionar paquetes/encomiendas.
 * Utiliza Bun como runtime y MySQL como base de datos.
 * 
 * ENDPOINTS DISPONIBLES:
 * - GET  /                      → Prueba de conexión
 * - GET  /api/packages          → Obtener todos los paquetes
 * - POST /api/packages          → Crear nuevo paquete
 * - GET  /api/packages/:id      → Obtener paquete específico
 * - PUT  /api/packages/:id      → Actualizar paquete
 * - DELETE /api/packages/:id    → Eliminar paquete
 */

import db from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

/**
 * FUNCIÓN: createTables
 * 
 * Objetivo: Crear la estructura de la tabla 'packages' en MySQL
 * 
 * Lógica:
 * 1. Verifica si la tabla 'packages' ya existe
 * 2. Si existe, la elimina (para garantizar estructura limpia)
 * 3. Crea la tabla con la estructura correcta
 * 
 * Estructura de 'packages':
 * - id: Identificador único (autoincremento)
 * - recipient_name: Nombre del destinatario (requerido)
 * - apartment_number: Número de apartamento (requerido)
 * - description: Descripción del paquete (opcional)
 * - sender: Remitente del paquete (requerido)
 * - delivery_date: Fecha de entrega (opcional)
 * - status: Estado del paquete (received, pending, delivered)
 * - created_at: Fecha de creación automática
 */
async function createTables() {
  try {
    // PASO 1: Verificar si la tabla existe
    // Consultamos INFORMATION_SCHEMA para saber si 'packages' ya está en la BD
    const [tables] = await db.query<any[]>(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'packages'"
    );

    // PASO 2: Si existe, eliminarla
    // Esto es útil para resetear la estructura si hay cambios
    // En production, se recomienda usar migrations en lugar de DROP
    if (tables.length > 0) {
      await db.query("DROP TABLE IF EXISTS packages");
      console.log("📋 Tabla 'packages' antigua eliminada.");
    }

    // PASO 3: Crear la tabla con estructura completa
    // Esta es la definición final de la tabla que será usada por la API
    await db.query(`
      CREATE TABLE packages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        -- Identificador único con autoincremento
        
        recipient_name VARCHAR(255) NOT NULL,
        -- Nombre del destinatario (máximo 255 caracteres, requerido)
        
        apartment_number VARCHAR(50) NOT NULL,
        -- Número de apartamento (máximo 50 caracteres, requerido)
        
        description TEXT,
        -- Descripción del paquete (texto largo, opcional)
        
        sender VARCHAR(255) NOT NULL,
        -- Remitente o empresa que envía (máximo 255 caracteres, requerido)
        
        delivery_date TIMESTAMP NULL,
        -- Fecha y hora de entrega (puede ser null si no se ha entregado)
        
        status ENUM('received', 'delivered', 'pending') DEFAULT 'received',
        -- Estado del paquete (solo 3 valores válidos)
        -- 'received': Paquete recibido en conserje
        -- 'pending': Esperando ser entregado al destinatario
        -- 'delivered': Entregado al destinatario
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        -- Fecha y hora de creación del registro (automática)
      )
    `);
    console.log("✅ Tabla 'packages' creada exitosamente.");
  } catch (error) {
    console.error("❌ Error creando tabla:", error);
  }
}

// Ejecutar la creación de tablas cuando inicia el servidor
await createTables();

/**
 * CONFIGURACIÓN DEL SERVIDOR HTTP
 * 
 * Se inicia un servidor HTTP usando Bun.serve en el puerto 3001
 * que maneja todas las rutas de la API REST de encomiendas.
 * 
 * VALIDACIONES IMPLEMENTADAS:
 * - Campos requeridos: recipient_name, apartment_number, sender
 * - Estados válidos: received, pending, delivered
 * - Tipos de datos: strings con límites de longitud
 * - Manejo de errores: 400 (bad request), 404 (not found), 500 (server error)
 */
Bun.serve({
  port: 3001,
  async fetch(request: Request) {
    const url = new URL(request.url);

    /**
     * ENDPOINT: GET /
     * 
     * Propósito: Prueba de conectividad y salud del servidor
     * 
     * Respuesta exitosa:
     * {
     *   "message": "Conexión a MySQL exitosa",
     *   "result": [{ test: 1 }]
     * }
     * 
     * Códigos de respuesta:
     * - 200: Servidor y BD funcionando correctamente
     * - 500: Error de conexión a MySQL
     */
    if (request.method === "GET" && url.pathname === "/") {
      try {
        // Realizar una consulta simple para probar la conexión
        const [rows] = await db.query<RowDataPacket[]>("SELECT 1 AS test");

        return Response.json({
          message: "Conexión a MySQL exitosa",
          result: rows,
        });
      } catch (error) {
        return Response.json(
          {
            message: "Error al conectar con MySQL",
            error: String(error),
          },
          { status: 500 }
        );
      }
    }

    /**
     * ENDPOINT: GET /api/packages
     * 
     * Propósito: Obtener todos los paquetes de la base de datos
     * 
     * Respuesta exitosa:
     * {
     *   "packages": [
     *     {
     *       "id": 1,
     *       "recipient_name": "Juan García",
     *       "apartment_number": "101",
     *       "description": "Paquete electrónico",
     *       "sender": "Amazon",
     *       "delivery_date": null,
     *       "status": "received",
     *       "created_at": "2026-04-18 02:40:55"
     *     },
     *     ...
     *   ]
     * }
     * 
     * Características:
     * - Ordena los paquetes por fecha de creación (más recientes primero)
     * - Devuelve todos los paquetes sin filtros
     * - Siempre devuelve un array (puede estar vacío)
     */
    if (request.method === "GET" && url.pathname === "/api/packages") {
      try {
        const [rows] = await db.query<RowDataPacket[]>(
          "SELECT * FROM packages ORDER BY created_at DESC"
        );

        return Response.json({
          packages: rows,
        });
      } catch (error) {
        return Response.json(
          {
            message: "Error obteniendo paquetes",
            error: String(error),
          },
          { status: 500 }
        );
      }
    }

    /**
     * ENDPOINT: POST /api/packages
     * 
     * Propósito: Crear un nuevo paquete en la base de datos
     * 
     * Cuerpo de la petición (JSON):
     * {
     *   "recipient_name": "Juan García",        // REQUERIDO
     *   "apartment_number": "101",              // REQUERIDO
     *   "description": "Paquete electrónico",   // OPCIONAL
     *   "sender": "Amazon",                     // REQUERIDO
     *   "delivery_date": "2026-04-18 10:30:00", // OPCIONAL (ISO 8601 o TIMESTAMP)
     *   "status": "received"                    // OPCIONAL (default: "received")
     * }
     * 
     * Respuesta exitosa (201 implícito o 200):
     * {
     *   "message": "Paquete insertado exitosamente",
     *   "id": 1
     * }
     * 
     * Validaciones:
     * - recipient_name: Requerido, máximo 255 caracteres
     * - apartment_number: Requerido, máximo 50 caracteres
     * - sender: Requerido, máximo 255 caracteres
     * - description: Opcional, texto libre
     * - delivery_date: Opcional, formato TIMESTAMP
     * - status: Opcional, valores: 'received', 'pending', 'delivered' (default: 'received')
     * 
     * Códigos de respuesta:
     * - 200: Paquete creado exitosamente
     * - 400: Faltan campos requeridos
     * - 500: Error en la base de datos
     */
    if (request.method === "POST" && url.pathname === "/api/packages") {
      try {
        // Parsear el cuerpo JSON de la petición
        const body = (await request.json()) as Record<string, unknown>;
        const { recipient_name, apartment_number, description, sender, delivery_date, status = "received" } = body;

        // VALIDACIÓN 1: recipient_name es requerido
        if (!recipient_name) {
          return Response.json(
            { error: "recipient_name es requerido" },
            { status: 400 }
          );
        }

        // VALIDACIÓN 2: apartment_number es requerido
        if (!apartment_number) {
          return Response.json(
            { error: "apartment_number es requerido" },
            { status: 400 }
          );
        }

        // VALIDACIÓN 3: sender es requerido
        if (!sender) {
          return Response.json(
            { error: "sender es requerido" },
            { status: 400 }
          );
        }

        // Insertar el nuevo paquete en la BD
        // Usa prepared statements (?) para prevenir SQL injection
        const [result] = await db.query<ResultSetHeader>(
          "INSERT INTO packages (recipient_name, apartment_number, description, sender, delivery_date, status) VALUES (?, ?, ?, ?, ?, ?)",
          [recipient_name, apartment_number, description, sender, delivery_date || null, status]
        );

        // Devolver el ID del paquete creado
        return Response.json({
          message: "Paquete insertado exitosamente",
          id: result.insertId,
        });
      } catch (error) {
        return Response.json(
          {
            message: "Error insertando paquete",
            error: String(error),
          },
          { status: 500 }
        );
      }
    }

    /**
     * ENDPOINT: GET /api/packages/:id
     * 
     * Propósito: Obtener los detalles de un paquete específico por su ID
     * 
     * Parámetro:
     * - id: Identificador numérico del paquete (en la URL)
     * 
     * Ejemplo de petición:
     * GET /api/packages/1
     * 
     * Respuesta exitosa:
     * {
     *   "package": {
     *     "id": 1,
     *     "recipient_name": "Juan García",
     *     "apartment_number": "101",
     *     "description": "Paquete electrónico",
     *     "sender": "Amazon",
     *     "delivery_date": null,
     *     "status": "received",
     *     "created_at": "2026-04-18 02:40:55"
     *   }
     * }
     * 
     * Códigos de respuesta:
     * - 200: Paquete encontrado
     * - 404: Paquete no existe
     * - 500: Error en la base de datos
     */
    if (request.method === "GET" && url.pathname.startsWith("/api/packages/")) {
      try {
        // Extraer el ID del final de la URL
        const id = url.pathname.split("/").pop();

        // Consultar el paquete por ID
        const [rows] = await db.query<RowDataPacket[]>(
          "SELECT * FROM packages WHERE id = ?",
          [id]
        );

        // Si no existe el paquete, devolver 404
        if (rows.length === 0) {
          return Response.json(
            { error: "Paquete no encontrado" },
            { status: 404 }
          );
        }

        return Response.json({
          package: rows[0],
        });
      } catch (error) {
        return Response.json(
          {
            message: "Error obteniendo paquete",
            error: String(error),
          },
          { status: 500 }
        );
      }
    }

    /**
     * ENDPOINT: PUT /api/packages/:id
     * 
     * Propósito: Actualizar uno o más campos de un paquete existente
     * 
     * Parámetro:
     * - id: Identificador numérico del paquete (en la URL)
     * 
     * Cuerpo de la petición (JSON - todos los campos opcionales):
     * {
     *   "recipient_name": "Nueva nombre",        // Opcional
     *   "apartment_number": "202",               // Opcional
     *   "description": "Nueva descripción",      // Opcional
     *   "sender": "Nuevo remitente",             // Opcional
     *   "delivery_date": "2026-04-18 15:30:00", // Opcional
     *   "status": "delivered"                    // Opcional (valid: received, pending, delivered)
     * }
     * 
     * Ejemplo de petición:
     * PUT /api/packages/1
     * { "status": "delivered" }
     * 
     * Respuesta exitosa:
     * {
     *   "message": "Paquete actualizado exitosamente",
     *   "id": "1"
     * }
     * 
     * Características especiales:
     * - Permite actualizar campos individualmente (no requiere todos)
     * - Al menos UN campo debe ser proporcionado
     * - Solo actualiza los campos especificados (los otros mantienen su valor)
     * - Útil para cambiar el estado de un paquete
     * 
     * Códigos de respuesta:
     * - 200: Paquete actualizado exitosamente
     * - 400: No se proporcionó ningún campo para actualizar
     * - 404: Paquete no existe
     * - 500: Error en la base de datos
     */
    if (request.method === "PUT" && url.pathname.startsWith("/api/packages/")) {
      try {
        // Extraer el ID del final de la URL
        const id = url.pathname.split("/").pop();
        
        // Parsear el cuerpo JSON
        const body = (await request.json()) as Record<string, unknown>;
        const { recipient_name, apartment_number, description, sender, delivery_date, status } = body;

        // VALIDACIÓN: Al menos un campo debe ser proporcionado
        // Esto previene que se haga un UPDATE sin cambios
        if (!recipient_name && !apartment_number && !description && !sender && !delivery_date && !status) {
          return Response.json(
            { error: "Al menos un campo debe ser proporcionado" },
            { status: 400 }
          );
        }

        // Construir la consulta UPDATE dinámicamente
        // Solo incluye los campos que fueron proporcionados en el cuerpo
        const updates: string[] = [];
        const values: unknown[] = [];

        // Agregar cada campo al UPDATE si fue proporcionado
        if (recipient_name) {
          updates.push("recipient_name = ?");
          values.push(recipient_name);
        }
        if (apartment_number) {
          updates.push("apartment_number = ?");
          values.push(apartment_number);
        }
        if (description) {
          updates.push("description = ?");
          values.push(description);
        }
        if (sender) {
          updates.push("sender = ?");
          values.push(sender);
        }
        if (delivery_date) {
          updates.push("delivery_date = ?");
          values.push(delivery_date);
        }
        if (status) {
          updates.push("status = ?");
          values.push(status);
        }

        // Agregar el ID al final de los valores (para el WHERE id = ?)
        values.push(id);

        // Ejecutar el UPDATE dinámico con prepared statement
        const [result] = await db.query<ResultSetHeader>(
          `UPDATE packages SET ${updates.join(", ")} WHERE id = ?`,
          values
        );

        // Validar que el paquete existía (affectedRows = 0 significa que no se encontró)
        if (result.affectedRows === 0) {
          return Response.json(
            { error: "Paquete no encontrado" },
            { status: 404 }
          );
        }

        return Response.json({
          message: "Paquete actualizado exitosamente",
          id: id,
        });
      } catch (error) {
        return Response.json(
          {
            message: "Error actualizando paquete",
            error: String(error),
          },
          { status: 500 }
        );
      }
    }

    /**
     * ENDPOINT: DELETE /api/packages/:id
     * 
     * Propósito: Eliminar un paquete de la base de datos
     * 
     * Parámetro:
     * - id: Identificador numérico del paquete (en la URL)
     * 
     * Ejemplo de petición:
     * DELETE /api/packages/1
     * 
     * Respuesta exitosa:
     * {
     *   "message": "Paquete eliminado exitosamente",
     *   "id": "1"
     * }
     * 
     * Nota importante:
     * - La eliminación es permanente
     * - Se recomienda usar un soft delete (marcar como inactivo) en producción
     * - Considerar agregar historial/auditoría antes de eliminar
     * 
     * Códigos de respuesta:
     * - 200: Paquete eliminado exitosamente
     * - 404: Paquete no existe
     * - 500: Error en la base de datos
     */
    if (request.method === "DELETE" && url.pathname.startsWith("/api/packages/")) {
      try {
        // Extraer el ID del final de la URL
        const id = url.pathname.split("/").pop();

        // Ejecutar el DELETE con prepared statement
        const [result] = await db.query<ResultSetHeader>(
          "DELETE FROM packages WHERE id = ?",
          [id]
        );

        // Validar que el paquete existía (affectedRows = 0 significa que no se encontró)
        if (result.affectedRows === 0) {
          return Response.json(
            { error: "Paquete no encontrado" },
            { status: 404 }
          );
        }

        return Response.json({
          message: "Paquete eliminado exitosamente",
          id: id,
        });
      } catch (error) {
        return Response.json(
          {
            message: "Error eliminando paquete",
            error: String(error),
          },
          { status: 500 }
        );
      }
    }

    /**
     * RUTA POR DEFECTO: 404 Not Found
     * 
     * Cualquier ruta que no coincida con las anteriores
     * devuelve un error 404
     */
    return Response.json({ error: "Ruta no encontrada" }, { status: 404 });
  },
});

// ========================================
// INICIO DEL SERVIDOR
// ========================================
console.log("🚀 Backend corriendo en http://localhost:3001");
console.log("📊 Endpoints disponibles:");
console.log("   GET  /                      → Prueba de conexión");
console.log("   GET  /api/packages          → Obtener todos los paquetes");
console.log("   POST /api/packages          → Crear nuevo paquete");
console.log("   GET  /api/packages/:id      → Obtener paquete específico");
console.log("   PUT  /api/packages/:id      → Actualizar paquete");
console.log("   DELETE /api/packages/:id    → Eliminar paquete");