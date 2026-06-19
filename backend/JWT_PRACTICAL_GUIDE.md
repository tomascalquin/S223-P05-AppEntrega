# JWT MIDDLEWARE - GUÍA PRÁCTICA COMPLETA

## 📋 Tabla de Contenidos
1. [Introducción](#introducción)
2. [Configuración Inicial](#configuración-inicial)
3. [Middlewares Disponibles](#middlewares-disponibles)
4. [Ejemplos Prácticos](#ejemplos-prácticos)
5. [Testing](#testing)
6. [Mejor Prácticas](#mejores-prácticas)
7. [Troubleshooting](#troubleshooting)

---

## Introducción

Este proyecto incluye un sistema completo de autenticación y autorización basado en JWT (JSON Web Tokens).

### ¿Qué es JWT?
Un JWT es un token digitalmente firmado que contiene información del usuario. Se envía en cada solicitud HTTP para validar que el usuario está autenticado.

### Componentes Principales
- **`generateToken()`**: Crea tokens JWT
- **`verifyToken()`**: Valida tokens JWT
- **`authMiddleware`**: Middleware básico de autenticación
- **`requireRole()`**: Middleware de autorización por roles
- **Middlewares avanzados**: Validaciones adicionales (caché, permisos, scopes, etc.)

---

## Configuración Inicial

### 1. Variables de Entorno

Crea un archivo `.env` en la carpeta `backend/`:

```bash
# JWT Configuration
JWT_SECRET=tu_clave_secreta_super_segura_aqui
JWT_EXPIRATION=2h

# Server Configuration
PORT=3000
SERVER_URL=http://localhost:3000

# CORS Configuration
CORS_ORIGIN=http://localhost:5173

# Database Configuration (si aplica)
DATABASE_URL=tu_url_base_de_datos
```

### 2. Instalación de Dependencias

```bash
# En la carpeta backend/
bun install

# Verificar que todas las dependencias estén OK
bun run src/index.ts
```

---

## Middlewares Disponibles

### Middleware Básico: `authMiddleware`

**Ubicación:** `backend/src/middleware/authMiddleware.ts`

**Función:** Valida que el token JWT sea válido y está presente en el header Authorization.

**Errores que Maneja:**
- `401 MISSING_TOKEN`: No hay token en el header
- `401 INVALID_TOKEN_FORMAT`: Formato de Bearer incorrecto
- `401 EMPTY_TOKEN`: Token vacío
- `401 INVALID_TOKEN`: Token con firma inválida
- `401 TOKEN_EXPIRED`: Token expirado

**Ejemplo Básico:**

```typescript
// En tus rutas
import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// Endpoint protegido
router.get('/protected', authMiddleware, (req: AuthRequest, res) => {
  // req.user contiene los datos del usuario del token
  res.json({
    message: 'Acceso autorizado',
    user: req.user
  });
});

export default router;
```

### Middleware Avanzado: `requireRole`

**Función:** Valida que el usuario tenga un rol específico.

**Sintaxis:**

```typescript
router.get('/admin', authMiddleware, requireRole('conserje'), handler);
router.post('/package', authMiddleware, requireRole('residente', 'conserje'), handler);
```

**Roles Disponibles:**
- `conserje`: Administrador del sistema, acceso completo
- `residente`: Usuario regular, acceso limitado

**Ejemplo:**

```typescript
import { requireRole } from '../middleware/authMiddleware';

// Solo conserje puede acceder
router.get('/reports', authMiddleware, requireRole('conserje'), (req: AuthRequest, res) => {
  res.json({ reports: '...' });
});

// Conserje o Residente
router.get('/my-packages', authMiddleware, requireRole('conserje', 'residente'), (req: AuthRequest, res) => {
  res.json({ packages: req.user.packages });
});
```

### Middleware Opcional: `optionalAuthMiddleware`

**Función:** Permite solicitudes con o sin autenticación. Si hay token válido, lo adjunta.

```typescript
// El endpoint funciona de dos formas
router.get('/packages', optionalAuthMiddleware, (req: AuthRequest, res) => {
  if (req.user) {
    // Usuario autenticado: mostrar sus paquetes
    res.json({ packages: userPackages });
  } else {
    // Usuario no autenticado: mostrar paquetes públicos
    res.json({ packages: publicPackages });
  }
});
```

### Middleware Avanzado: `authMiddlewareWithCache`

**Función:** Versión optimizada que cachea tokens validados.

**Beneficios:**
- Reduce overhead de validación criptográfica
- Mejora rendimiento en APIs con alto volumen
- Mantiene seguridad respetando TTL del JWT

```typescript
// En app.ts
import { authMiddlewareWithCache } from './middleware/advancedAuthMiddleware';

app.use(authMiddlewareWithCache); // Para todas las rutas protegidas
```

### Middleware: `validateTokenExpiration`

**Función:** Asegura que el token no expire pronto.

**Caso de Uso:** Operaciones largas que necesitan que el token esté válido por todo el tiempo.

```typescript
// Para operaciones que toman más de 5 minutos
router.post('/generate-report', 
  authMiddleware, 
  validateTokenExpiration(300), // Requiere 5 min mínimo de validez
  async (req: AuthRequest, res) => {
    // Generar reporte...
  }
);
```

### Middleware: `requirePermission`

**Función:** Validación granular de permisos más allá de roles.

```typescript
import { requirePermission } from '../middleware/advancedAuthMiddleware';

// Requiere TODOS los permisos
router.delete('/user/:id', 
  authMiddleware, 
  requirePermission(['delete_users', 'manage_accounts']),
  handler
);

// Requiere CUALQUIERA de los permisos
router.post('/report', 
  authMiddleware, 
  requirePermission(['create_reports', 'edit_reports'], false),
  handler
);
```

---

## Ejemplos Prácticos

### Ejemplo 1: Rutas Públicas vs Protegidas

```typescript
import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// ✅ ENDPOINT PÚBLICO - No requiere token
router.get('/packages', (req, res) => {
  res.json({ 
    packages: getAllPackages(),
    message: 'Accesible sin autenticación'
  });
});

// 🔒 ENDPOINT PROTEGIDO - Requiere token válido
router.get('/my-packages', authMiddleware, (req: AuthRequest, res) => {
  const userPackages = getPackagesByUser(req.user.id);
  res.json({ packages: userPackages });
});

export default router;
```

### Ejemplo 2: Control de Acceso por Roles

```typescript
import { Router } from 'express';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// Solo Conserje
router.get('/admin/reports', 
  authMiddleware, 
  requireRole('conserje'), 
  (req: AuthRequest, res) => {
    res.json({ reports: generateReports() });
  }
);

// Solo Residente
router.get('/my-history', 
  authMiddleware, 
  requireRole('residente'), 
  (req: AuthRequest, res) => {
    res.json({ history: getUserHistory(req.user.id) });
  }
);

// Ambos roles pueden acceder
router.put('/profile', 
  authMiddleware, 
  requireRole('conserje', 'residente'), 
  (req: AuthRequest, res) => {
    updateUserProfile(req.user.id, req.body);
    res.json({ message: 'Perfil actualizado' });
  }
);

export default router;
```

### Ejemplo 3: Manejo de Errores de Autenticación

```typescript
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// Middleware personalizado para manejar errores
router.use((req: AuthRequest, res: Response, next) => {
  // Registrar intentos fallidos
  if (req.path.includes('/protected') && !req.user) {
    console.log(`Intento de acceso sin token: ${req.method} ${req.path}`);
  }
  next();
});

// Endpoint protegido con manejo de errores
router.get('/profile', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userProfile = await fetchUserProfile(req.user.id);
    res.json(userProfile);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Not found')) {
      res.status(404).json({ error: 'Usuario no encontrado' });
    } else {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
});

export default router;
```

### Ejemplo 4: Refresh Tokens (Implementación Básica)

```typescript
import { Router } from 'express';
import { generateToken, verifyToken } from '../utils/jwt';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// Endpoint para obtener nuevo token
router.post('/refresh', authMiddleware, (req: AuthRequest, res) => {
  try {
    // El usuario está autenticado (authMiddleware lo valida)
    // Generar nuevo token
    const newToken = generateToken({
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role
    });

    res.json({
      message: 'Token renovado exitosamente',
      token: newToken,
      expiresIn: '2h'
    });
  } catch (error) {
    res.status(500).json({ error: 'Error renovando token' });
  }
});

export default router;
```

### Ejemplo 5: Integración Completa en app.ts

```typescript
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import protectedRoutes from './routes/protectedRoutes';
import roleBasedRoutes from './routes/roleBasedRoutes';
import { authMiddlewareWithCache } from './middleware/advancedAuthMiddleware';

const app = express();

// Middlewares globales
app.use(express.json());
app.use(cors());

// Ruta pública
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'Servidor activo' });
});

// Rutas de autenticación (público + protegido)
app.use('/auth', authRoutes);

// Rutas protegidas con caché de tokens
app.use('/api/protected', authMiddlewareWithCache, protectedRoutes);

// Rutas protegidas con control por rol
app.use('/api/role-based', authMiddlewareWithCache, roleBasedRoutes);

export { app };
```

---

## Testing

### Ejecutar Tests

```bash
# Test 1: Validación de JWT (generación y verificación)
bun run tests/test-auth.ts

# Test 2: Endpoints protegidos HTTP (requiere servidor corriendo)
# Terminal 1: bun run src/index.ts
# Terminal 2: bun run tests/test-protected-endpoints.ts

# Test 3: Validación completa de JWT (nuevo archivo)
# Terminal 1: bun run src/index.ts
# Terminal 2: bun run tests/test-jwt-validation.ts
```

### Test Manual con cURL

```bash
# 1. Obtener token (asumiendo que ya tienes un endpoint de login)
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  | jq -r '.token')

# 2. Usar token en endpoint protegido
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/protected/profile

# 3. Probar sin token (debe devolver 401)
curl http://localhost:3000/api/protected/profile

# 4. Probar con token inválido
curl -H "Authorization: Bearer invalid.token" \
  http://localhost:3000/api/protected/profile

# 5. Probar sin "Bearer"
curl -H "Authorization: $TOKEN" \
  http://localhost:3000/api/protected/profile
```

### Test con Postman

1. **Crear Colección:** "API Testing"

2. **Pre-request Script** (para obtener token automáticamente):
```javascript
const request = {
  url: 'http://localhost:3000/auth/login',
  method: 'POST',
  header: { 'Content-Type': 'application/json' },
  body: {
    mode: 'raw',
    raw: JSON.stringify({
      email: 'test@example.com',
      password: 'password'
    })
  }
};

pm.sendRequest(request, (err, response) => {
  if (!err) {
    const token = response.json().token;
    pm.environment.set('token', token);
  }
});
```

3. **Headers Setup:**
```
Authorization: Bearer {{token}}
Content-Type: application/json
```

---

## Mejores Prácticas

### 1. ✅ Siempre Valida Tokens en Headers
```typescript
// ✅ CORRECTO: Middleware en rutas protegidas
router.get('/protected', authMiddleware, handler);

// ❌ EVITAR: Confiar en datos del cliente
router.get('/protected', (req, res) => {
  const user = req.body.user; // ¡Inseguro!
});
```

### 2. ✅ Usa Roles para Control de Acceso
```typescript
// ✅ CORRECTO: Control por rol
router.delete('/user/:id', authMiddleware, requireRole('conserje'), handler);

// ❌ EVITAR: Confiar en el cliente para autorización
router.delete('/user/:id', authMiddleware, (req, res) => {
  if (req.body.isAdmin) { // ¡El cliente puede modificar!
    deleteUser(req.params.id);
  }
});
```

### 3. ✅ Expira Tokens Regularmente
```typescript
// En jwt.ts, ya configurado:
return jwt.sign(user, process.env.JWT_SECRET, {
  expiresIn: "2h" // ✅ Token expira cada 2 horas
});
```

### 4. ✅ Guarda JWT_SECRET en Variables de Entorno
```bash
# .env
JWT_SECRET=super_secreta_string_minimo_32_caracteres_aleatorios

# ❌ NUNCA en el código:
const secret = "miSecretaHardcoded"; // ¡Inseguro!
```

### 5. ✅ Maneja Errores de Autenticación Apropiadamente
```typescript
// ✅ CORRECTO: Respuestas claras
res.status(401).json({
  error: 'No autorizado',
  message: 'Token inválido o expirado',
  code: 'INVALID_TOKEN'
});

// ❌ EVITAR: Revelar demasiada información
res.status(401).json({
  error: 'Database error: connection refused...' // ¡Info sensible!
});
```

### 6. ✅ Usa HTTPS en Producción
Los tokens JWT deben viajarse siempre por HTTPS para evitar interception.

```typescript
// Verificar HTTPS en producción
if (process.env.NODE_ENV === 'production' && !req.secure) {
  return res.status(403).json({ error: 'HTTPS requerido' });
}
```

---

## Troubleshooting

### Problema 1: "MISSING_TOKEN" en Todos los Endpoints

**Síntoma:**
```
Error: 401 - No autorizado - Token requerido en header Authorization
```

**Solución:**
Asegúrate de enviar el token en el formato correcto:
```bash
# ❌ INCORRECTO
curl -H "Authorization: token123" http://localhost:3000/api/protected/profile

# ✅ CORRECTO
curl -H "Authorization: Bearer token123" http://localhost:3000/api/protected/profile
```

### Problema 2: "TOKEN_EXPIRED" Frecuentemente

**Síntoma:**
```
Error: 401 - Token expirado
```

**Soluciones:**
1. Aumenta duración del token en `jwt.ts`:
```typescript
expiresIn: "4h" // Cambiar de 2h a 4h
```

2. Implementa refresh tokens (ejemplo en la sección de ejemplos)

### Problema 3: "INVALID_TOKEN" en Endpoint Protegido

**Síntoma:**
```
Error: 401 - Token inválido o corrupido
```

**Causas y Soluciones:**
1. **Token modificado**: Regenerar nuevo token
2. **JWT_SECRET cambió**: Todos los tokens anteriores se invalidan
3. **Token corrupto**: Verificar que no tenga caracteres especiales

### Problema 4: Los Roles No Funcionan

**Síntoma:**
```
Error: 403 - Acceso denegado - Esta funcionalidad solo está disponible para: conserje
```

**Solución:**
Verifica que el token incluya el rol:
```bash
# Decodificar JWT (en jwt.io o script local)
# Debe tener: {"id":1,"email":"user@example.com","role":"conserje"}
```

Si no tiene rol, asegúrate que se asigna en login:
```typescript
// En authController.ts
const token = generateToken({
  id: user.id,
  email: user.email,
  name: user.name,
  role: 'conserje' // ✅ Asignar rol aquí
});
```

### Problema 5: CORS Error con Token

**Síntoma:**
```
CORS policy: Response to preflight request doesn't pass access control checks
```

**Solución:**
Asegúrate que CORS está configurado correctamente en `app.ts`:
```typescript
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"] // ✅ Authorization debe estar
}));
```

---

## Endpoint de Referencia

| Ruta | Método | Autenticación | Rol Requerido | Descripción |
|------|--------|---------------|---------------|------------|
| `/` | GET | ❌ | - | Health check |
| `/auth/google` | POST | ❌ | - | Login con Google |
| `/auth/profile` | GET | ✅ | - | Obtener perfil autenticado |
| `/api/protected/profile` | GET | ✅ | - | Datos del usuario |
| `/api/protected/me` | GET | ✅ | - | Usuario actual |
| `/api/protected/profile` | PUT | ✅ | - | Actualizar perfil |
| `/api/role-based/reports` | GET | ✅ | conserje | Reportes (solo conserje) |
| `/api/role-based/packages` | POST | ✅ | conserje | Crear paquete |

---

## Resumen

✅ **Completado:**
- [x] Middleware básico de autenticación JWT
- [x] Middleware de autorización por roles
- [x] Middleware opcional para autenticación
- [x] Middlewares avanzados (caché, permisos, scopes, etc.)
- [x] Ejemplos prácticos completos
- [x] Tests exhaustivos
- [x] Manejo robusto de errores
- [x] Documentación completa

🚀 **Listo para usar en producción con las mejores prácticas de seguridad.**
