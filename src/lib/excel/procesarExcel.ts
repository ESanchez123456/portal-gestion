/* eslint-disable @typescript-eslint/no-explicit-any */
// Port de procesarExcel (legacy ~3341-3735) y construirDiligenciasEquipos (~5446-5468).
// Función pura: sin DOM, sin estado global. Recibe las filas (sheet_to_json con cellDates:true,
// defval:'') del Reporte Total y del Reporte de Tareas y devuelve el ExcelPayload.
import type { ExcelPayload, Proceso, TareaGestion } from '@/types';

export type Row = Record<string, any>;

export interface ResultadoProcesar {
  payload: ExcelPayload;
  /** Estado de carpeta crudo por id (para explicar favoritos "ya no activos") */
  RAWRT_ESTADO_BY_ID: Record<number, string>;
}

const cl = (v: any): string => {
  const s = String(v == null ? '' : v).trim();
  return ['-', 'nan', 'None', 'null', ''].includes(s) ? '' : s;
};
const p2 = (n: number) => String(n).padStart(2, '0');

const fmtF = (v: any): string => {
  if (!v) return '';
  if (v instanceof Date) return p2(v.getDate()) + '/' + p2(v.getMonth() + 1) + '/' + v.getFullYear();
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const parts = s.slice(0, 10).split('-');
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }
  return s.slice(0, 10);
};
const fmtH = (v: any): string => {
  if (!v) return '';
  const s = String(v).trim();
  return s.includes(':') ? s.slice(0, 5) : s;
};

/** Lee un campo con múltiples nombres posibles (nuevo Excel primero). */
const gc = (r: Row, news: string[], olds?: string[]): string => {
  for (const k of news) { if (r[k] != null && String(r[k]).trim() != '') return cl(r[k]); }
  if (olds) for (const k of olds) { if (r[k] != null && String(r[k]).trim() != '') return cl(r[k]); }
  return '';
};

