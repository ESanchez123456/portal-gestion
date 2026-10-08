// Favoritos (procesos y tareas de Gestión) + sentencias + helpers de formato.
// Portado de legacy/index.html (JS 6012-6177, 6488-6616, 6972-7050). Claves FSLS idénticas al original.
import { createElement, type ReactElement } from 'react';
import { FSLS, usePortal, showToast } from '@/store/portal';
import { esAdmin, registrarAuditoriaFav } from '@/lib/audit';
import { getBackend } from '@/lib/backend';
import { GESTION_FAV_USERS } from '@/lib/constants';
import type { TareaGestion } from '@/types';

// Un mismo proceso/tarea puede ser favorito de hasta 3 personas del equipo de Gestión.
export const MAX_FAV_USUARIOS = 3;

export interface FavEntry {
  id: number | string;
  usuarios?: string[]; usuario?: string;
  ts?: number; obs?: string; creadoPor?: string;
  cliente?: string; tipo?: string;
}
export type FavMap = Record<string, FavEntry>;
export interface HistEntry { texto: string; fecha?: string; autor?: string }

const yoNombre = (): string => usePortal.getState().user?.name || '';
const parseJSON = <T,>(key: string, def: T): T => {
  try { const r = FSLS.getItem(key); return r ? (JSON.parse(r) as T) : def; } catch { return def; }
};
export const fechaHoraEs = (): string =>
  new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// ── Almacén ──
export function getFavs(): FavMap { return parseJSON<FavMap>('fav_procs', {}); }
export function saveFavs(o: FavMap): void { FSLS.setItem('fav_procs', JSON.stringify(o)); }
export function getFavTareas(): FavMap { return parseJSON<FavMap>('fav_tareas', {}); }
export function saveFavTareas(o: FavMap): void { FSLS.setItem('fav_tareas', JSON.stringify(o)); }
export function getFavHist(id: number | string): HistEntry[] { return parseJSON<HistEntry[]>('fav_hist_' + id, []); }
export function getFavHistTarea(id: number | string): HistEntry[] { return parseJSON<HistEntry[]>('fav_hist_tarea_' + id, []); }

/** Siempre un array de usuarios (formato viejo `usuario: string` o nuevo `usuarios: []`). */
export function getFavUsuarios(f?: FavEntry | null): string[] {
  if (!f) return [];
  if (Array.isArray(f.usuarios)) return f.usuarios;
  if (f.usuario) return [f.usuario];
  return [];
}
/** ¿Puede la sesión actual quitar este favorito? admin, asignado o quien lo marcó. */
export function puedeQuitarFav(f?: FavEntry | null): boolean {
  if (!f) return true;
  if (esAdmin()) return true;
  const yo = yoNombre();
  if (!yo) return false;
  if (getFavUsuarios(f).includes(yo)) return true;
  if (f.creadoPor && f.creadoPor === yo) return true;
  return false;
}
export function avisoFavAjeno(f: FavEntry): void {
  const duenos = getFavUsuarios(f).join(', ') || 'otro usuario';
  showToast('🔒 Este favorito es de ' + duenos + ' — solo esa persona o el admin pueden quitarlo');
}
/** Qué pasa al hacer clic en la estrella de un favorito que YA existe. */
export type FavAccion = 'sumarme' | 'lleno' | 'salirme' | 'quitar';
export function favAccionClic(f?: FavEntry | null): FavAccion {
  const yo = yoNombre();
  const us = getFavUsuarios(f);
  const soyGestion = GESTION_FAV_USERS.includes(yo);
  if (soyGestion && !us.includes(yo)) return us.length >= MAX_FAV_USUARIOS ? 'lleno' : 'sumarme';
  if (soyGestion && us.includes(yo) && us.length > 1) return 'salirme';
  return 'quitar';
}
export function favTituloEstrella(f: FavEntry): string {
  const us = getFavUsuarios(f).join(', ');
  const a = favAccionClic(f);
  if (a === 'sumarme') return 'Favorito de ' + us + ' — click para sumarte también';
  if (a === 'lleno') return 'Favorito de ' + us + ' — ya lo tienen ' + MAX_FAV_USUARIOS + ' personas (máximo)';
  if (a === 'salirme') return 'Favorito de ' + us + ' — click para quitarte tú (los demás lo conservan)';
  return puedeQuitarFav(f) ? 'Favorito de ' + us + ' — click para quitar' : 'Favorito de ' + us + ' — solo ' + us + ' o el admin pueden quitarlo';
}
export function favEstrellaBloqueada(f: FavEntry): boolean {
  const a = favAccionClic(f);
  return a === 'lleno' || (a === 'quitar' && !puedeQuitarFav(f));
}

