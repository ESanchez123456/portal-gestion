// Port de publicarDatosExcelEnFirestore / cargarDatosExcelDesdeKV (legacy ~3965-4027).
// Solo el uploader autorizado publica; el resto de sesiones reciben el payload ya procesado
// desde el KV (xdata_meta + xdata_chunk_N).
import { FSLS, usePortal, showToast } from '@/store/portal';
import { esUploaderAutorizado } from '@/lib/audit';
import { fmtFechaHora } from '@/lib/utils';
import { sincronizarJuzgadosConRT } from '@/lib/juzgados';
import type { ExcelPayload } from '@/types';

const CHUNK = 300000;

/** Label de la barra ("Actualizado el … · N procesos · M tareas"), como finalizarVistaDespuesDeCarga. */
export function construirLabelDatos(fecha: Date, p: Pick<ExcelPayload, 'DATA' | 'TAREAS_GESTION_EXCEL'>): string {
  return 'Actualizado el ' + fmtFechaHora(fecha) + ' · ' + p.DATA.length.toLocaleString() + ' procesos · ' + p.TAREAS_GESTION_EXCEL.length + ' tareas';
}

export function publicarDatosExcel(): void {
  if (!esUploaderAutorizado()) return;
  try {
    const s = usePortal.getState();
    const payload: ExcelPayload = {
      DATA: s.DATA,
      TAREAS_GESTION_EXCEL: s.TAREAS_GESTION_EXCEL,
      DILIGENCIAS_GESTION_EXCEL: s.DILIGENCIAS_GESTION_EXCEL,
      SENTENCIAS_BY_ID: s.SENTENCIAS_BY_ID || {},
      PLANNER_EXCEL_TAREAS: s.PLANNER_EXCEL_TAREAS || [],
      DILIGENCIAS_EQUIPOS_EXCEL: s.DILIGENCIAS_EQUIPOS_EXCEL || [],
    };
    const str = JSON.stringify(payload);
    const totalChunks = Math.max(1, Math.ceil(str.length / CHUNK));

    let prevCount = 0;
    try { const pm = FSLS.getItem('xdata_meta'); prevCount = pm ? (JSON.parse(pm).count || 0) : 0; } catch { /* sin meta previa */ }

    for (let i = 0; i < totalChunks; i++) {
      FSLS.setItem('xdata_chunk_' + i, str.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    for (let i = totalChunks; i < prevCount; i++) {
      FSLS.removeItem('xdata_chunk_' + i);
    }
    const u = s.user;
    FSLS.setItem('xdata_meta', JSON.stringify({
      count: totalChunks,
      uploadedBy: u?.name || u?.email || '',
      uploadedAt: new Date().toISOString(),
      procesos: s.DATA.length,
      tareas: s.TAREAS_GESTION_EXCEL.length,
    }));
    showToast('✓ Datos publicados para todo el equipo');
  } catch (e) {
    console.error('Error publicando datos a Firestore', e);
    showToast('⚠ No se pudo publicar para el equipo (ver consola)');
  }
}

/** Reconstruye los datos desde los chunks guardados en el KV. Devuelve true si había datos publicados. */
export function cargarDatosExcelDesdeKV(): boolean {
  const metaRaw = FSLS.getItem('xdata_meta');
  if (!metaRaw) return false;
  let meta: { count?: number; uploadedAt?: string };
  try { meta = JSON.parse(metaRaw); } catch { return false; }
  let str = '';
  for (let i = 0; i < (meta.count || 0); i++) {
    str += (FSLS.getItem('xdata_chunk_' + i) || '');
  }
  if (!str) return false;
  let payload: Partial<ExcelPayload>;
  try { payload = JSON.parse(str); } catch (e) { console.error('Error parseando datos del equipo', e); return false; }

  const full: ExcelPayload = {
    DATA: payload.DATA || [],
    TAREAS_GESTION_EXCEL: payload.TAREAS_GESTION_EXCEL || [],
    DILIGENCIAS_GESTION_EXCEL: payload.DILIGENCIAS_GESTION_EXCEL || [],
    SENTENCIAS_BY_ID: payload.SENTENCIAS_BY_ID || {},
    PLANNER_EXCEL_TAREAS: payload.PLANNER_EXCEL_TAREAS || [],
    DILIGENCIAS_EQUIPOS_EXCEL: payload.DILIGENCIAS_EQUIPOS_EXCEL || [],
  };
  const fechaMeta = meta.uploadedAt ? new Date(meta.uploadedAt) : new Date();
  usePortal.getState().setPayload(full, construirLabelDatos(fechaMeta, full));
  sincronizarJuzgadosConRT();   // parte de finalizarVistaDespuesDeCarga (solo escribe si es admin)
  return true;
}
