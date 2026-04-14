import mysql, { type RowDataPacket, type ResultSetHeader } from "mysql2/promise";

async function testDB() {
  try {
    const connection = await mysql.createConnection({
      host: "localhost",
      port: 3306,
      user: "root",
      password: "clave123",
      database: "appdb",
    });

    console.log("Conexión exitosa");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS packages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        recipient_name VARCHAR(255) NOT NULL,
        description TEXT,
        status ENUM('received', 'delivered', 'pending') DEFAULT 'received',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Tabla 'packages' lista");

    const [insertResult] = await connection.query<ResultSetHeader>(
      "INSERT INTO packages (recipient_name, description, status) VALUES (?, ?, ?)",
      ["Juan Pérez", "Paquete de prueba", "received"]
    );

    const insertId = insertResult.insertId;
    console.log(`Registro insertado con ID: ${insertId}`);

    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM packages WHERE id = ?",
      [insertId]
    );

    console.log("Registro consultado:", rows[0]);

    const [allRows] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM packages ORDER BY created_at DESC"
    );

    console.log("Todos los registros:", allRows);

    await connection.end();
    console.log("Prueba completada exitosamente");
  } catch (error) {
    console.error("Error:", error);
  }
}

testDB();