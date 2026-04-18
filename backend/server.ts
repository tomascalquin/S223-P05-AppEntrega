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
  username: string;
  role: "conserje" | "residente";
  password: string;
  otp_code_hash: string | null;
  otp_expires_at: string | null;
  otp_session_id: string | null;
  created_at: string;
};

type AuthTokenPayload = {
  id: number;
  email: string;
  name: string;
  username: string;
  role: "conserje" | "residente";
};

type UserRole = AuthTokenPayload["role"];

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
const OTP_LENGTH = 6;
const OTP_EXPIRATION_MINUTES = 5;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

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

const isUserRole = (value: unknown): value is UserRole => {
  return value === "conserje" || value === "residente";
};

const normalizeIdentifier = (value: string) => {
  return value.trim().toLowerCase();
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

const buildSafeUser = (user: Pick<UserRow, "id" | "name" | "email" | "username" | "role">) => {
  // # Normalizamos los tipos antes de enviarlos al frontend para que no dependa
  // # del formato interno de MySQL.
  return {
    id: String(user.id),
    name: user.name,
    email: user.email,
    username: user.username,
    role: user.role,
  };
};

const createOtpCode = () => {
  // # `Math.random` es suficiente para una demo/local, pero devolvemos un
  // # string fijo en longitud para evitar OTPs de 5 dígitos por ceros iniciales.
  const maxValue = 10 ** OTP_LENGTH;
  return Math.floor(Math.random() * maxValue)
    .toString()
    .padStart(OTP_LENGTH, "0");
};

const createOtpExpirationDate = () => {
  return new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000);
};

const buildOtpChallengeResponse = (otpSessionId: string, otpExpiresAt: Date, otpCode: string) => {
  return {
    requiresOtp: true,
    otpSessionId,
    otpExpiresAt: otpExpiresAt.toISOString(),
    // # En producción este campo se oculta; en desarrollo lo exponemos para
    // # poder probar el flujo completo sin integrar correo o SMS.
    otpCode: IS_PRODUCTION ? undefined : otpCode,
  };
};

const getUserByIdentifier = async (identifier: string, role: UserRole) => {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  const [rows] = await db.query<UserRow[]>(
    `SELECT * FROM users
     WHERE role = ? AND (LOWER(email) = ? OR LOWER(username) = ?)
     LIMIT 1`,
    [role, normalizedIdentifier, normalizedIdentifier]
  );

  return rows[0] ?? null;
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

const isAuthTokenPayload = (value: unknown): value is AuthTokenPayload => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload.id === "number" &&
    typeof payload.email === "string" &&
    typeof payload.name === "string" &&
    typeof payload.username === "string" &&
    isUserRole(payload.role)
  );
};

const getAuthenticatedUser = (request: Request) => {
  const decodedToken = verifyAuthHeader(request);

  if (!isAuthTokenPayload(decodedToken)) {
    throw new Error("Payload de autenticacion invalido");
  }

  return decodedToken;
};

const ensureAuthenticatedRequest = (request: Request) => {
  try {
    return {
      user: getAuthenticatedUser(request),
      response: null,
    };
  } catch (error) {
    return {
      user: null,
      response: jsonResponse(
        {
          error: "No autorizado",
          details: String(error),
        },
        { status: 401 }
      ),
    };
  }
};

