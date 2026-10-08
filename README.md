# Portal Gestión V&T — Next.js

- Desarrollo: `npm install && npm run dev`
- Build estático (para SharePoint / sitio interno): `npm run build` → carpeta `out/`
  - Subruta: `NEXT_PUBLIC_BASE_PATH=/sites/gestion/portal npm run build`
- Backend de datos: `NEXT_PUBLIC_DATA_BACKEND=local` (default: sin login ni Firebase, guarda en este navegador, solo pruebas) | `api` (+`NEXT_PUBLIC_API_URL`, data warehouse)
- Estructura: `src/lib/backend` (capa de datos), `src/store/portal.ts` (estado + FSLS), `src/views`, `src/modals`, `docs/` (DATOS.md, API.md), `legacy/index.html` (original de referencia)
