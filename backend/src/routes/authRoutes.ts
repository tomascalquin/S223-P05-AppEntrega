import { Router } from "express";
import { googleLogin } from "../controllers/authController";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

// Ruta pública para login con Google
router.post("/google", googleLogin);

// Ruta privada de prueba para verificar que el usuario sí está autenticado
router.get("/profile", authMiddleware, (req, res) => {
  return res.json({
    message: "Acceso permitido a ruta protegida",
  });
});

export default router;