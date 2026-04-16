import db from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// # Estos headers permiten que el frontend en otro puerto pueda hablar con este backend.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// # Este puerto puede cambiarse con la variable de entorno PORT.
// # Si no se define, el backend usará 3001 por defecto.
const PORT = Number(process.env.PORT || 3001);

async function createTables() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS packages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        recipient_name VARCHAR(255) NOT NULL,
        apartment_number VARCHAR(50) NOT NULL,
        description TEXT,
        sender VARCHAR(255) NOT NULL,
        delivery_date TIMESTAMP NULL,
        status ENUM('received', 'delivered', 'pending') DEFAULT 'received',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Tabla 'packages' creada o ya existe.");
  } catch (error) {
    console.error("Error creando tabla:", error);
  }
}

await createTables();

Bun.serve({
  port: PORT,
  async fetch(request) {
  port: 3001,
  async fetch(request: Request) {
    const url = new URL(request.url);
    // # Normalizamos el método para comparar siempre en mayúsculas.
    const method = request.method.trim().toUpperCase();

    // # El navegador envía OPTIONS antes de algunos POST.
    // # Si no respondemos esto, aparece el típico error "Failed to fetch".
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (method === "GET" && url.pathname === "/") {
      try {
        const [rows] = await db.query<RowDataPacket[]>("SELECT 1 AS test");

        return Response.json(
          {
            message: "Conexión a MySQL exitosa",
            result: rows,
          },
          { headers: corsHeaders }
        );
      } catch (error) {
        return Response.json(
          {
            message: "Error al conectar con MySQL",
            error: String(error),
          },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    if (method === "GET" && url.pathname === "/api/packages") {
      try {
        const [rows] = await db.query<RowDataPacket[]>(
          "SELECT * FROM packages ORDER BY created_at DESC"
        );

        return Response.json(
          {
            packages: rows,
          },
          { headers: corsHeaders }
        );
      } catch (error) {
        return Response.json(
          {
            message: "Error obteniendo paquetes",
            error: String(error),
          },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    if (method === "POST" && url.pathname === "/api/packages") {
      try {
        const body = (await request.json()) as Record<string, unknown>;
        const { recipient_name, apartment_number, description, sender, delivery_date, status = "received" } = body;

        if (!recipient_name) {
          return Response.json(
            { error: "recipient_name es requerido" },
            { status: 400, headers: corsHeaders }
          );
        }

        if (!apartment_number) {
          return Response.json(
            { error: "apartment_number es requerido" },
            { status: 400 }
          );
        }

        if (!sender) {
          return Response.json(
            { error: "sender es requerido" },
            { status: 400 }
          );
        }

        const [result] = await db.query<ResultSetHeader>(
          "INSERT INTO packages (recipient_name, apartment_number, description, sender, delivery_date, status) VALUES (?, ?, ?, ?, ?, ?)",
          [recipient_name, apartment_number, description, sender, delivery_date || null, status]
        );

        return Response.json(
          {
            message: "Paquete insertado exitosamente",
            id: result.insertId,
          },
          { headers: corsHeaders }
        );
      } catch (error) {
        return Response.json(
          {
            message: "Error insertando paquete",
            error: String(error),
          },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    if (method === "GET" && url.pathname.startsWith("/api/packages/")) {
      try {
        const id = url.pathname.split("/").pop();

        const [rows] = await db.query<RowDataPacket[]>(
          "SELECT * FROM packages WHERE id = ?",
          [id]
        );

        if (rows.length === 0) {
          return Response.json(
            { error: "Paquete no encontrado" },
            { status: 404, headers: corsHeaders }
          );
        }

        return Response.json(
          {
            package: rows[0],
          },
          { headers: corsHeaders }
        );
      } catch (error) {
        return Response.json(
          {
            message: "Error obteniendo paquete",
            error: String(error),
          },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    return Response.json(
      { error: "Ruta no encontrada" },
      { status: 404, headers: corsHeaders }
    );
    if (request.method === "PUT" && url.pathname.startsWith("/api/packages/")) {
      try {
        const id = url.pathname.split("/").pop();
        const body = (await request.json()) as Record<string, unknown>;
        const { recipient_name, apartment_number, description, sender, delivery_date, status } = body;

        // Validar que al menos un campo sea proporcionado
        if (!recipient_name && !apartment_number && !description && !sender && !delivery_date && !status) {
          return Response.json(
            { error: "Al menos un campo debe ser proporcionado" },
            { status: 400 }
          );
        }

        // Construir query dinámicamente
        const updates: string[] = [];
        const values: unknown[] = [];

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

        values.push(id);

        const [result] = await db.query<ResultSetHeader>(
          `UPDATE packages SET ${updates.join(", ")} WHERE id = ?`,
          values
        );

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

    if (request.method === "DELETE" && url.pathname.startsWith("/api/packages/")) {
      try {
        const id = url.pathname.split("/").pop();

        const [result] = await db.query<ResultSetHeader>(
          "DELETE FROM packages WHERE id = ?",
          [id]
        );

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

    return Response.json({ error: "Ruta no encontrada" }, { status: 404 });
  },
});

console.log(`Backend corriendo en http://localhost:${PORT}`);
