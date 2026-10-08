# Migración Portal Gestión → Next.js (TypeScript, exportación estática)

Fuente de verdad funcional: `legacy/index.html` (8.100 líneas, un solo archivo). La nueva app debe
tener **paridad funcional y visual** (mismo CSS: `src/app/globals.css` es el CSS original; reutiliza
las MISMAS clases y la misma estructura HTML dentro del JSX).

## Reglas
- Next 15 App Router, `output:'export'`, React 19, TypeScript estricto, Zustand. Sin servidor, sin API routes.
- Todo componente con estado/efectos lleva `'use client'`.
- **Datos**: nunca importes firebase en vistas/modales. Usa `FSLS` (de `@/store/portal`) para el almacén clave→valor
  (misma API que el original: `getItem/setItem/removeItem` + `getJSON/setJSON`). Las claves y formatos son
  IDÉNTICOS a los del original (los datos existentes en Firestore deben seguir funcionando).
  Para re-renderizar cuando cambian claves: `const rev = usePortal(s => s.kvRev)`.
- Datos del Excel: `usePortal(s => s.DATA)`, `TAREAS_GESTION_EXCEL`, `DILIGENCIAS_GESTION_EXCEL`, `SENTENCIAS_BY_ID`,
  `PLANNER_EXCEL_TAREAS`, `DILIGENCIAS_EQUIPOS_EXCEL`. `dataRev` sube cuando llegan datos nuevos (reinicia filtros/página).
- Usuario: `usePortal(s => s.user)` (`{email,name}`); permisos: `esAdmin()`, `esUploaderAutorizado()` de `@/lib/audit`.
- Auditoría: `registrarAuditoria / registrarVista / registrarAuditoriaFav / logVistaExterna` de `@/lib/audit` (llamar donde el original lo hace).
- Toast: `showToast(msg)` de `@/store/portal`. Error modal: `usePortal.getState().showError(msg)`.
- Modales compartidos: `usePortal.getState().openModal('agendar', payload)` / `closeModal`. El `ModalHost` ya renderiza
  `src/modals/<Nombre>Modal.tsx` con props `{payload, onClose}` (default export). Cada modal es un `<div className="overlay show">`
  con la misma estructura del original. NO cambies los nombres de archivo/exports ni `ModalHost.tsx` (si necesitas otro modal, dilo en tu informe).
- Constantes de equipo/usuarios: `@/lib/constants`. Juzgados (datos y cruce con encargados): `@/lib/juzgados` (ya portado).
- Componentes compartidos ya existentes: `components/table/Pagination.tsx`, `lib/useResizableColumns.ts`, `components/MentionTextarea.tsx`
  (props `{value,onChange,...}`; el dueño de Planner puede ampliarlo manteniendo las props), `lib/utils.ts`.
- Sustituye `onclick="..."`/`innerHTML` por JSX con eventos y estado de React. Escapar HTML ya no es necesario (JSX escapa).
  Mantén: textos en español, validaciones, mensajes, formatos de fecha (dd/mm/yyyy), orden, límites de paginación (PAGE=50).
- Exportaciones Excel/PDF: `xlsx` y `jspdf` (+`jspdf-autotable` si el original lo usa) importados con `import()` dinámico dentro del handler.
- Archivos: crea SOLO los de tu módulo. Si necesitas algo de otro módulo que no exista aún, impórtalo por la ruta pactada abajo.
  Helpers propios de tu módulo van en un archivo propio (`src/lib/<modulo>.ts`), no en `utils.ts`.
- Validación: `npx tsc --noEmit` debe pasar para TUS archivos (los errores de archivos ajenos en construcción ignóralos). No ejecutes `next build`
  (lo hace el coordinador) ni modifiques `package.json`/`tsconfig`. No toques `legacy/`.
- Al terminar: informa archivos creados, exports públicos, funciones del original NO portadas (y por qué) y diferencias conocidas.

## Reparto (rutas pactadas)
| Módulo | Archivos | Origen en legacy/index.html |
|---|---|---|
| A · Datos/Excel/Admin | `lib/excel/procesarExcel.ts`, `lib/excel/publish.ts` (`cargarDatosExcelDesdeKV(): boolean`, `publicarDatosExcel()`), `modals/CargaModal.tsx`, `views/AdminView.tsx` | HTML 836-870, 2250-2309; JS 3341-3735 (procesarExcel), 3738-4030, 5446-5468 (construirDiligenciasEquipos) |
| B · Reporte + Audiencias | `views/ReporteView.tsx`, `views/AudienciasView.tsx`, `modals/ObsProcModal.tsx`, `components/table/*` propios (filtros múltiples, filtros por columna) | HTML 872-1387, 2128-2144; JS 2631-3340, 4421-4760, 4946-5019 |
| C · Gestión (lista y tareas) | `views/GestionView.tsx` (contenedor con sub-vistas lista/cal/planner/favoritos/equipos; importa `./gestion/CalendarPanel`, `PlannerPanel`, `EquiposPanel`, `FavoritosPanel`), `modals/{Agendar,BulkAgendar,GestionarTarea,NuevaTarea,Redirigir,DevolverTarea,ComentariosTarea}Modal.tsx` | HTML 784-835, 1388-1507, 1602-1880, 1963-1999, 2311-2383; JS 4142-4420, 4636-4704, 5974-6011, 6178-6315, 7368-7790 |
| D · Calendario/Planner/Equipos | `views/gestion/{CalendarPanel,PlannerPanel,EquiposPanel}.tsx`, `modals/{PlannerTarea,Diligencia}Modal.tsx`, `components/MentionTextarea.tsx` (completo) | HTML 1508-1553, 1575-1601, 1881-1962, 2030-2127; JS 4762-4945, 5020-5445, 5469-5973 |
| E · Favoritos/Paralegal/Juzgados | `views/gestion/FavoritosPanel.tsx`, `modals/FavUserModal.tsx`, `views/ParalegalView.tsx`, `views/JuzgadosView.tsx`, `modals/JuzgadoModal.tsx`, `lib/favoritos.ts` (getFavs/saveFavs/toggleFav/etc. exportados: C y B los necesitan para la ⭐) | HTML 1554-1574, 2000-2029, 2145-2249; JS 6012-6177, 6316-6620, 6972-7304, 7794-7988 |

Funciones que otros módulos consumen (exportar con estos nombres):
- `lib/favoritos.ts` (E): `getFavs, saveFavs, toggleFav(procId), toggleFavTarea(tareaId), getFavTareas, getFavUsuarios, favEstrellaBloqueada, favTituloEstrella, getFavBadge, updateFavBadge`.
- `views/gestion/*` y modales: default export, sin props.
- `lib/obsProc.ts` (B): `getObsProc, getObsBadge`.
