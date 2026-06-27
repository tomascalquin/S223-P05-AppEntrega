import { Request, Response } from "express";
import db from "../db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// ========================================
// TIPOS
// ========================================

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    name: string;
    role: "conserje" | "residente";
  };
}

export type PackageStatus = "received" | "delivered" | "pending" | "atraso";

interface Package extends RowDataPacket {
  id: number;
  recipient_name: string;
  apartment_number: string;
  description: string | null;
  sender: string;
  delivery_date: string | null;
  status: PackageStatus;
  created_at: string;
}

// ========================================
// CONTROLADORES DE PAQUETES
// ========================================

/**
 * FUNCIÓN: Obtener todos los paquetes
 * 
 * Retorna todos los paquetes de la base de datos.
 * Acceso: Solo autenticados
 */
export async function getAllPackages(req: AuthRequest, res: Response) {
  try {
    const query = "SELECT * FROM packages ORDER BY created_at DESC";
    const [packages] = await db.query<Package[]>(query);

    return res.status(200).json({
      message: "Paquetes obtenidos exitosamente",
      packages,
      total: packages.length,
      requestedBy: req.user?.email,
    });
  } catch (error) {
    console.error("Error obteniendo paquetes:", error);
    return res.status(500).json({
      error: "Error obteniendo paquetes",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
}

/**
 * FUNCIÓN: Obtener paquetes de un residente
 * 
 * Retorna solo los paquetes de un residente específico.
 * Acceso: Solo el residente dueño del apartamento o conserje
 */
export async function getResidentPackages(
  req: AuthRequest,
  res: Response
) {
  try {
    const { apartmentNumber } = req.params;

    if (!apartmentNumber) {
      return res.status(400).json({
        error: "Validación fallida",
        message: "El número de apartamento es requerido",
      });
    }

    const query =
      "SELECT * FROM packages WHERE apartment_number = ? ORDER BY created_at DESC";
    const [packages] = await db.query<Package[]>(query, [apartmentNumber]);

    return res.status(200).json({
      message: "Paquetes del residente obtenidos exitosamente",
      packages,
      total: packages.length,
      apartment: apartmentNumber,
    });
  } catch (error) {
    console.error("Error obteniendo paquetes del residente:", error);
    return res.status(500).json({
      error: "Error obteniendo paquetes",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
}

/**
 * FUNCIÓN: Crear un nuevo paquete
 * 
 * Crea un nuevo paquete en la base de datos.
 * Acceso: Solo autenticados (idealmente conserje)
 */
export async function createPackage(req: AuthRequest, res: Response) {
  try {
    const {
      recipient_name,
      apartment_number,
      sender,
      description,
      delivery_date,
      status,
    } = req.body;

    // Validaciones
    if (!recipient_name || !apartment_number || !sender) {
      return res.status(400).json({
        error: "Validación fallida",
        message: "recipient_name, apartment_number y sender son requeridos",
      });
    }

    const packageStatus = (status || "received") as PackageStatus;

    const query = `
      INSERT INTO packages (recipient_name, apartment_number, sender, description, delivery_date, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query<ResultSetHeader>(query, [
      recipient_name,
      apartment_number,
      sender,
      description || null,
      delivery_date || null,
      packageStatus,
    ]);

    return res.status(201).json({
      message: "Paquete creado exitosamente",
      id: result.insertId,
      package: {
        id: result.insertId,
        recipient_name,
        apartment_number,
        sender,
        description: description || null,
        delivery_date: delivery_date || null,
        status: packageStatus,
        created_at: new Date().toISOString(),
      },
      createdBy: req.user?.email,
    });
  } catch (error) {
    console.error("Error creando paquete:", error);
    return res.status(500).json({
      error: "Error creando paquete",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
}

/**
 * FUNCIÓN: Actualizar estado del paquete
 * 
 * Actualiza el estado de un paquete (received, delivered, pending, atraso).
 * Acceso: Solo CONSERJE
 */
export async function updatePackageStatus(req: AuthRequest, res: Response) {
  try {
    const { packageId } = req.params;
    const { status } = req.body;

    // Validaciones
    if (!packageId || isNaN(Number(packageId))) {
      return res.status(400).json({
        error: "Validación fallida",
        message: "ID de paquete inválido",
      });
    }

    if (!status) {
      return res.status(400).json({
        error: "Validación fallida",
        message: "El estado es requerido",
      });
    }

    const validStatuses: PackageStatus[] = [
      "received",
      "delivered",
      "pending",
      "atraso",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: "Validación fallida",
        message: `El estado debe ser uno de: ${validStatuses.join(", ")}`,
      });
    }

    // Verificar que el paquete existe
    const checkQuery = "SELECT * FROM packages WHERE id = ?";
    const [packages] = await db.query<Package[]>(checkQuery, [packageId]);

    if (packages.length === 0) {
      return res.status(404).json({
        error: "Paquete no encontrado",
        message: `No existe paquete con ID ${packageId}`,
      });
    }

    // Actualizar el paquete
    const updateQuery = "UPDATE packages SET status = ? WHERE id = ?";
    await db.query(updateQuery, [status, packageId]);

    // Obtener el paquete actualizado
    const [updatedPackages] = await db.query<Package[]>(
      checkQuery,
      [packageId]
    );

    return res.status(200).json({
      message: "Estado del paquete actualizado exitosamente",
      package: updatedPackages[0],
      updatedBy: req.user?.email,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error actualizando paquete:", error);
    return res.status(500).json({
      error: "Error actualizando paquete",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
}

/**
 * FUNCIÓN: Eliminar un paquete
 * 
 * Elimina un paquete de la base de datos.
 * Acceso: Solo CONSERJE
 */
export async function deletePackage(req: AuthRequest, res: Response) {
  try {
    const { packageId } = req.params;

    // Validación del ID
    if (!packageId || isNaN(Number(packageId))) {
      return res.status(400).json({
        error: "Validación fallida",
        message: "ID de paquete inválido",
      });
    }

    // Verificar que el paquete existe
    const checkQuery = "SELECT * FROM packages WHERE id = ?";
    const [packages] = await db.query<Package[]>(checkQuery, [packageId]);

    if (packages.length === 0) {
      return res.status(404).json({
        error: "Paquete no encontrado",
        message: `No existe paquete con ID ${packageId}`,
      });
    }

    // Eliminar el paquete
    const deleteQuery = "DELETE FROM packages WHERE id = ?";
    await db.query(deleteQuery, [packageId]);

    return res.status(200).json({
      message: "Paquete eliminado exitosamente",
      id: packageId,
      deletedBy: req.user?.email,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error eliminando paquete:", error);
    return res.status(500).json({
      error: "Error eliminando paquete",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
}

/**
 * FUNCIÓN: Obtener estadísticas de paquetes
 * 
 * Retorna estadísticas sobre los paquetes.
 * Acceso: Solo CONSERJE
 */
export async function getPackageStats(req: AuthRequest, res: Response) {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'received' THEN 1 ELSE 0 END) as received,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'atraso' THEN 1 ELSE 0 END) as atraso
      FROM packages
    `;

    const [stats] = await db.query<
      Array<{
        total: number;
        received: number;
        delivered: number;
        pending: number;
        atraso: number;
      }>
    >(statsQuery);

    return res.status(200).json({
      message: "Estadísticas de paquetes obtenidas exitosamente",
      stats: stats[0],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error obteniendo estadísticas:", error);
    return res.status(500).json({
      error: "Error obteniendo estadísticas",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
}
