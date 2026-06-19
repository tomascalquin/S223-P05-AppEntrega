/**
 * EJEMPLOS PRÁCTICOS: Control de Acceso Basado en Roles (RBAC)
 * 
 * Este archivo contiene ejemplos prácticos de cómo:
 * 1. Autenticarse y obtener token con rol
 * 2. Hacer solicitudes como diferentes tipos de usuario
 * 3. Manejar errores de autorización
 * 4. Implementar lógica condicional según el rol
 */

// ============================================================
// EJEMPLO 1: Login y Obtener Token (desde el Frontend)
// ============================================================

interface LoginResponse {
  message: string;
  token: string;
  user: {
    id: number;
    email: string;
    name: string;
    role: "conserje" | "residente";
  };
}

interface GoogleLoginPayload {
  token: string; // Token de Google
  role?: "conserje" | "residente"; // Opcional
}

// Función para hacer login
async function authenticateWithGoogle(
  googleToken: string,
  userRole: "conserje" | "residente"
): Promise<LoginResponse> {
  const payload: GoogleLoginPayload = {
    token: googleToken,
    role: userRole, // Especificar el rol
  };

  const response = await fetch("http://localhost:3001/api/auth/google", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Error en autenticación");
  }

  const data = (await response.json()) as LoginResponse;

  // Guardar token y rol en localStorage
  localStorage.setItem("authToken", data.token);
  localStorage.setItem("userRole", data.user.role);
  localStorage.setItem("userName", data.user.name);

  console.log(`✅ Login exitoso como ${data.user.role}: ${data.user.name}`);
  return data;
}

// ============================================================
// EJEMPLO 2: Hacer Solicitudes Autenticadas
// ============================================================

interface AuthHeaders {
  "Content-Type": "application/json";
  Authorization: string;
}

function getAuthHeaders(): AuthHeaders {
  const token = localStorage.getItem("authToken");

  if (!token) {
    throw new Error("No hay token guardado");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// Solicitud genérica con autenticación
async function makeAuthenticatedRequest(
  endpoint: string,
  options: RequestInit = {}
) {
  const response = await fetch(`http://localhost:3001${endpoint}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  if (response.status === 403) {
    throw new Error("Acceso denegado: No tienes permiso para acceder a esto");
  }

  if (!response.ok) {
    throw new Error(`Error: ${response.status}`);
  }

  return await response.json();
}

// ============================================================
// EJEMPLO 3: Rutas SOLO CONSERJE
// ============================================================

// Obtener panel administrativo (SOLO CONSERJE)
async function getAdminPackagesDashboard() {
  console.log("📊 Obteniendo panel de paquetes (solo conserje)...");

  try {
    const data = await makeAuthenticatedRequest(
      "/api/role-based/admin/packages"
    );
    console.log("✅ Panel de paquetes:", data);
    return data;
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

// Marcar paquete como entregado (SOLO CONSERJE)
async function markPackageAsDelivered(packageId: number) {
  console.log(`📦 Marcando paquete ${packageId} como entregado...`);

  try {
    const data = await makeAuthenticatedRequest(
      "/api/role-based/admin/packages/mark-as-delivered",
      {
        method: "POST",
        body: JSON.stringify({ packageId }),
      }
    );
    console.log("✅ Paquete marcado:", data);
    return data;
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

// Obtener reportes (SOLO CONSERJE)
async function getConserjeReports() {
  console.log("📈 Obteniendo reportes (solo conserje)...");

  try {
    const data = await makeAuthenticatedRequest("/api/role-based/admin/reports");
    console.log("✅ Reportes:", data);
    return data;
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

// ============================================================
// EJEMPLO 4: Rutas SOLO RESIDENTE
// ============================================================

// Obtener mis paquetes (SOLO RESIDENTE)
async function getMyPackages() {
  console.log("📬 Obteniendo mis encomiendas (solo residente)...");

  try {
    const data = await makeAuthenticatedRequest("/api/role-based/my-packages");
    console.log("✅ Mis encomiendas:", data);
    return data;
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

// Reclamar paquete (SOLO RESIDENTE)
async function claimPackage(packageId: number) {
  console.log(`📮 Reclamando paquete ${packageId}...`);

  try {
    const data = await makeAuthenticatedRequest(
      "/api/role-based/claim-package",
      {
        method: "POST",
        body: JSON.stringify({ packageId }),
      }
    );
    console.log("✅ Paquete reclamado:", data);
    return data;
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

// Obtener historial (SOLO RESIDENTE)
async function getPackageHistory() {
  console.log("📋 Obteniendo historial de encomiendas...");

  try {
    const data = await makeAuthenticatedRequest(
      "/api/role-based/history"
    );
    console.log("✅ Historial:", data);
    return data;
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

// ============================================================
// EJEMPLO 5: Rutas para AMBOS ROLES
// ============================================================

// Obtener perfil (CONSERJE o RESIDENTE)
async function getMyProfile() {
  console.log("👤 Obteniendo mi perfil...");

  try {
    const data = await makeAuthenticatedRequest("/api/role-based/profile");
    console.log("✅ Mi perfil:", data);
    return data;
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

// Actualizar perfil (CONSERJE o RESIDENTE)
async function updateMyProfile(name: string, email: string) {
  console.log("✏️ Actualizando mi perfil...");

  try {
    const data = await makeAuthenticatedRequest(
      "/api/role-based/profile/update",
      {
        method: "PUT",
        body: JSON.stringify({ name, email }),
      }
    );
    console.log("✅ Perfil actualizado:", data);
    return data;
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

// ============================================================
// EJEMPLO 6: Validación de Rol en Frontend
// ============================================================

function getUserRole(): "conserje" | "residente" | null {
  const role = localStorage.getItem("userRole");
  return role as "conserje" | "residente" | null;
}

function isConserje(): boolean {
  return getUserRole() === "conserje";
}

function isResidente(): boolean {
  return getUserRole() === "residente";
}

// Mostrar elementos según el rol
function showConserjeMenu() {
  const menuElement = document.getElementById("conserje-menu");
  if (menuElement && isConserje()) {
    menuElement.style.display = "block";
  }
}

function showResidenteMenu() {
  const menuElement = document.getElementById("residente-menu");
  if (menuElement && isResidente()) {
    menuElement.style.display = "block";
  }
}

// ============================================================
// EJEMPLO 7: Manejo de Errores de Autorización
// ============================================================

interface ErrorResponse {
  error: string;
  message: string;
  code: string;
  requiredRoles?: string[];
  userRole?: string;
}

async function makeSafeRequest(endpoint: string) {
  try {
    const response = await fetch(`http://localhost:3001${endpoint}`, {
      headers: getAuthHeaders(),
    });

    if (response.status === 401) {
      console.error("❌ No autenticado - Redirigir a login");
      localStorage.removeItem("authToken");
      window.location.href = "/login";
      return;
    }

    if (response.status === 403) {
      const error = (await response.json()) as ErrorResponse;
      console.error(
        `❌ Acceso denegado: ${error.message} (requiere: ${error.requiredRoles?.join(", ")})`
      );
      // Mostrar mensaje amigable
      alert("No tienes permiso para acceder a esta funcionalidad");
      return;
    }

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error en solicitud:", error);
    throw error;
  }
}

