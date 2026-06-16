# 🚀 Guía Rápida: Sistema de Autenticación JWT

## 5 Minutos para Empezar

### 1️⃣ Configuración (1 min)

```bash
# Verificar que .env tiene estas variables
# backend/.env
JWT_SECRET=mi_clave_secreta_para_jwt_12345
JWT_EXPIRATION=2h
JWT_REFRESH_EXPIRATION=7d
DB_HOST=localhost
DB_NAME=appdb
```

### 2️⃣ Base de Datos (1 min)

```bash
# Ejecutar desde cliente MySQL o DBeaver
cd backend
SOURCE src/init.sql;

# O crear tablas manualmente (ver init.sql)
```

### 3️⃣ Instalar y Ejecutar (2 min)

```bash
# Backend
cd backend
bun install
bun run dev

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev
```

### 4️⃣ Probar (1 min)

```bash
# Terminal 1: Backend ejecutándose en :3001

# Terminal 2: Hacer requests
# REGISTRO
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456","name":"Test"}'

# Respuesta:
# {
#   "message": "Usuario registrado exitosamente",
#   "data": {
#     "accessToken": "eyJ...",
#     "refreshToken": "eyJ...",
#     "user": {...}
#   }
# }

# LOGIN
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456"}'

# Usar token en rutas protegidas
curl http://localhost:3001/auth/profile \
  -H "Authorization: Bearer eyJ..."
```

---

## 📚 Documentos Principales

| Archivo | Descripción |
|---------|-------------|
| [JWT_IMPLEMENTATION_COMPLETE.md](JWT_IMPLEMENTATION_COMPLETE.md) | Documentación completa con todos los detalles |
| [JWT_PRACTICAL_GUIDE.md](JWT_PRACTICAL_GUIDE.md) | Guía práctica con ejemplos |
| [JWT_SYSTEM_COMPLETE.md](JWT_SYSTEM_COMPLETE.md) | Resumen de implementación |
| [.env.example](.env.example) | Plantilla de configuración |

---

## 🔐 Endpoints Disponibles

### Públicos (sin autenticación)
```
POST /auth/register          # Crear usuario
POST /auth/login             # Login con email/contraseña
POST /auth/refresh-token     # Renovar access token
POST /auth/google            # Login con Google
```

### Protegidos (requieren token)
```
GET  /auth/profile           # Ver perfil del usuario
POST /auth/logout            # Cerrar sesión
```

---

## 💡 Estructura del Token

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwi...
                       ┌────────────────────────────────────────────┘
                       │ Token JWT con 3 partes separadas por puntos
                       
Header.Payload.Signature
```

**Payload contiene:**
- `id`: ID del usuario
- `email`: Email del usuario  
- `name`: Nombre completo
- `role`: "conserje" o "residente"
- `iat`: Fecha creación
- `exp`: Fecha vencimiento

---

## ⏱️ Ciclo de Vida del Token

```
✨ Creación
    ↓
⏰ Válido por 2 horas
    ↓
❌ Expira
    ↓
🔄 Usa refresh-token para obtener nuevo access-token
    ↓
✨ Nuevo access-token válido por 2h más
```

---

## 🔑 Ejemplo Completo (Frontend)

```javascript
// 1. REGISTRARSE
const register = async () => {
  const response = await fetch('http://localhost:3001/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'usuario@example.com',
      password: 'password123',
      name: 'Juan Pérez'
    })
  });
  
  const data = await response.json();
  localStorage.setItem('accessToken', data.data.accessToken);
  localStorage.setItem('refreshToken', data.data.refreshToken);
};

// 2. HACER PETICIÓN PROTEGIDA
const fetchProfile = async () => {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch('http://localhost:3001/auth/profile', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (response.status === 401) {
    // Token expirado, renovar
    const newToken = await refreshToken();
    return fetchProfile(); // Reintentar
  }
  
  return response.json();
};

// 3. RENOVAR TOKEN
const refreshToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  
  const response = await fetch('http://localhost:3001/auth/refresh-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  
  const data = await response.json();
  localStorage.setItem('accessToken', data.data.accessToken);
  
  return data.data.accessToken;
};

// 4. LOGOUT
const logout = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.location.href = '/login';
};
```

---

## 🧪 Ejecutar Tests

```bash
# Tests JWT completos
bun run test-jwt

# Todos los tests
bun run test:all

# Ver output detallado
bun run test-jwt 2>&1 | tee test-output.log
```

---

## ⚙️ Configuración Recomendada

### Desarrollo
```bash
JWT_EXPIRATION=2h
JWT_REFRESH_EXPIRATION=7d
NODE_ENV=development
```

### Producción
```bash
JWT_EXPIRATION=1h
JWT_REFRESH_EXPIRATION=30d
NODE_ENV=production
# JWT_SECRET debe ser aleatorio y seguro
```

---

## 🐛 Errores Comunes

### Error: "JWT_SECRET no está configurado"
```bash
✅ Solución: Agregar a .env:
JWT_SECRET=tu_clave_secreta_aqui
```

### Error: "Token expired" (401)
```javascript
✅ Solución en Frontend:
if (response.status === 401) {
  const newToken = await refreshToken();
  // Reintentar petición original
}
```

### Error: "Credenciales inválidas"
```bash
✅ Verifica:
- Email correcto
- Contraseña correcta (case-sensitive)
- Usuario registrado primero
```

### Error: "Database connection failed"
```bash
✅ Verifica .env:
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=clave123
DB_NAME=appdb
```

---

## 📊 Comparación: Antes vs Después

| Aspecto | Antes | Después |
|--------|-------|---------|
| Autenticación | Google OAuth solo | Google + Credenciales |
| Persistencia | Datos en memoria | Base de datos MySQL |
| Contraseñas | N/A | Hasheadas con bcryptjs |
| Token | Básico | Payload estructurado |
| Expiración | Fija (2h) | Configurable en .env |
| Renovación | No | Refresh tokens (7d) |
| Documentación | Mínima | Completa |
| Tests | Básicos | Completos |

---

## 🎯 Próximo Paso

Después de que funcione la autenticación:

1. **Proteger rutas del frontend** con AuthContext
2. **Agregar roles dinámicos** en rutas protegidas
3. **Implementar 2FA** (autenticación de dos factores)
4. **Agregar auditoría** de intentos de login
5. **Rate limiting** para prevenir ataques

---

## 📞 Recursos

- **Documentación JWT**: [JWT_IMPLEMENTATION_COMPLETE.md](JWT_IMPLEMENTATION_COMPLETE.md)
- **Middleware Avanzado**: [JWT_MIDDLEWARE_GUIDE.md](JWT_MIDDLEWARE_GUIDE.md)
- **Control de Roles**: [ROLE_BASED_ACCESS.md](ROLE_BASED_ACCESS.md)

---

**¡Listo! Tu sistema de autenticación JWT está funcionando. 🎉**
