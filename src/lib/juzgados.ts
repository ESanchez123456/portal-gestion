import { FSLS, usePortal } from '@/store/portal';
import { JUZGADOS_SEED } from '@/lib/juzgadosSeed';
import { INICIALES_GESTION } from '@/lib/constants';
import { esAdmin } from '@/lib/audit';
import type { Juzgado } from '@/types';

export const ENCARGADO_COLORS: Record<string, string> = { ATG: '#2563eb', CMP: '#16a34a', RMR: '#dc2626', SMO: '#7c3aed' };
export function colorEncargado(enc: string): string {
  if (!enc) return '#9ca3af';
  if (ENCARGADO_COLORS[enc]) return ENCARGADO_COLORS[enc];
  let h = 0; for (let i = 0; i < enc.length; i++) h = (h * 31 + enc.charCodeAt(i)) >>> 0;
  const palette = ['#0891b2', '#ea580c', '#4338ca', '#be185d', '#65a30d'];
  return palette[h % palette.length];
}
export const normOrgano = (s: unknown): string => (s ?? '').toString().trim().toUpperCase().replace(/\s+/g, ' ');

export function getJuzgados(): Juzgado[] {
  let arr: Juzgado[] | null = null;
  try { const raw = FSLS.getItem('juzgados_data'); if (raw) arr = JSON.parse(raw); } catch { /* */ }
  if (!arr || !arr.length) {
    arr = JUZGADOS_SEED.map((r, i) => ({ id: 'jz_' + (i + 1), distrito: r[0], tipoJuzgado: r[1], organo: r[2], magistrado: r[3], condicion: r[4], encargado: r[5] || '' }));
    // No se persiste aquí: solo el admin escribe (ver sincronizarJuzgadosConRT / edición).
  }
  return arr;
}
export function saveJuzgados(arr: Juzgado[]) { FSLS.setItem('juzgados_data', JSON.stringify(arr)); }

export function encargadosPorOrgano(organo: string): string[] {
  const key = normOrgano(organo);
  if (!key) return [];
  const set = new Set<string>();
  getJuzgados().forEach((j) => { if (normOrgano(j.organo) === key && j.encargado) set.add(j.encargado); });
  return Array.from(set).sort();
}
/** Persona de Gestión dueña de un órgano (la que más magistrados tiene a cargo). */
export function gestionDuenoPorOrgano(organo: string): string {
  const key = normOrgano(organo);
  if (!key) return '';
  const cnt: Record<string, number> = {};
  getJuzgados().forEach((j) => { if (j.encargado && normOrgano(j.organo) === key) cnt[j.encargado] = (cnt[j.encargado] || 0) + 1; });
  const top = Object.keys(cnt).filter((e) => INICIALES_GESTION[e]).sort((a, b) => cnt[b] - cnt[a] || a.localeCompare(b))[0];
  return top ? INICIALES_GESTION[top] : '';
}

