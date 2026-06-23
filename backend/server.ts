import "dotenv/config";
import db from "./src/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { randomBytes } from "crypto";
import nodemailer from "nodemailer";
import QRCode from "qrcode";
import { NotificationService } from "./src/services/notificationService";

type PackageStatus = "received" | "delivered" | "pending";
type ClaimStatus = "open" | "in_review" | "closed";

type PackageRow = RowDataPacket & {
  id: number;
  recipient_name: string;
  recipient_email: string;
  apartment_number: string;
  description: string | null;
  sender: string;
  delivery_date: string | null;
  status: PackageStatus;
  retrieval_code: string | null;
  created_at: string;
  retrieved_at: string | null;
};

type ClaimRow = RowDataPacket & {
  id: number;
  package_id: number;
  resident_id: number;
  description: string;
  status: ClaimStatus;
  created_at: string;
  package_recipient_name: string;
  package_recipient_email: string;
  package_apartment_number: string;
  package_sender: string;
  resident_name: string;
  resident_email: string;
};

type ConserjeDashboardStatsRow = RowDataPacket & {
  pending_total: number;
  delivered_today: number;
};

type UserEstado = "activo" | "inactivo" | "bloqueado";

type UserRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  username: string;
  role: "conserje" | "residente" | "administrador";
  estado: UserEstado;
  password: string;
  otp_code_hash: string | null;
  otp_expires_at: string | null;
  otp_session_id: string | null;
  created_at: string;
};

type AuthorizedEmailRow = RowDataPacket & {
  id: number;
  email: string;
  role: "conserje" | "residente" | "administrador";
  created_by: number | null;
  created_at: string;
};

type AuditLogRow = RowDataPacket & {
  id: number;
  admin_id: number | null;
  admin_nombre: string | null;
  accion: string;
  detalles: string | null;
  created_at: string;
};

type AuthTokenPayload = {
  id: number;
  email: string;
  name: string;
  username: string;
  role: "conserje" | "residente" | "administrador";
};

type UserRole = AuthTokenPayload["role"];

// # Estos headers permiten que frontend y HTMLs de prueba llamen al backend
// # incluso cuando están corriendo en otro puerto.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const allowedStatuses = new Set<PackageStatus>([
  "received",
  "delivered",
  "pending",
]);

const allowedClaimStatuses = new Set<ClaimStatus>([
  "open",
  "in_review",
  "closed",
]);

const claimStatusLabel: Record<ClaimStatus, string> = {
  open: "abierto",
  in_review: "en revisión",
  closed: "cerrado",
};

const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET?.trim() ?? "";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
// # Configuración SMTP usada únicamente para enviar el QR de retiro al correo del residente.
// # Si queda incompleta, el paquete igual se registra y solo se omite el envío del correo.
const SMTP_HOST = process.env.SMTP_HOST?.trim() ?? "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER?.trim() ?? "";
const SMTP_PASSWORD = process.env.SMTP_PASSWORD?.trim() ?? "";
const SMTP_FROM = process.env.SMTP_FROM?.trim() || SMTP_USER;
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
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
  return value === "conserje" || value === "residente" || value === "administrador";
};

const isUserEstado = (value: unknown): value is UserEstado => {
  return value === "activo" || value === "inactivo" || value === "bloqueado";
};

const normalizeIdentifier = (value: string) => {
  return value.trim().toLowerCase();
};

const normalizeEmail = (value: string) => {
  // # Guardamos correos en minúsculas para evitar duplicidades visuales por mayúsculas.
  return value.trim().toLowerCase();
};

const isEmail = (value: string) => {
  // # Validación simple de formato: suficiente para bloquear entradas claramente inválidas antes de SMTP.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const escapeHtml = (value: string) => {
  // # El correo HTML usa datos ingresados por el conserje, por eso escapamos caracteres especiales.
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const parsePackageId = (pathname: string) => {
  const id = Number(pathname.split("/").pop());
  return Number.isInteger(id) && id > 0 ? id : null;
};

const parseClaimId = (pathname: string) => {
  // # Centralizamos el parseo para que todos los endpoints de reclamos validen IDs de la misma forma.
  const id = Number(pathname.split("/").pop());
  return Number.isInteger(id) && id > 0 ? id : null;
};

const parseNotificationId = (pathname: string) => {
  // # El id va en el penúltimo segmento (".../notifications/:id/read"), no en el último.
  const parts = pathname.split("/");
  const id = Number(parts[parts.length - 2]);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const normalizeRetrievalCode = (value: unknown) => {
  // # Aunque el QR lo genera el sistema, normalizamos por seguridad antes de consultar la base.
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim().toUpperCase();
  return normalizedValue ? normalizedValue : null;
};

const isPackageStatus = (value: unknown): value is PackageStatus => {
  return typeof value === "string" && allowedStatuses.has(value as PackageStatus);
};

const isClaimStatus = (value: unknown): value is ClaimStatus => {
  // # La lista cerrada evita estados inventados desde el frontend o llamadas manuales a la API.
  return typeof value === "string" && allowedClaimStatuses.has(value as ClaimStatus);
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
        error: `No tienes permisos para realizar esta acción. Se requiere el rol '${role}'.`,
      },
      { status: 403 }
    );
  }

  return null;
};

const ensureAnyRoleAccess = (user: AuthTokenPayload, roles: UserRole[]) => {
  // # Reclamos pueden ser gestionados por conserje o administrador, por eso este helper acepta más de un rol.
  if (!roles.includes(user.role)) {
    return jsonResponse(
      {
        error: `No tienes permisos para realizar esta acción. Roles permitidos: ${roles.join(", ")}.`,
      },
      { status: 403 }
    );
  }

  return null;
};

const ensureAdminRequest = (request: Request) => {
  const auth = ensureAuthenticatedRequest(request);

  if (auth.response) {
    return { user: null, response: auth.response };
  }

  if (auth.user.role !== "administrador") {
    return {
      user: null,
      response: jsonResponse(
        { error: "No tienes permisos para acceder al panel de administración." },
        { status: 403 }
      ),
    };
  }

  return { user: auth.user, response: null };
};

const registrarLog = async (
  adminId: number | null,
  adminNombre: string | null,
  accion: string,
  detalles?: string
) => {
  try {
    await db.query(
      "INSERT INTO audit_logs (admin_id, admin_nombre, accion, detalles) VALUES (?, ?, ?, ?)",
      [adminId, adminNombre, accion, detalles ?? null]
    );
  } catch (err) {
    console.error("[AuditLog] Error registrando acción:", err);
  }
};

const ensureAdminConLog = async (request: Request, rutaAccedida: string) => {
  const admin = ensureAdminRequest(request);

  if (admin.response) {
    try {
      const userInfo = getAuthenticatedUser(request);
      await registrarLog(
        userInfo.id,
        userInfo.name,
        "acceso_no_autorizado",
        `Intento de acceso a '${rutaAccedida}' por usuario con rol '${userInfo.role}'`
      );
    } catch {
      await registrarLog(null, null, "acceso_no_autorizado", `Intento de acceso no autenticado a '${rutaAccedida}'`);
    }
  }

  return admin;
};

