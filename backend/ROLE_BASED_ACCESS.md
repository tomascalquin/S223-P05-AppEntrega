# 🔐 Control de Acceso Basado en Roles (RBAC)

## 📋 Descripción General

Sistema completo de **Restricción de Acceso Basado en Roles (Role-Based Access Control - RBAC)** implementado en la API backend. Los usuarios tienen uno de dos roles:
- **conserje**: Personal de gestión de encomiendas
- **residente**: Residentes del edificio

Cada rol tiene acceso a funcionalidades específicas mediante middleware de autorización.

## ✨ Características Implementadas

### 1. ✅ Tipos de Usuario Definidos
- **Rol "conserje"**: Acceso a panel administrativo, reportes y gestión de paquetes
- **Rol "residente"**: Acceso a información personal de encomiendas y historial

### 2. ✅ Extensión del JWT (Token)
El token JWT ahora incluye:
```json
{
  "id": 1,
  "email": "usuario@example.com",
  "name": "Nombre del Usuario",
  "role": "residente",
  "username": "usuario123"
}
```

### 3. ✅ Middleware de Autorización por Rol
- **`authMiddleware`**: Valida que el usuario esté autenticado
- **`requireRole(...roles)`**: Verifica que el usuario tenga uno de los roles especificados
- **`requireAllRoles(...roles)`**: Verifica que el usuario tenga todos los roles especificados

### 4. ✅ Rutas Protegidas por Rol
```
SOLO CONSERJE:
  GET    /api/role-based/admin/packages
  POST   /api/role-based/admin/packages/mark-as-delivered
  GET    /api/role-based/admin/reports

SOLO RESIDENTE:
  GET    /api/role-based/my-packages
  POST   /api/role-based/claim-package
  GET    /api/role-based/history

AMBOS ROLES:
  GET    /api/role-based/profile
  PUT    /api/role-based/profile/update
```

## 🚀 Uso del Sistema

### Estructura del Código

#### 1. Tipos de Usuario (`backend/src/utils/jwt.ts`)
```typescript
export type UserRole = "conserje" | "residente";

type UserPayload = {
  id: number;
  email: string;
  name: string;
  role?: UserRole;
  username?: string;
};
```

#### 2. Middleware de Autorización (`backend/src/middleware/authMiddleware.ts`)

**Middleware para validar rol:**
```typescript
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // Verifica que el usuario tenga uno de los roles permitidos
    // Retorna 403 si no tiene permiso
  };
}
```

**Uso en rutas:**
```typescript
// Solo conserjes
router.get(
  "/admin/packages",
  authMiddleware,
  requireRole("conserje"),
  controlador
);

// Solo residentes
router.get(
  "/my-packages",
  authMiddleware,
  requireRole("residente"),
  controlador
);

// Ambos roles
router.get(
  "/profile",
  authMiddleware,
  requireRole("conserje", "residente"),
  controlador
);
```

#### 3. Autenticación con Rol (`backend/src/controllers/authController.ts`)

```typescript
export async function googleLogin(req: Request, res: Response) {
  // El frontend puede enviar un rol específico
  const { token, role: requestRole } = req.body;
  
  // Se asigna el rol al crear el usuario
  user = {
    id: nextId++,
    email: payload.email,
    name: payload.name || "Sin nombre",
    picture: payload.picture || null,
    role: assignDefaultRole(payload.email, requestRole), // <-- ROL ASIGNADO
  };

  // El token generado INCLUYE el rol
  const appToken = generateToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role, // <-- ROL EN EL TOKEN
  });
}
```

## 📚 Ejemplos de Uso

### Ejemplo 1: Acceder como CONSERJE

**1. Login (obtener token)**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "conserje@ejemplo.com",
    "password": "password123",
    "role": "conserje"
  }'
```

**Respuesta:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "conserje@ejemplo.com",
    "name": "Juan Conserje",
    "role": "conserje"
  }
}
```