function logAuditTarea(id: string, accion: string, ctx: string): void {
  getBackend().logAudit({ key: 'favtarea_' + id, accion, label: '', ctx, byName: yoNombre() });
}

// ── Tareas de Gestión (Excel + overrides + manuales), como getAllTareasGestion del original ──
export function getAllTareasGestion(): TareaGestion[] {
  const st = usePortal.getState();
  const overrides = parseJSON<Record<string, Record<string, unknown>>>('tgOverrides', {});
  const deExcel = st.TAREAS_GESTION_EXCEL
    .filter((t) => !(overrides[t.id] && overrides[t.id].eliminada))
    .map((t) => {
      const proc = st.DATA.find((r) => r.id === t.nroId);
      const ov = (overrides[t.id] || {}) as Partial<TareaGestion>;
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
      } as TareaGestion;
    });
  const manuales = parseJSON<TareaGestion[]>('tareasGestion', []);
  return [...deExcel, ...manuales];
}

// ── Toggle favorito de proceso ──
export function toggleFav(procId: number): void {
  const favs = getFavs();
  const key = String(procId);
  const yo = yoNombre();
  if (favs[key]) {
    const f = favs[key];
    const us = getFavUsuarios(f);
    const accion = favAccionClic(f);
    if (accion === 'lleno') { showToast('⭐ Este proceso ya lo tienen ' + MAX_FAV_USUARIOS + ' personas (' + us.join(', ') + ') — es el máximo'); return; }
    if (accion === 'sumarme') {
      f.usuarios = [...us, yo]; delete f.usuario;
      saveFavs(favs); updateFavBadge();
      registrarAuditoriaFav('fav_add', procId, '(se sumó ' + yo + '; también lo tiene ' + us.join(', ') + ')');
      showToast('⭐ Agregado a tus favoritos — también lo tiene ' + us.join(', '));
      return;
    }
    if (accion === 'salirme') {
      f.usuarios = us.filter((u) => u !== yo); delete f.usuario;
      saveFavs(favs); updateFavBadge();
      registrarAuditoriaFav('fav_remove', procId, '(solo ' + yo + '; lo conserva ' + f.usuarios.join(', ') + ')');
      showToast('⭐ Quitado de tus favoritos — lo sigue teniendo ' + f.usuarios.join(', '));
      return;
    }
    if (!puedeQuitarFav(f)) { avisoFavAjeno(f); return; }
    delete favs[key];
    saveFavs(favs); updateFavBadge();
    registrarAuditoriaFav('fav_remove', procId);
    showToast('⭐ Quitado de favoritos');
    return;
  }
  // Equipo de Gestión: se marca de inmediato para él/ella.
  if (GESTION_FAV_USERS.includes(yo)) {
    favs[key] = { id: procId, usuarios: [yo], ts: Date.now(), obs: '', creadoPor: yo };
    saveFavs(favs); updateFavBadge();
    registrarAuditoriaFav('fav_add', procId);
    showToast('⭐ Agregado a tus favoritos');
    return;
  }
  // Resto (Paralegal, etc.): se pregunta a quién se asigna.
  usePortal.getState().openModal('favUser', { mode: 'proc', id: procId });
}