const parseUserId = (pathname: string) => {
  const id = Number(pathname.split("/").pop());
  return Number.isInteger(id) && id > 0 ? id : null;
};

const parseUserIdFromSegment = (pathname: string, segmentIndex: number) => {
  const parts = pathname.split("/");
  const id = Number(parts[segmentIndex]);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const getPackageById = async (id: number) => {
  const [rows] = await db.query<PackageRow[]>(
    "SELECT * FROM packages WHERE id = ?",
    [id]
  );

  return rows[0] ?? null;
};

const getClaimById = async (id: number) => {
  // # El join entrega al frontend contexto suficiente sin obligarlo a hacer llamadas extra por paquete o residente.
  const [rows] = await db.query<ClaimRow[]>(
    `SELECT
       c.id,
       c.package_id,
       c.resident_id,
       c.description,
       c.status,
       c.created_at,
       p.recipient_name AS package_recipient_name,
       p.recipient_email AS package_recipient_email,
       p.apartment_number AS package_apartment_number,
       p.sender AS package_sender,
       u.name AS resident_name,
       u.email AS resident_email
     FROM claims c
     INNER JOIN packages p ON p.id = c.package_id
     INNER JOIN users u ON u.id = c.resident_id
     WHERE c.id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] ?? null;
};

const createRetrievalCodeCandidate = () => {
  // # Este identificador viaja dentro del QR; usamos un alfabeto sin caracteres ambiguos.
  // # No se muestra como flujo principal al usuario: solo sirve como payload interno del QR.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);

  return Array.from(bytes)
    .map((byte) => alphabet[byte % alphabet.length])
    .join("");
};

const generateUniqueRetrievalCode = async () => {
  // # Consultamos la base antes de usar el valor y dejamos el índice UNIQUE como respaldo.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = createRetrievalCodeCandidate();
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT id FROM packages WHERE retrieval_code = ? LIMIT 1",
      [code]
    );

    if (rows.length === 0) {
      return code;
    }
  }

  throw new Error("No se pudo generar un identificador único de retiro");
};

const isMailConfigured = () => {
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_FROM);
};

const createMailTransport = () => {
  // # Se crea al momento de enviar para evitar conexiones SMTP innecesarias al iniciar el backend.
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth:
      SMTP_USER && SMTP_PASSWORD
        ? {
            user: SMTP_USER,
            pass: SMTP_PASSWORD,
          }
        : undefined,
  });
};

type RetrievalEmailPayload = {
  recipientName: string;
  recipientEmail: string;
  apartmentNumber: string;
  sender: string;
  retrievalCode: string;
};

const sendRetrievalQrEmail = async ({
  recipientName,
  recipientEmail,
  apartmentNumber,
  sender,
  retrievalCode,
}: RetrievalEmailPayload) => {
  if (!isMailConfigured()) {
    // # En desarrollo permitimos registrar la encomienda aunque no haya SMTP configurado.
    console.warn(`[Mail] SMTP no configurado. QR no enviado a ${recipientEmail}.`);
    return false;
  }

  // # El QR contiene solo el identificador de retiro; el backend decide si sigue activo.
  const qrBuffer = await QRCode.toBuffer(retrievalCode, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 260,
  });

  const safeRecipientName = escapeHtml(recipientName);
  const safeApartmentNumber = escapeHtml(apartmentNumber);
  const safeSender = escapeHtml(sender);

  // # El QR va embebido con cid para que el residente lo pueda abrir desde el correo
  // # sin depender de enlaces externos ni de entrar a la aplicación.
  await createMailTransport().sendMail({
    from: SMTP_FROM,
    to: recipientEmail,
    subject: "QR para retirar tu encomienda",
    text:
      `Hola ${recipientName},\n\n` +
      `Tienes una encomienda registrada de ${sender} para el departamento ${apartmentNumber}.\n` +
      "Presenta el QR adjunto al conserje para retirarla.",
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827;">
        <h2>Tu encomienda ya fue registrada</h2>
        <p>Hola ${safeRecipientName}, tienes una encomienda de <strong>${safeSender}</strong> para el departamento <strong>${safeApartmentNumber}</strong>.</p>
        <p>Presenta este QR al conserje para retirar tu encomienda.</p>
        <p><img src="cid:retrieval-qr" alt="QR de retiro" style="width: 220px; height: 220px;" /></p>
      </div>
    `,
    attachments: [
      {
        filename: "qr-retiro.png",
        content: qrBuffer,
        cid: "retrieval-qr",
      },
    ],
  });

  return true;
};

type ClaimStatusEmailPayload = {
  residentName: string;
  residentEmail: string;
  claimId: number;
  packageSender: string;
  status: ClaimStatus;
};

const sendClaimStatusEmail = async ({
  residentName,
  residentEmail,
  claimId,
  packageSender,
  status,
}: ClaimStatusEmailPayload) => {
  if (!isMailConfigured()) {
    // # En desarrollo no bloqueamos el cambio de estado si SMTP no está configurado.
    console.warn(`[Mail] SMTP no configurado. Notificación de reclamo no enviada a ${residentEmail}.`);
    return false;
  }

  const safeResidentName = escapeHtml(residentName);
  const safePackageSender = escapeHtml(packageSender);
  const safeStatusLabel = escapeHtml(claimStatusLabel[status]);

  // # Esta notificación cumple el criterio de aceptación: el residente se entera cuando gestión cambia el estado.
  await createMailTransport().sendMail({
    from: SMTP_FROM,
    to: residentEmail,
    subject: `Actualización de tu reclamo #${claimId}`,
    text:
      `Hola ${residentName},\n\n` +
      `Tu reclamo #${claimId} asociado a la encomienda de ${packageSender} cambió a: ${claimStatusLabel[status]}.\n`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827;">
        <h2>Tu reclamo fue actualizado</h2>
        <p>Hola ${safeResidentName}, el reclamo <strong>#${claimId}</strong> asociado a la encomienda de <strong>${safePackageSender}</strong> cambió a <strong>${safeStatusLabel}</strong>.</p>
      </div>
    `,
  });

  return true;
};

const findResidentByEmail = async (email: string) => {
  // # Las encomiendas no guardan user_id; este lookup es lo único que liga
  // # un recipient_email tipeado por el conserje con una cuenta de residente real.
  const [rows] = await db.query<UserRow[]>(
    "SELECT * FROM users WHERE LOWER(email) = ? AND role = 'residente' LIMIT 1",
    [normalizeEmail(email)]
  );

  return rows[0] ?? null;
};

type NotificationEmailPayload = {
  to: string;
  name: string;
  subject: string;
  message: string;
};

const sendNotificationEmail = async ({
  to,
  name,
  subject,
  message,
}: NotificationEmailPayload) => {
  if (!isMailConfigured()) {
    console.warn(`[Mail] SMTP no configurado. Notificación no enviada a ${to}.`);
    return false;
  }

  const safeName = escapeHtml(name);
  const safeMessage = escapeHtml(message);
  const safeSubject = escapeHtml(subject);

  await createMailTransport().sendMail({
    from: SMTP_FROM,
    to,
    subject,
    text: `Hola ${name},\n\n${message}\n`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827;">
        <h2>${safeSubject}</h2>
        <p>Hola ${safeName},</p>
        <p>${safeMessage}</p>
      </div>
    `,
  });

  return true;
};

