// Helpers del Módulo D (Calendario / Planner / Equipos / Diligencias / Menciones).
// Portado de legacy/index.html (JS 4762-4945, 5020-5445, 5773-5973).
import { FSLS, usePortal, showToast } from '@/store/portal';
import type { Proceso, TareaGestion } from '@/types';

/* ───────────────────────── Tipos de payload de los modales ───────────────────────── */

/** Una diligencia/tarea tal como la muestran Calendario y Planner (fila de DILIGENCIAS_GESTION_EXCEL o tarea del portal). */
export interface DiligenciaTarea {
  nroId?: number; nrotarea?: number;
  cliente?: string; expediente?: string; tipo?: string;
  asignado?: string; asignadoAlt?: string;
  responsable?: string; supervisor?: string; organo?: string; distrito?: string;
  materia?: string; submateria?: string; notas?: string; comentarios?: string;
  fecha?: string; hora?: string; estado?: string; relevancia?: string;
  /** true = tarea creada en el portal (se proyecta al calendario); la reasignación se persiste en 'tareasGestion'. */
  _esPortal?: boolean; _portalId?: string;
  [k: string]: unknown;
}

/**
 * Payload de `usePortal.getState().openModal('diligencia', payload)`.
 *  - `{ tarea }`  : el objeto diligencia (se muta `asignado` al reasignar, igual que el original).
 *  - `{ nrotarea }`: se busca en DILIGENCIAS_GESTION_EXCEL por nrotarea.
 *  - o directamente el objeto diligencia (sin envoltorio).
 */
export type DiligenciaPayload = { tarea: DiligenciaTarea } | { nrotarea: number } | DiligenciaTarea;

/**
 * Payload de `usePortal.getState().openModal('plannerTarea', payload)`.
 *  - `{ modo:'nueva', fecha?:'yyyy-mm-dd', miembro?:string }` : nueva tarea de gestión (abrirPlannerNueva).
 *  - `{ modo:'editar', tareaId:string }` : edita una tarea de getAllTareasGestion (abrirPlannerEditar). Si no existe abre 'nueva'.
 *  - `{ modo:'excel', tarea:PlannerExcelTarea }` : detalle de tarea Excel con notas+adjuntos (abrirPlannerTareaExcel).
 *  - `undefined`/`true` : equivale a `{modo:'nueva'}`.
 */
export type PlannerTareaPayload =
  | { modo: 'nueva'; fecha?: string; miembro?: string }
  | { modo: 'editar'; tareaId: string }
  | { modo: 'excel'; tarea: PlannerExcelTarea };

export interface PlannerExcelTarea {
  nroId?: number; nrotarea?: number; cliente?: string; expediente?: string; tipo?: string;
  asignado?: string; asignadoAlt?: string; fecha?: string; hora?: string; estado?: string;
  supervisor?: string; responsable?: string; materia?: string; submateria?: string; notas?: string;
  _src?: string; _key?: string; [k: string]: unknown;
}

/* ───────────────────────── Tareas de gestión (storage) ───────────────────────── */

export type TareaG = TareaGestion & { [k: string]: unknown };

export function loadTareasGestion(): TareaG[] { return FSLS.getJSON<TareaG[]>('tareasGestion', []); }
export function saveTareasGestion(arr: TareaG[]): void { FSLS.setItem('tareasGestion', JSON.stringify(arr)); }

/** Tareas del Excel (con overrides aplicados) + manuales. */
export function getAllTareasGestion(): TareaG[] {
  const st = usePortal.getState();
  const overrides = FSLS.getJSON<Record<string, Record<string, unknown>>>('tgOverrides', {});
  const deExcel = st.TAREAS_GESTION_EXCEL
    .filter((t) => !(overrides[t.id] && overrides[t.id].eliminada))
    .map((t) => {
      const proc = st.DATA.find((r) => r.id === t.nroId);
      const ov = overrides[t.id] || {};
      return {
        ...t,
        cliente: t.cliente || (proc ? proc.cliente : '—'),
        expediente: t.expediente || (proc ? proc.expediente : '—'),
        asignado: (ov.asignado as string) || t.asignado,
        fecha: (ov.fecha as string) || t.fecha,
        obs: (ov.obs as string) || t.obs,
        estado: (ov.estado as string) || t.estado,
        comentarios: (ov.comentarios as unknown[]) || t.comentarios || [],
        adjuntos: (ov.adjuntos as unknown[]) || t.adjuntos || [],
      } as TareaG;
    });
  return [...deExcel, ...loadTareasGestion()];
}

export function buildTareaDesdeProc(id: number, proc: Proceso | undefined | null, overrides: Record<string, unknown>): TareaG {
  return {
    nroId: id,
    cliente: proc?.cliente || '—', contraparte: proc?.contraparte || '—', expediente: proc?.expediente || '—',
    supervisor: proc?.supervisor || '—', responsable: proc?.responsable || '—', instancia: proc?.instancia || '—',
    situacion: proc?.situacion || '—', relevancia: proc?.relevancia || '—', pacto: proc?.pacto || '—',
    organo: proc?.organo || '—', distrito: proc?.distrito || '—', especialista: proc?.especialista || '—',
    ...overrides,
  } as unknown as TareaG;
}

