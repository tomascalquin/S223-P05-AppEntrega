# 🔐 Sistema de Autenticación JWT - Documentación Completa

## 📋 Tabla de Contenidos
1. [Overview](#overview)
2. [Endpoints](#endpoints)
3. [Payload del Token](#payload-del-token)
4. [Expiración](#expiración)
5. [Ejemplos de Uso](#ejemplos-de-uso)
6. [Configuración](#configuración)
7. [Base de Datos](#base-de-datos)

---

## Overview

El sistema de autenticación JWT proporciona:
- ✅ Registro de usuarios con contraseña hasheada
- ✅ Login con credenciales (email/contraseña)
- ✅ Login con Google OAuth
- ✅ Renovación de tokens (Refresh Token)
- ✅ Middleware de autenticación
- ✅ Control basado en roles (RBAC)
- ✅ Persistencia en MySQL

---

## Endpoints

### 1️⃣ POST /auth/register
**Crear nuevo usuario**

```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@example.com",
    "password": "contraseña123",
    "name": "Juan Pérez",
    "username": "juanperez",
    "role": "residente"
  }'
```

**Respuesta exitosa (201):**
```json
{
  "message": "Usuario registrado exitosamente",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "usuario@example.com",
      "name": "Juan Pérez",
      "role": "residente",
      "username": "juanperez"
    }
  }
}
```

**Errores:**
- `400`: Email/contraseña/nombre faltantes
- `400`: Contraseña < 6 caracteres
- `400`: Email formato inválido
- `409`: Email ya registrado

---

### 2️⃣ POST /auth/login
**Iniciar sesión con credenciales**

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@example.com",
    "password": "contraseña123"
  }'
```

**Respuesta exitosa (200):**
```json
{
  "message": "Inicio de sesión exitoso",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "usuario@example.com",
      "name": "Juan Pérez",
      "role": "residente"
    }
  }
}
```

**Errores:**
- `400`: Email o contraseña faltantes
- `401`: Credenciales inválidas
- `403`: Usuario inactivo

---

### 3️⃣ POST /auth/refresh-token
**Renovar Access Token**

```bash
curl -X POST http://localhost:3001/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

**Respuesta exitosa (200):**
```json
{
  "message": "Token renovado exitosamente",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "usuario@example.com",
      "name": "Juan Pérez",
      "role": "residente"
    }
  }
}
```

---

### 4️⃣ POST /auth/google
**Iniciar sesión con Google OAuth**

```bash
curl -X POST http://localhost:3001/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "token": "google_id_token_aqui",
    "role": "residente"
  }'
```

---

### 5️⃣ GET /auth/profile
**Obtener perfil del usuario autenticado**

```bash
curl http://localhost:3001/auth/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Payload del Token

### Access Token
El payload del JWT contiene:

```json
{
  "id": 1,
  "email": "usuario@example.com",
  "name": "Juan Pérez",
  "role": "residente",
  "username": "juanperez",
  "iat": 1718467200,
  "exp": 1718474400
}
```

**Campos:**
- `id`: ID único del usuario
- `email`: Email del usuario
- `name`: Nombre completo
- `role`: Rol del usuario (conserje | residente)
- `username`: Nombre de usuario (opcional)
- `iat`: Issued At (fecha creación, en segundos)
- `exp`: Expiration (fecha vencimiento, en segundos)

### Estructura Completa del JWT

Un JWT tiene 3 partes separadas por puntos:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwi...truncado.TJVA95OrM7E2cBab30RMHr...truncado
```

1. **Header** (base64): `{"alg":"HS256","typ":"JWT"}`
2. **Payload** (base64): Datos del usuario
3. **Signature**: Firma digital con JWT_SECRET

---

## Expiración

### Configuración en .env

```bash
JWT_EXPIRATION=2h              # Access Token: 2 horas
JWT_REFRESH_EXPIRATION=7d      # Refresh Token: 7 días
```

### Tiempos Válidos

- Segundos: `"3600"` o `3600`
- Minutos: `"30m"`
- Horas: `"2h"`, `"24h"`
- Días: `"7d"`, `"30d"`
- Semanas: `"1w"`

### Flujo de Renovación

```
┌─────────────────────────────────────────────────┐
│ 1. Usuario hace login                            │
│    └─ Obtiene accessToken (2h) + refreshToken    │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ 2. Usa accessToken en peticiones                 │
│    └─ Header: Authorization: Bearer <token>     │
└─────────────────────────────────────────────────┘
              ↓
       (después de 2 horas)
              ↓
┌─────────────────────────────────────────────────┐
│ 3. AccessToken expira (401 TokenExpiredError)   │
│    └─ Frontend detecta error                     │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ 4. Frontend usa POST /auth/refresh-token         │
│    └─ Envía refreshToken                        │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ 5. Obtiene nuevo accessToken                    │
│    └─ Refresh token sigue válido por 5 días    │
└─────────────────────────────────────────────────┘
```

---

## Ejemplos de Uso

### Flujo Completo en Frontend (JavaScript)

```javascript
// 1. REGISTRO
async function register(email, password, name) {
  const response = await fetch('http://localhost:3001/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name })
  });
  
  const data = await response.json();
  
  // Guardar tokens en localStorage
  localStorage.setItem('accessToken', data.data.accessToken);
  localStorage.setItem('refreshToken', data.data.refreshToken);
  
  return data.data.user;
}

// 2. LOGIN
async function login(email, password) {
  const response = await fetch('http://localhost:3001/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  
  localStorage.setItem('accessToken', data.data.accessToken);
  localStorage.setItem('refreshToken', data.data.refreshToken);
  
  return data.data.user;
}

// 3. HACER PETICIÓN CON TOKEN
async function fetchProtected(endpoint) {
  const accessToken = localStorage.getItem('accessToken');
  
  let response = await fetch(`http://localhost:3001${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  // Si token expiró
  if (response.status === 401) {
    // Renovar token
    const newAccessToken = await refreshToken();
    
    // Reintentar petición
    response = await fetch(`http://localhost:3001${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${newAccessToken}`
      }
    });
  }
  
  return response.json();
}

// 4. RENOVAR TOKEN
async function refreshToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  
  const response = await fetch('http://localhost:3001/auth/refresh-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  
  const data = await response.json();
  
  const newAccessToken = data.data.accessToken;
  localStorage.setItem('accessToken', newAccessToken);
  
  return newAccessToken;
}

// 5. LOGOUT
function logout() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  // Redirigir a login
  window.location.href = '/login';
}
```

---

## Configuración

### Variables de Entorno (.env)

```bash
# JWT
JWT_SECRET=mi_clave_secreta_para_jwt_12345
JWT_EXPIRATION=2h
JWT_REFRESH_EXPIRATION=7d

