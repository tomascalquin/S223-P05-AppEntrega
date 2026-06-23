import { Router } from "express";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware";

const router = Router();

/**
 * RUTAS PROTEGIDAS CON JWT
 * 
 * Todas estas rutas requieren un token JWT válido en el header Authorization.
 * Solo los usuarios autenticados pueden acceder a estos endpoints.
 */

/**
 * ENDPOINT: GET /api/protected/profile
 * 
 * Retorna información del usuario autenticado.
 * El usuario está disponible en req.user (extraído del JWT).
 * 
 * Ejemplo de solicitud:
 * GET /api/protected/profile
 * Headers: Authorization: Bearer <token_jwt>
 * 
 * Respuesta exitosa (200):
 * {
 *   "message": "Datos del perfil de usuario",
 *   "user": {
 *     "id": 1,
 *     "email": "usuario@example.com",
 *     "name": "Nombre del Usuario"
 *   }
 * }
 * 
 * Errores:
 * - 401: Token faltante, inválido o expirado
 */
router.get("/profile", authMiddleware, (req: AuthRequest, res) => {
  try {
    const user = req.user;

    return res.status(200).json({
      message: "Datos del perfil de usuario",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error obteniendo perfil",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * ENDPOINT: GET /api/protected/me
 * 
 * Alias corto para obtener información del usuario actual.
 * Idéntico a /profile pero con ruta más corta.
 * 
 * Respuesta exitosa (200):
 * {
 *   "id": 1,
 *   "email": "usuario@example.com",
 *   "name": "Nombre del Usuario"
 * }
 * 
 * Errores:
 * - 401: No autenticado
 */
router.get("/me", authMiddleware, (req: AuthRequest, res) => {
  try {
    return res.status(200).json(req.user);
  } catch (error) {
    return res.status(500).json({
      error: "Error",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * ENDPOINT: PUT /api/protected/profile
 * 
 * Permite al usuario actualizar su información de perfil.
 * 
 * Ejemplo de solicitud:
 * PUT /api/protected/profile
 * Headers: Authorization: Bearer <token_jwt>
 * Body:
 * {
 *   "name": "Nuevo nombre"
 * }
 * 
 * Respuesta exitosa (200):
 * {
 *   "message": "Perfil actualizado exitosamente",
 *   "user": {
 *     "id": 1,
 *     "email": "usuario@example.com",
 *     "name": "Nuevo nombre"
 *   }
 * }
 * 
 * Errores:
 * - 401: No autenticado
 * - 400: Datos inválidos
 */
router.put("/profile", authMiddleware, (req: AuthRequest, res) => {
  try {
    const { name, email } = req.body;
    const user = req.user;

    // Validaciones
    if (name && typeof name !== "string") {
      return res.status(400).json({
        error: "Validación fallida",
        message: "El nombre debe ser una cadena de texto",
      });
    }

    // En una aplicación real, aquí se actualizaría la base de datos
    // Por ahora, solo actualizamos el objeto en memoria
    if (name) {
      user.name = name;
    }

    return res.status(200).json({
      message: "Perfil actualizado exitosamente",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error actualizando perfil",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * ENDPOINT: GET /api/protected/packages
 * 
 * Retorna todos los paquetes de la base de datos.
 * REQUIERE autenticación - solo usuarios autenticados pueden ver paquetes.
 * 
 * En una aplicación real, podrías filtrar paquetes por departamento del usuario.
 * 
 * Ejemplo de solicitud:
 * GET /api/protected/packages
 * Headers: Authorization: Bearer <token_jwt>
 * 
 * Respuesta exitosa (200):
 * {
 *   "message": "Paquetes obtenidos exitosamente",
 *   "packages": [
 *     {
 *       "id": 1,
 *       "recipient_name": "Juan García",
 *       "apartment_number": "101",
 *       "status": "received"
 *     },
 *     ...
 *   ],
 *   "total": 5
 * }
 * 
 * Errores:
 * - 401: No autenticado
 * - 500: Error en base de datos
 */
router.get("/packages", authMiddleware, async (req: AuthRequest, res) => {
  try {
    // En una aplicación real, aquí iría una consulta a MySQL
    // Por ahora, retornamos un array vacío
    const packages: any[] = [];

    return res.status(200).json({
      message: "Paquetes obtenidos exitosamente",
      packages: packages,
      total: packages.length,
      requestedBy: req.user.email, // Información de quién hizo la solicitud
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error obteniendo paquetes",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * ENDPOINT: POST /api/protected/packages
 * 
 * Permite crear un nuevo paquete.
 * REQUIERE autenticación - solo usuarios autenticados pueden crear paquetes.
 * 
 * En una aplicación real, solo conserjes o administradores podrían crear paquetes.
 * 
 * Ejemplo de solicitud:
 * POST /api/protected/packages
 * Headers: Authorization: Bearer <token_jwt>
 * Body:
 * {
 *   "recipient_name": "Juan García",
 *   "apartment_number": "101",
 *   "sender": "Amazon",
 *   "description": "Paquete electrónico"
 * }
 * 
 * Respuesta exitosa (201):
 * {
 *   "message": "Paquete creado exitosamente",
 *   "id": 1,
 *   "createdBy": "usuario@example.com"
 * }
 * 
 * Errores:
 * - 401: No autenticado
 * - 400: Datos requeridos faltantes
 * - 500: Error en base de datos
 */
router.post("/packages", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { recipient_name, apartment_number, sender, description } = req.body;

    // Validaciones de campos requeridos
    if (!recipient_name || !apartment_number || !sender) {
      return res.status(400).json({
        error: "Validación fallida",
        message: "recipient_name, apartment_number y sender son requeridos",
      });
    }

    // En una aplicación real, aquí se insertaría en MySQL
    const newPackage = {
      id: Math.floor(Math.random() * 10000),
      recipient_name,
      apartment_number,
      sender,
      description: description || "",
      status: "received",
      created_at: new Date().toISOString(),
    };

    return res.status(201).json({
      message: "Paquete creado exitosamente",
      package: newPackage,
      createdBy: req.user.email,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error creando paquete",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * ENDPOINT: DELETE /api/protected/packages/:id
 * 
 * Permite eliminar un paquete.
 * REQUIERE autenticación - solo usuarios autenticados pueden eliminar paquetes.
 * 
 * En una aplicación real, solo administradores o propietarios podrían eliminar.
 * 
 * Ejemplo de solicitud:
 * DELETE /api/protected/packages/1
 * Headers: Authorization: Bearer <token_jwt>
 * 
 * Respuesta exitosa (200):
 * {
 *   "message": "Paquete eliminado exitosamente",
 *   "id": "1",
 *   "deletedBy": "usuario@example.com"
 * }
 * 
 * Errores:
 * - 401: No autenticado
 * - 404: Paquete no encontrado
 * - 500: Error en base de datos
 */
router.delete("/packages/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Validación del ID
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({
        error: "Validación fallida",
        message: "ID de paquete inválido",
      });
    }

    // En una aplicación real, aquí se verificaría que el paquete existe antes de eliminarlo
    // Por ahora, simulamos una eliminación exitosa

    return res.status(200).json({
      message: "Paquete eliminado exitosamente",
      id: id,
      deletedBy: req.user.email,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error eliminando paquete",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * ENDPOINT: GET /api/protected/packages/:id
 * 
 * Obtiene los detalles de un paquete específico.
 * REQUIERE autenticación.
 * 
 * Ejemplo de solicitud:
 * GET /api/protected/packages/1
 * Headers: Authorization: Bearer <token_jwt>
 * 
 * Respuesta exitosa (200):
 * {
 *   "message": "Paquete obtenido exitosamente",
 *   "package": {
 *     "id": 1,
 *     "recipient_name": "Juan García",
 *     "apartment_number": "101",
 *     "status": "received"
 *   }
 * }
 * 
 * Errores:
 * - 401: No autenticado
 * - 404: Paquete no encontrado
 */
router.get("/packages/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Validación del ID
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({
        error: "Validación fallida",
        message: "ID de paquete inválido",
      });
    }

    // En una aplicación real, aquí se consultaría a MySQL
    // Por ahora, simulamos un paquete

    return res.status(200).json({
      message: "Paquete obtenido exitosamente",
      package: {
        id: id,
        recipient_name: "Ejemplo",
        apartment_number: "101",
        status: "received",
      },
      requestedBy: req.user.email,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error obteniendo paquete",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

export default router;
