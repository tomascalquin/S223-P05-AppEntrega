# 📖 Backend - Sistema de Encomiendas

Servidor backend para la aplicación de gestión de encomiendas, construido con Bun y MySQL.

---

## 📋 Descripción

Este es el servidor REST API que gestiona todas las operaciones relacionadas con paquetes/encomiendas:
- Recepción de paquetes
- Almacenamiento en base de datos
- Cambios de estado de paquetes
- Consultas de paquetes

**Stack tecnológico:**
- **Runtime**: Bun v1.3.12
- **Base de datos**: MySQL 8
- **Lenguaje**: TypeScript

---

## 🚀 Inicio Rápido

### Iniciar el servidor

```bash
# Con Docker (recomendado)
cd ..
docker-compose up -d backend

# O directamente con Bun
cd backend
bun run src/server.ts
```

El servidor estará disponible en: `http://localhost:3001`

---

## 📚 Estructura de Archivos

```
backend/
├── src/
│   ├── server.ts          # Servidor HTTP con endpoints REST (300+ líneas comentadas)
│   ├── db.ts              # Configuración de conexión MySQL (70+ líneas comentadas)
│   ├── init.sql           # Script de inicialización de BD
│   └── backup_vacio.sql   # Backup vacío de la BD
├── tests/
│   ├── validate-data.ts   # 📝 Validación de integridad en BD (258 líneas comentadas)
│   ├── validate-api.ts    # 📝 Validación de endpoints REST (315 líneas comentadas)
│   └── test-db.ts         # Prueba básica de BD (existente)
├── package.json
├── tsconfig.json
├── dockerfile
└── README.md              # Este archivo
```

---

## 🔌 Endpoints REST API

### 1. GET `/` - Prueba de Conexión
Verifica que el servidor y la BD estén funcionando correctamente.

```bash
curl http://localhost:3001/
```

**Respuesta exitosa:**
```json
{
  "message": "Conexión a MySQL exitosa",
  "result": [{ "test": 1 }]
}
```

---

### 2. POST `/api/packages` - Crear Paquete
Crear un nuevo paquete en la base de datos.

```bash
curl -X POST http://localhost:3001/api/packages \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_name": "Juan García",
    "apartment_number": "101",
    "description": "Paquete electrónico",
    "sender": "Amazon"
  }'
```

**Campos requeridos:**
- `recipient_name`: Nombre del destinatario (máx. 255 caracteres)
- `apartment_number`: Número de apartamento (máx. 50 caracteres)
- `sender`: Remitente del paquete (máx. 255 caracteres)

**Campos opcionales:**
- `description`: Descripción del paquete
- `delivery_date`: Fecha de entrega (formato: YYYY-MM-DD HH:MM:SS)
- `status`: Estado ('received', 'pending', 'delivered') - default: 'received'

**Respuesta exitosa:**
```json
{
  "message": "Paquete insertado exitosamente",
  "id": 1
}
```

---

### 3. GET `/api/packages` - Obtener Todos
Obtener la lista de todos los paquetes (ordenados por fecha más reciente primero).

```bash
curl http://localhost:3001/api/packages
```

**Respuesta:**
```json
{
  "packages": [
    {
      "id": 1,
      "recipient_name": "Juan García",
      "apartment_number": "101",
      "description": "Paquete electrónico",
      "sender": "Amazon",
      "delivery_date": null,
      "status": "received",
      "created_at": "2026-04-18 02:40:55"
    }
  ]
}
```

---

### 4. GET `/api/packages/:id` - Obtener Uno
Obtener los detalles de un paquete específico.

```bash
curl http://localhost:3001/api/packages/1
```

**Respuesta exitosa:**
```json
{
  "package": {
    "id": 1,
    "recipient_name": "Juan García",
    "apartment_number": "101",
    "description": "Paquete electrónico",
    "sender": "Amazon",
    "delivery_date": null,
    "status": "received",
    "created_at": "2026-04-18 02:40:55"
  }
}
```

**Errores posibles:**
- `404`: Paquete no encontrado

---

### 5. PUT `/api/packages/:id` - Actualizar
Actualizar campos de un paquete existente (especialmente el estado).

