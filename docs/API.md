# Contrato de API esperado (backend Node → Data Warehouse)
La app usa `DataBackend` (src/lib/backend/types.ts). Hoy la app corre en modo `local` (sin usuarios ni Firebase; IndexedDB del navegador, solo pruebas). Para pasar a la API de TI: `NEXT_PUBLIC_DATA_BACKEND=api` + `NEXT_PUBLIC_API_URL`.
Implementación de referencia del cliente: `src/lib/backend/apiBackend.ts`.

| Método | Ruta | Descripción |
|---|---|---|
| GET | /me | usuario actual `{email, name?}` — la autenticación (SSO Microsoft/Entra ID) la resuelve el servidor; la app no maneja contraseñas |
| GET | /kv | todo el almacén `{clave: valor}` (fase 1, compatible con hoy) |
| PUT/DELETE | /kv/:key | escribir/borrar una clave |
| GET | /kv/stream (SSE) o polling | cambios en vivo |
| POST/GET | /audit | registrar y listar (limit=400) |

Fase 2 (recomendada): reemplazar /kv por recursos reales (`/procesos`, `/tareas`, `/favoritos`, `/juzgados`, …) según DATOS.md,
con una fila por registro (elimina las pérdidas por escrituras simultáneas). El Reporte Total/Tareas pasan a leerse del DW (`GET /procesos`, `GET /tareas`) y desaparece la carga de Excel.
