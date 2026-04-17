import db from "./src/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

type PackageStatus = "received" | "delivered" | "pending";

type PackageRow = RowDataPacket & {
  id: number;
  recipient_name: string;
  apartment_number: string;
  description: string | null;
  sender: string;
  delivery_date: string | null;
  status: PackageStatus;
  created_at: string;
};

// # Estos headers permiten que el frontend corriendo en otro puerto pueda llamar
// # al backend sin quedar bloqueado por CORS.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// # Esta lista deja explícitos los estados válidos para validarlos tanto en POST como en PUT.
const allowedStatuses = new Set<PackageStatus>([
  "received",
  "delivered",
  "pending",
]);

// # Este puerto puede cambiarse por variable de entorno.
// # Si no existe, mantenemos 3001 para no romper el frontend actual.
const PORT = Number(process.env.PORT || 3001);

// # Este helper evita repetir `Response.json(..., { headers: corsHeaders })`
// # en cada rama del servidor.
const jsonResponse = (body: unknown, init?: ResponseInit) => {
  return Response.json(body, {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init?.headers ?? {}),
    },
  });
};

// # Este helper valida que el valor exista, sea texto y no quede vacío tras hacer trim.
const getRequiredString = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
};

// # Este helper nos permite aceptar texto opcional y guardar `null`
// # cuando el frontend envía vacío o directamente no lo incluye.
const getOptionalString = (value: unknown) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
};

// # Esta validación centraliza la verificación del id para las rutas `/api/packages/:id`.
const parsePackageId = (pathname: string) => {
  const id = Number(pathname.split("/").pop());
  return Number.isInteger(id) && id > 0 ? id : null;
};

// # Así evitamos aceptar estados inventados que luego rompan consultas o la UI.
const isPackageStatus = (value: unknown): value is PackageStatus => {
  return typeof value === "string" && allowedStatuses.has(value as PackageStatus);
};

// # Este helper evita repetir la llamada larga a `hasOwnProperty`
// # cada vez que validamos updates parciales.
const hasOwn = (value: Record<string, unknown>, key: string) => {
  return Object.prototype.hasOwnProperty.call(value, key);
};

// # Este helper lee un paquete puntual después de crear o actualizar,
// # para devolver al frontend el registro definitivo que quedó en la base de datos.
const getPackageById = async (id: number) => {
  const [rows] = await db.query<PackageRow[]>(
    "SELECT * FROM packages WHERE id = ?",
    [id]
  );

  return rows[0] ?? null;
};

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

    // # Si la tabla ya existía de una versión anterior, agregamos las columnas nuevas
    // # una por una para no depender de que la base haya sido recreada desde cero.
    const ensureColumn = async (columnName: string, definition: string) => {
      const [rows] = await db.query<RowDataPacket[]>(
        "SHOW COLUMNS FROM packages LIKE ?",
        [columnName]
      );

      if (rows.length === 0) {
        await db.query(`ALTER TABLE packages ADD COLUMN ${definition}`);
      }
    };

    await ensureColumn(
      "apartment_number",
      "apartment_number VARCHAR(50) NOT NULL DEFAULT 'N/A'"
    );
    await ensureColumn("description", "description TEXT NULL");
    await ensureColumn(
      "sender",
      "sender VARCHAR(255) NOT NULL DEFAULT 'Desconocido'"
    );
    await ensureColumn("delivery_date", "delivery_date TIMESTAMP NULL");
    await ensureColumn(
      "status",
      "status ENUM('received', 'delivered', 'pending') DEFAULT 'received'"
    );
    await ensureColumn(
      "created_at",
      "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    );

    console.log("Tabla 'packages' creada o ya existe.");
  } catch (error) {
    console.error("Error creando tabla:", error);
  }
}

await createTables();

