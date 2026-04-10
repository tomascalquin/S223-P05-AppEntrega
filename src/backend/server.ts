import { db } from "./db";

Bun.serve({
  port: 3001,
  async fetch() {
    try {
      const [rows] = await db.query("SELECT 1 AS test");

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
  },
});

console.log("Backend corriendo en http://localhost:3001");