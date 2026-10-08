// Módulo C · helpers de Tareas de Gestión (portado de legacy/index.html JS 4142-4420, 5974-6011, 7368-7790).
import { FSLS, usePortal, showToast } from '@/store/portal';
import type { Proceso, TareaGestion } from '@/types';

export interface ComentarioTarea { texto: string; autor?: string; fecha?: string }
export interface AdjuntoTarea { nombre: string; tipo: string; data: string }
export interface TareaG extends TareaGestion {
  comentarios?: ComentarioTarea[]; adjuntos?: AdjuntoTarea[];
  solicitadoPor?: string; supervisorAprobador?: string; aprobadaEn?: string;
  instancia?: string; situacion?: string; relevancia?: string; pacto?: string; especialista?: string;
}
export interface TgOverride {
  asignado?: string; fecha?: string; obs?: string; estado?: string; eliminada?: boolean;
  comentarios?: ComentarioTarea[]; adjuntos?: AdjuntoTarea[];
}
export type TgOverrides = Record<string, TgOverride>;

export const MYBIG_PROC = (id: number | string) => 'https://vinatea.mybig.com.ar/trabajos/overview/' + id + '/';
export const MYBIG_TAREA = (nro: number | string) => 'https://vinatea.mybig.com.ar/tareas/' + nro + '/edit/';

export const ASIGNADOS_GESTION = ['Arturo Trelles', 'Carlos Morales', 'Juan Jose Edquen', 'Roberto Matallana', 'Silvia Maldonado', 'Talía León'];

export const TIPOS_TAREA_GRUPOS: { label: string; items: string[] }[] = [
  { label: '1ra instancia', items: ['Gestión - Impulso de demanda/admisorio', 'Gestión - Impulso previo audiencia primera', 'Gestión - Impulso sentencia de primera', 'Gestión - Consignaciones judiciales', 'Gestión - Elevación a segunda', 'Gestión - Impulso trámite primera instancia', 'Gestión - Ejecución de sentencia'] },
  { label: '2da instancia', items: ['Gestión - Programación vista de la causa', 'Gestión - Impulso previo vista de la causa', 'Gestión - Impulso sentencia de segunda', 'Gestión - Elevación a Suprema/TC', 'Gestión - Impulso trámite segunda instancia'] },
  { label: '3ra instancia / Suprema', items: ['Gestión - Confirmación sala y número expediente', 'Gestión - Programación calificación', 'Gestión - Previo a la audiencia calificación/fondo', 'Gestión - Programación vista fondo', 'Gestión - Impulso sentencia en Suprema/TC', 'Gestión - Impulso trámite Suprema/TC'] },
  { label: 'Sin instancia', items: ['Gestión - Búsqueda demanda/cautelar', 'Gestión - Impulso cautelar', 'Gestión - Oficios', 'Gestión - Recojo/entrega documentos'] },
];
export const AGENDADO_POR_EXT = [
  ['Carlos Morales', 'Carlos Morales (Equipo Morales)'], ['Cynthia Lagos', 'Cynthia Lagos (Equipo Lagos)'], ['Elyana Arias', 'Elyana Arias (Equipo Arias)'],
  ['Katia Jacinto', 'Katia Jacinto (Equipo Jacinto)'], ['Samuel Paz', 'Samuel Paz (Equipo Paz)'], ['Solanch Estrella', 'Solanch Estrella (Equipo Estrella)'],
];
export const AGENDADO_POR_INT = [
  ['Arturo Trelles', 'Arturo Trelles'], ['Carlos Morales (Gestión)', 'Carlos Morales (Gestión)'], ['Juan Jose Edquen', 'Juan Jose Edquen'],
  ['Roberto Matallana', 'Roberto Matallana'], ['Silvia Maldonado', 'Silvia Maldonado'], ['Talía León', 'Talía León'],
];