```bash
curl -X PUT http://localhost:3001/api/packages/1 \
  -H "Content-Type: application/json" \
  -d '{ "status": "delivered" }'
```

**Campos actualizables:**
- `recipient_name`
- `apartment_number`
- `description`
- `sender`
- `delivery_date`
- `status`

**Nota**: Se puede actualizar cualquier combinación de campos. Al menos uno es requerido.

**Respuesta exitosa:**
```json
{
  "message": "Paquete actualizado exitosamente",
  "id": "1"
}
```

---

### 6. DELETE `/api/packages/:id` - Eliminar
Eliminar un paquete de la base de datos.

```bash
curl -X DELETE http://localhost:3001/api/packages/1
```

**Respuesta exitosa:**
```json
{
  "message": "Paquete eliminado exitosamente",
  "id": "1"
}
```

**Errores posibles:**
- `404`: Paquete no encontrado

---

## 🧪 Scripts de Validación

Se incluyen dos scripts TypeScript para validar la integridad del sistema:

### 1. `validate-data.ts` - Validación de Base de Datos

**Propósito**: Valida que los datos se guarden correctamente en MySQL sin pasar por la API.

**Qué prueba:**
- ✅ Inserción de 4 paquetes de prueba
- ✅ Recuperación de datos desde BD
- ✅ Cambios de estado (received → pending → delivered → received)
- ✅ Validación de campos obligatorios
- ✅ Validación de estados válidos
- ✅ Validación de fechas de creación
- ✅ Consistencia de datos

**Ejecución:**
```bash
cd backend
bun tests/validate-data.ts
```

**Salida esperada:**
```
✅ CONEXIÓN EXITOSA A MYSQL
✅ 4 paquetes insertados
✅ Cambios de estado fueron exitosos
✅ Todos los datos son consistentes
```

**Tiempo de ejecución**: ~2-3 segundos

**Características:**
- 258 líneas de código comentado
- Sin dependencias externas (solo conexión a BD)
- Ideal para CI/CD

---

### 2. `validate-api.ts` - Validación de Endpoints REST

**Propósito**: Valida que todos los endpoints REST funcionen correctamente y mantengan integridad.

**Qué prueba:**
- ✅ Conectividad del servidor
- ✅ POST /api/packages (CREATE)
- ✅ GET /api/packages (READ todos)
- ✅ GET /api/packages/:id (READ uno)
- ✅ PUT /api/packages/:id (UPDATE)
- ✅ DELETE /api/packages/:id (DELETE)
- ✅ Validaciones de entrada (400, 404)
- ✅ Integridad de datos en BD

**Ejecución:**
```bash
cd backend
bun tests/validate-api.ts
```

**Salida esperada:**
```
✅ Servidor respondiendo: OK
✅ Se crearon 3 paquetes
✅ Todos los endpoints funcionan
✅ Integridad de datos: OK
```

**Tiempo de ejecución**: ~3-5 segundos

**Características:**
- 315 líneas de código comentado
- Pruebas CRUD completas
- Verifica sincronización BD ↔ API
- Ideal para validación antes de deploy

---

## 🐛 Ejecutar Ambas Validaciones

Para una validación completa del sistema:

```bash
cd backend

# Validar base de datos
echo "=== Validando integridad de BD ==="
bun tests/validate-data.ts

# Validar API
echo "=== Validando endpoints REST ==="
bun tests/validate-api.ts
```

**Resultado esperado:**
- Ambos scripts terminan con ✅ sin errores
- Tiempo total: ~5-8 segundos
- Sistema listo para producción

---

## 📊 Estructura de Datos - Tabla `packages`