Bun.serve({
  port: PORT,
  async fetch(request: Request) {
    const url = new URL(request.url);
    // # Normalizamos el método para comparar siempre en mayúsculas y evitar errores por formato.
    const method = request.method.trim().toUpperCase();

    // # Algunos navegadores envían primero un OPTIONS antes del POST/PUT/DELETE.
    // # Responder aquí evita errores de conexión falsos desde el frontend.
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (method === "GET" && url.pathname === "/") {
      try {
        const [rows] = await db.query<RowDataPacket[]>("SELECT 1 AS test");

        return jsonResponse({
          message: "Conexión a MySQL exitosa",
          result: rows,
        });
      } catch (error) {
        return jsonResponse(
          {
            message: "Error al conectar con MySQL",
            error: String(error),
          },
          { status: 500 }
        );
      }
    }

    if (method === "GET" && url.pathname === "/api/packages") {
      try {
        // # Permitimos filtros por query string para que el residente vea solo sus encomiendas
        // # sin tener que descargar todo el historial en el navegador.
        const filters: string[] = [];
        const values: unknown[] = [];

        const recipientName = getRequiredString(
          url.searchParams.get("recipient_name")
        );
        const apartmentNumber = getRequiredString(
          url.searchParams.get("apartment_number")
        );
        const status = url.searchParams.get("status");

        if (recipientName) {
          filters.push("recipient_name = ?");
          values.push(recipientName);
        }

        if (apartmentNumber) {
          filters.push("apartment_number = ?");
          values.push(apartmentNumber);
        }

        if (status) {
          if (!isPackageStatus(status)) {
            return jsonResponse(
              { error: "status debe ser received, delivered o pending" },
              { status: 400 }
            );
          }

          filters.push("status = ?");
          values.push(status);
        }

        const whereClause =
          filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

        const [rows] = await db.query<PackageRow[]>(
          `SELECT * FROM packages ${whereClause} ORDER BY created_at DESC`,
          values
        );

        return jsonResponse({
          packages: rows,
        });
      } catch (error) {
        return jsonResponse(
          {
            message: "Error obteniendo paquetes",
            error: String(error),
          },
          { status: 500 }
        );
      }
    }

    if (method === "POST" && url.pathname === "/api/packages") {
      try {
        const body = (await request.json()) as Record<string, unknown>;

        // # Cada campo obligatorio se valida por separado para poder responder
        // # con un mensaje preciso que la UI pueda mostrar tal cual.
        const recipientName = getRequiredString(body.recipient_name);
        const apartmentNumber = getRequiredString(body.apartment_number);
        const sender = getRequiredString(body.sender);
        const description = getOptionalString(body.description);
        const deliveryDate = getOptionalString(body.delivery_date);
        const status = body.status === undefined ? "received" : body.status;

        if (!recipientName) {
          return jsonResponse(
            { error: "recipient_name es requerido" },
            { status: 400 }
          );
        }

        if (!apartmentNumber) {
          return jsonResponse(
            { error: "apartment_number es requerido" },
            { status: 400 }
          );
        }

        if (!sender) {
          return jsonResponse({ error: "sender es requerido" }, { status: 400 });
        }

        if (!isPackageStatus(status)) {
          return jsonResponse(
            { error: "status debe ser received, delivered o pending" },
            { status: 400 }
          );
        }

        const [result] = await db.query<ResultSetHeader>(
          "INSERT INTO packages (recipient_name, apartment_number, description, sender, delivery_date, status) VALUES (?, ?, ?, ?, ?, ?)",
          [
            recipientName,
            apartmentNumber,
            description,
            sender,
            deliveryDate,
            status,
          ]
        );

        const createdPackage = await getPackageById(result.insertId);

        if (!createdPackage) {
          return jsonResponse(
            { message: "No se pudo recuperar el paquete recién creado" },
            { status: 500 }
          );
        }

        return jsonResponse({
          message: "Paquete insertado exitosamente",
          id: result.insertId,
          package: createdPackage,
        });
      } catch (error) {
        return jsonResponse(
          {
            message: "Error insertando paquete",
            error: String(error),
          },
          { status: 500 }
        );
      }
    }

    if (method === "GET" && url.pathname.startsWith("/api/packages/")) {
      try {
        const id = parsePackageId(url.pathname);

        if (!id) {
          return jsonResponse({ error: "id inválido" }, { status: 400 });
        }

        const packageItem = await getPackageById(id);

        if (!packageItem) {
          return jsonResponse(
            { error: "Paquete no encontrado" },
            { status: 404 }
          );
        }

        return jsonResponse({
          package: packageItem,
        });
      } catch (error) {
        return jsonResponse(
          {
            message: "Error obteniendo paquete",
            error: String(error),
          },
          { status: 500 }
        );
      }
    }

    if (method === "PUT" && url.pathname.startsWith("/api/packages/")) {
      try {
        const id = parsePackageId(url.pathname);

        if (!id) {
          return jsonResponse({ error: "id inválido" }, { status: 400 });
        }

        const body = (await request.json()) as Record<string, unknown>;

        // # Armamos la actualización solo con los campos presentes en el body.
        // # Esto permite que el frontend cambie únicamente el estado sin reenviar todo el paquete.
        const updates: string[] = [];
        const values: unknown[] = [];

        if (hasOwn(body, "recipient_name")) {
          const recipientName = getRequiredString(body.recipient_name);

          if (!recipientName) {
            return jsonResponse(
              { error: "recipient_name no puede estar vacío" },
              { status: 400 }
            );
          }

          updates.push("recipient_name = ?");
          values.push(recipientName);
        }

        if (hasOwn(body, "apartment_number")) {
          const apartmentNumber = getRequiredString(body.apartment_number);

          if (!apartmentNumber) {
            return jsonResponse(
              { error: "apartment_number no puede estar vacío" },
              { status: 400 }
            );
          }

          updates.push("apartment_number = ?");
          values.push(apartmentNumber);
        }

        if (hasOwn(body, "description")) {
          updates.push("description = ?");
          values.push(getOptionalString(body.description));
        }

        if (hasOwn(body, "sender")) {
          const sender = getRequiredString(body.sender);

          if (!sender) {
            return jsonResponse(
              { error: "sender no puede estar vacío" },
              { status: 400 }
            );
          }

          updates.push("sender = ?");
          values.push(sender);
        }

        if (hasOwn(body, "delivery_date")) {
          const deliveryDate = getOptionalString(body.delivery_date);
          updates.push("delivery_date = ?");
          values.push(deliveryDate);
        }

        if (hasOwn(body, "status")) {
          if (!isPackageStatus(body.status)) {
            return jsonResponse(
              { error: "status debe ser received, delivered o pending" },
              { status: 400 }
            );
          }

          updates.push("status = ?");
          values.push(body.status);
        }

        if (updates.length === 0) {
          return jsonResponse(
            { error: "Al menos un campo debe ser proporcionado" },
            { status: 400 }
          );
        }

        values.push(id);

        const [result] = await db.query<ResultSetHeader>(
          `UPDATE packages SET ${updates.join(", ")} WHERE id = ?`,
          values
        );

        if (result.affectedRows === 0) {
          return jsonResponse(
            { error: "Paquete no encontrado" },
            { status: 404 }
          );
        }

        const updatedPackage = await getPackageById(id);

        if (!updatedPackage) {
          return jsonResponse(
            { message: "No se pudo recuperar el paquete actualizado" },
            { status: 500 }
          );
        }

        return jsonResponse({
          message: "Paquete actualizado exitosamente",
          id,
          package: updatedPackage,
        });
      } catch (error) {
        return jsonResponse(
          {
            message: "Error actualizando paquete",
            error: String(error),
          },
          { status: 500 }
        );
      }
    }

    if (method === "DELETE" && url.pathname.startsWith("/api/packages/")) {
      try {
        const id = parsePackageId(url.pathname);

        if (!id) {
          return jsonResponse({ error: "id inválido" }, { status: 400 });
        }

        const [result] = await db.query<ResultSetHeader>(
          "DELETE FROM packages WHERE id = ?",
          [id]
        );

        if (result.affectedRows === 0) {
          return jsonResponse(
            { error: "Paquete no encontrado" },
            { status: 404 }
          );
        }

        return jsonResponse({
          message: "Paquete eliminado exitosamente",
          id,
        });
      } catch (error) {
        return jsonResponse(
          {
            message: "Error eliminando paquete",
            error: String(error),
          },
          { status: 500 }
        );
      }
    }

    return jsonResponse({ error: "Ruta no encontrada" }, { status: 404 });
  },
});

console.log(`Backend corriendo en http://localhost:${PORT}`);
