# 🚀 Guía Rápida de Referencia - Sistema de Encomiendas

**Documento de referencia rápida para desarrolladores**

---

## 📍 Ubicaciones Clave

| Archivo | Ubicación | Propósito |
|---------|-----------|----------|
| Servidor | `backend/src/server.ts` | Endpoints REST API (300+ líneas comentadas) |
| Base de datos | `backend/src/db.ts` | Conexión MySQL (70+ líneas comentadas) |
| Validación BD | `backend/tests/validate-data.ts` | Pruebas de integridad (258 líneas comentadas) |
| Validación API | `backend/tests/validate-api.ts` | Pruebas de endpoints (315 líneas comentadas) |
| Documentación | `backend/README.md` | Guía completa del backend |
| Reporte | `VALIDACION_DATOS.md` | Reporte de validación (comprensivo) |

---

## 🔄 Flujo Rápido de Desarrollo

### 1️⃣ Cambiar Código
```bash
# Editar archivo (ej: backend/src/server.ts)
```

### 2️⃣ Reconstruir Backend
```bash
cd c:\Users\pfmv2\OneDrive\Documentos\GitHub\S223-P05-AppEntrega
docker-compose up -d --build backend
```

### 3️⃣ Validar Cambios
```bash
cd backend

# Validar BD
bun tests/validate-data.ts

# Validar API
bun tests/validate-api.ts
```

### 4️⃣ Ver Logs
```bash
docker-compose logs -f backend
```

---

## 📋 Endpoints REST - Referencia Rápida

### Crear Paquete
```bash
POST /api/packages
{
  "recipient_name": "Juan",
  "apartment_number": "101",
  "sender": "Amazon"
}
→ { "id": 1 }
```

### Obtener Todos
```bash
GET /api/packages
→ { "packages": [...] }
```

### Obtener Uno
```bash
GET /api/packages/1
→ { "package": {...} }
```

### Actualizar
```bash
PUT /api/packages/1
{ "status": "delivered" }
→ { "message": "OK", "id": "1" }
```

### Eliminar
```bash
DELETE /api/packages/1
→ { "message": "OK", "id": "1" }
```

---

## 🧪 Testing - Referencia Rápida

### Validación Completa del Sistema
```bash
cd backend

# 1. Validar almacenamiento en BD
echo "=== Integridad de Base de Datos ===" 
bun tests/validate-data.ts

# 2. Validar endpoints REST
echo "=== Endpoints REST API ==="
bun tests/validate-api.ts
```

### Qué valida cada script

| Script | Pruebas | Tiempo |
|--------|---------|--------|
| `validate-data.ts` | Inserción, recuperación, cambios de estado, integridad | 2-3s |
| `validate-api.ts` | CRUD completo, validaciones, sincronización BD | 3-5s |

---

## 🐳 Docker - Comandos Esenciales

```bash
# Iniciar todos los servicios
docker-compose up -d

# Ver estado
docker-compose ps

# Ver logs
docker-compose logs -f backend

# Reconstruir backend
docker-compose up -d --build backend

# Detener todo
docker-compose down

# Detener y eliminar volúmenes (resetea BD)
docker-compose down -v
```

---

## 🔧 Configuración - Variables Clave

### Conexión MySQL
```
DB_HOST=db
DB_PORT=3306
DB_USER=root
DB_PASSWORD=clave123
DB_NAME=appdb
```

### Servidor
```
PORT=3001
```

---

## 📊 Estructura de Tabla

```sql
-- Tabla principal
packages (
  id INT PRIMARY KEY,                    -- Auto-increment
  recipient_name VARCHAR(255) NOT NULL,  -- Nombre destinatario
  apartment_number VARCHAR(50) NOT NULL, -- Apartamento
  description TEXT,                      -- Descripción (nullable)
  sender VARCHAR(255) NOT NULL,          -- Remitente
  delivery_date TIMESTAMP NULL,          -- Fecha entrega (nullable)
  status ENUM(...) DEFAULT 'received',   -- received, pending, delivered
  created_at TIMESTAMP AUTO               -- Timestamp automático
)
```

---

## 🎯 Estados de Paquete

```
received  ──→  pending  ──→  delivered
   ↑                              │
   └──────────────────────────────┘
         (puede volver si es necesario)
```

---

## 🔍 Debugging Rápido