```sql
CREATE TABLE packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipient_name VARCHAR(255) NOT NULL,      -- Nombre destinatario
  apartment_number VARCHAR(50) NOT NULL,     -- Apartamento
  description TEXT,                          -- Descripción (opcional)
  sender VARCHAR(255) NOT NULL,              -- Remitente
  delivery_date TIMESTAMP NULL,              -- Fecha entrega (opcional)
  status ENUM('received','pending','delivered') DEFAULT 'received',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Estados de Paquetes

| Estado | Significado | Transición |
|--------|------------|-----------|
| `received` | Paquete recibido en conserje | → pending |
| `pending` | Esperando entrega al residente | → delivered |
| `delivered` | Entregado al destinatario | → (fin) |

---

## ⚙️ Configuración del Entorno

### Variables de Entorno (.env)

```env
# Base de datos
DB_HOST=db
DB_PORT=3306
DB_USER=root
DB_PASSWORD=clave123
DB_NAME=appdb

# Servidor
PORT=3001
```

### En Docker

Las variables se definen en `docker-compose.yml`:

```yaml
backend:
  environment:
    - DB_HOST=db
    - DB_PORT=3306
    - DB_USER=root
    - DB_PASSWORD=clave123
    - DB_NAME=appdb
```

---

## 🛠️ Desarrollo

### Instalar dependencias

```bash
cd backend
bun install
```

### Ejecutar servidor en desarrollo

```bash
bun run src/server.ts
```

### Ver logs del servidor

```bash
# En Docker
docker-compose logs -f backend

# Ver últimas 50 líneas
docker-compose logs -f --tail=50 backend
```

---

## 📝 Comentarios en el Código

Todos los archivos incluyen comentarios detallados:

| Archivo | Líneas comentadas | Cobertura |
|---------|------------------|-----------|
| `server.ts` | 300+ | Todos los endpoints y validaciones |
| `db.ts` | 70+ | Configuración de conexión |
| `validate-data.ts` | 258 | Cada paso de validación |
| `validate-api.ts` | 315 | Cada operación CRUD |

**Lectura recomendada:**
1. `db.ts` - Entiende la conexión a BD
2. `server.ts` - Entiende los endpoints
3. `validate-data.ts` - Entiende flujo de datos
4. `validate-api.ts` - Entiende integración

---

## 🐳 Docker

### Construir imagen

```bash
cd ..
docker-compose build backend
```

### Iniciar con Docker Compose

```bash
# Iniciar backend, db y frontend
docker-compose up -d

# Especificar solo backend
docker-compose up -d backend

# Ver logs
docker-compose logs -f backend
```

### Reconstruir después de cambios de código

```bash
docker-compose up -d --build backend
```

---

## 🔍 Debugging

### Errores comunes

#### Error: "Field 'apartment_number' doesn't have a default value"
**Causa**: Estructura de tabla incompleta  
**Solución**: Reconstruir backend
```bash
docker-compose up -d --build backend
```

#### Error: "Can't connect to MySQL"
**Causa**: MySQL no está corriendo o las credenciales son incorrectas  
**Solución**: Verificar Docker y variables de entorno
```bash
docker-compose ps
docker-compose logs db
```

#### API no responde
**Causa**: Servidor no está corriendo  
**Solución**: Reiniciar
```bash
docker-compose restart backend
# O si corre localmente
bun run src/server.ts
```

---

## 📊 Monitoreo

### Verificar salud del servidor

```bash
# Responde exitosamente si está bien
curl http://localhost:3001/

# Debe devolver:
# {"message":"Conexión a MySQL exitosa","result":[{"test":1}]}
```

### Conteo de paquetes

```bash
curl http://localhost:3001/api/packages | jq '.packages | length'
```

### Ver último paquete

```bash
curl http://localhost:3001/api/packages | jq '.packages[0]'
```

---

## 🚀 Próximas Mejoras

- [ ] Agregar autenticación (JWT)
- [ ] Agregar paginación en GET /api/packages
- [ ] Agregar filtrado por estado
- [ ] Agregar historial de cambios
- [ ] Agregar índices en BD para optimizar
- [ ] Agregar soft delete (marcar como eliminado)
- [ ] Agregar rate limiting

---

## 📞 Soporte

Para reportar problemas o sugerir mejoras, revisa los comentarios en:
- `backend/src/server.ts` - Documentación de endpoints
- `backend/src/db.ts` - Documentación de conexión
- `backend/tests/validate-*.ts` - Ejemplos de uso

---

**Última actualización**: 18 de Abril de 2026  
**Estado**: ✅ Completamente documentado y validado