**2. Usar token para acceder a panel administrativo**
```bash
curl -X GET http://localhost:3001/api/role-based/admin/packages \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Respuesta (200 OK):**
```json
{
  "message": "Panel de administración de paquetes (Solo conserje)",
  "user": {
    "id": 1,
    "role": "conserje",
    "name": "Juan Conserje"
  },
  "data": {
    "totalPackages": 42,
    "pendingDelivery": 5,
    "delivered": 37,
    "packages": [...]
  }
}
```

**3. Intentar acceder a ruta solo para residentes**
```bash
curl -X GET http://localhost:3001/api/role-based/my-packages \
  -H "Authorization: Bearer <token_conserje>"
```

**Respuesta (403 Forbidden):**
```json
{
  "error": "Acceso denegado",
  "message": "Esta funcionalidad solo está disponible para: residente. Tu rol actual es: conserje",
  "code": "INSUFFICIENT_PERMISSIONS",
  "requiredRoles": ["residente"],
  "userRole": "conserje"
}
```

### Ejemplo 2: Acceder como RESIDENTE

**1. Login**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "residente@ejemplo.com",
    "password": "password123",
    "role": "residente"
  }'
```

**2. Ver propias encomiendas**
```bash
curl -X GET http://localhost:3001/api/role-based/my-packages \
  -H "Authorization: Bearer <token_residente>"
```

**Respuesta (200 OK):**
```json
{
  "message": "Mis encomiendas (Residente)",
  "resident": {
    "id": 2,
    "name": "María García",
    "email": "maria@ejemplo.com",
    "role": "residente"
  },
  "packages": [
    {
      "id": 101,
      "sender": "Amazon",
      "status": "entregado",
      "receivedDate": "2024-01-15",
      "location": "Mostrador principal"
    }
  ],
  "totalPending": 1
}
```

**3. Reclamar una encomienda**
```bash
curl -X POST http://localhost:3001/api/role-based/claim-package \
  -H "Authorization: Bearer <token_residente>" \
  -H "Content-Type: application/json" \
  -d '{
    "packageId": 101
  }'
```

**Respuesta (200 OK):**
```json
{
  "message": "Encomienda reclamada exitosamente",
  "residentId": 2,
  "residentName": "María García",
  "packageId": 101,
  "claimedAt": "2024-06-01T14:30:00Z",
  "instructions": "Por favor dirigirse al mostrador principal con su identificación"
}
```

## 🔒 Códigos de Error

### 401 Unauthorized
```json
{
  "error": "No autorizado",
  "message": "Token requerido en header Authorization",
  "code": "MISSING_TOKEN"
}
```

**Causa:** Token no incluido o inválido
**Solución:** Incluir token válido en header `Authorization: Bearer <token>`

### 403 Forbidden
```json
{
  "error": "Acceso denegado",
  "message": "Esta funcionalidad solo está disponible para: conserje",
  "code": "INSUFFICIENT_PERMISSIONS",
  "requiredRoles": ["conserje"],
  "userRole": "residente"
}
```

**Causa:** Usuario no tiene el rol requerido
**Solución:** Usar cuenta con el rol correspondiente

### Sin Rol Asignado
```json
{
  "error": "Acceso denegado",
  "message": "El usuario no tiene un rol asignado",
  "code": "NO_ROLE_ASSIGNED"
}
```

**Causa:** Usuario autenticado pero sin rol en el token
**Solución:** Asegurarse de que el rol se asigna correctamente en el login

## 📁 Archivos Modificados/Creados

1. **`backend/src/utils/jwt.ts`** ✏️
   - Agregado tipo `UserRole`
   - Extendido `UserPayload` con `role` y `username`

2. **`backend/src/middleware/authMiddleware.ts`** ✏️
   - Importado `UserRole`
   - Agregado middleware `requireRole(...roles)`
   - Agregado middleware `requireAllRoles(...roles)`

3. **`backend/src/controllers/authController.ts`** ✏️
   - Importado `UserRole`
   - Agregada interfaz `AppUser` con campo `role`
   - Agregada función `assignDefaultRole()`
   - Modificada función `googleLogin()` para asignar rol

4. **`backend/src/routes/roleBasedRoutes.ts`** 🆕
   - Creado archivo con rutas basadas en roles
   - 3 rutas solo para conserje
   - 3 rutas solo para residente
   - 2 rutas para ambos roles

5. **`backend/src/app.ts`** ✏️
   - Importado `roleBasedRoutes`
   - Registrada ruta `/api/role-based`

## 🧪 Testing

