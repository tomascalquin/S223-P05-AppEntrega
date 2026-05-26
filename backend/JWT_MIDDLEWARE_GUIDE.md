# 🔐 JWT Middleware - Guía Completa

## 📋 Descripción

Middleware JWT completamente implementado para proteger endpoints sensibles en la API REST de encomiendas. Incluye validación de tokens en headers, manejo robusto de errores, y tests exhaustivos para verificar acceso autorizado/no autorizado.

## ✨ Características Implementadas

### 1. ✅ Middleware de Autenticación JWT
- **Ubicación:** `backend/src/middleware/authMiddleware.ts`
- Valida tokens JWT en el header `Authorization`
- Formato requerido: `Authorization: Bearer <token>`
- Errores específicos para cada caso (token faltante, inválido, expirado)
- Middleware opcional para endpoints públicos-privados

### 2. ✅ Validación de Tokens en Headers
- Extrae token del formato `Bearer <token>`
- Valida estructura JWT (3 partes separadas por puntos)
- Verifica firma criptográfica del token
- Comprueba expiración del token (2 horas por defecto)
- Detecta tokens adulterados/modificados

### 3. ✅ Manejo Robusto de Errores
- **401 Unauthorized** - Token faltante, inválido o expirado
- **400 Bad Request** - Formato de token incorrecto
- **500 Internal Server Error** - Errores no esperados
- Mensajes de error descriptivos con códigos específicos

### 4. ✅ Endpoints Protegidos
**Rutas autenticadas** (requieren `Authorization: Bearer <token>`):
- `GET /api/protected/profile` - Obtener perfil del usuario
- `GET /api/protected/me` - Datos del usuario actual
- `PUT /api/protected/profile` - Actualizar perfil
- `GET /api/protected/packages` - Listar paquetes
- `POST /api/protected/packages` - Crear paquete
- `GET /api/protected/packages/:id` - Obtener paquete específico
- `DELETE /api/protected/packages/:id` - Eliminar paquete

### 5. ✅ Tests Exhaustivos
- **test-auth.ts** - 8 tests de validación JWT
- **test-protected-endpoints.ts** - 7 tests de endpoints HTTP

## 🚀 Inicio Rápido

### Instalación de dependencias
```bash
cd backend
bun install
```

### Iniciar el servidor Express
```bash
bun run dev
```

El servidor estará disponible en `http://localhost:3000`

### Ejecutar tests

**Test 1: Validación de JWT**
```bash
bun run test-auth
```

Valida:
- ✓ Generación de tokens
- ✓ Verificación de tokens válidos
- ✓ Rechazo de tokens inválidos
- ✓ Rechazo de tokens adulterados
- ✓ Estructura correcta del token
- ✓ Datos del usuario en el token
- ✓ Rechazo de tokens vacíos
- ✓ Expiración correcta

**Test 2: Endpoints Protegidos HTTP**
```bash
# En terminal 1: iniciar servidor
bun run dev

# En terminal 2: ejecutar tests
bun run test-endpoints
```

Valida:
- ✓ Rechazo sin token (401)
- ✓ Rechazo con token inválido (401)
- ✓ Rechazo con formato inválido (401)
- ✓ Permiso con token válido (200)
- ✓ Datos correctos en respuesta
- ✓ Detección de falta de Authorization
- ✓ Requerimiento de formato Bearer

## 📚 Uso en Aplicación Frontend

### 1. Obtener Token (Login)
```typescript
// En login.ts
async function loginWithGoogle(token: string) {
  const response = await fetch("http://localhost:3000/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  const data = await response.json();
  localStorage.setItem("authToken", data.token); // Guardar token
  return data;
}
```

### 2. Usar Token en Solicitudes
```typescript
// En cualquier servicio
async function getProtectedData() {
  const token = localStorage.getItem("authToken");

  const response = await fetch("http://localhost:3000/api/protected/profile", {
    headers: {
      "Authorization": `Bearer ${token}` // ⭐ Formato correcto
    },
  });

  if (response.status === 401) {
    // Token expirado o inválido - redirigir a login
    localStorage.removeItem("authToken");
    window.location.href = "/login";
  }

  return response.json();
}
```

### 3. Interceptor de Solicitudes (Recomendado)
```typescript
// En services/api.ts
const api = {
  async fetch(url: string, options: RequestInit = {}) {
    const token = localStorage.getItem("authToken");

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });

    // Manejar token expirado
    if (response.status === 401) {
      localStorage.removeItem("authToken");
      window.location.href = "/login";
    }

    return response;
  },
};
```

## 📋 Estructura de Archivos

```
backend/src/
├── app.ts                    # Configuración de Express
├── index.ts                  # Punto de entrada del servidor
├── server.ts                 # Servidor original de Bun (paquetes)
├── middleware/
│   └── authMiddleware.ts    # Middleware JWT (mejorado)
├── routes/
│   ├── authRoutes.ts        # Rutas de autenticación
│   └── protectedRoutes.ts   # Rutas protegidas (NUEVA)
├── controllers/
│   └── authController.ts    # Controlador de autenticación
└── utils/
    └── jwt.ts               # Utilidades JWT

tests/
├── test-auth.ts             # Tests de validación JWT (NUEVA)
└── test-protected-endpoints.ts # Tests de endpoints HTTP (NUEVA)
```

## 🔒 Detalles Técnicos

### Header Authorization Esperado
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MTcxNjc0MDMwMCwiZXhwIjoxNzE2NzQ3NTAwfQ.signature
```

### Estructura del Token JWT
```json
// Header
{
  "alg": "HS256",
  "typ": "JWT"
}

// Payload
{
  "id": 1,
  "email": "usuario@example.com",
  "name": "Nombre Usuario",
  "iat": 1716740300,
  "exp": 1716747500
}

