/**
 * CONFIGURACIÓN Y CONEXIÓN A BASE DE DATOS
 * 
 * Este archivo configura la conexión a MySQL usando un pool de conexiones.
 * Un pool de conexiones permite reutilizar conexiones y mejorar el rendimiento.
 * 
 * VARIABLES DE ENTORNO REQUERIDAS (en .env):
 * - DB_HOST: Host del servidor MySQL (default: localhost)
 * - DB_PORT: Puerto de MySQL (default: 3306)
 * - DB_USER: Usuario de MySQL (default: root)
 * - DB_PASSWORD: Contraseña de MySQL (default: "")
 * - DB_NAME: Nombre de la base de datos (default: appdb)
 */

import "dotenv/config";  // Carga variables de entorno desde archivo .env
import mysql from "mysql2/promise";  // Driver de MySQL con soporte para Promises
import type { Pool } from "mysql2/promise";  // Tipo para el pool de conexiones

/**
 * VERIFICACIÓN DE VARIABLES DE ENTORNO
 * 
 * Se imprimen en consola para debugging y verificar que
 * las variables se están cargando correctamente desde .env
 */
console.log("🔧 Configuración de Base de Datos:");
console.log(`   DB_HOST: ${process.env.DB_HOST || "localhost"}`);
console.log(`   DB_PORT: ${process.env.DB_PORT || 3306}`);
console.log(`   DB_NAME: ${process.env.DB_NAME || "appdb"}`);
console.log(`   DB_USER: ${process.env.DB_USER || "root"}`);
console.log("");

/**
 * POOL DE CONEXIONES
 * 
 * Un pool mantiene múltiples conexiones abiertas a la BD
 * para reutilizarlas en diferentes peticiones.
 * 
 * Beneficios:
 * - Mejor rendimiento (no necesita crear conexión nueva cada vez)
 * - Manejo automático de reconexiones
 * - Límite configurable de conexiones simultáneas
 * 
 * Configuración:
 * - host: Servidor MySQL
 * - port: Puerto MySQL (3306 es el estándar)
 * - user: Usuario con permisos en la BD
 * - password: Contraseña del usuario
 * - database: Nombre de la BD por defecto
 */
const pool: Pool = mysql.createPool({
  // Host del servidor MySQL
  host: process.env.DB_HOST || "localhost",
  
  // Puerto del servidor MySQL
  port: Number(process.env.DB_PORT || 3306),
  
  // Usuario con acceso a la BD
  user: process.env.DB_USER || "root",
  
  // Contraseña del usuario
  password: process.env.DB_PASSWORD || "clave123",
  
  // Base de datos por defecto
  database: process.env.DB_NAME || "appdb",
});

/**
 * EXPORTACIÓN DEL POOL
 * 
 * Se exporta el pool de conexiones para que pueda ser usado
 * en otros archivos del backend (como server.ts)
 * 
 * Uso en otros archivos:
 * import db from "./db";
 * const [rows] = await db.query("SELECT * FROM packages");
 */
export default pool;