# Google OAuth
GOOGLE_CLIENT_ID=156919733559-vr6q4blfh3ckmc4u4ul1b02epercl20k.apps.googleusercontent.com

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=appdb
DB_USER=root
DB_PASSWORD=clave123

# Server
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

### Generador de JWT_SECRET Seguro

```bash
# Opción 1: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Opción 2: OpenSSL
openssl rand -hex 32

# Opción 3: Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

---

## Base de Datos

### Tabla: users

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(100),
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role ENUM('conserje', 'residente') DEFAULT 'residente',
  picture VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
);
```

### Tabla: refresh_tokens

```sql
CREATE TABLE refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at)
);
```

---

## Códigos de Error

| Código | Significado | Solución |
|--------|-------------|----------|
| 400 | Datos faltantes o inválidos | Verifica la solicitud |
| 401 | Credenciales inválidas | Revisa email/contraseña |
| 401 | Token expirado | Usa refresh-token |
| 401 | Token inválido | Verifica el header Authorization |
| 403 | Usuario inactivo | Contacta administrador |
| 409 | Email ya registrado | Usa otro email |
| 500 | Error del servidor | Revisa logs |

---

## Testing

### Con cURL

```bash
# Registro
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test User"}'

# Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Profile (requiere token)
curl http://localhost:3001/auth/profile \
  -H "Authorization: Bearer TOKEN_AQUI"
```

---

## Mejores Prácticas

✅ **DO:**
- Usar HTTPS en producción
- Guardar JWT en localStorage o sessionStorage
- Validar token en cada petición protegida
- Renovar token antes de que expire
- Usar refresh tokens para mayor seguridad
- Hashear contraseñas con bcryptjs

❌ **DON'T:**
- Guardar JWT en cookies (sin httpOnly)
- Exponer JWT_SECRET
- Usar expiración demasiado larga
- Confiar en cliente para validación
- Guardar contraseñas en texto plano

---

## Troubleshooting

### "JWT_SECRET no está configurado"
→ Asegúrate de tener `.env` en `/backend/` con `JWT_SECRET=...`

### "Token expirado"
→ Usa refresh token para obtener uno nuevo

### "Token inválido"
→ Verifica el formato: `Authorization: Bearer <token>`

### "Usuario no encontrado"
→ Registra el usuario primero

### "Contraseña incorrecta"
→ Usa la contraseña correcta (case-sensitive)