// ── Toggle favorito de tarea ──
export function toggleFavTarea(tareaId: string, cliente?: string, tipo?: string): void {
  const favs = getFavTareas();
  if (!cliente && !tipo) {
    const t = getAllTareasGestion().find((x) => x.id === tareaId);
    if (t) { cliente = t.cliente || ''; tipo = t.tipo || ''; }
  }
  const ctxBase = (tipo ? tipo + ' — ' : '') + (cliente || 'Tarea #' + tareaId);
  const yo = yoNombre();
  if (favs[tareaId]) {
    const f = favs[tareaId];
    const us = getFavUsuarios(f);
    const accion = favAccionClic(f);
    if (accion === 'lleno') { showToast('⭐ Esta tarea ya la tienen ' + MAX_FAV_USUARIOS + ' personas (' + us.join(', ') + ') — es el máximo'); return; }
    if (accion === 'sumarme' || accion === 'salirme') {
      const sumo = accion === 'sumarme';
      f.usuarios = sumo ? [...us, yo] : us.filter((u) => u !== yo);
      delete f.usuario;
      saveFavTareas(favs); updateFavBadge();
      logAuditTarea(tareaId, sumo ? 'fav_add' : 'fav_remove',
        ctxBase + (sumo ? ' (se sumó ' + yo + '; también lo tiene ' + us.join(', ') + ')' : ' (solo ' + yo + '; lo conserva ' + f.usuarios.join(', ') + ')'));
      showToast(sumo ? '⭐ Tarea agregada a tus favoritos — también la tiene ' + us.join(', ') : '⭐ Tarea quitada de tus favoritos — la sigue teniendo ' + f.usuarios.join(', '));
      return;
    }
    if (!puedeQuitarFav(f)) { avisoFavAjeno(f); return; }
    delete favs[tareaId];
    saveFavTareas(favs); updateFavBadge();
    logAuditTarea(tareaId, 'fav_remove', ctxBase);
    showToast('⭐ Tarea quitada de favoritos');
    return;
  }
  if (GESTION_FAV_USERS.includes(yo)) {
    favs[tareaId] = { id: tareaId, cliente: cliente || '', tipo: tipo || '', usuarios: [yo], ts: Date.now(), creadoPor: yo };
    saveFavTareas(favs); updateFavBadge();
    logAuditTarea(tareaId, 'fav_add', ctxBase);
    showToast('⭐ Tarea agregada a tus favoritos');
    return;
  }
  usePortal.getState().openModal('favUser', { mode: 'tarea', id: tareaId, cliente: cliente || '', tipo: tipo || '' });
}

/** Celda <td> con la estrella (equivale al getFavBadge del original, que devolvía HTML). */
export function getFavBadge(id: number): ReactElement {
  const favs = getFavs();
  const f = favs[String(id)];
  const tdStyle = { width: 28, textAlign: 'center' as const, padding: '0 4px', overflow: 'visible' as const };
  const onTd = (e: { stopPropagation(): void }) => e.stopPropagation();
  if (f) {
    const us = getFavUsuarios(f);
    return createElement('td', { style: tdStyle, onClick: onTd },
      createElement('span', {
        className: 'fav-star activo', onClick: () => toggleFav(id), title: favTituloEstrella(f),
        style: favEstrellaBloqueada(f) ? { cursor: 'not-allowed' } : undefined,
      }, '⭐'),
      us.length > 1 ? createElement('span', {
        style: { display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--amber)', lineHeight: 1 }, title: us.join(', '),
      }, '×' + us.length) : null);
  }
  return createElement('td', { style: tdStyle, onClick: onTd },
    createElement('span', { className: 'fav-star', onClick: () => toggleFav(id), title: 'Marcar como favorito' }, '⭐'));
}