/** Fecha/hora estilo es-PE usada en registros ("dd/mm/yyyy, hh:mm"). */
export const fechaHoraPE = () => new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const nombreActual = () => usePortal.getState().user?.name || '';
/** yyyy-mm-dd → dd/mm/yyyy */
export const isoADmy = (f: string) => (f ? f.split('-').reverse().join('/') : '');
/** dd/mm/yyyy → yyyy-mm-dd */
export const dmyAIso = (f?: string) => (f ? f.split('/').reverse().join('-') : '');

export function tareaIdDePayload(p: unknown): string {
  if (typeof p === 'string') return p;
  if (p && typeof p === 'object' && 'tareaId' in p) return String((p as { tareaId: unknown }).tareaId ?? '');
  return '';
}

// ── Almacenamiento (claves idénticas al original) ──
export function loadTareasGestion(): TareaG[] {
  try { return JSON.parse(FSLS.getItem('tareasGestion') || '[]'); } catch { return []; }
}
export function saveTareasGestion(arr: TareaG[]) { FSLS.setItem('tareasGestion', JSON.stringify(arr)); }
export function loadOverrides(): TgOverrides {
  try { return JSON.parse(FSLS.getItem('tgOverrides') || '{}'); } catch { return {}; }
}
export function saveOverrides(o: TgOverrides) { FSLS.setItem('tgOverrides', JSON.stringify(o)); }

/** Combina tareas del Excel (con overrides) + manuales. */
export function getAllTareasGestion(): TareaG[] {
  const st = usePortal.getState();
  const overrides = loadOverrides();
  const deExcel = (st.TAREAS_GESTION_EXCEL as TareaG[])
    .filter((t) => !(overrides[t.id] && overrides[t.id].eliminada))
    .map((t) => {
      const proc = st.DATA.find((r) => r.id === t.nroId);
      const ov = overrides[t.id] || {};
      return {
        ...t,
        cliente: t.cliente || (proc ? proc.cliente : '—'),
        expediente: t.expediente || (proc ? proc.expediente : '—'),
        asignado: ov.asignado || t.asignado,
        fecha: ov.fecha || t.fecha,
        obs: ov.obs || t.obs,
        estado: ov.estado || t.estado,
        comentarios: ov.comentarios || t.comentarios || [],
        adjuntos: ov.adjuntos || t.adjuntos || [],
      } as TareaG;
    });
  return [...deExcel, ...loadTareasGestion()];
}

/** Helper: extrae todos los campos del proceso al crear una tarea. */
export function buildTareaDesdeProc(id: number, proc: Proceso | undefined | null, overrides: Partial<TareaG> & { id: string }): TareaG {
  return {
    nroId: id,
    cliente: proc?.cliente || '—',
    contraparte: proc?.contraparte || '—',
    expediente: proc?.expediente || '—',
    supervisor: proc?.supervisor || '—',
    responsable: proc?.responsable || '—',
    instancia: proc?.instancia || '—',
    situacion: proc?.situacion || '—',
    relevancia: proc?.relevancia || '—',
    pacto: proc?.pacto || '—',
    organo: proc?.organo || '—',
    distrito: proc?.distrito || '—',
    especialista: proc?.especialista || '—',
    tipo: '', asignado: '', agendadoPor: '', fecha: '', estado: '', obs: '', origen: '',
    ...overrides,
  } as TareaG;
}