// ============================================================
// EJEMPLO 8: Flujo Completo (Component React-like)
// ============================================================

async function demonstrateFullFlow() {
  console.log("🚀 Iniciando demostración completa del RBAC");
  console.log("==================================================");

  try {
    // 1. LOGIN COMO CONSERJE
    console.log("\n1️⃣  Autenticando como CONSERJE...");
    const conserjePage = await authenticateWithGoogle(
      "FAKE_GOOGLE_TOKEN", // En real, obtener de Google
      "conserje"
    );

    // 2. ACCEDER A PANEL DE CONSERJE
    console.log("\n2️⃣  Accediendo al panel de administración...");
    await getAdminPackagesDashboard();

    // 3. INTENTAR ACCEDER A RUTA SOLO PARA RESIDENTES
    console.log(
      "\n3️⃣  Intentando acceder a 'mis encomiendas' (solo residentes)..."
    );
    try {
      await getMyPackages();
    } catch (error) {
      console.log("✅ Correctamente rechazado:", error);
    }

    // 4. OBTENER PERFIL (accesible para ambos)
    console.log("\n4️⃣  Obteniendo perfil (accesible para ambos roles)...");
    await getMyProfile();

    // 5. LOGIN COMO RESIDENTE
    console.log("\n5️⃣  Cambiando a RESIDENTE...");
    await authenticateWithGoogle("FAKE_GOOGLE_TOKEN", "residente");

    // 6. ACCEDER A RUTAS DE RESIDENTE
    console.log("\n6️⃣  Obteniendo mis encomiendas (residente)...");
    await getMyPackages();

    // 7. INTENTAR ACCEDER A RUTA SOLO PARA CONSERJES
    console.log(
      "\n7️⃣  Intentando acceder a panel admin (solo conserje)..."
    );
    try {
      await getAdminPackagesDashboard();
    } catch (error) {
      console.log("✅ Correctamente rechazado:", error);
    }

    console.log(
      "\n✅ Demostración completada - RBAC funcionando correctamente!"
    );
  } catch (error) {
    console.error("❌ Error en demostración:", error);
  }
}

// ============================================================
// EJEMPLO 9: Renderizado Condicional por Rol
// ============================================================

interface DashboardProps {
  role: "conserje" | "residente";
}

function DashboardContent({ role }: DashboardProps) {
  switch (role) {
    case "conserje":
      return {
        title: "Panel de Administración",
        sections: [
          { name: "Gestión de Paquetes", action: getAdminPackagesDashboard },
          { name: "Reportes", action: getConserjeReports },
          {
            name: "Marcar Entregado",
            action: () => markPackageAsDelivered(1),
          },
        ],
      };

    case "residente":
      return {
        title: "Mis Encomiendas",
        sections: [
          { name: "Ver Encomiendas", action: getMyPackages },
          { name: "Historial", action: getPackageHistory },
          { name: "Reclamar Paquete", action: () => claimPackage(1) },
        ],
      };

    default:
      return {
        title: "Inicio",
        sections: [],
      };
  }
}

// ============================================================
// USO DE EJEMPLOS
// ============================================================

/*
// En tu aplicación frontend, usarías así:

// 1. Login como conserje
await authenticateWithGoogle(googleToken, "conserje");

// 2. Obtener panel de administración
const adminData = await getAdminPackagesDashboard();

// 3. Cambiar a residente
localStorage.clear();
await authenticateWithGoogle(googleToken, "residente");

// 4. Obtener mis paquetes
const myPackages = await getMyPackages();

// 5. Manejo seguro con errores
const data = await makeSafeRequest("/api/role-based/admin/packages");
*/

export {
  authenticateWithGoogle,
  getAdminPackagesDashboard,
  markPackageAsDelivered,
  getConserjeReports,
  getMyPackages,
  claimPackage,
  getPackageHistory,
  getMyProfile,
  updateMyProfile,
  getUserRole,
  isConserje,
  isResidente,
  showConserjeMenu,
  showResidenteMenu,
  makeSafeRequest,
  demonstrateFullFlow,
  DashboardContent,
};