type NotifyResidentPayload = {
  userId: number;
  email: string;
  name: string;
  message: string;
  subject: string;
};

const notifyResident = async ({
  userId,
  email,
  name,
  message,
  subject,
}: NotifyResidentPayload) => {
  // # Cada paso es independiente: un correo fallido no debe borrar la notificación
  // # ya guardada, ni viceversa, igual que el resto de los envíos de este archivo.
  try {
    await NotificationService.createNotification({ user_id: userId, message });
  } catch (error) {
    console.error("[Notification] Error creando notificación en BD:", error);
  }

  try {
    await sendNotificationEmail({ to: email, name, subject, message });
  } catch (error) {
    console.error("[Mail] Error enviando correo de notificación:", error);
  }
};

async function createTables() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS packages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        recipient_name VARCHAR(255) NOT NULL,
        -- # Correo destino del QR; se solicita al conserje al registrar la encomienda.
        recipient_email VARCHAR(255) NOT NULL DEFAULT '',
        apartment_number VARCHAR(50) NOT NULL,
        description TEXT,
        sender VARCHAR(255) NOT NULL,
        delivery_date TIMESTAMP NULL,
        status ENUM('received', 'delivered', 'pending') DEFAULT 'received',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        retrieved_at TIMESTAMP NULL,
        -- # Payload interno del QR. NULL significa que el QR ya no sirve para retirar.
        retrieval_code VARCHAR(32) NULL UNIQUE
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
    await ensureColumn(
      "recipient_email",
      "recipient_email VARCHAR(255) NOT NULL DEFAULT ''"
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
    await ensureColumn("retrieval_code", "retrieval_code VARCHAR(32) NULL");
    await ensureColumn(
      "created_at",
      "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    );
    // # Guarda la fecha y hora exacta en que el residente retiró la encomienda,
    // # para auditoría e historial. Queda NULL hasta que se marca como entregada.
    await ensureColumn("retrieved_at", "retrieved_at TIMESTAMP NULL");

    // # El índice único impide que dos encomiendas activas compartan el mismo identificador QR.
    const [retrievalCodeIndexes] = await db.query<RowDataPacket[]>(
      "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'packages' AND COLUMN_NAME = 'retrieval_code' AND NON_UNIQUE = 0"
    );

    if (retrievalCodeIndexes.length === 0) {
      await db.query(
        "ALTER TABLE packages ADD UNIQUE KEY uq_packages_retrieval_code (retrieval_code)"
      );
    }

    // # Los paquetes antiguos no entregados reciben identificador para poder usar el flujo QR.
    const [packagesWithoutCode] = await db.query<PackageRow[]>(
      "SELECT * FROM packages WHERE retrieval_code IS NULL AND status <> 'delivered'"
    );

    for (const packageItem of packagesWithoutCode) {
      const retrievalCode = await generateUniqueRetrievalCode();
      await db.query(
        "UPDATE packages SET retrieval_code = ? WHERE id = ?",
        [retrievalCode, packageItem.id]
      );
    }

    console.log("Tabla 'packages' creada o ya existe.");

    // # Conservamos la tabla de usuarios que llegó desde develop para no perder
    // # el trabajo de autenticación local/Google.
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(255) NOT NULL UNIQUE,
        role ENUM('conserje', 'residente', 'administrador') NOT NULL DEFAULT 'residente',
        estado ENUM('activo', 'inactivo', 'bloqueado') NOT NULL DEFAULT 'activo',
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
      "role ENUM('conserje', 'residente', 'administrador') NOT NULL DEFAULT 'residente'"
    );
    await ensureUserColumn(
      "estado",
      "estado ENUM('activo', 'inactivo', 'bloqueado') NOT NULL DEFAULT 'activo'"
    );
    await ensureUserColumn("otp_code_hash", "otp_code_hash VARCHAR(255) NULL");
    await ensureUserColumn("otp_expires_at", "otp_expires_at DATETIME NULL");
    await ensureUserColumn("otp_session_id", "otp_session_id VARCHAR(255) NULL");
    await db.query(
      "UPDATE users SET username = CONCAT('user_', id) WHERE username = '' OR username IS NULL"
    );

    // # Si la tabla ya existía sin el valor 'administrador' en el ENUM lo agregamos.
    const [roleColInfo] = await db.query<RowDataPacket[]>(
      "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'"
    );
    if (roleColInfo.length > 0 && !String(roleColInfo[0].COLUMN_TYPE).includes("administrador")) {
      // # Normalizamos valores que no encajan en la nueva lista (datos viejos o cargados a mano)
      // # para que el ALTER no falle con "Data truncated" bajo sql_mode estricto.
      await db.query(
        "UPDATE users SET role = 'residente' WHERE role NOT IN ('conserje', 'residente', 'administrador')"
      );
      await db.query(
        "ALTER TABLE users MODIFY COLUMN role ENUM('conserje', 'residente', 'administrador') NOT NULL DEFAULT 'residente'"
      );
      console.log("ENUM de 'role' en 'users' actualizado para incluir 'administrador'.");
    }

    console.log("Tabla 'users' creada o ya existe.");

    await db.query(`
      CREATE TABLE IF NOT EXISTS claims (
        id INT AUTO_INCREMENT PRIMARY KEY,
        package_id INT NOT NULL,
        resident_id INT NOT NULL,
        description TEXT NOT NULL,
        status ENUM('open', 'in_review', 'closed') NOT NULL DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        -- # Relacionamos cada reclamo con una encomienda real y con el residente autenticado que lo abrió.
        CONSTRAINT fk_claims_package_id FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
        CONSTRAINT fk_claims_resident_id FOREIGN KEY (resident_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_claims_package_id (package_id),
        INDEX idx_claims_resident_id (resident_id),
        INDEX idx_claims_status (status),
        INDEX idx_claims_created_at (created_at)
      )
    `);

    console.log("Tabla 'claims' creada o ya existe.");

    await db.query(`
      CREATE TABLE IF NOT EXISTS authorized_emails (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        role ENUM('conserje', 'residente', 'administrador') NOT NULL DEFAULT 'conserje',
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_email_role (email, role)
      )
    `);

    console.log("Tabla 'authorized_emails' creada o ya existe.");

    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        admin_id INT NULL,
        admin_nombre VARCHAR(255) NULL,
        accion VARCHAR(100) NOT NULL,
        detalles TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_accion (accion),
        INDEX idx_admin_id (admin_id),
        INDEX idx_created_at (created_at)
      )
    `);

    console.log("Tabla 'audit_logs' creada o ya existe.");

    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        message VARCHAR(500) NOT NULL,
        \`read\` BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_notifications_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_notifications_user_id (user_id),
        INDEX idx_notifications_read (\`read\`),
        INDEX idx_notifications_created_at (created_at),
        INDEX idx_notifications_user_read (user_id, \`read\`)
      )
    `);

    console.log("Tabla 'notifications' creada o ya existe.");
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
        const recipientEmail = getRequiredString(body.recipient_email);
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

        if (!recipientEmail) {
          return jsonResponse(
            { error: "recipient_email es requerido" },
            { status: 400 }
          );
        }

        const normalizedRecipientEmail = normalizeEmail(recipientEmail);

        if (!isEmail(normalizedRecipientEmail)) {
          return jsonResponse(
            { error: "recipient_email debe ser un correo válido" },
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

        const retrievalCode =
          status === "delivered" ? null : await generateUniqueRetrievalCode();

        // # Guardamos el identificador junto al paquete antes de enviar el correo.
        // # Así el QR enviado por email apunta a un registro ya existente y verificable.
        const [result] = await db.query<ResultSetHeader>(
          "INSERT INTO packages (recipient_name, recipient_email, apartment_number, description, sender, delivery_date, status, retrieval_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            recipientName,
            normalizedRecipientEmail,
            apartmentNumber,
            description,
            sender,
            deliveryDate,
            status,
            retrievalCode,
          ]
        );

        const createdPackage = await getPackageById(result.insertId);

        if (!createdPackage) {
          return jsonResponse(
            { message: "No se pudo recuperar el paquete recién creado" },
            { status: 500 }
          );
        }

        let retrievalEmailSent = false;
        let retrievalEmailWarning: string | null = null;

        if (retrievalCode) {
          try {
            // # El correo se envía después del INSERT para no mandar QRs de paquetes no guardados.
            retrievalEmailSent = await sendRetrievalQrEmail({
              recipientName,
              recipientEmail: normalizedRecipientEmail,
              apartmentNumber,
              sender,
              retrievalCode,
            });
          } catch (error) {
            // # No revertimos el registro si falla el correo: el paquete ya quedó guardado.
            console.error("[Mail] Error enviando QR de retiro:", error);
            retrievalEmailWarning =
              "La encomienda fue registrada, pero no se pudo enviar el correo con el QR.";
          }
        }

        try {
          // # El correo del QR ya avisa al residente; aquí solo dejamos la notificación
          // # en la campanita para quien tenga cuenta de residente con ese correo.
          const residentUser = await findResidentByEmail(normalizedRecipientEmail);

          if (residentUser) {
            await NotificationService.createNotification({
              user_id: residentUser.id,
              message: `📦 Nuevo paquete registrado para ${recipientName} (ID: ${result.insertId})`,
            });
          }
        } catch (error) {
          console.error(
            "[Notification] Error creando notificación de paquete registrado:",
            error
          );
        }

        return jsonResponse({
          message: retrievalEmailWarning ?? "Paquete insertado exitosamente",
          id: result.insertId,
          package: createdPackage,
          retrieval_email_sent: retrievalEmailSent,
          retrieval_email_warning: retrievalEmailWarning,
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

    if (method === "POST" && url.pathname === "/api/packages/verify-code") {
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
        // # El lector QR entrega el texto embebido en la imagen; ese texto debe coincidir con retrieval_code.
        const retrievalCode = normalizeRetrievalCode(body.retrieval_code);

        if (!retrievalCode) {
          return jsonResponse(
            { error: "Ingresa un QR de retiro válido." },
            { status: 400 }
          );
        }

        // # Solo un retrieval_code activo permite entregar; al entregar queda en NULL.
        const [rows] = await db.query<PackageRow[]>(
          "SELECT * FROM packages WHERE retrieval_code = ? LIMIT 1",
          [retrievalCode]
        );

        const packageItem = rows[0] ?? null;

        if (!packageItem) {
          return jsonResponse(
            { error: "QR inexistente o ya utilizado." },
            { status: 404 }
          );
        }

        const [result] = await db.query<ResultSetHeader>(
          // # Esta actualización atómica entrega el paquete e invalida el QR en la misma operación.
          "UPDATE packages SET status = 'delivered', delivery_date = COALESCE(delivery_date, NOW()), retrieved_at = NOW(), retrieval_code = NULL WHERE id = ? AND retrieval_code = ?",
          [packageItem.id, retrievalCode]
        );

        if (result.affectedRows === 0) {
          return jsonResponse(
            { error: "QR inexistente o ya utilizado." },
            { status: 404 }
          );
        }

        const deliveredPackage = await getPackageById(packageItem.id);

        if (!deliveredPackage) {
          return jsonResponse(
            { message: "No se pudo recuperar el paquete entregado" },
            { status: 500 }
          );
        }

        try {
          const residentUser = await findResidentByEmail(
            deliveredPackage.recipient_email
          );

          if (residentUser) {
            await notifyResident({
              userId: residentUser.id,
              email: residentUser.email,
              name: residentUser.name,
              subject: "Tu encomienda fue entregada",
              message: `✅ Tu paquete de ${deliveredPackage.sender} fue entregado (ID: ${deliveredPackage.id}).`,
            });
          }
        } catch (error) {
          console.error(
            "[Notification] Error notificando entrega de paquete:",
            error
          );
        }

        return jsonResponse({
          message: "QR validado. Paquete marcado como entregado.",
          package: deliveredPackage,
        });
      } catch (error) {
        return jsonResponse(
          {
            message: "Error validando QR de retiro",
            error: String(error),
          },
          { status: 500 }
        );
      }
    }

    if (method === "GET" && url.pathname === "/api/packages/stats/conserje") {
      try {
        const auth = ensureAuthenticatedRequest(request);

        if (auth.response) {
          return auth.response;
        }

        const roleResponse = ensureRoleAccess(auth.user, "conserje");

        if (roleResponse) {
          return roleResponse;
        }

        const [statsRows] = await db.query<ConserjeDashboardStatsRow[]>(
          `SELECT
             SUM(CASE WHEN status <> 'delivered' THEN 1 ELSE 0 END) AS pending_total,
             SUM(CASE WHEN status = 'delivered' AND DATE(retrieved_at) = CURRENT_DATE() THEN 1 ELSE 0 END) AS delivered_today
           FROM packages`
        );

        const [oldestPendingRows] = await db.query<PackageRow[]>(
          `SELECT *
           FROM packages
           WHERE status <> 'delivered'
           ORDER BY COALESCE(delivery_date, created_at) ASC, created_at ASC
           LIMIT 1`
        );

        return jsonResponse({
          stats: {
            pending_total: Number(statsRows[0]?.pending_total ?? 0),
            delivered_today: Number(statsRows[0]?.delivered_today ?? 0),
            oldest_pending_package: oldestPendingRows[0] ?? null,
          },
        });
      } catch (error) {
        return jsonResponse(
          {
            message: "Error obteniendo estadísticas de conserjería",
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

        const existingPackage = await getPackageById(id);

        if (!existingPackage) {
          return jsonResponse(
            { error: "Paquete no encontrado" },
            { status: 404 }
          );
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

        if (hasOwn(body, "recipient_email")) {
          const recipientEmail = getRequiredString(body.recipient_email);

          if (!recipientEmail) {
            return jsonResponse(
              { error: "recipient_email no puede estar vacío" },
              { status: 400 }
            );
          }

          const normalizedRecipientEmail = normalizeEmail(recipientEmail);

          if (!isEmail(normalizedRecipientEmail)) {
            return jsonResponse(
              { error: "recipient_email debe ser un correo válido" },
              { status: 400 }
            );
          }

          updates.push("recipient_email = ?");
          values.push(normalizedRecipientEmail);
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

        let transitionedToDelivered = false;

        if (hasOwn(body, "status")) {
          if (!isPackageStatus(body.status)) {
            return jsonResponse(
              { error: "status debe ser received, delivered o pending" },
              { status: 400 }
            );
          }

          updates.push("status = ?");
          values.push(body.status);

          if (body.status === "delivered") {
            // # Cualquier entrega manual también invalida el QR para impedir reuso.
            updates.push("retrieval_code = NULL");
            updates.push("retrieved_at = COALESCE(retrieved_at, NOW())");
            transitionedToDelivered = existingPackage.status !== "delivered";
          } else if (existingPackage.status === "delivered") {
            updates.push("retrieved_at = NULL");
          }
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

        if (transitionedToDelivered) {
          try {
            const residentUser = await findResidentByEmail(
              updatedPackage.recipient_email
            );

            if (residentUser) {
              await notifyResident({
                userId: residentUser.id,
                email: residentUser.email,
                name: residentUser.name,
                subject: "Tu encomienda fue entregada",
                message: `✅ Tu paquete de ${updatedPackage.sender} fue entregado (ID: ${updatedPackage.id}).`,
              });
            }
          } catch (error) {
            console.error(
              "[Notification] Error notificando entrega manual de paquete:",
              error
            );
          }
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

    if (method === "POST" && (url.pathname === "/api/claims" || url.pathname === "/claims")) {
      try {
        const auth = ensureAuthenticatedRequest(request);

        if (auth.response) {
          return auth.response;
        }

        const roleResponse = ensureRoleAccess(auth.user, "residente");

        if (roleResponse) {
          return roleResponse;
        }

        const body = (await request.json()) as Record<string, unknown>;
        const packageId = Number(body.package_id);
        const description = getRequiredString(body.description);

        if (!Number.isInteger(packageId) || packageId <= 0) {
          return jsonResponse(
            { error: "package_id debe ser un id de encomienda válido" },
            { status: 400 }
          );
        }

        if (!description) {
          return jsonResponse(
            { error: "description es requerida" },
            { status: 400 }
          );
        }

        const packageItem = await getPackageById(packageId);

        if (!packageItem) {
          return jsonResponse(
            { error: "La encomienda asociada no existe" },
            { status: 404 }
          );
        }

        if (
          packageItem.recipient_name !== auth.user.name &&
          packageItem.recipient_email !== auth.user.email
        ) {
          // # El residente solo puede abrir reclamos para encomiendas asociadas a su identidad.
          return jsonResponse(
            { error: "No puedes reclamar una encomienda de otro residente" },
            { status: 403 }
          );
        }

        const [result] = await db.query<ResultSetHeader>(
          "INSERT INTO claims (package_id, resident_id, description, status) VALUES (?, ?, ?, 'open')",
          [packageId, auth.user.id, description]
        );

        const createdClaim = await getClaimById(result.insertId);

        if (!createdClaim) {
          return jsonResponse(
            { message: "No se pudo recuperar el reclamo recién creado" },
            { status: 500 }
          );
        }

        try {
          await notifyResident({
            userId: auth.user.id,
            email: auth.user.email,
            name: auth.user.name,
            subject: `Reclamo #${result.insertId} recibido`,
            message: `🔴 Reclamo abierto para tu paquete (ID: ${packageId}). Reclamo #${result.insertId}. El conserje lo revisará pronto.`,
          });
        } catch (error) {
          console.error(
            "[Notification] Error notificando apertura de reclamo:",
            error
          );
        }

        return jsonResponse(
          {
            message: "Reclamo creado exitosamente",
            id: result.insertId,
            claim: createdClaim,
          },
          { status: 201 }
        );
      } catch (error) {
        return jsonResponse(
          {
            message: "Error creando reclamo",
            error: String(error),
          },
          { status: 500 }
        );
      }
    }

    if (method === "GET" && (url.pathname === "/api/claims" || url.pathname === "/claims")) {
      try {
        const auth = ensureAuthenticatedRequest(request);

        if (auth.response) {
          return auth.response;
        }

        const values: unknown[] = [];
        const whereParts: string[] = [];

        if (auth.user.role === "residente") {
          // # Filtro obligatorio de backend: un residente nunca recibe reclamos ajenos.
          whereParts.push("c.resident_id = ?");
          values.push(auth.user.id);
        } else {
          const roleResponse = ensureAnyRoleAccess(auth.user, [
            "conserje",
            "administrador",
          ]);

          if (roleResponse) {
            return roleResponse;
          }
        }

        const whereClause =
          whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

        const [rows] = await db.query<ClaimRow[]>(
          `SELECT
             c.id,
             c.package_id,
             c.resident_id,
             c.description,
             c.status,
             c.created_at,
             p.recipient_name AS package_recipient_name,
             p.recipient_email AS package_recipient_email,
             p.apartment_number AS package_apartment_number,
             p.sender AS package_sender,
             u.name AS resident_name,
             u.email AS resident_email
           FROM claims c
           INNER JOIN packages p ON p.id = c.package_id
           INNER JOIN users u ON u.id = c.resident_id
           ${whereClause}
           ORDER BY c.created_at DESC`,
          values
        );

        return jsonResponse({ claims: rows });
      } catch (error) {
        return jsonResponse(
          {
            message: "Error obteniendo reclamos",
            error: String(error),
          },
          { status: 500 }
        );
      }
    }

    if (method === "PATCH" && /^\/(?:api\/)?claims\/\d+$/.test(url.pathname)) {
      try {
        const auth = ensureAuthenticatedRequest(request);

        if (auth.response) {
          return auth.response;
        }

        const roleResponse = ensureAnyRoleAccess(auth.user, [
          "conserje",
          "administrador",
        ]);

        if (roleResponse) {
          return roleResponse;
        }

        const id = parseClaimId(url.pathname);

        if (!id) {
          return jsonResponse({ error: "id inválido" }, { status: 400 });
        }

        const existingClaim = await getClaimById(id);

        if (!existingClaim) {
          return jsonResponse({ error: "Reclamo no encontrado" }, { status: 404 });
        }

        const body = (await request.json()) as Record<string, unknown>;
        const nextStatus = body.status;

        if (!isClaimStatus(nextStatus)) {
          return jsonResponse(
            { error: "status debe ser open, in_review o closed" },
            { status: 400 }
          );
        }

        if (existingClaim.status === "closed" && nextStatus !== "closed") {
          // # Regla de negocio explícita: un reclamo cerrado no se puede reabrir.
          return jsonResponse(
            { error: "Un reclamo cerrado no puede volver a abrirse" },
            { status: 409 }
          );
        }

        const [result] = await db.query<ResultSetHeader>(
          "UPDATE claims SET status = ? WHERE id = ?",
          [nextStatus, id]
        );

        if (result.affectedRows === 0) {
          return jsonResponse({ error: "Reclamo no encontrado" }, { status: 404 });
        }

        const updatedClaim = await getClaimById(id);

        if (!updatedClaim) {
          return jsonResponse(
            { message: "No se pudo recuperar el reclamo actualizado" },
            { status: 500 }
          );
        }

        let notificationSent = false;
        let notificationWarning: string | null = null;

        if (existingClaim.status !== nextStatus) {
          try {
            notificationSent = await sendClaimStatusEmail({
              residentName: updatedClaim.resident_name,
              residentEmail: updatedClaim.resident_email,
              claimId: updatedClaim.id,
              packageSender: updatedClaim.package_sender,
              status: updatedClaim.status,
            });
          } catch (error) {
            // # El estado ya fue guardado; si el correo falla, avisamos sin revertir la gestión.
            console.error("[Mail] Error notificando cambio de reclamo:", error);
            notificationWarning =
              "El estado fue actualizado, pero no se pudo enviar la notificación al residente.";
          }

          try {
            // # El correo ya avisa el cambio; esto solo deja el registro en la campanita.
            await NotificationService.createNotification({
              user_id: updatedClaim.resident_id,
              message: `✅ Tu reclamo #${updatedClaim.id} cambió a: ${claimStatusLabel[updatedClaim.status]}.`,
            });
          } catch (error) {
            console.error(
              "[Notification] Error creando notificación de cambio de reclamo:",
              error
            );
          }
        }

        return jsonResponse({
          message: notificationWarning ?? "Estado de reclamo actualizado exitosamente",
          id,
          claim: updatedClaim,
          notification_sent: notificationSent,
          notification_warning: notificationWarning,
        });
      } catch (error) {
        return jsonResponse(
          {
            message: "Error actualizando reclamo",
            error: String(error),
          },
          { status: 500 }
        );
      }
    }

    if (method === "GET" && url.pathname === "/api/notifications") {
      try {
        const auth = ensureAuthenticatedRequest(request);

        if (auth.response) {
          return auth.response;
        }

        const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1") || 1);
        const limit = Math.max(1, parseInt(url.searchParams.get("limit") ?? "10") || 10);

        if (limit > 100) {
          return jsonResponse(
            { error: "El límite máximo es 100" },
            { status: 400 }
          );
        }

        const data = await NotificationService.getNotificationsByUserId(
          auth.user.id,
          page,
          limit
        );

        return jsonResponse({
          message: "Notificaciones obtenidas exitosamente",
          data,
        });
      } catch (error) {
        return jsonResponse(
          {
            message: "Error obteniendo notificaciones",
            error: String(error),
          },
          { status: 500 }
        );
      }
    }

    if (method === "PATCH" && url.pathname === "/api/notifications/read-all") {
      try {
        const auth = ensureAuthenticatedRequest(request);

        if (auth.response) {
          return auth.response;
        }

        const updated = await NotificationService.markAllNotificationsAsRead(
          auth.user.id
        );

        return jsonResponse({
          message: "Todas las notificaciones han sido marcadas como leídas",
          data: { updated },
        });
      } catch (error) {
        return jsonResponse(
          {
            message: "Error marcando notificaciones como leídas",
            error: String(error),
          },
          { status: 500 }
        );
      }
    }

    if (
      method === "PATCH" &&
      /^\/api\/notifications\/\d+\/read$/.test(url.pathname)
    ) {
      try {
        const auth = ensureAuthenticatedRequest(request);

        if (auth.response) {
          return auth.response;
        }

        const notificationId = parseNotificationId(url.pathname);

        if (!notificationId) {
          return jsonResponse({ error: "id inválido" }, { status: 400 });
        }

        const notification =
          await NotificationService.getNotificationById(notificationId);

        if (!notification) {
          return jsonResponse(
            { error: "Notificación no encontrada" },
            { status: 404 }
          );
        }

        if (notification.user_id !== auth.user.id) {
          // # Un residente nunca debe poder marcar como leída la notificación de otro.
          return jsonResponse(
            { error: "No tienes permisos para actualizar esta notificación" },
            { status: 403 }
          );
        }

        const updatedNotification =
          await NotificationService.markNotificationAsRead(notificationId);

        return jsonResponse({
          message: "Notificación marcada como leída",
          data: updatedNotification,
        });
      } catch (error) {
        return jsonResponse(
          {
            message: "Error marcando notificación como leída",
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

        if (user.estado === "bloqueado") {
          await registrarLog(null, null, "intento_acceso_bloqueado", `Usuario bloqueado intentó iniciar sesión: ${user.email} (id=${user.id})`);
          return jsonResponse(
            { error: "Tu cuenta ha sido bloqueada. Contacta al administrador del edificio." },
            { status: 403 }
          );
        }

        if (user.estado === "inactivo") {
          return jsonResponse(
            { error: "Tu cuenta está inactiva. Contacta al administrador del edificio." },
            { status: 403 }
          );
        }

        // Si existe al menos una entrada en la whitelist para este rol, el email debe estar incluido.
        const [whitelistCount] = await db.query<RowDataPacket[]>(
          "SELECT COUNT(*) as total FROM authorized_emails WHERE role = ?",
          [role]
        );
        if (Number(whitelistCount[0]?.total ?? 0) > 0) {
          const [whitelistMatch] = await db.query<RowDataPacket[]>(
            "SELECT id FROM authorized_emails WHERE LOWER(email) = ? AND role = ?",
            [normalizeIdentifier(user.email), role]
          );
          if (whitelistMatch.length === 0) {
            return jsonResponse(
              { error: "No estás autorizado para acceder con este rol" },
              { status: 401 }
            );
          }
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

        if (user.estado === "bloqueado") {
          await db.query(
            `UPDATE users SET otp_code_hash = NULL, otp_expires_at = NULL, otp_session_id = NULL WHERE id = ?`,
            [user.id]
          );
          return jsonResponse(
            { error: "Tu cuenta ha sido bloqueada. Contacta al administrador del edificio." },
            { status: 403 }
          );
        }

        if (user.estado === "inactivo") {
          await db.query(
            `UPDATE users SET otp_code_hash = NULL, otp_expires_at = NULL, otp_session_id = NULL WHERE id = ?`,
            [user.id]
          );
          return jsonResponse(
            { error: "Tu cuenta está inactiva. Contacta al administrador del edificio." },
            { status: 403 }
          );
        }

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
          const existingUser = rows[0];

          if (existingUser.estado === "bloqueado") {
            await registrarLog(null, null, "intento_acceso_bloqueado", `Usuario bloqueado intentó iniciar sesión con Google: ${existingUser.email}`);
            return jsonResponse(
              { error: "Tu cuenta ha sido bloqueada. Contacta al administrador del edificio." },
              { status: 403 }
            );
          }

          if (existingUser.estado === "inactivo") {
            return jsonResponse(
              { error: "Tu cuenta está inactiva. Contacta al administrador del edificio." },
              { status: 403 }
            );
          }

          user = {
            id: existingUser.id,
            name: existingUser.name,
            email: existingUser.email,
            username: existingUser.username,
            role: existingUser.role,
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

    if (method === "GET" && url.pathname === "/api/admin/users") {
      try {
        const admin = await ensureAdminConLog(request, "GET /api/admin/users");

        if (admin.response) {
          return admin.response;
        }

        const [rows] = await db.query<UserRow[]>(
          "SELECT id, name, email, username, role, estado, created_at FROM users ORDER BY created_at DESC"
        );

        const users = rows.map((u) => ({
          id: String(u.id),
          name: u.name,
          email: u.email,
          username: u.username,
          role: u.role,
          estado: u.estado,
          created_at: u.created_at,
        }));

        return jsonResponse({ users });
      } catch (error) {
        return jsonResponse(
          { message: "Error obteniendo usuarios", error: String(error) },
          { status: 500 }
        );
      }
    }

    // # El endpoint de estado debe ir antes del PATCH genérico para que el
    // # parseUserId del PATCH genérico no reciba "estado" como id.
    if (method === "PATCH" && /^\/api\/admin\/users\/\d+\/estado$/.test(url.pathname)) {
      try {
        const admin = await ensureAdminConLog(request, `PATCH ${url.pathname}`);

        if (admin.response) {
          return admin.response;
        }

        const segments = url.pathname.split("/");
        const id = parseUserIdFromSegment(url.pathname, segments.indexOf("users") + 1);

        if (!id) {
          return jsonResponse({ error: "id inválido" }, { status: 400 });
        }

        if (id === admin.user.id) {
          return jsonResponse(
            { error: "No puedes cambiar tu propio estado de cuenta." },
            { status: 403 }
          );
        }

        const body = (await request.json()) as Record<string, unknown>;
        const nuevoEstado = body.estado;

        if (!isUserEstado(nuevoEstado)) {
          return jsonResponse(
            { error: "estado debe ser activo, inactivo o bloqueado" },
            { status: 400 }
          );
        }

        const [targetRows] = await db.query<UserRow[]>(
          "SELECT id, name, email, role FROM users WHERE id = ?",
          [id]
        );

        if (targetRows.length === 0) {
          return jsonResponse({ error: "Usuario no encontrado" }, { status: 404 });
        }

        const targetUser = targetRows[0];

        const [result] = await db.query<ResultSetHeader>(
          "UPDATE users SET estado = ? WHERE id = ?",
          [nuevoEstado, id]
        );

        if (result.affectedRows === 0) {
          return jsonResponse({ error: "Usuario no encontrado" }, { status: 404 });
        }

        await registrarLog(
          admin.user.id,
          admin.user.name,
          "cambio_estado_usuario",
          `Estado de '${targetUser.name}' (${targetUser.email}) cambiado a '${nuevoEstado}'`
        );

        return jsonResponse({
          message: "Estado de usuario actualizado exitosamente",
          id,
          estado: nuevoEstado,
        });
      } catch (error) {
        return jsonResponse(
          { message: "Error actualizando estado de usuario", error: String(error) },
          { status: 500 }
        );
      }
    }

    if (method === "PATCH" && url.pathname.startsWith("/api/admin/users/")) {
      try {
        const admin = await ensureAdminConLog(request, `PATCH ${url.pathname}`);

        if (admin.response) {
          return admin.response;
        }

        const id = parseUserId(url.pathname);

        if (!id) {
          return jsonResponse({ error: "id inválido" }, { status: 400 });
        }

        const body = (await request.json()) as Record<string, unknown>;
        const newRole = body.role;

        if (!isUserRole(newRole)) {
          return jsonResponse(
            { error: "role debe ser conserje, residente o administrador" },
            { status: 400 }
          );
        }

        if (id === admin.user.id) {
          return jsonResponse(
            { error: "No puedes cambiar tu propio rol." },
            { status: 403 }
          );
        }

        const [targetRows] = await db.query<UserRow[]>(
          "SELECT id, name, email, role FROM users WHERE id = ?",
          [id]
        );

        if (targetRows.length === 0) {
          return jsonResponse({ error: "Usuario no encontrado" }, { status: 404 });
        }

        const targetUser = targetRows[0];
        const previousRole = targetUser.role;

        const [result] = await db.query<ResultSetHeader>(
          "UPDATE users SET role = ? WHERE id = ?",
          [newRole, id]
        );

        if (result.affectedRows === 0) {
          return jsonResponse({ error: "Usuario no encontrado" }, { status: 404 });
        }

        await registrarLog(
          admin.user.id,
          admin.user.name,
          "cambio_rol",
          `Rol de '${targetUser.name}' (${targetUser.email}) cambiado de '${previousRole}' a '${newRole}'`
        );

        return jsonResponse({ message: "Rol actualizado exitosamente", id, role: newRole });
      } catch (error) {
        return jsonResponse(
          { message: "Error actualizando rol", error: String(error) },
          { status: 500 }
        );
      }
    }

    if (method === "DELETE" && url.pathname.startsWith("/api/admin/users/")) {
      try {
        const admin = await ensureAdminConLog(request, `DELETE ${url.pathname}`);

        if (admin.response) {
          return admin.response;
        }

        const id = parseUserId(url.pathname);

        if (!id) {
          return jsonResponse({ error: "id inválido" }, { status: 400 });
        }

        if (id === admin.user.id) {
          return jsonResponse(
            { error: "No puedes eliminar tu propia cuenta de administrador." },
            { status: 403 }
          );
        }

        const [targetRows] = await db.query<UserRow[]>(
          "SELECT id, name, email, role FROM users WHERE id = ?",
          [id]
        );

        if (targetRows.length === 0) {
          return jsonResponse({ error: "Usuario no encontrado" }, { status: 404 });
        }

        const targetUser = targetRows[0];

        const [result] = await db.query<ResultSetHeader>(
          "DELETE FROM users WHERE id = ?",
          [id]
        );

        if (result.affectedRows === 0) {
          return jsonResponse({ error: "Usuario no encontrado" }, { status: 404 });
        }

        await registrarLog(
          admin.user.id,
          admin.user.name,
          "eliminar_usuario",
          `Usuario '${targetUser.name}' (${targetUser.email}, rol: ${targetUser.role}) eliminado del sistema`
        );

        return jsonResponse({ message: "Usuario eliminado exitosamente", id });
      } catch (error) {
        return jsonResponse(
          { message: "Error eliminando usuario", error: String(error) },
          { status: 500 }
        );
      }
    }

    if (method === "GET" && url.pathname === "/api/admin/logs") {
      try {
        const admin = await ensureAdminConLog(request, "GET /api/admin/logs");

        if (admin.response) {
          return admin.response;
        }

        const limite = Math.min(Number(url.searchParams.get("limite") ?? 100), 500);
        const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

        const [rows] = await db.query<AuditLogRow[]>(
          `SELECT id, admin_id, admin_nombre, accion, detalles, created_at
           FROM audit_logs
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`,
          [limite, offset]
        );

        const [countRows] = await db.query<RowDataPacket[]>(
          "SELECT COUNT(*) as total FROM audit_logs"
        );
        const total = Number(countRows[0]?.total ?? 0);

        const logs = rows.map((l) => ({
          id: String(l.id),
          admin_id: l.admin_id ? String(l.admin_id) : null,
          admin_nombre: l.admin_nombre,
          accion: l.accion,
          detalles: l.detalles,
          created_at: l.created_at,
        }));

        return jsonResponse({ logs, total, limite, offset });
      } catch (error) {
        return jsonResponse(
          { message: "Error obteniendo logs", error: String(error) },
          { status: 500 }
        );
      }
    }

    if (method === "GET" && url.pathname === "/api/admin/authorized-emails") {
      try {
        const admin = await ensureAdminConLog(request, "GET /api/admin/authorized-emails");
        if (admin.response) return admin.response;

        const [rows] = await db.query<AuthorizedEmailRow[]>(
          `SELECT ae.id, ae.email, ae.role, ae.created_by, ae.created_at,
                  u.name AS created_by_name
           FROM authorized_emails ae
           LEFT JOIN users u ON u.id = ae.created_by
           ORDER BY ae.created_at DESC`
        );

        const emails = rows.map((r) => ({
          id: String(r.id),
          email: r.email,
          role: r.role,
          created_by: r.created_by ? String(r.created_by) : null,
          created_by_name: (r as AuthorizedEmailRow & { created_by_name?: string }).created_by_name ?? null,
          created_at: r.created_at,
        }));

        return jsonResponse({ emails });
      } catch (error) {
        return jsonResponse(
          { message: "Error obteniendo correos autorizados", error: String(error) },
          { status: 500 }
        );
      }
    }

    if (method === "POST" && url.pathname === "/api/admin/authorized-emails") {
      try {
        const admin = await ensureAdminConLog(request, "POST /api/admin/authorized-emails");
        if (admin.response) return admin.response;

        const body = (await request.json()) as Record<string, unknown>;
        const email = getRequiredString(body.email);
        const role = body.role;

        if (!email || !isUserRole(role)) {
          return jsonResponse(
            { error: "email y role son requeridos" },
            { status: 400 }
          );
        }

        const normalizedEmail = normalizeIdentifier(email);

        const [result] = await db.query<ResultSetHeader>(
          "INSERT INTO authorized_emails (email, role, created_by) VALUES (?, ?, ?)",
          [normalizedEmail, role, admin.user.id]
        );

        await registrarLog(
          admin.user.id,
          admin.user.name,
          "agregar_email_autorizado",
          `Correo '${normalizedEmail}' autorizado para rol '${role}'`
        );

        return jsonResponse(
          {
            message: "Correo autorizado agregado exitosamente",
            id: String(result.insertId),
            email: normalizedEmail,
            role,
          },
          { status: 201 }
        );
      } catch (error) {
        const isDuplicate = String(error).includes("Duplicate entry") || String(error).includes("uq_email_role");
        if (isDuplicate) {
          return jsonResponse(
            { error: "Este correo ya está autorizado para ese rol" },
            { status: 409 }
          );
        }
        return jsonResponse(
          { message: "Error agregando correo autorizado", error: String(error) },
          { status: 500 }
        );
      }
    }

    if (method === "PATCH" && url.pathname.startsWith("/api/admin/authorized-emails/")) {
      try {
        const admin = await ensureAdminConLog(request, `PATCH ${url.pathname}`);
        if (admin.response) return admin.response;

        const id = parseUserId(url.pathname);
        if (!id) return jsonResponse({ error: "id inválido" }, { status: 400 });

        const body = (await request.json()) as Record<string, unknown>;
        const newRole = body.role;

        if (!isUserRole(newRole)) {
          return jsonResponse(
            { error: "role debe ser conserje, residente o administrador" },
            { status: 400 }
          );
        }

        const [result] = await db.query<ResultSetHeader>(
          "UPDATE authorized_emails SET role = ? WHERE id = ?",
          [newRole, id]
        );

        if (result.affectedRows === 0) {
          return jsonResponse({ error: "Correo autorizado no encontrado" }, { status: 404 });
        }

        await registrarLog(
          admin.user.id,
          admin.user.name,
          "cambio_rol_email_autorizado",
          `Rol del correo autorizado id=${id} cambiado a '${newRole}'`
        );

        return jsonResponse({ message: "Rol actualizado exitosamente", id, role: newRole });
      } catch (error) {
        const isDuplicate = String(error).includes("Duplicate entry") || String(error).includes("uq_email_role");
        if (isDuplicate) {
          return jsonResponse(
            { error: "Este correo ya está autorizado para ese rol" },
            { status: 409 }
          );
        }
        return jsonResponse(
          { message: "Error actualizando correo autorizado", error: String(error) },
          { status: 500 }
        );
      }
    }

    if (method === "DELETE" && url.pathname.startsWith("/api/admin/authorized-emails/")) {
      try {
        const admin = await ensureAdminConLog(request, `DELETE ${url.pathname}`);
        if (admin.response) return admin.response;

        const id = parseUserId(url.pathname);
        if (!id) return jsonResponse({ error: "id inválido" }, { status: 400 });

        const [emailRows] = await db.query<AuthorizedEmailRow[]>(
          "SELECT email, role FROM authorized_emails WHERE id = ?",
          [id]
        );

        const [result] = await db.query<ResultSetHeader>(
          "DELETE FROM authorized_emails WHERE id = ?",
          [id]
        );

        if (result.affectedRows === 0) {
          return jsonResponse({ error: "Correo autorizado no encontrado" }, { status: 404 });
        }

        if (emailRows.length > 0) {
          await registrarLog(
            admin.user.id,
            admin.user.name,
            "eliminar_email_autorizado",
            `Correo '${emailRows[0].email}' (rol: ${emailRows[0].role}) eliminado de la whitelist`
          );
        }

        return jsonResponse({ message: "Correo autorizado eliminado exitosamente" });
      } catch (error) {
        return jsonResponse(
          { message: "Error eliminando correo autorizado", error: String(error) },
          { status: 500 }
        );
      }
    }

    return jsonResponse({ error: "Ruta no encontrada" }, { status: 404 });
  },
});

console.log(`Backend corriendo en http://localhost:${PORT}`);
