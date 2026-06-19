/**
 * EJEMPLOS PRÁCTICOS DE USO DEL MIDDLEWARE JWT
 * 
 * Este archivo contiene ejemplos de cómo usar el middleware JWT
 * desde diferentes contextos (frontend, tests, APIs externas).
 */

// ============================================================================
// 1️⃣ EJEMPLO: Login en Frontend (React)
// ============================================================================

import { useState } from "react";

export function LoginPage() {
  const [token, setToken] = useState<string>("");

  async function handleGoogleLogin(googleToken: string) {
    // Paso 1: Enviar token de Google al backend
    const response = await fetch("http://localhost:3000/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: googleToken }),
    });

    if (!response.ok) {
      console.error("Error en login");
      return;
    }

    // Paso 2: Obtener token JWT del backend
    const data = await response.json();
    const jwtToken = data.token; // eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

    // Paso 3: Guardar token en localStorage
    localStorage.setItem("authToken", jwtToken);
    setToken(jwtToken);

    // Paso 4: Redirigir al dashboard
    window.location.href = "/dashboard";
  }

  return (
    <div>
      <h1>Login</h1>
      <button onClick={() => handleGoogleLogin("google-token-here")}>
        Iniciar sesión con Google
      </button>
    </div>
  );
}

// ============================================================================
// 2️⃣ EJEMPLO: Usar Token en Solicitudes (React Service)
// ============================================================================

// File: services/api.ts
export const api = {
  /**
   * Realiza una solicitud GET protegida
   */
  async getProtectedData(endpoint: string) {
    const token = localStorage.getItem("authToken");

    if (!token) {
      throw new Error("No hay token. Necesitas iniciar sesión.");
    }

    const response = await fetch(`http://localhost:3000${endpoint}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`, // ⭐ IMPORTANTE: Formato Bearer
      },
    });

    // Manejar token expirado
    if (response.status === 401) {
      localStorage.removeItem("authToken");
      window.location.href = "/login";
      throw new Error("Sesión expirada. Por favor, inicia sesión nuevamente.");
    }

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Realiza una solicitud POST protegida
   */
  async postProtectedData(endpoint: string, data: any) {
    const token = localStorage.getItem("authToken");

    if (!token) {
      throw new Error("No hay token. Necesitas iniciar sesión.");
    }

    const response = await fetch(`http://localhost:3000${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`, // ⭐ IMPORTANTE: Formato Bearer
      },
      body: JSON.stringify(data),
    });

    if (response.status === 401) {
      localStorage.removeItem("authToken");
      window.location.href = "/login";
      throw new Error("Sesión expirada");
    }

    if (!response.ok) {
      throw new Error(`Error ${response.status}`);
    }

    return response.json();
  },
};

// Uso en componentes:
// const profile = await api.getProtectedData("/api/protected/profile");

// ============================================================================
// 3️⃣ EJEMPLO: Interceptor Axios (Alternativa a Fetch)
// ============================================================================

import axios from "axios";

const apiClient = axios.create({
  baseURL: "http://localhost:3000",
});

