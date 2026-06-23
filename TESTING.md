# Testing

Este proyecto separa las pruebas en tres grupos para no mezclar cobertura unitaria con flujos que dependen de infraestructura.

Desde la raiz se puede ejecutar la suite unitaria completa:

```bash
bun run test
```

## Frontend

Las pruebas unitarias del frontend viven junto al codigo que validan:

- `frontend/src/services/*.test.ts`
- `frontend/src/context/*.test.tsx`
- `frontend/src/pages/*.test.tsx`
- `frontend/src/test/setupTests.ts`

Comandos:

```bash
cd frontend
bun run test
bun run test:watch
bun run test:coverage
```

La suite usa Vitest, React Testing Library y jsdom. Los tests mockean `fetch`, `localStorage`, navegacion, contextos y servicios cuando corresponde, para no depender del backend, MySQL ni `bun run dev`.

## Backend

Las pruebas unitarias formales viven en:

- `backend/tests/unit/*.test.ts`

Comandos:

```bash
cd backend
bun run test
bun run test:unit
```

La suite usa `bun test`, coherente con el runtime del backend. Estas pruebas no levantan servidor ni se conectan a MySQL.

## Integracion y smoke tests

Estos archivos existentes prueban flujos reales contra API, servidor o base de datos. Son utiles, pero no cuentan como pruebas unitarias:

- `backend/tests/test-jwt-complete.ts`
- `backend/tests/test-protected-endpoints.ts`
- `backend/tests/test-package-flow.ts`
- `backend/tests/test-db.ts`
- `backend/tests/validate-data.ts`
- `backend/tests/validate-api.ts`

Comando agrupado:

```bash
cd backend
bun run test:integration
```

Ese comando requiere la configuracion local correspondiente: backend levantado cuando el script use HTTP, variables de entorno validas y MySQL disponible cuando el script toque base de datos.

## Cobertura actual

Queda cubierta como prueba unitaria real:

- servicios de autenticacion del frontend
- servicios de encomiendas del frontend
- servicios de reclamos del frontend
- contexto de autenticacion del frontend
- vista de login del frontend
- vista de reclamos del frontend
- utilidades JWT del backend

## Pendientes recomendados

Prioridad media:

- `frontend/src/pages/Conserje.test.tsx`
- `frontend/src/pages/HistorialEncomiendas.test.tsx`
- `frontend/src/pages/AdminLogs.test.tsx`
- tests de rutas protegidas en `frontend/src/App.test.tsx`
- unit tests backend para reglas puras de claims si se extraen desde endpoints

Prioridad baja:

- componentes visuales simples como `Navbar`, `LanguageSwitcher`, `DashboardStats` y `RecentPackages`
- tests de existencia de llaves i18n adicionales
