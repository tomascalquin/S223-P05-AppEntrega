// Importa la conexión a la base de datos MySQL desde el archivo db.ts
import db from "./src/db";

// Importa tipos de mysql2 para tipar correctamente los resultados de las consultas
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// Importa la librería para crear y validar tokens JWT
import jwt from "jsonwebtoken";

// Importa la librería para encriptar contraseñas y compararlas al iniciar sesión
import bcrypt from "bcryptjs";

import dotenv from "dotenv";
import path from "path";

// Importa el cliente OAuth de Google para validar tokens de Google Sign-In
import { OAuth2Client } from "google-auth-library";

// Construye la ruta absoluta al archivo .env que está en la carpeta backend
const envPath = path.resolve(import.meta.dir, ".env");

// Carga las variables del archivo .env usando la ruta absoluta
dotenv.config({ path: envPath });

/*
  Este tipo representa una fila de la tabla users.
  Sirve para que TypeScript sepa qué campos tiene un usuario obtenido desde MySQL.
*/
type UserRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  password: string;
  created_at: string;
};

// Obtiene la clave secreta usada para firmar y validar JWT
const JWT_SECRET = process.env.JWT_SECRET as string;

// Obtiene el puerto donde correrá el backend
const PORT = Number(process.env.PORT || 3001);

// Obtiene el Client ID de Google para validar tokens SSO
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID as string;

// Si no existe JWT_SECRET, el backend no debe arrancar
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET no está definido en el archivo .env");
}

// Si no existe GOOGLE_CLIENT_ID, el backend no debe arrancar
if (!GOOGLE_CLIENT_ID) {
  throw new Error("GOOGLE_CLIENT_ID no está definido en el archivo .env");
}

/*
  Crea el cliente OAuth de Google.
  Este objeto se usará para verificar que un token realmente fue emitido por Google
  y que corresponde a esta aplicación.
*/
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