// Signature (HMAC SHA256)
```

### Códigos de Error HTTP

| Código | Situación | Solución |
|--------|-----------|----------|
| **401** | Token faltante, inválido o expirado | Enviar token válido en header `Authorization` |
| **400** | Formato de token incorrecto | Usar formato `Bearer <token>` |
| **500** | Error del servidor | Contactar al administrador |

### Códigos de Error en Respuesta

```json
// Token faltante
{
  "error": "No autorizado",
  "code": "MISSING_TOKEN",
  "message": "Token requerido en header Authorization"
}

// Formato incorrecto
{
  "error": "No autorizado",
  "code": "INVALID_TOKEN_FORMAT",
  "message": "Formato de token inválido. Use: Authorization: Bearer <token>"
}

// Token expirado
{
  "error": "No autorizado",
  "code": "TOKEN_EXPIRED",
  "message": "Token expirado",
  "expiredAt": "2026-05-26T12:00:00.000Z"
}

// Token inválido
{
  "error": "No autorizado",
  "code": "INVALID_TOKEN",
  "message": "Token inválido o corrupido"
}
```

## 🧪 Casos de Prueba Implementados

### Caso 1: Acceso sin Token
```bash
curl -X GET http://localhost:3000/api/protected/profile
# Respuesta: 401 Unauthorized
```

### Caso 2: Token Válido
```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X GET http://localhost:3000/api/protected/profile \
  -H "Authorization: Bearer $TOKEN"
# Respuesta: 200 OK con datos del usuario
```

### Caso 3: Token Inválido
```bash
curl -X GET http://localhost:3000/api/protected/profile \
  -H "Authorization: Bearer invalid.token.here"
# Respuesta: 401 Unauthorized
```

### Caso 4: Formato Incorrecto
```bash
curl -X GET http://localhost:3000/api/protected/profile \
  -H "Authorization: $TOKEN"  # Sin "Bearer"
# Respuesta: 401 Unauthorized
```

### Caso 5: Header Faltante
```bash
curl -X GET http://localhost:3000/api/protected/profile
# Respuesta: 401 Unauthorized
```

## 🔄 Flujo de Autenticación

```mermaid
graph LR
    A[Usuario] -->|1. Login con Google| B[POST /auth/google]
    B -->|2. Token JWT| A
    A -->|3. Solicitud con Bearer Token| C[GET /api/protected/...]
    C -->|4. Valida JWT| D[authMiddleware]
    D -->|5. Token válido| E[Controlador]
    D -->|5. Token inválido| F[401 Unauthorized]
    E -->|6. Datos| A
    F -->|Error| A
```

## 🛡️ Seguridad

- ✅ Tokens firmados criptográficamente (HMAC SHA256)
- ✅ Expiración automática (2 horas)
- ✅ Validación de estructura y firma
- ✅ Detección de tokens adulterados
- ✅ Mensajes de error sin información sensible
- ✅ CORS configurado de forma segura
- ✅ Preparación para HTTPS en producción

## 📝 Variables de Entorno Requeridas

```bash
# .env
JWT_SECRET=tu_clave_secreta_muy_larga_y_segura
GOOGLE_CLIENT_ID=tu_google_client_id
CORS_ORIGIN=http://localhost:5173  # Para desarrollo
NODE_ENV=development
```

## 🐛 Troubleshooting

### \"Token expirado\" en tests
```bash
# Los tokens expiran después de 2 horas
# Ejecuta nuevamente los tests para generar tokens frescos
bun run test-endpoints
```

### \"Servidor no disponible\"
```bash
# Asegúrate de que el servidor está ejecutándose
bun run dev
# El servidor debe iniciar en http://localhost:3000
```

### \"CORS error\" desde frontend
```bash
# Actualiza CORS_ORIGIN en .env
# O configura permitiendo todos los orígenes (desarrollo):
# CORS_ORIGIN=*
```

## 📚 Archivos Mejorados/Creados

- ✅ `authMiddleware.ts` - Mejorado con mejor manejo de errores
- ✅ `protectedRoutes.ts` - NUEVO: Rutas protegidas de ejemplo
- ✅ `app.ts` - NUEVO: Configuración de Express
- ✅ `index.ts` - NUEVO: Punto de entrada del servidor
- ✅ `test-auth.ts` - NUEVO: Tests de validación JWT
- ✅ `test-protected-endpoints.ts` - NUEVO: Tests de endpoints HTTP
- ✅ `package.json` - Actualizado con nuevos scripts

## ✅ Checklist de Implementación

- [x] Validar JWT en headers
- [x] Extraer token del formato \"Bearer <token>\"
- [x] Verificar firma criptográfica
- [x] Verificar expiración del token
- [x] Manejar errores específicos (faltante, inválido, expirado)
- [x] Proteger endpoints sensibles
- [x] Tests de acceso no autorizado
- [x] Tests de acceso autorizado
- [x] Documentación completa
- [x] Ejemplos de uso en frontend

## 🚀 Próximos Pasos

1. **Integrar con Base de Datos:**
   - Guardar tokens en sesiones/historial
   - Implementar blacklist de tokens

2. **Roles y Permisos:**
   - Agregar roles de usuario (admin, conserje, residente)
   - Middleware para autorización por roles

3. **Seguridad Adicional:**
   - Implementar rate limiting
   - Validar User-Agent
   - Implementar HTTPS

4. **Monitoreo:**
   - Logging de intentos de acceso no autorizado
   - Alertas de tokens inválidos

---

**Implementado por:** GitHub Copilot  
**Fecha:** Mayo 26, 2026  
**Estado:** ✅ Producción-listo
