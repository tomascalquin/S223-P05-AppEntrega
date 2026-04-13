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

    console.log("Conexión exitosa");

    // Crear tabla si no existe
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

    // Insertar un registro de prueba
    const [insertResult] = await connection.query(
      "INSERT INTO packages (recipient_name, description, status) VALUES (?, ?, ?)",
      ["Juan Pérez", "Paquete de prueba", "received"]
    );
    const insertId = (insertResult as any).insertId;
    console.log(`Registro insertado con ID: ${insertId}`);

    // Consultar el registro insertado
    const [rows] = await connection.query("SELECT * FROM packages WHERE id = ?", [insertId]);
    console.log("Registro consultado:", rows[0]);

    // Listar todos los registros
    const [allRows] = await connection.query("SELECT * FROM packages ORDER BY created_at DESC");
    console.log("Todos los registros:", allRows);

    await connection.end();
    console.log("Prueba completada exitosamente");
  } catch (error) {
    console.error("Error:", error);
  }
}

testDB();