/** Registro centralizado en el Panel Paralegal (clave pp_all). */
export function registrarEnPanel(entry: Record<string, unknown>) {
  const all: Record<string, unknown>[] = JSON.parse(FSLS.getItem('pp_all') || '[]');
  entry.id = 'pp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  entry.ts = fechaHoraPE();
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

const autorGestion = () => nombreActual() || 'Equipo Gestión';

// ── Acciones ──
export function eliminarTareaGestion(id: string) {
  const tarea = getAllTareasGestion().find((t) => t.id === id);
  const nombre = tarea ? (tarea.tipo || '').replace('Gestión - ', '') + ' — ' + (tarea.cliente || '') : '#' + id;
  if (!window.confirm('¿Eliminar esta tarea?\n\n' + nombre + '\n\nEsta acción no se puede deshacer.')) return;
  const arr = loadTareasGestion();
  const idx = arr.findIndex((t) => t.id === id);
  if (idx >= 0) { arr.splice(idx, 1); saveTareasGestion(arr); }
  else { const ov = loadOverrides(); ov[id] = { ...(ov[id] || {}), eliminada: true }; saveOverrides(ov); }
  // Limpiar también de favoritos
  try {
    const fav = JSON.parse(FSLS.getItem('fav_tareas') || '{}');
    if (fav[id]) { delete fav[id]; FSLS.setItem('fav_tareas', JSON.stringify(fav)); }
  } catch { /* */ }
  if (tarea) {
    registrarEnPanel({
      tipo: 'gestion', origen: 'gestion', nroId: tarea.nroId || 0, nrotarea: tarea.nrotarea || 0,
      cliente: tarea.cliente || '—', expediente: tarea.expediente || '—', supervisor: tarea.supervisor || '—',
      texto: '🗑 Tarea eliminada: ' + (tarea.tipo || '').replace('Gestión - ', '') + (tarea.asignado ? ' · Asignada a: ' + tarea.asignado : ''),
      autor: autorGestion(), tareaId: id,
    });
  }
  showToast('🗑 Tarea eliminada');
}

export function borrarCambioParalegal(tareaId: string) {
  const ov = loadOverrides();
  if (ov[tareaId]) {
    delete ov[tareaId]; saveOverrides(ov);
    showToast('Cambio eliminado del Panel Paralegal');
    return;
  }
  const arr = loadTareasGestion();
  const idx = arr.findIndex((t) => t.id === tareaId);
  if (idx >= 0) { arr.splice(idx, 1); saveTareasGestion(arr); showToast('Registro eliminado del Panel Paralegal'); }
}

export function marcarCompletada(tareaId: string) {
  const arr = loadTareasGestion();
  const idx = arr.findIndex((t) => t.id === tareaId);
  if (idx >= 0) { arr[idx].estado = 'Completada'; saveTareasGestion(arr); }
}

function marcarPPAtendida(id: string, val: boolean) {
  const all: { id: string; atendida?: boolean }[] = JSON.parse(FSLS.getItem('pp_all') || '[]');
  const idx = all.findIndex((e) => e.id === id);
  if (idx >= 0) { all[idx].atendida = val; FSLS.setItem('pp_all', JSON.stringify(all)); }
  showToast(val ? '✓ Marcada como atendida' : '↩ Marcada como pendiente');
}

export function aprobarTarea(ppId: string, tareaId: string) {
  const arr = loadTareasGestion();
  const idx = arr.findIndex((t) => t.id === tareaId);
  if (idx >= 0) { arr[idx].estado = 'Pendiente'; arr[idx].aprobadaEn = fechaHoraPE(); saveTareasGestion(arr); }
  marcarPPAtendida(ppId, true);
  const all: { id: string; estado?: string; atendida?: boolean }[] = JSON.parse(FSLS.getItem('pp_all') || '[]');
  const pidx = all.findIndex((e) => e.id === ppId);
  if (pidx >= 0) { all[pidx].estado = 'aprobada'; all[pidx].atendida = true; FSLS.setItem('pp_all', JSON.stringify(all)); }
  showToast('✓ Tarea aprobada y enviada a Gestión');
}

export function rechazarTarea(ppId: string, tareaId: string) {
  const arr = loadTareasGestion();
  const idx = arr.findIndex((t) => t.id === tareaId);
  if (idx >= 0) { arr[idx].estado = 'Rechazada'; saveTareasGestion(arr); }
  const all: { id: string; estado?: string; atendida?: boolean }[] = JSON.parse(FSLS.getItem('pp_all') || '[]');
  const pidx = all.findIndex((e) => e.id === ppId);
  if (pidx >= 0) { all[pidx].estado = 'rechazada'; all[pidx].atendida = true; FSLS.setItem('pp_all', JSON.stringify(all)); }
  showToast('✗ Tarea rechazada');
}