| Problema | Solución |
|----------|----------|
| "apartment_number doesn't have a default value" | `docker-compose up -d --build backend` |
| API no responde | `docker-compose ps` y `docker-compose logs backend` |
| BD sin conexión | Verificar `docker-compose ps` y credenciales en `.env` |
| Cambios de código no se aplican | Reconstruir: `docker-compose up -d --build backend` |

---

## 📝 Comentarios en el Código

Todos los archivos están documentados:

### `server.ts` (300+ líneas de comentarios)
```typescript
// Buscar por: ENDPOINT, PASO, VALIDACIÓN
// Cada endpoint tiene:
// - Propósito
// - Parámetros
// - Respuesta exitosa
// - Códigos de error
```

### `db.ts` (70+ líneas de comentarios)
```typescript
// Buscar por: VARIABLES DE ENTORNO, POOL, EXPORTACIÓN
// Explica:
// - Configuración de conexión
// - Pool de conexiones
// - Variables de entorno
```

### `validate-data.ts` (258 líneas)
```typescript
// Buscar por: PASO 1-5
// Valida:
// - Inserción
// - Almacenamiento
// - Cambios de estado
// - Consistencia
```

### `validate-api.ts` (315 líneas)
```typescript
// Buscar por: PASO 1-8
// Prueba:
// - Conectividad
// - CRUD operations
// - Validaciones
// - Integridad
```

---

## ✅ Checklist - Antes de Producción

- [ ] Ejecutar `validate-data.ts` ✅
- [ ] Ejecutar `validate-api.ts` ✅
- [ ] Ver `docker-compose logs backend` sin errores ✅
- [ ] Probar `curl http://localhost:3001/` OK ✅
- [ ] Base de datos sincronizada con API ✅
- [ ] Estados de paquete funcionan correctamente ✅
- [ ] Manejo de errores (404, 400) ✅
- [ ] Comentarios de código revisados ✅

---

## 🚀 Comandos Útiles

### Conectar a la BD directamente
```bash
# Via Docker
docker-compose exec db mysql -u root -p appdb

# Contraseña: clave123
```

### Ver todos los paquetes
```sql
SELECT * FROM packages ORDER BY created_at DESC;
```

### Contar por estado
```sql
SELECT status, COUNT(*) as cantidad FROM packages GROUP BY status;
```

### Resetear BD (eliminar todos los paquetes)
```sql
DELETE FROM packages;
ALTER TABLE packages AUTO_INCREMENT = 1;
```

---

## 📚 Lectura Recomendada

**Orden sugerido:**
1. Este archivo (Quick Reference) - 5 min
2. `backend/README.md` - Guía completa - 15 min
3. `backend/src/db.ts` - Conexión - 10 min
4. `backend/src/server.ts` - Endpoints - 20 min
5. `backend/tests/validate-data.ts` - Flujo BD - 15 min
6. `backend/tests/validate-api.ts` - Integración - 15 min
7. `VALIDACION_DATOS.md` - Reporte final - 20 min

**Tiempo total**: ~1.5 horas para entender completamente

---

## 🔗 Referencias Externas

- **Bun**: https://bun.sh
- **MySQL2 for Promises**: https://github.com/sidorares/node-mysql2
- **TypeScript**: https://www.typescriptlang.org

---

## 💡 Tips & Tricks

### Ver estado en tiempo real
```bash
watch -n 1 'curl -s http://localhost:3001/api/packages | jq ".packages | length"'
```

### Resetear sistema completo
```bash
docker-compose down -v  # Elimina volúmenes (resetea BD)
docker-compose up -d    # Reinicia limpio
docker-compose logs -f  # Ver logs mientras se inicia
```

### Ejecutar ambas validaciones en paralelo
```bash
cd backend
(bun tests/validate-data.ts &) && (sleep 1 && bun tests/validate-api.ts)
```

---

## 📞 Contacto / Soporte

**Problemas encontrados:**
- Revisar comentarios en archivos `.ts`
- Ver logs: `docker-compose logs backend`
- Reconstruir: `docker-compose up -d --build backend`
- Reset completo: `docker-compose down -v && docker-compose up -d`

---

**Última actualización**: 18 de Abril de 2026  
**Estado**: ✅ Sistema completamente documentado y validado  
**Autor**: Sistema de validación automático
