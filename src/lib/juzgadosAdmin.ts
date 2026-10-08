// Altas/ediciones/bajas de Juzgados (JS 6850-6935 del original). Solo admin.
import { FSLS, showToast } from '@/store/portal';
import { esAdmin } from '@/lib/audit';
import { getJuzgados, saveJuzgados, normOrgano } from '@/lib/juzgados';
import type { Juzgado } from '@/types';

export interface JuzgadoForm {
  distrito: string; tipoJuzgado: string; organo: string; magistrado: string; condicion: string; encargado: string;
}

/** Devuelve true si guardó. */
export function guardarJuzgado(id: string, f: JuzgadoForm): boolean {
  if (id && !esAdmin()) { showToast('⚠ Solo el administrador puede editar o eliminar juzgados'); return false; }
  const distrito = (f.distrito || '').trim().toUpperCase();
  const tipoJuzgado = (f.tipoJuzgado || '').trim().toUpperCase();
  const organo = (f.organo || '').trim().toUpperCase();
  const magistrado = (f.magistrado || '').trim().toUpperCase();
  const condicion = f.condicion || '';
  const encargado = (f.encargado || '').trim().toUpperCase();
  const filaRT = id ? getJuzgados().find((j) => j.id === id) : null;
  if (!organo || (!magistrado && !(filaRT && filaRT.deRT))) { showToast('⚠ Completa al menos el órgano y el magistrado'); return false; }
  const arr = getJuzgados();
  if (id) {
    const idx = arr.findIndex((j) => j.id === id);
    if (idx > -1) arr[idx] = { ...arr[idx], distrito, tipoJuzgado, organo, magistrado, condicion, encargado, editado: true };
  } else {
    arr.push({ id: 'jz_' + Date.now() + '_' + Math.floor(Math.random() * 1000), distrito, tipoJuzgado, organo, magistrado, condicion, encargado, editado: true } as Juzgado);
  }
  saveJuzgados(arr);
  showToast('💾 Guardado');
  return true;
}

export function borrarJuzgado(id: string): boolean {
  if (!esAdmin()) { showToast('⚠ Solo el administrador puede eliminar juzgados'); return false; }
  if (!confirm('¿Eliminar este magistrado del listado de Juzgados?')) return false;
  const fila = getJuzgados().find((j) => j.id === id);
  if (fila && fila.deRT) {
    try {
      const o = JSON.parse(FSLS.getItem('juzgados_rt_ocultos') || '[]');
      o.push(normOrgano(fila.distrito) + '||' + normOrgano(fila.organo));
      FSLS.setItem('juzgados_rt_ocultos', JSON.stringify(o));
    } catch { /* */ }
  }
  saveJuzgados(getJuzgados().filter((j) => j.id !== id));
  showToast('🗑 Eliminado');
  return true;
}
