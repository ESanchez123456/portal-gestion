// Observaciones por proceso (portado de legacy/index.html 4946-5019). Clave FSLS: obs_proc_<id>
import { createElement, type ReactElement } from 'react';
import { FSLS, usePortal } from '@/store/portal';

export interface ObsEntry { texto: string; autor?: string; fecha?: string; mine?: boolean }

export function getObsProc(id: number | string): ObsEntry[] {
  try { return JSON.parse(FSLS.getItem('obs_proc_' + id) || '[]'); } catch { return []; }
}
export function saveObsProc(id: number | string, arr: ObsEntry[]): void {
  FSLS.setItem('obs_proc_' + id, JSON.stringify(arr));
}
/** Abre el modal de observaciones del proceso (payload: { procId }). */
export function abrirObsProc(id: number): void {
  usePortal.getState().openModal('obsProc', { procId: id });
}
/** Botón "+ Obs" / "💬 n" (equivale a getObsBadge, que devolvía HTML). El componente padre debe suscribirse a kvRev. */
export function getObsBadge(id: number): ReactElement {
  const obs = getObsProc(id);
  const onClick = (e: { stopPropagation(): void }) => { e.stopPropagation(); abrirObsProc(id); };
  if (!obs.length) {
    return createElement('button', {
      className: 'obs-badge', onClick,
      style: { background: 'var(--gray-l)', borderColor: 'var(--gray-b)', color: 'var(--text4)' },
    }, '+ Obs');
  }
  return createElement('button', { className: 'obs-badge', onClick, title: obs.length + ' observación(es)' }, '💬 ' + obs.length);
}