/** Registro centralizado en el Panel Paralegal (clave pp_all). */
export function registrarEnPanel(entry: Record<string, unknown>): void {
  const all = FSLS.getJSON<Record<string, unknown>[]>('pp_all', []);
  entry.id = 'pp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  entry.ts = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  entry.atendida = false;
  if (!entry.origen) {
    if (entry.tipo === 'obs') entry.origen = 'reporte';
    else if (entry.tipo === 'dili') entry.origen = 'audiencias';
    else entry.origen = 'gestion';
  }
  all.unshift(entry);
  if (all.length > 500) all.splice(500);
  FSLS.setItem('pp_all', JSON.stringify(all));
}

export const currentUserName = () => usePortal.getState().user?.name || 'Equipo Gestión';

/** eliminarTareaGestion (HTML 2313-2358) — usada por el botón 🗑 de las tarjetas del Planner. */
export function eliminarTareaGestion(id: string): void {
  const tarea = getAllTareasGestion().find((t) => t.id === id);
  const nombre = tarea ? (tarea.tipo || '').replace('Gestión - ', '') + ' — ' + (tarea.cliente || '') : '#' + id;
  if (!window.confirm('¿Eliminar esta tarea?\n\n' + nombre + '\n\nEsta acción no se puede deshacer.')) return;
  const arr = loadTareasGestion();
  const idx = arr.findIndex((t) => t.id === id);
  if (idx >= 0) { arr.splice(idx, 1); saveTareasGestion(arr); }
  else {
    const overrides = FSLS.getJSON<Record<string, Record<string, unknown>>>('tgOverrides', {});
    overrides[id] = { ...(overrides[id] || {}), eliminada: true };
    FSLS.setItem('tgOverrides', JSON.stringify(overrides));
  }
  const fav = FSLS.getJSON<Record<string, unknown>>('fav_tareas', {});
  if (fav[id]) { delete fav[id]; FSLS.setItem('fav_tareas', JSON.stringify(fav)); }
  if (tarea) {
    registrarEnPanel({
      tipo: 'gestion', origen: 'gestion', nroId: tarea.nroId || 0, nrotarea: tarea.nrotarea || 0,
      cliente: tarea.cliente || '—', expediente: tarea.expediente || '—', supervisor: tarea.supervisor || '—',
      texto: '🗑 Tarea eliminada: ' + (tarea.tipo || '').replace('Gestión - ', '') + (tarea.asignado ? ' · Asignada a: ' + tarea.asignado : ''),
      autor: currentUserName(), tareaId: id,
    });
  }
  showToast('🗑 Tarea eliminada');
}

/* ───────────────────────── Fechas ───────────────────────── */

const p2 = (n: number) => String(n).padStart(2, '0');
/** Date → 'yyyy-mm-dd' en hora local. */
export const isoLocal = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
/** 'yyyy-mm-dd' → Date local (12:00 para evitar saltos de día). */
export const dateFromISO = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12, 0, 0); };
/** Robusto fecha (dd/mm/yyyy | yyyy-mm-dd) → yyyy-mm-dd ('' si no se reconoce). */
export function toISO(f: unknown): string {
  if (!f) return '';
  const s = String(f).trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) { const [d, m, y] = s.split('/'); return y.slice(0, 4) + '-' + p2(Number(m)) + '-' + p2(Number(d)); }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return '';
}
/** 'yyyy-mm-dd' → 'dd/mm/yyyy' */
export const isoToDMY = (s: string) => (s ? s.split('-').reverse().join('/') : '');
/** 'dd/mm/yyyy' → 'yyyy-mm-dd' (tal cual el original: split/reverse/join) */
export const dmyToISO = (s?: string) => (s ? s.split('/').reverse().join('-') : '');

/* ───────────────────────── Horas por tipo de tarea ───────────────────────── */

