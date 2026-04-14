import db from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

async function createTables() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS packages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        recipient_name VARCHAR(255) NOT NULL,
        description TEXT,
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
  port: 3001,
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      try {
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

    if (request.method === "POST" && url.pathname === "/api/packages") {
      try {
        const body = await request.json();
        const { recipient_name, description, status = "received" } = body;

        if (!recipient_name) {
          return Response.json(
            { error: "recipient_name es requerido" },
            { status: 400 }
          );
        }

        const [result] = await db.query<ResultSetHeader>(
          "INSERT INTO packages (recipient_name, description, status) VALUES (?, ?, ?)",
          [recipient_name, description, status]
        );

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

    if (request.method === "GET" && url.pathname.startsWith("/api/packages/")) {
      try {
        const id = url.pathname.split("/").pop();

        const [rows] = await db.query<RowDataPacket[]>(
          "SELECT * FROM packages WHERE id = ?",
          [id]
        );

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

    return Response.json({ error: "Ruta no encontrada" }, { status: 404 });
  },
});

console.log("Backend corriendo en http://localhost:3001");