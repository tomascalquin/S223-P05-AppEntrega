import { Router } from "express";
import { authMiddleware, AuthRequest, requireRole } from "../middleware/authMiddleware";

const router = Router();

/**
 * RUTAS CON CONTROL DE ACCESO POR ROL
 * 
 * Estas rutas demuestran cómo proteger endpoints específicos
 * según el tipo de usuario (conserje o residente).
 */

// ============================================================
// RUTAS SOLO PARA CONSERJES
// ============================================================

/**
 * ENDPOINT: GET /api/role-based/admin/packages
 * Acceso: Solo CONSERJE
 * 
 * Lista todos los paquetes del sistema.
 * Solo los conserjes pueden ver el panel de administración de paquetes.
 */
router.get(
  "/admin/packages",
  authMiddleware,
  requireRole("conserje"),
  (req: AuthRequest, res) => {
    try {
      const user = req.user;

      return res.status(200).json({
        message: "Panel de administración de paquetes (Solo conserje)",
        user: {
          id: user.id,
          role: user.role,
          name: user.name,
        },
        data: {
          totalPackages: 42,
          pendingDelivery: 5,
          delivered: 37,
          packages: [
            { id: 1, recipient: "Juan Pérez", status: "pending", date: "2024-01-15" },
            { id: 2, recipient: "María García", status: "delivered", date: "2024-01-14" },
          ],
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: "Error obteniendo paquetes",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

/**
 * ENDPOINT: POST /api/role-based/admin/packages/mark-as-delivered
 * Acceso: Solo CONSERJE
 * 
 * Marca un paquete como entregado.
 * Solo los conserjes pueden cambiar el estado de los paquetes.
 */
router.post(
  "/admin/packages/mark-as-delivered",
  authMiddleware,
  requireRole("conserje"),
  (req: AuthRequest, res) => {
    try {
      const { packageId } = req.body;
      const user = req.user;

      if (!packageId) {
        return res.status(400).json({
          error: "El ID del paquete es requerido",
        });
      }

      return res.status(200).json({
        message: "Paquete marcado como entregado",
        conserjeId: user.id,
        conserjeRole: user.role,
        packageId: packageId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return res.status(500).json({
        error: "Error marcando paquete como entregado",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

/**
 * ENDPOINT: GET /api/role-based/admin/reports
 * Acceso: Solo CONSERJE
 * 
 * Obtiene reportes de gestión de encomiendas.
 * Información estadística solo disponible para conserjes.
 */
router.get(
  "/admin/reports",
  authMiddleware,
  requireRole("conserje"),
  (req: AuthRequest, res) => {
    try {
      const user = req.user;

      return res.status(200).json({
        message: "Reportes de gestión (Solo conserje)",
        generatedBy: user.name,
        reports: {
          totalPackagesThisMonth: 156,
          deliveryRate: "98.7%",
          averageDeliveryTime: "2.3 días",
          topRecipients: [
            { name: "Apto 101", count: 12 },
            { name: "Apto 205", count: 9 },
          ],
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: "Error obteniendo reportes",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

// ============================================================
// RUTAS SOLO PARA RESIDENTES
// ============================================================

/**
 * ENDPOINT: GET /api/role-based/my-packages
 * Acceso: Solo RESIDENTE
 * 
 * Lista los paquetes del residente actual.
 * Cada residente solo puede ver sus propios paquetes.
 */
router.get(
  "/my-packages",
  authMiddleware,
  requireRole("residente"),
  (req: AuthRequest, res) => {
    try {
      const user = req.user;

      return res.status(200).json({
        message: "Mis encomiendas (Residente)",
        resident: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        packages: [
          {
            id: 101,
            sender: "Amazon",
            status: "entregado",
            receivedDate: "2024-01-15",
            location: "Mostrador principal",
          },
          {
            id: 102,
            sender: "MercadoLibre",
            status: "pendiente",
            receivedDate: "2024-01-16",
            location: "Almacén A",
          },
        ],
        totalPending: 1,
      });
    } catch (error) {
      return res.status(500).json({
        error: "Error obteniendo encomiendas",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

/**
 * ENDPOINT: POST /api/role-based/claim-package
 * Acceso: Solo RESIDENTE
 * 
 * Permite al residente reclamar una encomienda.
 * Solo residentes pueden reclamar sus propias encomiendas.
 */
router.post(
  "/claim-package",
  authMiddleware,
  requireRole("residente"),
  (req: AuthRequest, res) => {
    try {
      const { packageId } = req.body;
      const user = req.user;

      if (!packageId) {
        return res.status(400).json({
          error: "El ID del paquete es requerido",
        });
      }

      return res.status(200).json({
        message: "Encomienda reclamada exitosamente",
        residentId: user.id,
        residentName: user.name,
        packageId: packageId,
        claimedAt: new Date().toISOString(),
        instructions: "Por favor dirigirse al mostrador principal con su identificación",
      });
    } catch (error) {
      return res.status(500).json({
        error: "Error reclamando encomienda",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

/**
 * ENDPOINT: GET /api/role-based/history
 * Acceso: Solo RESIDENTE
 * 
 * Obtiene el historial de encomiendas del residente.
 */
router.get(
  "/history",
  authMiddleware,
  requireRole("residente"),
  (req: AuthRequest, res) => {
    try {
      const user = req.user;

      return res.status(200).json({
        message: "Historial de encomiendas",
        resident: user.name,
        history: [
          {
            date: "2024-01-10",
            packages: 3,
            status: "todos entregados",
          },
          {
            date: "2024-01-05",
            packages: 2,
            status: "todos entregados",
          },
        ],
      });
    } catch (error) {
      return res.status(500).json({
        error: "Error obteniendo historial",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

// ============================================================
// RUTAS PARA AMBOS ROLES (conserje Y residente)
// ============================================================

/**
 * ENDPOINT: GET /api/role-based/profile
 * Acceso: CONSERJE O RESIDENTE
 * 
 * Obtiene el perfil del usuario actual (funciona para ambos roles).
 * Permite que cualquier usuario autenticado vea su información.
 */
router.get(
  "/profile",
  authMiddleware,
  requireRole("conserje", "residente"),
  (req: AuthRequest, res) => {
    try {
      const user = req.user;

      const roleDescription =
        user.role === "conserje"
          ? "Personal de gestión de encomiendas"
          : "Residente del edificio";

      return res.status(200).json({
        message: "Perfil del usuario",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          roleDescription: roleDescription,
          joinedAt: "2024-01-01",
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: "Error obteniendo perfil",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

/**
 * ENDPOINT: PUT /api/role-based/profile/update
 * Acceso: CONSERJE O RESIDENTE
 * 
 * Permite que cualquier usuario autenticado actualice su perfil.
 */
router.put(
  "/profile/update",
  authMiddleware,
  requireRole("conserje", "residente"),
  (req: AuthRequest, res) => {
    try {
      const { name, email } = req.body;
      const user = req.user;

      if (!name || !email) {
        return res.status(400).json({
          error: "Nombre y email son requeridos",
        });
      }

      return res.status(200).json({
        message: "Perfil actualizado exitosamente",
        user: {
          id: user.id,
          name: name,
          email: email,
          role: user.role,
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: "Error actualizando perfil",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

export default router;
