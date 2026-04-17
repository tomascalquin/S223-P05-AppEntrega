// Importa mysql2 con soporte para promesas
import mysql from "mysql2/promise";

// Importa dotenv para leer variables del archivo .env
import dotenv from "dotenv";

// Importa path para construir la ruta absoluta al .env
import path from "path";

// Como db.ts está dentro de src, el .env está un nivel arriba: ../.env
const envPath = path.resolve(import.meta.dir, "../.env");

// Carga las variables del archivo .env
dotenv.config({ path: envPath });

// Crea el pool de conexiones a MySQL usando variables del .env
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "appdb",
});

// Exporta el pool para usarlo en server.ts
export default pool;