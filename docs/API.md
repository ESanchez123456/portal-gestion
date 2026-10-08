# Contrato de API esperado (backend Node → Data Warehouse)
La app usa `DataBackend` (src/lib/backend/types.ts). Para pasar de Firebase a la API de TI: `NEXT_PUBLIC_DATA_BACKEND=api` + `NEXT_PUBLIC_API_URL`.
Implementación de referencia del cliente: `src/lib/backend/apiBackend.ts`.

| Método | Ruta | Descripción |
|---|---|---|
| POST | /auth/login · /auth/logout · /auth/reset | o SSO Microsoft (Entra ID) |
| GET | /auth/me | usuario actual `{email}` |
| GET | /kv | todo el almacén `{clave: valor}` (fase 1, compatible con hoy) |
| PUT/DELETE | /kv/:key | escribir/borrar una clave |
| GET | /kv/stream (SSE) o polling | cambios en vivo |
| POST/GET | /audit | registrar y listar (limit=400) |

Fase 2 (recomendada): reemplazar /kv por recursos reales (`/procesos`, `/tareas`, `/favoritos`, `/juzgados`, …) según DATOS.md,
con una fila por registro (elimina las pérdidas por escrituras simultáneas). El Reporte Total/Tareas pasan a leerse del DW (`GET /procesos`, `GET /tareas`) y desaparece la carga de Excel.