/** Contador de la pestaña Favoritos (#fav-tab-cnt). En React lo pinta GestionView con getFavs(); esto mantiene la compatibilidad con el DOM si existe. */
export function updateFavBadge(): void {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('fav-tab-cnt');
  if (el) el.textContent = String(Object.keys(getFavs()).length);
}

// ── Comentarios (historial) ──
export function guardarFavComentario(id: number | string, texto: string): boolean {
  texto = texto.trim();
  if (!texto) { showToast('Escribe un comentario antes de guardar'); return false; }
  const hist = getFavHist(id);
  hist.unshift({ texto, autor: '—', fecha: fechaHoraEs() });
  FSLS.setItem('fav_hist_' + id, JSON.stringify(hist));
  showToast('✓ Comentario guardado');
  return true;
}
export function borrarFavComentario(id: number | string, idx: number): void {
  const hist = getFavHist(id);
  hist.splice(idx, 1);
  FSLS.setItem('fav_hist_' + id, JSON.stringify(hist));
}
export function guardarFavTareaComentario(id: string, texto: string): boolean {
  texto = texto.trim();
  if (!texto) { showToast('Escribe algo primero'); return false; }
  const hist = getFavHistTarea(id);
  hist.unshift({ texto, fecha: fechaHoraEs() });
  FSLS.setItem('fav_hist_tarea_' + id, JSON.stringify(hist));
  showToast('✓ Comentario guardado');
  return true;
}
export function borrarFavTareaComentario(id: string, idx: number): void {
  const hist = getFavHistTarea(id);
  hist.splice(idx, 1);
  FSLS.setItem('fav_hist_tarea_' + id, JSON.stringify(hist));
}

// ── Sentencias del proceso ──
export interface Sentencia { label: string; fecha: string; sentencia: string; resultado: string; monto: string; detalle: string }
export function haySentenciasDisponibles(): boolean {
  const m = usePortal.getState().SENTENCIAS_BY_ID;
  return !!(m && Object.keys(m).length);
}
export function getSentencias(nroId: number): Sentencia[] {
  const cl = (v: unknown): string => {
    const s = String(v == null ? '' : v).trim();
    return (s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') ? '' : s;
  };
  const fila = usePortal.getState().SENTENCIAS_BY_ID?.[nroId] as Record<string, unknown> | undefined;
  if (!fila) return [];
  const LABELS: Record<number, string> = {
    1: '1ra instancia', 2: '2da sentencia 1ra inst.', 3: '2da instancia',
    4: '2da sentencia 2da inst.', 5: '3ra instancia', 6: '2da sentencia 3ra inst.',
  };
  const sents: Sentencia[] = [];
  for (let i = 1; i <= 6; i++) {
    const fecha = cl(fila['fecha_s' + i] || '');
    const sent = cl(fila['sentencia_s' + i] || '');
    const result = cl(fila['resultado_s' + i] || '');
    const monto = cl(fila['monto_s' + i] || '');
    const detalle = cl(fila['detalle_s' + i] || '');
    if (sent || result) sents.push({ label: LABELS[i], fecha, sentencia: sent, resultado: result, monto, detalle });
  }
  return sents
    .map((s, idx) => ({ ...s, _idx: idx, _t: s.fecha ? new Date(s.fecha).getTime() : NaN }))
    .sort((a, b) => {
      const aOk = !isNaN(a._t), bOk = !isNaN(b._t);
      if (!aOk && !bOk) return a._idx - b._idx;
      if (!aOk) return 1;
      if (!bOk) return -1;
      return a._t - b._t;
    })
    .map(({ _idx, _t, ...s }) => { void _idx; void _t; return s; });
}

// ── Formato fecha / monto ──
export function fmtFechaEs(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  const d = v instanceof Date ? v : new Date(v as string);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '');
}
export function fmtMonto(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(String(v).replace(/,/g, ''));
  if (isNaN(n)) return String(v);
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
