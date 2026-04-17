import "dotenv/config";
import db from "./src/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";

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

type UserRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  password: string;
  created_at: string;
};

type AuthTokenPayload = {
  id: number;
  email: string;
  name: string;
};

// # Estos headers permiten que frontend y HTMLs de prueba llamen al backend
// # incluso cuando están corriendo en otro puerto.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const allowedStatuses = new Set<PackageStatus>([
  "received",
  "delivered",
  "pending",
]);

const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET?.trim() ?? "";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";

// # Solo creamos el cliente de Google si realmente existe el Client ID.
// # Así el backend puede seguir funcionando para paquetes aunque SSO no esté configurado.
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

const jsonResponse = (body: unknown, init?: ResponseInit) => {
  return Response.json(body, {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init?.headers ?? {}),
    },
  });
};

const getRequiredString = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
};

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

const parsePackageId = (pathname: string) => {
  const id = Number(pathname.split("/").pop());
  return Number.isInteger(id) && id > 0 ? id : null;
};

const isPackageStatus = (value: unknown): value is PackageStatus => {
  return typeof value === "string" && allowedStatuses.has(value as PackageStatus);
};

const hasOwn = (value: Record<string, unknown>, key: string) => {
  return Object.prototype.hasOwnProperty.call(value, key);
};

const ensureAuthIsConfigured = () => {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET no está definido en backend/.env");
  }
};

const ensureGoogleAuthIsConfigured = () => {
  ensureAuthIsConfigured();

  if (!GOOGLE_CLIENT_ID || !googleClient) {
    throw new Error("GOOGLE_CLIENT_ID no está definido en backend/.env");
  }
};

const generateToken = (user: AuthTokenPayload) => {
  ensureAuthIsConfigured();

  return jwt.sign(user, JWT_SECRET, {
    expiresIn: "2h",
  });
};

const verifyAuthHeader = (request: Request) => {
  ensureAuthIsConfigured();

  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    throw new Error("Falta header Authorization");
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    throw new Error("Formato de token inválido");
  }

  return jwt.verify(parts[1], JWT_SECRET);
};

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
    // # una por una para no depender de recrear toda la base.
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

    // # Conservamos la tabla de usuarios que llegó desde develop para no perder
    // # el trabajo de autenticación local/Google.
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Tabla 'users' creada o ya existe.");
  } catch (error) {
    console.error("Error creando tablas:", error);
  }
}

await createTables();

Bun.serve({
  port: PORT,
  async fetch(request: Request) {
    const url = new URL(request.url);
    const method = request.method.trim().toUpperCase();

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
        // # Permitimos filtros por query string para que el frontend no tenga
        // # que descargar siempre el historial completo.
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
          updates.push("delivery_date = ?");
          values.push(getOptionalString(body.delivery_date));
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

    if (method === "POST" && url.pathname === "/api/auth/register") {
      try {
        const body = (await request.json()) as Record<string, unknown>;
        const name = getRequiredString(body.name);
        const email = getRequiredString(body.email);
        const password = getRequiredString(body.password);

        if (!name || !email || !password) {
          return jsonResponse(
            { error: "name, email y password son requeridos" },
            { status: 400 }
          );
        }

        const [existingUsers] = await db.query<UserRow[]>(
          "SELECT * FROM users WHERE email = ?",
          [email]
        );

        if (existingUsers.length > 0) {
          return jsonResponse(
            { error: "Ya existe un usuario con ese correo" },
            { status: 409 }
          );
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await db.query<ResultSetHeader>(
          "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
          [name, email, hashedPassword]
        );

        return jsonResponse(
          {
            message: "Usuario registrado exitosamente",
            id: result.insertId,
          },
          { status: 201 }
        );
      } catch (error) {
        return jsonResponse(
          {
            message: "Error registrando usuario",
            error: String(error),
          },
          { status: 500 }
        );
      }
    }

    if (method === "POST" && url.pathname === "/api/auth/login") {
      try {
        const body = (await request.json()) as Record<string, unknown>;
        const email = getRequiredString(body.email);
        const password = getRequiredString(body.password);

        if (!email || !password) {
          return jsonResponse(
            { error: "email y password son requeridos" },
            { status: 400 }
          );
        }

        const [rows] = await db.query<UserRow[]>(
          "SELECT * FROM users WHERE email = ?",
          [email]
        );

        if (rows.length === 0) {
          return jsonResponse(
            { error: "Credenciales inválidas" },
            { status: 401 }
          );
        }

        const user = rows[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
          return jsonResponse(
            { error: "Credenciales inválidas" },
            { status: 401 }
          );
        }

        const token = generateToken({
          id: user.id,
          email: user.email,
          name: user.name,
        });

        return jsonResponse({
          message: "Inicio de sesión exitoso",
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
        });
      } catch (error) {
        return jsonResponse(
          {
            message: "Error iniciando sesión",
            error: String(error),
          },
          { status: 500 }
        );
      }
    }

    if (method === "POST" && url.pathname === "/api/auth/google") {
      try {
        ensureGoogleAuthIsConfigured();

        const body = (await request.json()) as Record<string, unknown>;
        const token = getRequiredString(body.token);

        if (!token || !googleClient) {
          return jsonResponse(
            { error: "Token de Google requerido" },
            { status: 400 }
          );
        }

        const ticket = await googleClient.verifyIdToken({
          idToken: token,
          audience: GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();

        if (!payload?.email) {
          return jsonResponse(
            { error: "Token de Google inválido" },
            { status: 401 }
          );
        }

        const [rows] = await db.query<UserRow[]>(
          "SELECT * FROM users WHERE email = ?",
          [payload.email]
        );

        let user: AuthTokenPayload;

        if (rows.length > 0) {
          user = {
            id: rows[0].id,
            name: rows[0].name,
            email: rows[0].email,
          };
        } else {
          const [result] = await db.query<ResultSetHeader>(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            [payload.name || "Usuario Google", payload.email, "GOOGLE_LOGIN"]
          );

          user = {
            id: result.insertId,
            name: payload.name || "Usuario Google",
            email: payload.email,
          };
        }

        const appToken = generateToken(user);

        return jsonResponse({
          message: "Inicio de sesión con Google exitoso",
          token: appToken,
          user,
        });
      } catch (error) {
        return jsonResponse(
          {
            error: "Error en autenticación SSO con Google",
            details: String(error),
          },
          { status: 500 }
        );
      }
    }

    if (method === "GET" && url.pathname === "/api/auth/profile") {
      try {
        const decoded = verifyAuthHeader(request);

        return jsonResponse({
          message: "Acceso autorizado",
          user: decoded,
        });
      } catch (error) {
        return jsonResponse(
          {
            error: "No autorizado",
            details: String(error),
          },
          { status: 401 }
        );
      }
    }

    return jsonResponse({ error: "Ruta no encontrada" }, { status: 404 });
  },
});

console.log(`Backend corriendo en http://localhost:${PORT}`);
