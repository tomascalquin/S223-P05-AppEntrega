# RecepBox
## Integrantes
| Nombre           | GitHub |
|------------------|--------|
| Benjamín Vega    | @bnjvega999 |
| Patricia Francia | @patifrancia |
| Pablo Morales    | @pab212 |
# Descripción
RecepBox es una aplicación diseñada para optimizar la recepción y entrega de encomiendas en edificios residenciales o corporativos. Permite registrar envíos, hacer seguimiento y notificar a los destinatarios. Para así mejorar la organización , reducir errores y aumentar la trazabilidad del proceso.

# Requisitos necesarios

- Docker y Docker Compose (para entorno en contendor)
- Bun
# Instalación y ejecución
## Bun (local)
```bash
bun install
bun run dev
```
- Para correr Frontend sin problemas
```bash
cd frontend
npm.cmd install
npm.cmd run dev
bun add react-router-dom
npm install typesafe-i18n
```

## Docker
### Para levantar el contenedor (local)
```bash
docker compose up 
```
# Uso
La aplicación permite:

- Registrar paquetes recibidos en conserjería.
- Notificar a los residentes.
- Llevar un historial de recibos y entregas.
- Gestionar el estado de cada paquete.
## Configuración
1. Copiar el archivo `.env.example`:
   ```bash
   cp .env.example .env
# Política de ramas
## Ramas principales

- `main`: contiene código estable y listo para la producción
**No se permite hacer push directamente a esta rama (sólo recibe cambios desde `develop`)**
- `develop`: rama principal de desarrollo, aquí se integran todas las nuevas funcionalidades antes de pasar a `main`. Puede contener código en progreso (no necesariamente estable)
## Reglas importantes
- **No hacer push directo a `main`**
- **No hacer PR directo de feat a `main`**
- Todas las ramas nacen de `develop`
- `develop` concentra el desarrollo activo
- `main` siempre tiene que estar estable
## Tipos de ramas
| Tipo de rama | Formato                     | Descripción                     |
|--------------|-----------------------------|---------------------------------|
| Feat         | `feat/nombre-funcionalidad` | Nuevas funcionalidades          |
| Fix          | `fix/descripcion-error`     | Corrección de errores           |
| Hotfix       | `hotfix/descripcion`        | Correcciones urgentes           |
> **Nota:** Para elegir el nombre de la rama, ver el número del problema en GitHub Projects.
# Flujo de trabajo
## Pasos:
1. Crear una rama desde `develop` (siempre hacer pull en `develop`)
```bash
git checkout develop
git pull
git checkout -b feat/ejemplo
```
2. Desarrollar funcionalidad y hacer commit
3. Subir la rama al repositorio
4. Crear un Pull Request hacia develop (**asegurarse que este en `develop`**)
5. Revisar el código
6. Hacer merge a `develop` si es aprobado
7. Cuando `develop` este estable, crear PR desde `develop` a `main`
8. Hacer merge a `main`
9. Eliminar rama utilizada