/*
  Esta función crea las tablas necesarias al iniciar el servidor.
  Así evitamos errores si la base de datos aún no tiene las tablas creadas.
*/
async function createTables() {
  try {
    // Crea la tabla packages si no existe
    await db.query(`
      CREATE TABLE IF NOT EXISTS packages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        recipient_name VARCHAR(255) NOT NULL,
        description TEXT,
        status ENUM('received', 'delivered', 'pending') DEFAULT 'received',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Tabla 'packages' creada o ya existe.");

    // Crea la tabla users si no existe
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Tabla 'users' creada o ya existe.");
  } catch (error) {
    console.error("Error creando tablas:", error);
  }
}

// Ejecuta la creación de tablas antes de iniciar el servidor
await createTables();

/*
  Genera un token JWT para un usuario autenticado.
  Este token se devuelve al cliente y luego se usa para acceder a rutas protegidas.
*/
function generateToken(user: { id: number; email: string; name: string }) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    {
      expiresIn: "2h", // El token expira en 2 horas
    }
  );
}

/*
  Verifica el token enviado en el header Authorization.
  Espera el formato:
  Authorization: Bearer TU_TOKEN
*/
function verifyAuthHeader(request: Request) {
  // Obtiene el valor del header Authorization
  const authHeader = request.headers.get("Authorization");

  // Si no existe el header, significa que el usuario no envió token
  if (!authHeader) {
    throw new Error("Falta header Authorization");
  }

  // Divide el header por espacios. Ejemplo: "Bearer abc123"
  const parts = authHeader.split(" ");

  // Valida que tenga exactamente el formato esperado
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    throw new Error("Formato de token inválido");
  }

  // Extrae el token desde la segunda parte
  const token = parts[1];

  // Verifica y devuelve el contenido decodificado del token
  return jwt.verify(token, JWT_SECRET);
}

/*
  Bun.serve levanta el servidor HTTP.
  Toda solicitud entrante pasa por la función fetch(request).
*/
Bun.serve({
  port: PORT,

  async fetch(request) {
    // Convierte la URL del request en un objeto para poder leer su path
    const url = new URL(request.url);

    /*
      Headers CORS:
      Permiten que un frontend o un HTML de prueba ubicado en otro origen
      (por ejemplo http://127.0.0.1:5500) pueda hacer requests al backend
      que corre en http://localhost:3001.
    */
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    /*
      Petición OPTIONS:
      El navegador la envía automáticamente antes de algunos POST/GET entre orígenes distintos.
      Si no respondemos esto, el navegador bloquea la llamada antes de llegar a la ruta real.
    */
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    /*
      RUTA: GET /
      Sirve para probar si el backend está vivo y si la conexión a MySQL funciona.
    */
    if (request.method === "GET" && url.pathname === "/") {
      try {
        const [rows] = await db.query<RowDataPacket[]>("SELECT 1 AS test");

        return Response.json(
          {
            message: "Conexión a MySQL exitosa",
            result: rows,
          },
          {
            headers: corsHeaders,
          }
        );
      } catch (error) {
        return Response.json(
          {
            message: "Error al conectar con MySQL",
            error: String(error),
          },
          {
            status: 500,
            headers: corsHeaders,
          }
        );
      }
    }

    /*
      RUTA: GET /api/packages
      Devuelve todos los paquetes guardados en la base de datos.
    */
    if (request.method === "GET" && url.pathname === "/api/packages") {
      try {
        const [rows] = await db.query<RowDataPacket[]>(
          "SELECT * FROM packages ORDER BY created_at DESC"
        );

        return Response.json(
          {
            packages: rows,
          },
          {
            headers: corsHeaders,
          }
        );
      } catch (error) {
        return Response.json(
          {
            message: "Error obteniendo paquetes",
            error: String(error),
          },
          {
            status: 500,
            headers: corsHeaders,
          }
        );
      }
    }

    /*
      RUTA: POST /api/packages
      Crea un nuevo paquete usando los datos enviados en el body.
    */
    if (request.method === "POST" && url.pathname === "/api/packages") {
      try {
        // Lee el body enviado como JSON
        const body = await request.json();

        // Extrae los campos del paquete
        const { recipient_name, description, status = "received" } = body;

        // Valida que recipient_name exista
        if (!recipient_name) {
          return Response.json(
            { error: "recipient_name es requerido" },
            {
              status: 400,
              headers: corsHeaders,
            }
          );
        }

        // Inserta el paquete en la base de datos
        const [result] = await db.query<ResultSetHeader>(
          "INSERT INTO packages (recipient_name, description, status) VALUES (?, ?, ?)",
          [recipient_name, description, status]
        );

        return Response.json(
          {
            message: "Paquete insertado exitosamente",
            id: result.insertId,
          },
          {
            headers: corsHeaders,
          }
        );
      } catch (error) {
        return Response.json(
          {
            message: "Error insertando paquete",
            error: String(error),
          },
          {
            status: 500,
            headers: corsHeaders,
          }
        );
      }
    }

    /*
      RUTA: GET /api/packages/:id
      Devuelve un paquete específico según su id.
    */
    if (request.method === "GET" && url.pathname.startsWith("/api/packages/")) {
      try {
        // Extrae el id desde la URL
        const id = url.pathname.split("/").pop();

        // Busca el paquete en la base de datos
        const [rows] = await db.query<RowDataPacket[]>(
          "SELECT * FROM packages WHERE id = ?",
          [id]
        );

        // Si no existe, devuelve 404
        if (rows.length === 0) {
          return Response.json(
            { error: "Paquete no encontrado" },
            {
              status: 404,
              headers: corsHeaders,
            }
          );
        }

        return Response.json(
          {
            package: rows[0],
          },
          {
            headers: corsHeaders,
          }
        );
      } catch (error) {
        return Response.json(
          {
            message: "Error obteniendo paquete",
            error: String(error),
          },
          {
            status: 500,
            headers: corsHeaders,
          }
        );
      }
    }

    /*
      RUTA: POST /api/auth/register
      Registra un nuevo usuario local con nombre, email y contraseña.
      La contraseña se guarda encriptada con bcrypt.
    */
    if (request.method === "POST" && url.pathname === "/api/auth/register") {
      try {
        // Lee el body enviado como JSON
        const body = await request.json();

        // Extrae name, email y password
        const { name, email, password } = body;

        // Valida que los campos obligatorios existan
        if (!name || !email || !password) {
          return Response.json(
            { error: "name, email y password son requeridos" },
            {
              status: 400,
              headers: corsHeaders,
            }
          );
        }

        // Busca si ya existe un usuario con el mismo email
        const [existingUsers] = await db.query<UserRow[]>(
          "SELECT * FROM users WHERE email = ?",
          [email]
        );

        // Si ya existe, devuelve conflicto
        if (existingUsers.length > 0) {
          return Response.json(
            { error: "Ya existe un usuario con ese correo" },
            {
              status: 409,
              headers: corsHeaders,
            }
          );
        }

        // Encripta la contraseña antes de guardarla
        const hashedPassword = await bcrypt.hash(password, 10);

        // Inserta el nuevo usuario en la base de datos
        const [result] = await db.query<ResultSetHeader>(
          "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
          [name, email, hashedPassword]
        );

        return Response.json(
          {
            message: "Usuario registrado exitosamente",
            id: result.insertId,
          },
          {
            status: 201,
            headers: corsHeaders,
          }
        );
      } catch (error) {
        return Response.json(
          {
            message: "Error registrando usuario",
            error: String(error),
          },
          {
            status: 500,
            headers: corsHeaders,
          }
        );
      }
    }

    /*
      RUTA: POST /api/auth/login
      Inicia sesión con email y contraseña.
      Si las credenciales son correctas, devuelve un JWT.
    */
    if (request.method === "POST" && url.pathname === "/api/auth/login") {
      try {
        // Lee el body enviado como JSON
        const body = await request.json();

        // Extrae email y password
        const { email, password } = body;

        // Valida que ambos campos existan
        if (!email || !password) {
          return Response.json(
            { error: "email y password son requeridos" },
            {
              status: 400,
              headers: corsHeaders,
            }
          );
        }

        // Busca al usuario por email
        const [rows] = await db.query<UserRow[]>(
          "SELECT * FROM users WHERE email = ?",
          [email]
        );

        // Si no existe, devuelve credenciales inválidas
        if (rows.length === 0) {
          return Response.json(
            { error: "Credenciales inválidas" },
            {
              status: 401,
              headers: corsHeaders,
            }
          );
        }

        // Toma el usuario encontrado
        const user = rows[0];

        // Compara la contraseña ingresada con la guardada en la base de datos
        const isPasswordValid = await bcrypt.compare(password, user.password);

        // Si no coincide, devuelve error
        if (!isPasswordValid) {
          return Response.json(
            { error: "Credenciales inválidas" },
            {
              status: 401,
              headers: corsHeaders,
            }
          );
        }

        // Genera un token JWT para el usuario autenticado
        const token = generateToken({
          id: user.id,
          email: user.email,
          name: user.name,
        });

        return Response.json(
          {
            message: "Inicio de sesión exitoso",
            token,
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
            },
          },
          {
            headers: corsHeaders,
          }
        );
      } catch (error) {
        return Response.json(
          {
            message: "Error iniciando sesión",
            error: String(error),
          },
          {
            status: 500,
            headers: corsHeaders,
          }
        );
      }
    }

    /*
      RUTA: POST /api/auth/google
      Implementa autenticación SSO con Google.

      Flujo:
      1. El frontend obtiene un token de Google.
      2. Envía ese token al backend.
      3. El backend valida el token con Google.
      4. Busca si el usuario ya existe en la base de datos.
      5. Si no existe, lo crea automáticamente.
      6. Luego genera un JWT propio del sistema.
    */
    if (request.method === "POST" && url.pathname === "/api/auth/google") {
      try {
        // Lee el body enviado como JSON
        const body = await request.json();

        // Extrae el token de Google
        const { token } = body;

        // Valida que el token exista
        if (!token) {
          return Response.json(
            { error: "Token de Google requerido" },
            {
              status: 400,
              headers: corsHeaders,
            }
          );
        }

        // Verifica el token con Google para comprobar que es auténtico
        const ticket = await googleClient.verifyIdToken({
          idToken: token,
          audience: GOOGLE_CLIENT_ID,
        });

        // Obtiene la información del usuario desde el token verificado
        const payload = ticket.getPayload();

        // Si no hay payload o email, no se puede autenticar
        if (!payload || !payload.email) {
          return Response.json(
            { error: "Token de Google inválido" },
            {
              status: 401,
              headers: corsHeaders,
            }
          );
        }

        // Busca si ya existe un usuario con ese correo
        const [rows] = await db.query<UserRow[]>(
          "SELECT * FROM users WHERE email = ?",
          [payload.email]
        );

        let user: {
          id: number;
          name: string;
          email: string;
        };

        // Si el usuario ya existe, reutiliza ese registro
        if (rows.length > 0) {
          user = {
            id: rows[0].id,
            name: rows[0].name,
            email: rows[0].email,
          };
        } else {
          /*
            Si el usuario no existe, lo crea automáticamente.
            Se guarda un valor simbólico en password porque este usuario
            entra mediante Google y no con contraseña local.
          */
          const [result] = await db.query<ResultSetHeader>(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            [payload.name || "Usuario Google", payload.email, "GOOGLE_LOGIN"]
          );

          user = {
            id: result.insertId,
            name: payload.name || "Usuario Google",
            email: payload.email,
          };
        }

        // Genera un JWT propio del sistema
        const appToken = generateToken({
          id: user.id,
          email: user.email,
          name: user.name,
        });

        return Response.json(
          {
            message: "Inicio de sesión con Google exitoso",
            token: appToken,
            user,
          },
          {
            headers: corsHeaders,
          }
        );
      } catch (error) {
        return Response.json(
          {
            error: "Error en autenticación SSO con Google",
            details: String(error),
          },
          {
            status: 500,
            headers: corsHeaders,
          }
        );
      }
    }

    /*
      RUTA: GET /api/auth/profile
      Es una ruta protegida.
      Solo funciona si el cliente envía un token válido en Authorization.
    */
    if (request.method === "GET" && url.pathname === "/api/auth/profile") {
      try {
        // Valida el token enviado en el header Authorization
        const decoded = verifyAuthHeader(request);

        return Response.json(
          {
            message: "Acceso autorizado",
            user: decoded,
          },
          {
            headers: corsHeaders,
          }
        );
      } catch (error) {
        return Response.json(
          {
            error: "No autorizado",
            details: String(error),
          },
          {
            status: 401,
            headers: corsHeaders,
          }
        );
      }
    }

    // Si ninguna ruta coincide, responde 404
    return Response.json(
      { error: "Ruta no encontrada" },
      {
        status: 404,
        headers: corsHeaders,
      }
    );
  },
});

// Mensaje de confirmación al iniciar el backend
console.log(`Backend corriendo en http://localhost:${PORT}`);