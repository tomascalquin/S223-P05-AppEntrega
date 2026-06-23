/**
 * TAREA PROGRAMADA: Recordatorios de encomiendas sin retirar
 *
 * Corre una vez al día y, para cada encomienda que sigue sin estado
 * 'delivered' y supera el umbral de RECORDATORIO_UMBRAL_DIAS, envía al
 * residente una notificación in-app (NotificationService) y un correo.
 */

import cron from "node-cron";
import nodemailer from "nodemailer";
import type { RowDataPacket } from "mysql2/promise";
import db from "../db";
import { NotificationService } from "./notificationService";

const DEFAULT_REMINDER_THRESHOLD_DAYS = 3;
// # node-cron usa hora del servidor; 09:00 evita madrugadas y deja margen
// # para que conserjería ya esté operando cuando el residente reciba el aviso.
const REMINDER_CRON_SCHEDULE = "0 9 * * *";

const getReminderThresholdDays = (): number => {
  const rawValue = Number(process.env.RECORDATORIO_UMBRAL_DIAS);
  return Number.isInteger(rawValue) && rawValue > 0
    ? rawValue
    : DEFAULT_REMINDER_THRESHOLD_DAYS;
};

const SMTP_HOST = process.env.SMTP_HOST?.trim() ?? "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER?.trim() ?? "";
const SMTP_PASSWORD = process.env.SMTP_PASSWORD?.trim() ?? "";
const SMTP_FROM = process.env.SMTP_FROM?.trim() || SMTP_USER;
const SMTP_SECURE = process.env.SMTP_SECURE === "true";

const isMailConfigured = (): boolean => {
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_FROM);
};

const createMailTransport = () => {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth:
      SMTP_USER && SMTP_PASSWORD
        ? { user: SMTP_USER, pass: SMTP_PASSWORD }
        : undefined,
  });
};

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

type PendingPackageRow = RowDataPacket & {
  id: number;
  recipient_name: string;
  recipient_email: string;
  apartment_number: string;
  sender: string;
  created_at: string;
};

type ResidentIdRow = RowDataPacket & { id: number };

const findResidentIdByEmail = async (email: string): Promise<number | null> => {
  // # Las encomiendas no guardan user_id; este lookup es lo único que liga
  // # un recipient_email con una cuenta de residente real (igual que en server.ts).
  const [rows] = await db.query<ResidentIdRow[]>(
    "SELECT id FROM users WHERE LOWER(email) = ? AND role = 'residente' LIMIT 1",
    [email.trim().toLowerCase()]
  );

  return rows[0]?.id ?? null;
};

const findPendingPackagesNeedingReminder = async (
  thresholdDays: number
): Promise<PendingPackageRow[]> => {
  const [rows] = await db.query<PendingPackageRow[]>(
    `SELECT id, recipient_name, recipient_email, apartment_number, sender, created_at
     FROM packages
     WHERE status <> 'delivered'
       AND recipient_email <> ''
       AND created_at <= DATE_SUB(NOW(), INTERVAL ? DAY)
       AND (last_reminder_sent_at IS NULL OR last_reminder_sent_at < CURDATE())`,
    [thresholdDays]
  );

  return rows;
};

const markReminderSent = async (packageId: number): Promise<void> => {
  await db.query(
    "UPDATE packages SET last_reminder_sent_at = NOW() WHERE id = ?",
    [packageId]
  );
};

const buildReminderMessage = (
  packageItem: PendingPackageRow,
  daysWaiting: number
): string => {
  return (
    `Tienes una encomienda de ${packageItem.sender} ` +
    `(depto ${packageItem.apartment_number}) esperando retiro hace ${daysWaiting} día(s). ` +
    `Por favor acércate a conserjería a retirarla.`
  );
};

const sendReminderEmail = async (
  recipientName: string,
  recipientEmail: string,
  message: string
): Promise<void> => {
  if (!isMailConfigured()) {
    console.warn(
      `[PackagesReminder] SMTP no configurado. No se envió correo a ${recipientEmail}.`
    );
    return;
  }

  const safeName = escapeHtml(recipientName);
  const safeMessage = escapeHtml(message);

  await createMailTransport().sendMail({
    from: SMTP_FROM,
    to: recipientEmail,
    subject: "Recordatorio: tienes una encomienda pendiente de retiro",
    text: `Hola ${recipientName},\n\n${message}\n`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827;">
        <h2>Tienes una encomienda pendiente de retiro</h2>
        <p>Hola ${safeName},</p>
        <p>${safeMessage}</p>
      </div>
    `,
  });
};

const notifyPendingPackage = async (
  packageItem: PendingPackageRow,
  thresholdDays: number
): Promise<void> => {
  const daysWaiting = Math.max(
    thresholdDays,
    Math.floor(
      (Date.now() - new Date(packageItem.created_at).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );
  const message = buildReminderMessage(packageItem, daysWaiting);

  const residentId = await findResidentIdByEmail(packageItem.recipient_email);

  if (residentId) {
    try {
      await NotificationService.createNotification({
        user_id: residentId,
        message,
        type: "package_pending_reminder",
        params: {
          sender: packageItem.sender,
          apartment: packageItem.apartment_number,
          days: daysWaiting,
        },
      });
    } catch (error) {
      console.error(
        `[PackagesReminder] Error creando notificación in-app para encomienda #${packageItem.id}:`,
        error
      );
    }
  } else {
    console.warn(
      `[PackagesReminder] No existe cuenta de residente para ${packageItem.recipient_email}; ` +
        `se omite la notificación in-app de la encomienda #${packageItem.id}.`
    );
  }

  try {
    await sendReminderEmail(
      packageItem.recipient_name,
      packageItem.recipient_email,
      message
    );
  } catch (error) {
    console.error(
      `[PackagesReminder] Error enviando correo de recordatorio para encomienda #${packageItem.id}:`,
      error
    );
  }

  // # Se marca como enviado aunque algún canal haya fallado, para respetar
  // # el límite de un recordatorio por encomienda por día; reintenta al día siguiente.
  await markReminderSent(packageItem.id);
};

export const runPackageReminderJob = async (): Promise<void> => {
  const thresholdDays = getReminderThresholdDays();

  try {
    const pendingPackages = await findPendingPackagesNeedingReminder(thresholdDays);

    console.log(
      `[PackagesReminder] ${pendingPackages.length} encomienda(s) requieren recordatorio (umbral: ${thresholdDays} día(s)).`
    );

    for (const packageItem of pendingPackages) {
      await notifyPendingPackage(packageItem, thresholdDays);
    }
  } catch (error) {
    console.error("[PackagesReminder] Error ejecutando el job de recordatorios:", error);
  }
};

export const startPackageReminderCron = (): void => {
  cron.schedule(REMINDER_CRON_SCHEDULE, () => {
    void runPackageReminderJob();
  });

  console.log(
    `[PackagesReminder] Cron de recordatorios programado ("${REMINDER_CRON_SCHEDULE}", 1 vez al día).`
  );
};
