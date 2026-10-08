import { getBackend } from '@/lib/backend';
import { usePortal } from '@/store/portal';
import { ADMIN_EMAILS, EXCEL_UPLOADER_EMAIL } from '@/lib/constants';

/** Etiqueta legible por prefijo de clave para el Control de cambios. null = no auditar. */
export function describirCambioKV(key: string): string | null {
  if (key.indexOf('xdata_chunk_') === 0) return null;
  if (key === 'xdata_meta') return 'Datos del Excel (Reporte Total / Tareas)';
  if (key === 'fav_procs') return 'Favoritos de procesos';
  if (key === 'fav_tareas') return 'Favoritos de tareas';
  if (key.indexOf('fav_obs_') === 0) return 'Observación de un favorito';
  if (key.indexOf('fav_hist_tarea_') === 0) return 'Historial de una tarea favorita';
  if (key.indexOf('fav_hist_') === 0) return 'Historial de un proceso favorito';
  if (key === 'pp_all') return 'Panel Paralegal';
  if (key === 'tareasGestion') return 'Tareas de Gestión (manuales)';
  if (key === 'tgOverrides') return 'Edición de una tarea de Gestión';
  if (key.indexOf('obs_proc_') === 0) return 'Observación de un proceso';
  if (key.indexOf('dili_notas_') === 0) return 'Nota de diligencia';
  if (key.indexOf('ptarea_adj_tmp_') === 0) return 'Adjunto temporal de tarea';
  if (key.indexOf('ptarea_adj_ex_') === 0) return 'Adjunto de tarea (Excel)';
  if (key.indexOf('ptarea_adj_') === 0) return 'Adjunto de tarea';
  if (key.indexOf('ptarea_notas_') === 0) return 'Nota de tarea';
  return 'Dato: ' + key;
}
const byName = () => usePortal.getState().user?.name || '';

export function registrarAuditoria(key: string, accion: string) {
  const label = describirCambioKV(key);
  if (!label) return;
  getBackend().logAudit({ key, accion, label, byName: byName() });
}
export function registrarVista(texto: string, ctx?: string) {
  getBackend().logAudit({ key: 'vista', accion: 'vio', label: texto, ctx: ctx || '', byName: byName() });
}
export function registrarAuditoriaFav(accion: string, nroId: number | string, extra?: string) {
  const proc = usePortal.getState().DATA.find((r) => r.id === Number(nroId));
  const ctx = '#' + nroId + (proc ? ' · ' + (proc.cliente || '') + (proc.expediente ? ' · ' + proc.expediente : '') : '') + (extra ? ' ' + extra : '');
  getBackend().logAudit({ key: 'fav_' + nroId, accion, label: '', ctx, byName: byName() });
}
export function logVistaExterna(nroId: number) {
  const proc = usePortal.getState().DATA.find((r) => r.id === nroId);
  registrarVista('visualizó el proceso en MyBiG', '#' + nroId + (proc ? ' · ' + (proc.cliente || '') + (proc.expediente ? ' · ' + proc.expediente : '') : ''));
}

/** Permisos (leen el usuario actual del store). */
export const esAdmin = () => ADMIN_EMAILS.includes((usePortal.getState().user?.email || '').toLowerCase());
export const esUploaderAutorizado = () => (usePortal.getState().user?.email || '').toLowerCase() === EXCEL_UPLOADER_EMAIL;