// ── Homologación con el Reporte Total (col. K órgano, col. M tipo de juzgado) ──
function juzFamilia(n: string) {
  n = (n || '').toUpperCase();
  if (/SALA SUPREMA/.test(n)) return 'supr';
  if (/PAZ LETRADO/.test(n)) return 'paz';
  if (/SALA/.test(n)) return 'sala';
  if (/CONSTITUCIONAL/.test(n)) return 'const';
  if (/TRABAJO|LABORAL/.test(n)) return 'trab';
  return 'otro';
}
function juzClave(distrito: string, organo: string) {
  const m = (organo || '').match(/^\s*(\d{1,3})/);
  const fam = juzFamilia(organo);
  if (!m || fam === 'otro') return '';
  return normOrgano(distrito) + '|' + fam + '|' + (/TRANSITORI/i.test(organo) ? 'T' : 'P') + '|' + parseInt(m[1], 10);
}
function juzEditado(j: Juzgado): boolean {
  if (j.editado === true) return true;
  if (j.deRT || j.rt) return false;
  const m = /^jz_(\d+)$/.exec(j.id || '');
  if (!m) return true;
  const sd = JUZGADOS_SEED[parseInt(m[1], 10) - 1];
  if (!sd) return true;
  return !(normOrgano(j.distrito) === normOrgano(sd[0]) && normOrgano(j.tipoJuzgado) === normOrgano(sd[1]) && normOrgano(j.organo) === normOrgano(sd[2]));
}
/** Solo admin escribe. Lo editado a mano NUNCA se pisa. Idempotente. */
export function sincronizarJuzgadosConRT(): void {
  try {
    const DATA = usePortal.getState().DATA;
    if (!esAdmin() || !DATA || !DATA.length) return;
    const ocultos = new Set<string>(JSON.parse(FSLS.getItem('juzgados_rt_ocultos') || '[]'));
    type Ent = { distrito: string; organo: string; n: number; tipos: Record<string, number>; tipo?: string; usado?: boolean };
    const cat = new Map<string, Ent>();
    DATA.forEach((r) => {
      const o = normOrgano(r.organo); if (!o) return;
      const d = normOrgano(r.distrito);
      const k = d + '||' + o;
      let e = cat.get(k);
      if (!e) { e = { distrito: d, organo: o, n: 0, tipos: {} }; cat.set(k, e); }
      e.n++;
      const t = (r.tipoJuzgado || '').toString().trim();
      if (t) e.tipos[t] = (e.tipos[t] || 0) + 1;
    });
    cat.forEach((e) => { e.tipo = Object.keys(e.tipos).sort((a, b) => e.tipos[b] - e.tipos[a])[0] || ''; });
    const entries = Array.from(cat.values());
    const arr = getJuzgados();
    let changed = false;
    const grupos = new Map<string, Juzgado[]>();
    arr.forEach((j) => { const k = normOrgano(j.distrito) + '||' + normOrgano(j.organo); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k)!.push(j); });
    entries.forEach((e) => {
      const rows = grupos.get(e.distrito + '||' + e.organo);
      if (rows && rows.length) {
        e.usado = true;
        rows.forEach((j) => {
          if (juzEditado(j)) return;
          if (e.tipo && j.tipoJuzgado !== e.tipo) { j.tipoJuzgado = e.tipo; j.rt = true; changed = true; }
        });
      }
    });
    const claveSeed = new Map<string, Juzgado[][]>();
    grupos.forEach((rows, k) => {
      const j0 = rows[0];
      if (rows.some((j) => juzEditado(j) || j.deRT)) return;
      const c = juzClave(j0.distrito, j0.organo);
      if (!c) return;
      if (entries.some((e) => e.usado && e.distrito + '||' + e.organo === k)) return;
      claveSeed.set(c, (claveSeed.get(c) || []).concat([rows]));
    });
    claveSeed.forEach((lista, c) => {
      if (lista.length !== 1) return;
      const cands = entries.filter((e) => !e.usado && !/DESACTIVADO/.test(e.organo) && juzClave(e.distrito, e.organo) === c).sort((a, b) => b.n - a.n);
      if (!cands.length) return;
      if (cands[1] && cands[1].n * 2 > cands[0].n) return;
      const e = cands[0];
      lista[0].forEach((j) => {
        j.organoOriginal = j.organoOriginal || j.organo;
        j.organo = e.organo; j.rt = true;
        if (e.tipo) j.tipoJuzgado = e.tipo;
        changed = true;
      });
      e.usado = true;
    });
    entries.forEach((e) => {
      if (e.usado || ocultos.has(e.distrito + '||' + e.organo)) return;
      arr.push({
        id: 'jz_rt_' + e.distrito.replace(/\W+/g, '').slice(0, 12) + '_' + e.organo.replace(/\W+/g, '').slice(0, 40),
        distrito: e.distrito, tipoJuzgado: e.tipo || '', organo: e.organo, magistrado: '', condicion: '', encargado: '', deRT: true,
      });
      changed = true;
    });
    if (changed) saveJuzgados(arr);
  } catch (err) { console.error('sincronizarJuzgadosConRT', err); }
}
