import mysql from "mysql2/promise";

export const db = await mysql.createConnection({
  host: "localhost",
  port: 3306,
  user: "root",
  password: "clave123",
  database: "appdb",
});