// Fecha del Planner / Diligencias equipos (usa getters UTC, como el original)
const fmtFp = (v: any): string => {
  if (!v) return '';
  if (v instanceof Date) return p2(v.getUTCDate()) + '/' + p2(v.getUTCMonth() + 1) + '/' + v.getUTCFullYear();
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return p2(d.getUTCDate()) + '/' + p2(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear();
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) { const p = s.slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s.slice(0, 10);
  return s.slice(0, 10);
};

/** Diligencias de TODOS los equipos (vista "Todos los equipos"). Port de construirDiligenciasEquipos. */
export function construirDiligenciasEquipos(rows: Row[] | null | undefined): Record<string, unknown>[] {
  const c = (v: any) => String(v == null ? '' : v).trim();
  return (rows || []).filter((r) => c(r['tipo']).toUpperCase().startsWith('DILIGENCIA -')).map((r) => ({
    nrotarea: Number(r['nrotarea'] || 0),
    supervisor: c(r['supervisor']),
    usuario: c(r['usuario']),
    cliente: c(r['clientefacturable'] || r['clienterepresentado']),
    expediente: c(r['expediente']),
    tipo: c(r['tipo']).replace(/^DILIGENCIA - /i, ''),
    fecha: fmtFp(r['fecha']),
    hora: c(r['hora']).slice(0, 5),
    estado: c(r['estadotarea']),
  }));
}

const NOMBRES_GESTION = ['Arturo Trelles', 'Carlos Morales', 'Juan Jose Edquen', 'Juan José Edquen', 'Roberto Matallana', 'Silvia Maldonado', 'Talía León', 'Talia Leon'];
const NOMBRES_GESTION_SET = new Set(['arturo trelles', 'carlos morales', 'juan jose edquen', 'juan josé edquen', 'roberto matallana', 'silvia maldonado', 'talía león', 'talia leon']);

/**
 * Procesa las filas del Reporte Total (rawRT) y del Reporte de Tareas (rawTA).
 * Lanza Error si algo falla (el llamador muestra el mensaje).
 */
export function procesarExcel(rawRT: Row[], rawTA: Row[]): ResultadoProcesar {
  // Filtrar activos — estadocarpeta puede estar vacío (= activo) o ser 'Activo'
  const activos = rawRT.filter((r) => {
    const ec = gc(r, ['estadocarpeta'], ['Estado carpeta', 'Estado Carpeta']).toLowerCase();
    return ec === '' || ec === 'activo';
  });

  // Mapa diagnóstico: valor crudo de Estado Carpeta de CUALQUIER proceso del Excel
  const RAWRT_ESTADO_BY_ID: Record<number, string> = {};
  rawRT.forEach((r) => {
    const _id = Number(gc(r, ['Nro'], ['Nro. ID']) || 0);
    if (!_id) return;
    RAWRT_ESTADO_BY_ID[_id] = gc(r, ['estadocarpeta'], ['Estado carpeta', 'Estado Carpeta']) || '(vacío)';
  });

  // Tareas pendientes para cruzar con procesos
  const taPend = rawTA.filter((r) => cl(r['estadotarea'] || '').toLowerCase() === 'pendiente');

  // Tareas de gestión del Excel (tipo empieza con 'Gestión' o 'Gestion')
  const TAREAS_GESTION_EXCEL: TareaGestion[] = rawTA
    .filter((r) => { const t = cl(r['tipo'] || '').toLowerCase(); return t.startsWith('gestión') || t.startsWith('gestion'); })
    .map((r) => ({
      id: 'ex_' + cl(r['nrotarea'] || ''),
      nroId: Number(r['nroproceso'] || 0),
      nrotarea: Number(r['nrotarea'] || 0),
      cliente: cl(r['clientefacturable'] || r['clienterepresentado'] || ''),
      contraparte: cl(r['contraparte'] || ''),
      expediente: cl(r['expediente'] || ''),
      tipo: cl(r['tipo'] || ''),
      asignado: cl(r['usuario'] || r['responsable'] || ''),
      agendadoPor: 'Excel/MyBiG',
      fecha: fmtF(r['fecha']),
      hora: fmtH(r['hora'] || ''),
      estado: cl(r['estadotarea'] || 'Pendiente'),
      obs: cl(r['notas'] || r['comentarios'] || ''),
      origen: 'excel',
      supervisor: cl(r['supervisor'] || ''),
      responsable: cl(r['responsable'] || ''),
      organo: cl(r['organojurisdiccional'] || ''),
      distrito: cl(r['distrito'] || ''),
    }));

  // Diligencias asignadas a miembros del equipo Gestión (para el calendario)
  const DILIGENCIAS_GESTION_EXCEL = rawTA
    .filter((r) => {
      const tipo = cl(r['tipo'] || '').toUpperCase();
      const usuario = cl(r['usuario'] || '');
      const alterno = cl(r['asignado_alterno'] || '');
      return tipo.startsWith('DILIGENCIA -') && (
        NOMBRES_GESTION.some((n) => n.toLowerCase() === usuario.toLowerCase()) ||
        NOMBRES_GESTION.some((n) => n.toLowerCase() === alterno.toLowerCase())
      );
    })
    .map((r) => ({
      nroId: Number(r['nroproceso'] || 0),
      nrotarea: Number(r['nrotarea'] || 0),
      cliente: cl(r['clientefacturable'] || r['clienterepresentado'] || ''),
      expediente: cl(r['expediente'] || ''),
      tipo: cl(r['tipo'] || '').replace(/^DILIGENCIA - /i, ''),
      asignado: cl(r['usuario'] || r['responsable'] || ''),
      asignadoAlt: cl(r['asignado_alterno'] || ''),
      responsable: cl(r['responsable'] || ''),
      supervisor: cl(r['supervisor'] || ''),
      organo: cl(r['organojurisdiccional'] || ''),
      distrito: cl(r['distrito'] || ''),
      materia: cl(r['materia'] || ''),
      submateria: cl(r['submateria'] || ''),
      notas: cl(r['notas'] || ''),
      comentarios: cl(r['comentarios'] || ''),
      fecha: fmtF(r['fecha']),
      hora: fmtH(r['hora'] || ''),
      estado: cl(r['estadotarea'] || ''),
    }));

  // Mapa liviano de sentencias por proceso (fecha_s/sentencia_s/resultado_s/monto_s/detalle_s de 1 a 6)
  const SENTENCIAS_BY_ID: Record<string, unknown> = {};
  activos.forEach((r) => {
    const id = Number(gc(r, ['Nro'], ['Nro. ID']) || 0);
    if (!id) return;
    const obj: Record<string, unknown> = {};
    for (let i = 1; i <= 6; i++) {
      ['fecha_s' + i, 'sentencia_s' + i, 'resultado_s' + i, 'monto_s' + i, 'detalle_s' + i].forEach((k) => {
        if (r[k] != null && String(r[k]).trim() !== '') obj[k] = r[k];
      });
    }
    if (Object.keys(obj).length) SENTENCIAS_BY_ID[id] = obj;
  });

  // Tareas pendientes del equipo Gestión con fecha (para el Planner)
  const PLANNER_EXCEL_TAREAS = rawTA
    .filter((r) => {
      const est = String(r['estadotarea'] || '').trim();
      const usuario = String(r['usuario'] || '').trim().toLowerCase();
      const alterno = String(r['asignado_alterno'] || '').trim().toLowerCase();
      return est === 'Pendiente' && (NOMBRES_GESTION_SET.has(usuario) || NOMBRES_GESTION_SET.has(alterno)) && r['fecha'];
    })
    .map((r) => ({
      nroId: Number(r['nroproceso'] || 0),
      nrotarea: Number(r['nrotarea'] || 0),
      cliente: cl(r['clientefacturable'] || r['clienterepresentado'] || ''),
      expediente: cl(r['expediente'] || ''),
      tipo: cl(r['tipo'] || ''),
      asignado: cl(r['usuario'] || ''),
      asignadoAlt: cl(r['asignado_alterno'] || ''),
      fecha: fmtFp(r['fecha']),
      hora: cl(r['hora'] || '').slice(0, 5),
      estado: cl(r['estadotarea'] || ''),
      supervisor: cl(r['supervisor'] || ''),
      responsable: cl(r['responsable'] || ''),
      materia: cl(r['materia'] || ''),
      submateria: cl(r['submateria'] || ''),
      notas: cl(r['notas'] || r['comentarios'] || ''),
      _src: 'excel',
      _key: 'excel_' + cl(r['nrotarea'] || ''),
    }));

  // Diligencias de TODOS los equipos
  const DILIGENCIAS_EQUIPOS_EXCEL = construirDiligenciasEquipos(rawTA);

  // Última diligencia por proceso (para calcular días sin diligencia)
  const taUltDili: Record<number, Row> = {};
  rawTA.forEach((r) => {
    const tipo = cl(r['tipo'] || '').toUpperCase();
    if (!tipo.startsWith('DILIGENCIA -')) return;
    const np = Number(r['nroproceso'] || 0);
    const fd = fmtF(r['fecha']);
    const fdSort = fd ? fd.split('/').reverse().join('-') : '';
    if (!taUltDili[np] || fdSort > (taUltDili[np]._fds || ''))
      taUltDili[np] = { ...r, _fd: fd, _fds: fdSort };
  });
  const taNoDili: Record<number, Row> = {};
  taPend.forEach((r) => {
    const np = Number(r['nroproceso'] || 0);
    const tipo = cl(r['tipo'] || '').toUpperCase();
    const fd = fmtF(r['fecha']);
    if (!tipo.startsWith('DILIGENCIA -')) {
      if (!taNoDili[np] || fd < (taNoDili[np]._fd || 'zzz')) taNoDili[np] = { ...r, _fd: fd };
    }
  });

  // Próxima diligencia — priorizar Pendientes; Cancelada/Cumplida solo si no hay Pendiente
  const taDili: Record<number, Row> = {};
  const hoyStr = (() => { const h = new Date(); return h.getFullYear() + '-' + p2(h.getMonth() + 1) + '-' + p2(h.getDate()); })();
  rawTA.forEach((r) => {
    const tipo = cl(r['tipo'] || '').toUpperCase();
    if (!tipo.startsWith('DILIGENCIA -')) return;
    const np = Number(r['nroproceso'] || 0);
    const fd = fmtF(r['fecha']);
    const estado = cl(r['estadotarea'] || '');
    const esPend = estado.toLowerCase() === 'pendiente';
    const fdSort = fd ? fd.split('/').reverse().join('-') : '';
    const existing = taDili[np];
    if (!existing) { taDili[np] = { ...r, _fd: fd, _fds: fdSort, _esPend: esPend }; return; }
    if (esPend && !existing._esPend) { taDili[np] = { ...r, _fd: fd, _fds: fdSort, _esPend: true }; return; }
    if (!esPend && existing._esPend) return;
    const exSort = existing._fds || '';
    const fdFut = fdSort >= hoyStr, exFut = exSort >= hoyStr;
    if (fdFut && !exFut) taDili[np] = { ...r, _fd: fd, _fds: fdSort, _esPend: esPend };
    else if (fdFut && exFut && fdSort < exSort) taDili[np] = { ...r, _fd: fd, _fds: fdSort, _esPend: esPend };
    else if (!fdFut && !exFut && fdSort > exSort) taDili[np] = { ...r, _fd: fd, _fds: fdSort, _esPend: esPend };
  });

  const DATA: Proceso[] = [];
  activos.forEach((r, rowIdx) => {
    try {
      const id = Number(gc(r, ['Nro'], ['Nro. ID']) || 0);
      if (!id) return;
      const tn = taNoDili[id], td = taDili[id];

      // Excluir LECTURA DE SENTENCIA de proxDiligencia
      const dTRaw = td ? cl(td['tipo']).replace(/^DILIGENCIA - /i, '') : '';
      const esLectura = dTRaw.toUpperCase().includes('LECTURA');
      const dT = esLectura ? '' : dTRaw;
      const dF = esLectura ? '' : (td ? fmtF(td['fecha']) : '');
      const dH = esLectura ? '' : (td ? fmtH(td['hora'] || '') : '');
      const dID = esLectura ? 0 : (td ? Number(td['nrotarea'] || 0) : 0);

      const _pt = tn ? cl(tn['tipo']) : '';
      const _pf = tn ? fmtF(tn['fecha']) : '';
      const _ph = tn ? fmtH(tn['hora'] || '') : '';
      const _pID = tn ? Number(tn['nrotarea'] || 0) : 0;

      const bit = gc(r, ['bitacora'], ['Bitácora', 'Bitacora']);
      const _bu = bit.toUpperCase();
      const _pL = _bu.includes('PENDIENTE') && _bu.includes('LECTURA') && _bu.includes('SENTENCIA');
      const _pNS = _bu.includes('PENDIENTE DE EMITIR NUEVA SENTENCIA');
      // "CASACI" cubre CASACION y CASACIÓN
      const _pCas = _bu.includes('PENDIENTE') && _bu.includes('CASACI');
      // Caso 1: bitácora pendiente de sentencia pero hay próxima diligencia PENDIENTE programada
      const _aLSentSinCoincidir = (_pL || _pNS) && !!dT && !!(td && td._esPend);
      // Caso 2: bitácora pendiente de audiencia (no de sentencia) pero sin audiencia agendada
      const _pAudSinAgendar = !_pL && !_pNS && !_pCas && _bu.includes('PENDIENTE') && _bu.includes('AUDIENCIA') && !dT;
      const _aL = _aLSentSinCoincidir || _pAudSinAgendar;

      DATA.push({
        id,
        cliente: gc(r, ['clientefacturable'], ['Cliente Facturable', 'Cliente']),
        contraparte: gc(r, ['contraparte'], ['Contraparte']),
        expediente: gc(r, ['Nroexpediente'], ['Nro. Expediente', 'expediente']),
        supervisor: gc(r, ['supervisor'], ['Supervisor']),
        responsable: gc(r, ['responsable'], ['Responsable']),
        instancia: gc(r, ['estadointerno'], ['Estado Interno']),
        distrito: gc(r, ['distritoactual'], ['Distrito Actual']),
        organo: gc(r, ['organojurisdiccional'], ['Órgano Jurisdiccional', 'Organo Jurisdiccional']),
        tipoJuzgado: gc(r, ['tipojuzgado'], ['Tipo de juzgado', 'Tipo Juzgado', 'Tipo de Juzgado']),
        especialista: gc(r, ['especialistalegal'], ['Especialista legal']),
        relevancia: gc(r, ['relevancia'], ['Relevancia']),
        pacto: gc(r, ['pacto'], ['Pacto']),
        bitacora: bit,
        situacion: gc(r, ['situacion'], ['Situación', 'Situacion']),
        materia: gc(r, ['materia'], ['Materia']),
        submateria: gc(r, ['submateria'], ['Submateria']),
        viaprocesal: gc(r, ['viaprocesal'], ['Via Procesal']),
        cuantia: gc(r, ['cuantia'], ['Cuantía', 'Cuantia', 'CUANTIA', 'Monto Cuantía', 'Monto Cuantia']),
        reposicion: gc(r, ['reposicion'], ['Reposición', 'Reposicion', 'REPOSICION', 'Repone', 'Reposición SI/NO', 'Reposicion SI/NO']),
        estadoCarpeta: gc(r, ['estadocarpeta'], ['Estado carpeta', 'Estado Carpeta']),
        sensible: gc(r, ['relevancia'], ['Relevancia']) === 'SENSIBLE',
        porSentenciar: _pL || _pCas,
        alertLectura: _aL,
        porNuevaSentencia: bit.toUpperCase().includes('PENDIENTE DE EMITIR NUEVA SENTENCIA'),
        porAdmitir: bit.toUpperCase().includes('PENDIENTE DE ADMITIR DEMANDA'),
        porArchivo: bit.toUpperCase().includes('PENDIENTE DE ARCHIVO'),
        proxTarea: _pt, proxTareaFecha: _pf, proxTareaHora: _ph, proxTareaId: _pID,
        proxTareaNota: tn ? cl(tn['notas'] || tn['comentarios'] || '') : '',
        proxDiligencia: dT, proxDiliFecha: dF, proxDiliHora: dH, proxDiliId: dID,
        proxDiliTipo: td ? cl(td['tipo']) : '',
        ultimaDiliFecha: taUltDili[id] ? taUltDili[id]._fd : '',
        tareaGestion: '', tareaGestionFecha: '', tareaGestionAsigPor: '', tareaGestionNota: '',
      });
    } catch (rowErr: any) {
      console.error('Error en fila', rowIdx, 'ID=' + (r['Nro'] || '?'), rowErr?.message);
    }
  });

  return {
    payload: { DATA, TAREAS_GESTION_EXCEL, DILIGENCIAS_GESTION_EXCEL, SENTENCIAS_BY_ID, PLANNER_EXCEL_TAREAS, DILIGENCIAS_EQUIPOS_EXCEL },
    RAWRT_ESTADO_BY_ID,
  };
}

// ───────────────────────── Lectura de archivos (xlsx) ─────────────────────────

export type TipoReporte = 'rt' | 'ta' | 'desconocido';

/** Detecta si las filas corresponden al Reporte Total ('rt') o al Reporte de Tareas ('ta'). */
export function detectarTipoReporte(rows: Row[]): TipoReporte {
  const cols = new Set<string>();
  rows.slice(0, 20).forEach((r) => Object.keys(r).forEach((k) => cols.add(k)));
  const esTA = cols.has('nrotarea') || cols.has('estadotarea') || cols.has('nroproceso');
  const esRT = cols.has('Nro') || cols.has('Nro. ID') || cols.has('Nroexpediente') || cols.has('estadocarpeta') || cols.has('estadointerno');
  if (esTA && !esRT) return 'ta';
  if (esRT && !esTA) return 'rt';
  if (esTA && esRT) return cols.has('nrotarea') ? 'ta' : 'rt';
  return 'desconocido';
}

/** Lee la primera hoja de un File .xlsx (como el original: sheet_to_json con defval:''). */
export async function leerArchivoExcel(file: File): Promise<Row[]> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }) as Row[];
}

/** Procesa un workbook de SheetJS ya leído por cada reporte (primera hoja de cada uno). */
export function procesarWorkbooks(wbRT: import('xlsx').WorkBook, wbTA: import('xlsx').WorkBook, XLSX: typeof import('xlsx')): ResultadoProcesar {
  const aRows = (wb: import('xlsx').WorkBook) => XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }) as Row[];
  return procesarExcel(aRows(wbRT), aRows(wbTA));
}

/**
 * Lee los archivos (en cualquier orden), detecta cuál es el Reporte Total y cuál el de Tareas
 * y procesa. Lanza Error si falta alguno.
 */
export async function procesarArchivos(files: File[]): Promise<ResultadoProcesar> {
  let rt: Row[] | null = null, ta: Row[] | null = null;
  for (const f of files) {
    const rows = await leerArchivoExcel(f);
    const t = detectarTipoReporte(rows);
    if (t === 'rt' && !rt) rt = rows;
    else if (t === 'ta' && !ta) ta = rows;
  }
  if (!rt) throw new Error('No se encontró el Reporte Total entre los archivos');
  if (!ta) throw new Error('No se encontró el Reporte de Tareas entre los archivos');
  return procesarExcel(rt, ta);
}
