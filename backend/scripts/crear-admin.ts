/**
 * Script de inicialización del primer administrador.
 *
 * Uso: bun run scripts/crear-admin.ts
 *
 * Valida que no exista ningún administrador previo antes de crear uno.
 * La contraseña se puede pasar como argumento o se generará aleatoriamente.
 *
 * Ejemplo: bun run scripts/crear-admin.ts --email admin@edificio.cl --nombre "Admin Principal"
 */

import "dotenv/config";
import db from "../src/db";
import bcrypt from "bcryptjs";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

const generarContrasenaAleatoria = (longitud = 16) => {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let resultado = "";
  const array = new Uint8Array(longitud);
  crypto.getRandomValues(array);
  for (const byte of array) {
    resultado += chars[byte % chars.length];
  }
  return resultado;
};

const obtenerArg = (nombre: string) => {
  const index = process.argv.indexOf(`--${nombre}`);
  return index !== -1 ? process.argv[index + 1] : null;
};

const run = async () => {
  console.log("=== Creación de primer administrador ===\n");

  // Verificar que no exista ningún administrador
  const [adminExistente] = await db.query<RowDataPacket[]>(
    "SELECT COUNT(*) as total FROM users WHERE role = 'administrador' LIMIT 1"
  );

  const totalAdmins = Number(adminExistente[0]?.total ?? 0);

  if (totalAdmins > 0) {
    console.error("ERROR: Ya existe al menos un administrador en el sistema.");
    console.error("Este script solo puede ejecutarse cuando no hay administradores.");
    console.error("Para crear administradores adicionales, usa el panel de administración.");
    process.exit(1);
  }

  const email = obtenerArg("email") ?? "admin@edificio.cl";
  const nombre = obtenerArg("nombre") ?? "Administrador Principal";
  const username = obtenerArg("username") ?? "admin";
  const passwordArg = obtenerArg("password");
  const contrasena = passwordArg ?? generarContrasenaAleatoria();

  // Validar que el email y username no existan
  const [usuariosExistentes] = await db.query<RowDataPacket[]>(
    "SELECT COUNT(*) as total FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?",
    [email.toLowerCase(), username.toLowerCase()]
  );

  if (Number(usuariosExistentes[0]?.total ?? 0) > 0) {
    console.error(`ERROR: Ya existe un usuario con el email '${email}' o el username '${username}'.`);
    console.error("Usa --email y --username para especificar valores distintos.");
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(contrasena, 12);

  const [result] = await db.query<ResultSetHeader>(
    "INSERT INTO users (name, email, username, role, estado, password) VALUES (?, ?, ?, 'administrador', 'activo', ?)",
    [nombre, email.toLowerCase(), username.toLowerCase(), hashedPassword]
  );

  console.log("Administrador creado exitosamente:\n");
  console.log(`  ID:       ${result.insertId}`);
  console.log(`  Nombre:   ${nombre}`);
  console.log(`  Email:    ${email.toLowerCase()}`);
  console.log(`  Username: ${username.toLowerCase()}`);
  console.log(`  Rol:      administrador`);

  if (!passwordArg) {
    console.log(`\n  Contraseña generada (guárdala en un lugar seguro):`);
    console.log(`  ${contrasena}`);
  } else {
    console.log(`  Contraseña: [proporcionada por argumento]`);
  }

  console.log("\n=== Proceso completado ===");
  process.exit(0);
};

run().catch((err) => {
  console.error("Error ejecutando el script:", err);
  process.exit(1);
});
