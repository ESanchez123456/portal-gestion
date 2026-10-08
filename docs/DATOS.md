# Diccionario de datos — Portal Gestión (borrador técnico)

Borrador generado desde el código. **Edu completa**: definición de negocio, propietario del dato, fuente oficial y el nombre/tipo
definitivo en el data warehouse. Hoy todo se guarda en Firestore (`portal_kv`, `portal_audit`); la columna "Tabla propuesta (DW)" es solo una sugerencia.

## 1. Fuentes (hoy: Excel cargados a mano)
| Fuente | Cómo llega | Contenido |
|---|---|---|
| Reporte Total (MyBiG) | correo diario | un registro por proceso (hoja "Datos") |
| Reporte de Tareas (MyBiG, informe 7624 "V&T - Reporte Diario de Tareas") | descarga manual | una fila por tarea/diligencia |

## 2. Entidad PROCESO (de Reporte Total) → tabla propuesta `proceso`
| Campo app | Columna Excel | Descripción (completar) |
|---|---|---|
| id | Nro | ID del proceso en MyBiG (clave) |
| cliente | clientefacturable | |
| contraparte | contraparte | |
| expediente | Nroexpediente | N° de expediente judicial |
| supervisor / responsable | supervisor / responsable | |
| instancia | estadointerno | Estado interno (instancia) |
| distrito | distritoactual | Distrito judicial/sede actual |
| organo | organojurisdiccional (col. K) | Órgano jurisdiccional (nombre homologado) |
| tipoJuzgado | tipojuzgado (col. M) | Tipo de juzgado |
| especialista | especialistalegal | Especialista legal del juzgado (CEJ) |
| relevancia, pacto, situacion, materia, submateria, viaprocesal, cuantia, reposicion | idem | |
| estadoCarpeta | estadocarpeta | Solo se muestran Activos/vacíos |
| bitacora | bitácora | Última anotación; de ella se derivan porAdmitir / porArchivo / porNuevaSentencia / porSentenciar |
| proxTarea*, proxDiligencia*, ultimaDiliFecha | derivados del Reporte de Tareas | próxima tarea / audiencia / última diligencia |

## 3. Entidad TAREA (de Reporte de Tareas) → `tarea`
nrotarea (clave), nroproceso (FK proceso), tipo, usuario (asignado), responsable, asignado_alterno, estadotarea, fecha, hora, notas, supervisor, materia, submateria.
Subconjuntos derivados: tareas de Gestión (tipo "Gestión - …"), diligencias (tipo "DILIGENCIA - …"), planner.

## 4. Datos colaborativos creados en la app (hoy claves de `portal_kv`)
| Clave KV | Contenido | Tabla propuesta (DW/OLTP) | Quién escribe |
|---|---|---|---|
| `tareasGestion` | tareas de Gestión creadas en el portal (array JSON) | `tarea_gestion` (1 fila por tarea) | todos |
| `tgOverrides` | ediciones sobre tareas del Excel `{idTarea:{asignado,fecha,obs,estado,comentarios,adjuntos,eliminada}}` | `tarea_gestion_override` | todos |
| `pp_all` | Panel Paralegal: cambios/avisos pendientes de atender | `panel_paralegal` | todos |
| `fav_procs` / `fav_tareas` | favoritos por usuario (procesos y tareas) | `favorito` (usuario, tipo, id) | todos |
| `fav_obs_<id>`, `fav_hist_<id>`, `fav_hist_tarea_<id>` | observaciones/historial/comentarios de favoritos | `favorito_comentario` | todos |
| `obs_proc_<id>` | observaciones por proceso | `proceso_observacion` | todos |
| `dili_notas_<nro>` | notas de diligencia | `diligencia_nota` | todos |
| `ptarea_notas_<id>`, `ptarea_adj_<id>` | notas y adjuntos de tareas del planner | `tarea_nota`, `tarea_adjunto` | todos |
| `juzgados_data` | Juzgados y magistrados `{id,distrito,tipoJuzgado,organo,magistrado,condicion,encargado,editado,deRT}` | `juzgado_magistrado` | solo admin edita |
| `juzgados_rt_ocultos` | órganos del reporte que el admin descartó | `juzgado_oculto` | admin |
| `xdata_meta`, `xdata_chunk_N` | **Excel procesado publicado** (se reemplaza por el warehouse) | — (desaparece) | solo uploader |

## 5. Auditoría → `auditoria` (`portal_audit`)
key, accion (set/delete/vio/…), label, ctx, byEmail, byName, ts.

## 6. Catálogos y reglas
- Equipo de Gestión: Arturo Trelles (ATG), Carlos Morales (CMP), Roberto Matallana (RMR), Silvia Maldonado (SMO), Juan Jose Edquen, Talía León. Iniciales → persona en `lib/constants.ts` (`INICIALES_GESTION`).
- Encargado por juzgado = iniciales (campo `encargado` de Juzgados); "Asignado a" por defecto en Agendar sale de aquí.
- Estados de tarea: Pendiente · Pendiente aprobación · Rechazada · Completada · Cancelada.
- Roles: admin (Edu) · uploader del Excel (Edu) · resto lectura/escritura colaborativa.

## 7. Pendiente de definir con TI
Nombres definitivos en el DW, tipos, claves foráneas, retención de auditoría, y qué reemplaza a la carga manual (ETL desde MyBiG).