const ensureRoleAccess = (user: AuthTokenPayload, role: UserRole) => {
  if (user.role !== role) {
    return jsonResponse(
      {
        error: "No tienes permisos para realizar esta accion",
      },
      { status: 403 }
    );
  }

  return null;
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
        username VARCHAR(255) NOT NULL UNIQUE,
        role ENUM('conserje', 'residente') NOT NULL DEFAULT 'residente',
        password VARCHAR(255) NOT NULL,
        otp_code_hash VARCHAR(255) NULL,
        otp_expires_at DATETIME NULL,
        otp_session_id VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const ensureUserColumn = async (columnName: string, definition: string) => {
      const [rows] = await db.query<RowDataPacket[]>(
        "SHOW COLUMNS FROM users LIKE ?",
        [columnName]
      );

      if (rows.length === 0) {
        await db.query(`ALTER TABLE users ADD COLUMN ${definition}`);
      }
    };

    await ensureUserColumn(
      "username",
      "username VARCHAR(255) NOT NULL DEFAULT ''"
    );
    await ensureUserColumn(
      "role",
      "role ENUM('conserje', 'residente') NOT NULL DEFAULT 'residente'"
    );
    await ensureUserColumn("otp_code_hash", "otp_code_hash VARCHAR(255) NULL");
    await ensureUserColumn("otp_expires_at", "otp_expires_at DATETIME NULL");
    await ensureUserColumn("otp_session_id", "otp_session_id VARCHAR(255) NULL");
    await db.query(
      "UPDATE users SET username = CONCAT('user_', id) WHERE username = '' OR username IS NULL"
    );

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
        const auth = ensureAuthenticatedRequest(request);

        if (auth.response) {
          return auth.response;
        }

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

        if (auth.user.role === "residente") {
          // # Aunque el frontend ya filtra la vista del residente, repetimos la regla
          // # en backend para que no pueda consultar encomiendas de otros usuarios.
          filters.push("recipient_name = ?");
          values.push(auth.user.name);
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
        const auth = ensureAuthenticatedRequest(request);

        if (auth.response) {
          return auth.response;
        }

        const roleResponse = ensureRoleAccess(auth.user, "conserje");

        if (roleResponse) {
          return roleResponse;
        }

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
        const auth = ensureAuthenticatedRequest(request);

        if (auth.response) {
          return auth.response;
        }

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

        if (
          auth.user.role === "residente" &&
          packageItem.recipient_name !== auth.user.name
        ) {
          return jsonResponse(
            { error: "No tienes permisos para ver este paquete" },
            { status: 403 }
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
        const auth = ensureAuthenticatedRequest(request);

        if (auth.response) {
          return auth.response;
        }

        const roleResponse = ensureRoleAccess(auth.user, "conserje");

        if (roleResponse) {
          return roleResponse;
        }

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
        const auth = ensureAuthenticatedRequest(request);

        if (auth.response) {
          return auth.response;
        }

        const roleResponse = ensureRoleAccess(auth.user, "conserje");

        if (roleResponse) {
          return roleResponse;
        }

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
        const role = body.role;
        const name = getRequiredString(body.name);
        const email = getRequiredString(body.email);
        const username = getRequiredString(body.username);
        const password = getRequiredString(body.password);

        if (!isUserRole(role) || !name || !email || !username || !password) {
          return jsonResponse(
            { error: "role, name, email, username y password son requeridos" },
            { status: 400 }
          );
        }

        const [existingUsers] = await db.query<UserRow[]>(
          "SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?",
          [normalizeIdentifier(email), normalizeIdentifier(username)]
        );

        if (existingUsers.length > 0) {
          return jsonResponse(
            { error: "Ya existe un usuario con ese correo o nombre de usuario" },
            { status: 409 }
          );
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await db.query<ResultSetHeader>(
          "INSERT INTO users (name, email, username, role, password) VALUES (?, ?, ?, ?, ?)",
          [
            name,
            normalizeIdentifier(email),
            normalizeIdentifier(username),
            role,
            hashedPassword,
          ]
        );

        const registeredUser = {
          id: result.insertId,
          name,
          email: normalizeIdentifier(email),
          username: normalizeIdentifier(username),
          role,
        };

        const token = generateToken(registeredUser);

        return jsonResponse(
          {
            message: "Usuario registrado exitosamente",
            token,
            user: buildSafeUser(registeredUser),
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
        const role = body.role;
        const identifier = getRequiredString(body.identifier);
        const password = getRequiredString(body.password);

        if (!isUserRole(role) || !identifier || !password) {
          return jsonResponse(
            { error: "role, identifier y password son requeridos" },
            { status: 400 }
          );
        }

        const user = await getUserByIdentifier(identifier, role);

        if (!user) {
          return jsonResponse(
            { error: "Credenciales invalidas" },
            { status: 401 }
          );
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
          return jsonResponse(
            { error: "Credenciales invalidas" },
            { status: 401 }
          );
        }

        const otpCode = createOtpCode();
        const otpSessionId = crypto.randomUUID();
        const otpExpiresAt = createOtpExpirationDate();
        const otpCodeHash = await bcrypt.hash(otpCode, 10);

        // # Guardamos la sesion OTP en el usuario para que el segundo paso
        // # confirme el codigo correcto y ademas invalide codigos anteriores.
        await db.query(
          `UPDATE users
           SET otp_code_hash = ?, otp_expires_at = ?, otp_session_id = ?
           WHERE id = ?`,
          [otpCodeHash, otpExpiresAt, otpSessionId, user.id]
        );

        console.log(
          `[OTP] Usuario ${user.email} debe validar el codigo ${otpCode} antes de ${otpExpiresAt.toISOString()}`
        );

        return jsonResponse({
          message: "Credenciales correctas. Falta validar el OTP.",
          ...buildOtpChallengeResponse(otpSessionId, otpExpiresAt, otpCode),
        });
      } catch (error) {
        return jsonResponse(
          {
            message: "Error iniciando sesion",
            error: String(error),
          },
          { status: 500 }
        );
      }
    }

    if (method === "POST" && url.pathname === "/api/auth/verify-otp") {
      try {
        const body = (await request.json()) as Record<string, unknown>;
        const otpSessionId = getRequiredString(body.otpSessionId);
        const otpCode = getRequiredString(body.otpCode);

        if (!otpSessionId || !otpCode) {
          return jsonResponse(
            { error: "otpSessionId y otpCode son requeridos" },
            { status: 400 }
          );
        }

        const [rows] = await db.query<UserRow[]>(
          "SELECT * FROM users WHERE otp_session_id = ? LIMIT 1",
          [otpSessionId]
        );

        if (rows.length === 0) {
          return jsonResponse(
            { error: "La sesion OTP no existe o ya fue usada" },
            { status: 401 }
          );
        }

        const user = rows[0];

        if (!user.otp_code_hash || !user.otp_expires_at) {
          return jsonResponse(
            { error: "No existe un OTP pendiente para este usuario" },
            { status: 401 }
          );
        }

        const otpExpirationTime = new Date(user.otp_expires_at).getTime();

        if (Number.isNaN(otpExpirationTime) || otpExpirationTime < Date.now()) {
          await db.query(
            `UPDATE users
             SET otp_code_hash = NULL, otp_expires_at = NULL, otp_session_id = NULL
             WHERE id = ?`,
            [user.id]
          );

          return jsonResponse(
            { error: "El OTP expiro. Debes iniciar sesion nuevamente." },
            { status: 401 }
          );
        }

        const isOtpValid = await bcrypt.compare(otpCode, user.otp_code_hash);

        if (!isOtpValid) {
          return jsonResponse(
            { error: "El codigo OTP ingresado no es valido" },
            { status: 401 }
          );
        }

        await db.query(
          `UPDATE users
           SET otp_code_hash = NULL, otp_expires_at = NULL, otp_session_id = NULL
           WHERE id = ?`,
          [user.id]
        );

        const token = generateToken({
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
          role: user.role,
        });

        return jsonResponse({
          message: "OTP validado correctamente. Inicio de sesion completado.",
          token,
          user: buildSafeUser(user),
        });
      } catch (error) {
        return jsonResponse(
          {
            message: "Error validando OTP",
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
        const requestedRole = isUserRole(body.role) ? body.role : "residente";

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
            username: rows[0].username,
            role: rows[0].role,
          };
        } else {
          const googleUsernameBase = normalizeIdentifier(
            payload.email.split("@")[0] ?? payload.email
          );
          const googleUsername = `${googleUsernameBase}_${crypto.randomUUID().slice(0, 8)}`;

          const [result] = await db.query<ResultSetHeader>(
            "INSERT INTO users (name, email, username, role, password) VALUES (?, ?, ?, ?, ?)",
            [
              payload.name || "Usuario Google",
              normalizeIdentifier(payload.email),
              googleUsername,
              requestedRole,
              "GOOGLE_LOGIN",
            ]
          );

          user = {
            id: result.insertId,
            name: payload.name || "Usuario Google",
            email: normalizeIdentifier(payload.email),
            username: googleUsername,
            role: requestedRole,
          };
        }

        const appToken = generateToken(user);

        return jsonResponse({
          message: "Inicio de sesión con Google exitoso",
          token: appToken,
          user: buildSafeUser(user),
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
        const decoded = getAuthenticatedUser(request);

        return jsonResponse({
          message: "Acceso autorizado",
          user: buildSafeUser(decoded),
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
