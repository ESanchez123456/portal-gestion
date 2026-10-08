// Helpers del módulo B (Reporte total + Próximas audiencias): filtrado, exportación y datos derivados.
// Portado de legacy/index.html (getFiltered 2759-2790, renderAud 3040-3110, procToRow/exportar 4670-4760).
import { useMemo } from 'react';
import { usePortal } from '@/store/portal';
import { encargadosPorOrgano, colorEncargado } from '@/lib/juzgados';
import { getAllTareasGestion } from '@/lib/gestion';
import type { Proceso, TareaGestion } from '@/types';

export const PAGE = 50;

export type FddGroup = 'instancia' | 'pacto' | 'relevancia' | 'cliente' | 'bitacora' | 'organo' | 'encargado';
export type FddGroupAud = 'estado' | 'instancia' | 'pacto' | 'cliente' | 'organo' | 'encargado';
export const FDD_GROUPS: FddGroup[] = ['instancia', 'pacto', 'relevancia', 'cliente', 'bitacora', 'organo', 'encargado'];
export const FDD_GROUPS_AUD: FddGroupAud[] = ['estado', 'instancia', 'pacto', 'cliente', 'organo', 'encargado'];
export const emptyFdd = (): Record<FddGroup, Set<string>> =>
  ({ instancia: new Set(), pacto: new Set(), relevancia: new Set(), cliente: new Set(), bitacora: new Set(), organo: new Set(), encargado: new Set() });
export const emptyFddAud = (): Record<FddGroupAud, Set<string>> =>
  ({ estado: new Set(), instancia: new Set(), pacto: new Set(), cliente: new Set(), organo: new Set(), encargado: new Set() });

/** Etiquetas de los chips de filtros activos. */
export const CHIP_LABELS: Record<string, string> = {
  sensible: 'Sensibles', ejecucion: 'Solo ejecución', giro: 'Solo en giro', tarea: 'Con tarea',
  'PRIMERA INSTANCIA': '1ra instancia', 'SEGUNDA INSTANCIA': '2da instancia',
  'TERCERA INSTANCIA': '3ra/Suprema', 'EJECUCIÓN': 'Ejecución',
  Fijo: 'Fijo', Horas: 'Horas', 'Etapas o Hitos': 'Etapas', Retainer: 'Retainer', __sin__: 'Sin encargado',
};
export const COL_LABELS: Record<string, string> = {
  cliente: 'Cliente', contraparte: 'Contraparte', expediente: 'Expediente',
  supervisor: 'Supervisor', responsable: 'Responsable', instancia: 'Instancia',
  situacion: 'Situación', relevancia: 'Relevancia', pacto: 'Pacto',
  especialista: 'CEJ', organo: 'Órgano', bitacora: 'Bitácora',
  proxTarea: 'Tarea', proxDiligencia: 'Audiencia',
};
export const SUPERVISORES = ['Carlos Morales', 'Cynthia Lagos', 'Elyana Arias', 'Katia Jacinto', 'Samuel Paz', 'Solanch Estrella'];

const s = (v: unknown): string => (v == null ? '' : String(v));

// ── Responsables (encargados) por órgano, calculados una vez por cambio de datos/juzgados ──
export type EncMap = Map<string, string[]>;
export function useEncargadosMap(): EncMap {
  const DATA = usePortal((st) => st.DATA);
  const juz = usePortal((st) => st.kv['juzgados_data']);
  return useMemo(() => {
    void juz; // dependencia: se recalcula solo cuando cambian los juzgados
    const m: EncMap = new Map();
    DATA.forEach((r) => { if (!m.has(r.organo)) m.set(r.organo, encargadosPorOrgano(r.organo)); });
    return m;
  }, [DATA, juz]);
}
const encDe = (m: EncMap, organo: string) => m.get(organo) ?? encargadosPorOrgano(organo);
function pasaEncargado(set: Set<string>, es: string[]): boolean {
  return es.some((e) => set.has(e)) || (es.length === 0 && set.has('__sin__'));
}

/** Opciones del filtro "Responsable" (encargado de gestión de cada órgano, según Juzgados). */
export function encargadosOpts(DATA: Proceso[], enc: EncMap): { key: string; label: string; dot: string }[] {
  const set = new Set<string>(); let haySin = false;
  DATA.forEach((r) => { const es = enc.get(r.organo) || []; if (es.length) es.forEach((e) => set.add(e)); else haySin = true; });
  const opts = Array.from(set).sort().map((v) => ({ key: v, label: v, dot: colorEncargado(v) }));
  if (haySin) opts.push({ key: '__sin__', label: 'Sin asignar', dot: 'var(--gray-b)' });
  return opts;
}