// Interceptor de solicitud (agregar token)
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`; // ⭐ Formato Bearer
  }

  return config;
});

// Interceptor de respuesta (manejar token expirado)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado o inválido
      localStorage.removeItem("authToken");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

// Uso:
// const profile = await apiClient.get("/api/protected/profile");

// ============================================================================
// 4️⃣ EJEMPLO: Usar en Tests (Bun/Jest)
// ============================================================================

import { generateToken } from "../src/utils/jwt";
import { test, expect } from "bun:test";

const testUser = {
  id: 1,
  email: "test@example.com",
  name: "Test User",
};

test("GET /api/protected/profile - CON TOKEN VÁLIDO debe devolver 200", async () => {
  // Paso 1: Generar token válido
  const token = generateToken(testUser);

  // Paso 2: Realizar solicitud con token
  const response = await fetch("http://localhost:3000/api/protected/profile", {
    headers: {
      Authorization: `Bearer ${token}`, // ⭐ Formato Bearer
    },
  });

  // Paso 3: Verificar respuesta
  expect(response.status).toBe(200);

  const data = await response.json();
  expect(data.user.id).toBe(testUser.id);
  expect(data.user.email).toBe(testUser.email);
});

test("GET /api/protected/profile - SIN TOKEN debe devolver 401", async () => {
  // Paso 1: Realizar solicitud SIN token
  const response = await fetch("http://localhost:3000/api/protected/profile");

  // Paso 2: Verificar que rechazó
  expect(response.status).toBe(401);

  const data = await response.json();
  expect(data.code).toBe("MISSING_TOKEN");
});

test("GET /api/protected/profile - CON TOKEN INVÁLIDO debe devolver 401", async () => {
  // Paso 1: Realizar solicitud con token inválido
  const response = await fetch("http://localhost:3000/api/protected/profile", {
    headers: {
      Authorization: "Bearer invalid.token.here",
    },
  });

  // Paso 2: Verificar que rechazó
  expect(response.status).toBe(401);
  expect(response.json().code).toBe("INVALID_TOKEN");
});

// ============================================================================
// 5️⃣ EJEMPLO: Usar en cURL (Terminal)
// ============================================================================

/**
 * Solicitud SIN token (debe rechazar 401):
 * 
 * curl -X GET http://localhost:3000/api/protected/profile
 * 
 * Respuesta:
 * {
 *   "error": "No autorizado",
 *   "code": "MISSING_TOKEN",
 *   "message": "Token requerido en header Authorization"
 * }
 */

/**
 * Solicitud CON token VÁLIDO:
 * 
 * TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MTcxNjc0MDMwMCwiZXhwIjoxNzE2NzQ3NTAwfQ.signature"
 * 
 * curl -X GET http://localhost:3000/api/protected/profile \
 *   -H "Authorization: Bearer $TOKEN"
 * 
 * Respuesta:
 * {
 *   "message": "Datos del perfil de usuario",
 *   "user": {
 *     "id": 1,
 *     "email": "test@example.com",
 *     "name": "Test User"
 *   }
 * }
 */

/**
 * Solicitud CON token INVÁLIDO:
 * 
 * curl -X GET http://localhost:3000/api/protected/profile \
 *   -H "Authorization: Bearer invalid.token.here"
 * 
 * Respuesta:
 * {
 *   "error": "No autorizado",
 *   "code": "INVALID_TOKEN",
 *   "message": "Token inválido o corrupido"
 * }
 */

/**
 * Solicitud CON formato INCORRECTO:
 * 
 * curl -X GET http://localhost:3000/api/protected/profile \
 *   -H "Authorization: $TOKEN"
 * 
 * Respuesta:
 * {
 *   "error": "No autorizado",
 *   "code": "INVALID_TOKEN_FORMAT",
 *   "message": "Formato de token inválido. Use: Authorization: Bearer <token>"
 * }
 */

// ============================================================================
// 6️⃣ EJEMPLO: Usar en Postman
// ============================================================================

/**
 * PASO 1: Obtener token (Login)
 * 
 * POST http://localhost:3000/auth/google
 * 
 * Body (JSON):
 * {
 *   "token": "google-id-token-here"
 * }
 * 
 * Respuesta:
 * {
 *   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "user": {
 *     "id": 1,
 *     "email": "user@example.com",
 *     "name": "User Name"
 *   }
 * }
 */

/**
 * PASO 2: Usar token en solicitud protegida
 * 
 * En Postman:
 * 1. Nueva solicitud: GET http://localhost:3000/api/protected/profile
 * 2. Pestaña "Headers"
 * 3. Agregar header:
 *    Key: Authorization
 *    Value: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 * 4. Enviar
 * 
 * O usar variables en Postman:
 * 1. En Postman, crear variable: {{token}}
 * 2. Después de login, ejecutar script:
 *    pm.environment.set("token", pm.response.json().token);
 * 3. En headers, usar: Bearer {{token}}
 */

/**
 * SCRIPT para Postman (Guardar token automáticamente):
 * 
 * En la pestaña \"Tests\" después de login:
 * 
 * if (pm.response.code === 200) {
 *   const jsonResponse = pm.response.json();
 *   pm.environment.set("authToken", jsonResponse.token);
 * }
 */

// ============================================================================
// 7️⃣ EJEMPLO: Middleware en Express personalizado
// ============================================================================

import { Request, Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware";

// Usar el middleware en una ruta
const app = require("express")();

// Aplicar middleware a una ruta específica
app.get("/api/protected/profile", authMiddleware, (req: AuthRequest, res) => {
  res.json({
    message: "Acceso permitido",
    user: req.user, // Usuario extraído del token
  });
});

// Aplicar middleware a un grupo de rutas
const protectedRoutes = require("express").Router();

// Todas las rutas en protectedRoutes requieren autenticación
protectedRoutes.use(authMiddleware);

protectedRoutes.get("/dashboard", (req: AuthRequest, res) => {
  res.json({
    message: `Bienvenido ${req.user.name}`,
    userId: req.user.id,
  });
});

app.use("/api/protected", protectedRoutes);

// ============================================================================
// 8️⃣ EJEMPLO: Manejo de errores personalizado
// ============================================================================

async function getProfileWithErrorHandling() {
  try {
    const token = localStorage.getItem("authToken");

    if (!token) {
      throw new Error("No autenticado");
    }

    const response = await fetch("http://localhost:3000/api/protected/profile", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    switch (response.status) {
      case 200:
        // Éxito
        return await response.json();

      case 401:
        // No autenticado o token expirado
        const errorData = await response.json();

        if (errorData.code === "TOKEN_EXPIRED") {
          // Token expirado - redirigir a login
          localStorage.removeItem("authToken");
          window.location.href = "/login";
          throw new Error("Tu sesión ha expirado. Por favor, inicia sesión nuevamente.");
        } else if (errorData.code === "MISSING_TOKEN") {
          // Token no enviado
          throw new Error("Token no encontrado. Por favor, inicia sesión.");
        } else {
          // Token inválido
          throw new Error("Token inválido. Por favor, inicia sesión nuevamente.");
        }

      case 400:
        // Error en la solicitud
        const badRequestData = await response.json();
        throw new Error(`Error en la solicitud: ${badRequestData.message}`);

      default:
        // Error desconocido
        throw new Error(`Error ${response.status} del servidor`);
    }
  } catch (error) {
    console.error("Error obteniendo perfil:", error);
    throw error;
  }
}

// ============================================================================
// 9️⃣ EJEMPLO: Hook personalizado de React para proteger rutas
// ============================================================================

import { useEffect, useState } from "react";

function useProtectedRoute() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("authToken");

    if (!token) {
      // No hay token - redirigir a login
      window.location.href = "/login";
      return;
    }

    // Verificar que el token es válido
    fetch("http://localhost:3000/api/protected/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((response) => {
        if (response.status === 401) {
          // Token expirado
          localStorage.removeItem("authToken");
          window.location.href = "/login";
        } else {
          setIsAuthenticated(true);
        }
      })
      .catch((error) => {
        console.error(error);
        window.location.href = "/login";
      })
      .finally(() => setLoading(false));
  }, []);

  return { isAuthenticated, loading };
}

// Uso en componente:
// function ProtectedPage() {
//   const { isAuthenticated, loading } = useProtectedRoute();
//
//   if (loading) return <div>Cargando...</div>;
//   if (!isAuthenticated) return <div>No autenticado</div>;
//
//   return <div>Contenido protegido</div>;
// }

// ============================================================================
// 🔟 EJEMPLO: Obtener información del usuario del token
// ============================================================================

function getUserFromToken(): { id: number; email: string; name: string } | null {
  const token = localStorage.getItem("authToken");

  if (!token) {
    return null;
  }

  try {
    // Decodificar la parte del payload del JWT
    // Nota: No verifica la firma, solo decodifica para mostrar en UI
    const parts = token.split(".");
    const payload = JSON.parse(atob(parts[1]));

    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
    };
  } catch (error) {
    console.error("Error decodificando token:", error);
    return null;
  }
}

// Uso:
// const user = getUserFromToken();
// console.log(`Bienvenido, ${user?.name}!`);

export { LoginPage, api, useProtectedRoute, getUserFromToken };