export const HORAS_TAREA: Record<string, number> = {
  'APELACION DE SENTENCIA': 12, 'RECURSO DE CASACION': 6, 'RECURSO DE AGRAVIO CONSTITUCIONAL': 6,
  'CONTESTA DEMANDA (EXCEPCIONES)': 4, 'PRESENTACION DE DEMANDA': 4, 'PRESENTAR MEDIDA CAUTELAR': 4,
  'OPOSICION A MEDIDA CAUTELAR': 2, 'DESISTIMIENTO': 2, 'ABSOLVER TRASLADO': 2,
  'DILIGENCIA - AUDIENCIA DE JUZGAMIENTO': 2, 'DILIGENCIA - AUDIENCIA DE VISTA DE LA CAUSA': 2,
  'DILIGENCIA - AUDIENCIA DE VISTA EN SUPREMA / TC': 2, 'DILIGENCIA - AUDIENCIA DE VISTA EN SUPREMA (DISCORDIA)': 2,
  'RECURSO DE NULIDAD / APELACIÓN DE AUTO': 1, 'CUMPLIR OBLIGACION PRINCIPAL': 1,
  'CUMPLIR PAGO DE COSTAS, COSTOS Y/O CAL': 1, 'CUMPLIR PAGO DE INTERESES': 1, 'CUMPLE MANDATO': 1,
  'TENGASE PRESENTE': 1, 'OBSERVACION DE INFORME PERICIAL': 1, 'DILIGENCIAR OFICIO': 1,
  'REQUERIR AL CLIENTE': 1, 'REQUERIR AL JUZGADO / SALA': 1,
  'DILIGENCIA - AUDIENCIA DE CONCILIACION': 1, 'DILIGENCIA - AUDIENCIA DE CONCILIACION (CONTINUACION)': 1,
  'DILIGENCIA - AUDIENCIA DE INFORME ORAL': 1, 'DILIGENCIA - AUDIENCIA DE JUZGAMIENTO (CONTINUACION)': 1,
  'DILIGENCIA - AUDIENCIA UNICA': 1, 'DILIGENCIA - AUDIENCIA UNICA (CONTINUACION)': 1,
  'DILIGENCIA - LECTURA DE SENTENCIA (PRIMERA INSTANCIA)': 1, 'DILIGENCIA - LECTURA DE SENTENCIA (SEGUNDA INSTANCIA)': 1,
  'DILIGENCIA - LECTURA DE SENTENCIA (TERCERA INSTANCIA)': 1, 'SEGUIMIENTO': 1,
  'SOLICITUD DE ARCHIVO DEFINITIVO': 0.5, 'INFORMAR AL CLIENTE': 0.5, 'INFORMAR AL JUZGADO / SALA': 0.5,
  'DILIGENCIA - AUDIENCIA PREPARATORIA DE CONCILIACION': 0.5, 'DILIGENCIA - AUDIENCIA PREPARATORIA VISTA DE LA CAUSA': 0.5,
  'APERSONAMIENTO Y USO DE LA PALABRA EN SUPREMA': 0.16, 'APERSONAMIENTO Y/O VARIACION DE DOMICILIO': 0.16,
  'DILIGENCIA - VISTA DE CALIFICACION': 1, 'APELACION CONTRAPARTE': 1, 'RECURSO DE CASACION CONTRAPARTE': 1,
  'RECURSO DE AGRAVIO CONSTITUCIONAL CONTRAPARTE': 1, 'RESULTADO CALIFICACION DEL RECURSO': 1,
  'CUMPLIR PAGO DE COSTOS - COSTOS Y/O CAL': 1,
};
export const HORAS_DIA = 8;
export function getHorasTarea(tipo?: string): number {
  if (!tipo) return 0.5;
  const tipoUp = tipo.toUpperCase().trim();
  if (tipoUp.startsWith('GESTIÓN') || tipoUp.startsWith('GESTION')) return 3;
  if (HORAS_TAREA[tipoUp] !== undefined) return HORAS_TAREA[tipoUp];
  for (const [k, v] of Object.entries(HORAS_TAREA)) {
    if (tipoUp.includes(k) || k.includes(tipoUp)) return v;
  }
  return 0.5;
}

/* ───────────────────────── Menciones ───────────────────────── */

export const MENTION_USERS = [
  { nombre: 'Roberto Matallana', alias: 'roberto', color: '#dc2626', rol: 'Gestión' },
  { nombre: 'Carlos Morales', alias: 'carlos', color: '#2563eb', rol: 'Gestión' },
  { nombre: 'Arturo Trelles', alias: 'arturo', color: '#4f46e5', rol: 'Gestión' },
  { nombre: 'Silvia Maldonado', alias: 'silvia', color: '#16a34a', rol: 'Gestión' },
  { nombre: 'Juan Jose Edquen', alias: 'juanjose', color: '#7c3aed', rol: 'Gestión' },
  { nombre: 'Talía León', alias: 'talia', color: '#ca8a04', rol: 'Gestión' },
  { nombre: 'Edu Sanchez', alias: 'edusanchez', color: '#0891b2', rol: 'CID' },
];
export type MentionUser = (typeof MENTION_USERS)[number];

/** Diligencias: notas guardadas por nrotarea (clave dili_notas_<nrotarea>). */
export function getDiliNotas(nrotarea: unknown): { notas: string; obsCid: string } {
  const r = FSLS.getJSON<{ notas?: string; obsCid?: string }>('dili_notas_' + nrotarea, { notas: '', obsCid: '' });
  return { notas: r.notas || '', obsCid: r.obsCid || '' };
}
export function saveDiliNotas(nrotarea: unknown, obj: { notas: string; obsCid: string }): void {
  FSLS.setItem('dili_notas_' + nrotarea, JSON.stringify(obj));
}

/** Fuerza re-render de quienes leen los arrays de Excel del store tras mutar un objeto en sitio. */
export function bumpDiligencias(): void {
  usePortal.setState((s) => ({ DILIGENCIAS_GESTION_EXCEL: [...s.DILIGENCIAS_GESTION_EXCEL], PLANNER_EXCEL_TAREAS: [...s.PLANNER_EXCEL_TAREAS] }));
}