// ── Tareas de gestión agrupadas por proceso (1 sola pasada por cambio de datos) ──
let cacheKey = ''; let cacheMap: Map<number, TareaGestion[]> = new Map();
export function useTareasPorProc(): Map<number, TareaGestion[]> {
  const kvRev = usePortal((st) => st.kvRev);
  const dataRev = usePortal((st) => st.dataRev);
  return useMemo(() => {
    const key = kvRev + ':' + dataRev;
    if (key === cacheKey) return cacheMap;
    const m = new Map<number, TareaGestion[]>();
    getAllTareasGestion().forEach((t) => { const a = m.get(t.nroId); if (a) a.push(t); else m.set(t.nroId, [t]); });
    cacheKey = key; cacheMap = m;
    return m;
  }, [kvRev, dataRev]);
}

// ── Reporte total: getFiltered ──
export interface RepFilters {
  q: string; sup: string; dist: string; mf: '' | 'sent' | 'adm' | 'arch' | 'dili';
  fdd: Record<FddGroup, Set<string>>;
  col: Record<string, string>; // valor (en minúsculas) por columna
}
export function filtrarReporte(DATA: Proceso[], f: RepFilters, enc: EncMap, excludeCol?: string): Proceso[] {
  const q = f.q.toLowerCase();
  const { instancia: inst, pacto: pact, relevancia: relv, cliente: cliSet, bitacora: bitSet, organo: orgSet, encargado: encSet } = f.fdd;
  const cols = Object.entries(f.col).filter(([c]) => c !== excludeCol);
  return DATA.filter((r) => {
    if (q && !(r.cliente + r.contraparte + r.expediente + r.responsable + r.organo + r.especialista + r.bitacora + r.proxTarea).toLowerCase().includes(q)) return false;
    if (f.sup && r.supervisor !== f.sup) return false;
    if (f.dist && r.distrito !== f.dist) return false;
    if (f.mf === 'sent' && !r.porSentenciar && !r.porNuevaSentencia) return false;
    if (f.mf === 'adm' && !r.porAdmitir) return false;
    if (f.mf === 'arch' && !r.porArchivo) return false;
    if (f.mf === 'dili' && !r.proxDiligencia) return false;
    if (inst.size > 0 && !inst.has(r.instancia)) return false;
    if (pact.size > 0 && !pact.has(r.pacto)) return false;
    if (relv.size > 0 && !relv.has(r.relevancia)) return false;
    if (cliSet.size > 0 && !cliSet.has(r.cliente)) return false;
    if (bitSet.size > 0 && !bitSet.has(r.bitacora)) return false;
    if (orgSet.size > 0 && !orgSet.has(r.organo)) return false;
    if (encSet.size > 0 && !pasaEncargado(encSet, encDe(enc, r.organo))) return false;
    for (const [col, val] of cols) { if (!s(r[col]).toLowerCase().includes(val)) return false; }
    return true;
  });
}

