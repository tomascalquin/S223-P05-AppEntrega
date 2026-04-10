import mysql from "mysql2/promise";

async function testDB() {
  try {
    const connection = await mysql.createConnection({
      host: "localhost",
      port: 3306,
      user: "root",
      password: "clave123",
      database: "appdb",
    });

    const [rows] = await connection.query("SELECT 1");

    console.log("Conexión exitosa:", rows);

    await connection.end();
  } catch (error) {
    console.error("Error de conexión:", error);
  }
}

testDB();