### Script de Test Básico (con cURL)

**1. Login como conserje:**
```bash
curl -X POST http://localhost:3001/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "token": "GOOGLE_TOKEN",
    "role": "conserje"
  }'
# Guardar token en variable: export TOKEN_CONSERJE="..."
```

**2. Probar acceso como conserje:**
```bash
curl -X GET http://localhost:3001/api/role-based/admin/packages \
  -H "Authorization: Bearer $TOKEN_CONSERJE"
# Respuesta: 200 OK ✅
```

**3. Intentar acceder a ruta solo para residentes:**
```bash
curl -X GET http://localhost:3001/api/role-based/my-packages \
  -H "Authorization: Bearer $TOKEN_CONSERJE"
# Respuesta: 403 Forbidden ❌
```

**4. Login como residente:**
```bash
curl -X POST http://localhost:3001/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "token": "GOOGLE_TOKEN",
    "role": "residente"
  }'
# Guardar token en variable: export TOKEN_RESIDENTE="..."
```

**5. Acceder como residente:**
```bash
curl -X GET http://localhost:3001/api/role-based/my-packages \
  -H "Authorization: Bearer $TOKEN_RESIDENTE"
# Respuesta: 200 OK ✅
```

## 🛠️ Cómo Extender el Sistema

### Agregar Nuevo Rol

1. **Actualizar tipo en `jwt.ts`:**
```typescript
export type UserRole = "conserje" | "residente" | "admin"; // Agregar "admin"
```

2. **Usar en rutas:**
```typescript
// Solo para admin
router.delete(
  "/delete-user/:id",
  authMiddleware,
  requireRole("admin"),
  controlador
);
```

### Crear Ruta Multi-Rol

```typescript
// Accesible para conserje Y residente, pero no para otros
router.get(
  "/shared-data",
  authMiddleware,
  requireRole("conserje", "residente"),
  (req: AuthRequest, res) => {
    // Implementar lógica específica según rol
    if (req.user.role === "conserje") {
      // Mostrar datos completos
    } else {
      // Mostrar datos filtrados
    }
  }
);
```

### Lógica Personalizada por Rol

```typescript
router.get(
  "/packages",
  authMiddleware,
  requireRole("conserje", "residente"),
  (req: AuthRequest, res) => {
    const user = req.user;

    if (user.role === "conserje") {
      // Mostrar TODOS los paquetes
      return res.json({ packages: getAllPackages() });
    } else if (user.role === "residente") {
      // Mostrar SOLO paquetes del residente
      return res.json({ packages: getResidentPackages(user.id) });
    }
  }
);
```

## 🔄 Flujo Completo de Autenticación y Autorización

```
1. Usuario inicia sesión con Google
         ↓
2. authController.googleLogin() valida token con Google
         ↓
3. Se busca o crea el usuario con ROL asignado
         ↓
4. generateToken() crea JWT incluyendo ROL
         ↓
5. Frontend guarda token en localStorage
         ↓
6. Solicitudes posteriores incluyen token en header Authorization
         ↓
7. authMiddleware verifica que el token sea válido
         ↓
8. requireRole() verifica que el usuario tenga el rol necesario
         ↓
9. Si todo OK → Ejecutar controlador
   Si falla → Retornar 401 o 403 con error específico
```

## 📝 Checklist de Implementación

- ✅ JWT payload extendido con `role`
- ✅ Middleware `requireRole()` creado
- ✅ AuthController modificado para asignar roles
- ✅ Rutas de ejemplo para conserje
- ✅ Rutas de ejemplo para residente
- ✅ Rutas compartidas para ambos roles
- ✅ Documentación completa
- ✅ Errores específicos por rol
- ✅ Manejo de usuarios sin rol

## 🔗 Referencias Relacionadas

- [JWT Middleware Guide](./JWT_MIDDLEWARE_GUIDE.md)
- [Auth Routes](./routes/authRoutes.ts)
- [Role Based Routes](./routes/roleBasedRoutes.ts)
- [Auth Middleware](./middleware/authMiddleware.ts)
- [JWT Utils](./utils/jwt.ts)

## ✉️ Contacto

Para preguntas sobre el sistema de roles, consultar la documentación de implementación relacionada.