// ── Próximas audiencias: renderAud (filtrado + orden) ──
export interface AudFilters {
  q: string; sup: string; tipo: string; desde: string; hasta: string; sortAsc: boolean;
  fdd: Record<FddGroupAud, Set<string>>;
  col: Record<string, string>;
}
export const parseAudFecha = (f?: string): Date | null => {
  if (!f) return null;
  const [d, m, y] = f.split('/');
  return new Date(+y, +m - 1, +d);
};
/** Base de valores para el dropdown de columna (solo q/sup/tipo y filtros de columna, sin fdd ni fechas). */
export function baseAudParaColumna(DATA: Proceso[], f: AudFilters, excludeCol: string): Proceso[] {
  const q = f.q.toLowerCase();
  const cols = Object.entries(f.col).filter(([c]) => c !== excludeCol);
  return DATA.filter((r) => {
    if (!r.proxDiligencia) return false;
    if (f.sup && r.supervisor !== f.sup) return false;
    if (f.tipo && r.proxDiligencia !== f.tipo) return false;
    if (q && !(r.cliente + r.contraparte + r.expediente + r.responsable + r.organo).toLowerCase().includes(q)) return false;
    for (const [c, v] of cols) { if (!s(r[c]).toLowerCase().includes(v)) return false; }
    return true;
  });
}
export function filtrarAudiencias(DATA: Proceso[], f: AudFilters, enc: EncMap): Proceso[] {
  const q = f.q.toLowerCase();
  const cols = Object.entries(f.col);
  const { estado: est, instancia: inst, pacto: pact, cliente: cliSet, organo: orgSet, encargado: encSet } = f.fdd;
  const rows = DATA.filter((r) => {
    if (!r.proxDiligencia) return false;
    if (f.sup && r.supervisor !== f.sup) return false;
    if (f.tipo && r.proxDiligencia !== f.tipo) return false;
    if (q && !(r.cliente + r.contraparte + r.expediente + r.responsable + r.organo).toLowerCase().includes(q)) return false;
    for (const [c, v] of cols) { if (!s(r[c]).toLowerCase().includes(v)) return false; }
    if (est.size) {
      const pass = (est.has('sensible') && r.sensible) || (est.has('ejecucion') && (r.instancia || '').toLowerCase().includes('ejec')) || (est.has('tarea') && r.proxTarea);
      if (!pass) return false;
    }
    if (inst.size && !inst.has(r.instancia)) return false;
    if (pact.size && !pact.has(r.pacto)) return false;
    if (cliSet.size && !cliSet.has(r.cliente)) return false;
    if (orgSet.size && !orgSet.has(r.organo)) return false;
    if (encSet.size && !pasaEncargado(encSet, encDe(enc, r.organo))) return false;
    if (f.desde || f.hasta) {
      const ft = parseAudFecha(r.proxDiliFecha);
      if (!ft) return false;
      if (f.desde && ft < new Date(f.desde)) return false;
      if (f.hasta && ft > new Date(f.hasta + 'T23:59:59')) return false;
    }
    return true;
  });
  rows.sort((a, b) => {
    const va = (a.proxDiliFecha || '').split('/').reverse().join(''), vb = (b.proxDiliFecha || '').split('/').reverse().join('');
    return f.sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
  });
  return rows;
}

// ── Estadísticas ──
export function statsReporte(DATA: Proceso[]) {
  const sent = DATA.filter((r) => r.porSentenciar || r.porNuevaSentencia).length;
  return {
    total: DATA.length, sent,
    dili: DATA.filter((r) => r.proxDiligencia).length,
    sens: DATA.filter((r) => r.sensible).length,
    ej: DATA.filter((r) => r.situacion === 'EJECUCION').length,
    adm: DATA.filter((r) => r.porAdmitir).length,
    arch: DATA.filter((r) => r.porArchivo).length,
  };
}
export function statsAudiencias(DATA: Proceso[]) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const finSemana = new Date(hoy); finSemana.setDate(finSemana.getDate() + 6);
  const conDili = DATA.filter((r) => r.proxDiligencia);
  let hoyN = 0, semana = 0, vencidas = 0, sens = 0;
  conDili.forEach((r) => {
    const ft = parseAudFecha(r.proxDiliFecha);
    if (r.sensible) sens++;
    if (!ft || isNaN(ft.getTime())) return;
    if (ft.getTime() === hoy.getTime()) hoyN++;
    if (ft >= hoy && ft <= finSemana) semana++;
    if (ft < hoy) vencidas++;
  });
  return { total: conDili.length, hoy: hoyN, semana, vencidas, sens };
}

/** yyyy-mm-dd en hora local. */
export const isoLocal = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

// ── Exportación a Excel ──
export function procToRow(r: Proceso): Record<string, unknown> {
  return {
    ID: r.id, Cliente: r.cliente, Contraparte: r.contraparte, Expediente: r.expediente,
    Supervisor: r.supervisor, Responsable: r.responsable, Instancia: r.instancia, Situación: r.situacion,
    Relevancia: r.relevancia, Pacto: r.pacto, Distrito: r.distrito, Órgano: r.organo, Bitácora: r.bitacora,
    'Especialista legal': r.especialista, 'Próxima tarea': r.proxTarea, 'Fecha próxima tarea': r.proxTareaFecha,
    'Próxima audiencia': r.proxDiligencia, 'Fecha próxima audiencia': r.proxDiliFecha, 'ID Tarea': r.proxDiliId || '',
    'Días sin diligencia': r.ultimaDiliFecha
      ? Math.round((new Date().getTime() - new Date(r.ultimaDiliFecha.split('/').reverse().join('-')).getTime()) / (1000 * 60 * 60 * 24))
      : '',
  };
}
export async function exportarXlsx(rows: Proceso[], hoja: string, archivo: string): Promise<void> {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows.map(procToRow));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, hoja);
  XLSX.writeFile(wb, archivo);
}
