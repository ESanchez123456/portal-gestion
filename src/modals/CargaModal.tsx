'use client';
import { useEffect, useRef, useState } from 'react';
import { usePortal, showToast } from '@/store/portal';
import { esUploaderAutorizado } from '@/lib/audit';
import { sincronizarJuzgadosConRT } from '@/lib/juzgados';
import { procesarExcel, leerArchivoExcel, detectarTipoReporte, type Row } from '@/lib/excel/procesarExcel';
import { publicarDatosExcel, construirLabelDatos } from '@/lib/excel/publish';

type Tipo = 'rt' | 'ta';
type St = { msg: string; ok: boolean } | null;

export default function CargaModal({ onClose }: { payload: unknown; onClose: () => void }) {
  const autorizado = esUploaderAutorizado();
  const [rawRT, setRawRT] = useState<Row[] | null>(null);
  const [rawTA, setRawTA] = useState<Row[] | null>(null);
  const [st, setSt] = useState<Record<Tipo, St>>({ rt: null, ta: null });
  const [over, setOver] = useState<Tipo | null>(null);
  const [procesando, setProcesando] = useState(false);
  const f1 = useRef<HTMLInputElement>(null);
  const f2 = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!autorizado) onClose(); }, [autorizado, onClose]);
  if (!autorizado) return null;

  const showSt = (t: Tipo, msg: string, ok: boolean) => setSt((s) => ({ ...s, [t]: { msg, ok } }));

  async function loadFile(file: File | undefined, tipo: Tipo) {
    if (!file) return;
    try {
      const json = await leerArchivoExcel(file);
      const det = detectarTipoReporte(json);
      if (det !== 'desconocido' && det !== tipo) {
        throw new Error('este archivo parece ser el ' + (det === 'rt' ? 'Reporte Total' : 'Reporte de Tareas') + ', no el ' + (tipo === 'rt' ? 'Reporte Total' : 'Reporte de Tareas'));
      }
      if (tipo === 'rt') setRawRT(json); else setRawTA(json);
      showSt(tipo, '✓ ' + file.name + ' — ' + json.length.toLocaleString() + ' filas cargadas', true);
    } catch (err) {
      showSt(tipo, '✗ Error: ' + (err instanceof Error ? err.message : String(err)), false);
    }
  }

  function dzDrop(e: React.DragEvent, tipo: Tipo) {
    e.preventDefault(); setOver(null);
    void loadFile(e.dataTransfer.files[0], tipo);
  }

  function procesar() {
    if (!rawRT || !rawTA) return;
    setProcesando(true);
    // diferir un tick para que se pinte el estado "procesando" antes del trabajo síncrono pesado
    setTimeout(() => {
      try {
        const { payload, RAWRT_ESTADO_BY_ID } = procesarExcel(rawRT, rawTA);
        usePortal.setState({ RAWRT_ESTADO_BY_ID });
        usePortal.getState().setPayload(payload, construirLabelDatos(new Date(), payload));
        sincronizarJuzgadosConRT();
        onClose();
        showToast('✓ ' + payload.DATA.length.toLocaleString() + ' procesos · ' + payload.TAREAS_GESTION_EXCEL.length + ' tareas de gestión');
        // Publicar para que los demás usuarios vean estos datos sin subir el Excel
        publicarDatosExcel();
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        console.error('procesarExcel error:', e.name, e.message);
        console.error('Stack:', e.stack);
        usePortal.getState().showError('Error al procesar: ' + e.message + '\n\nStack: ' + (e.stack || '').slice(0, 200));
        setProcesando(false);
      }
    }, 30);
  }

  const dz = (tipo: Tipo, id: string, icon: string, titulo: string, sub: React.ReactNode, ref: React.RefObject<HTMLInputElement | null>, extraStyle?: React.CSSProperties) => (
    <>
      <div className="dz-label" style={extraStyle}><span>{icon === '↓' ? '📊' : '📋'}</span> {titulo}</div>
      <div
        className={'drop-zone' + (over === tipo ? ' dragover' : '')} id={id}
        onClick={() => ref.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(tipo); }}
        onDragLeave={() => setOver(null)}
        onDrop={(e) => dzDrop(e, tipo)}
      >
        <span>{icon}</span>
        <div className="dz-t">Arrastra aquí o haz clic para seleccionar</div>
        <div className="dz-s">{sub}</div>
      </div>
      <div>{st[tipo] && <div className={'dz-status ' + (st[tipo]!.ok ? 'dz-ok' : 'dz-err')}>{st[tipo]!.msg}</div>}</div>
      <input
        type="file" ref={ref} accept=".xlsx" style={{ display: 'none' }}
        onChange={(e) => { void loadFile(e.target.files?.[0], tipo); e.target.value = ''; }}
      />
    </>
  );

  return (
    <div className="overlay show" id="modalCarga" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-title">Cargar datos desde Excel</div>
        <div className="modal-sub">Carga el Reporte total y el Reporte de Tareas exportados desde MyBiG. Los datos se procesan en el navegador — ningún archivo se sube a internet.</div>
        <div style={{ background: 'var(--amber-l)', border: '1px solid var(--amber-b)', borderRadius: 'var(--r)', padding: '9px 12px', marginBottom: '.9rem', fontSize: 12, lineHeight: 1.6, color: 'var(--text2,inherit)' }}>
          <strong>¿Qué reportes adjuntar?</strong><br />
          📊 <strong>Reporte Total</strong>: el que MyBiG envía todos los días por correo.<br />
          📋 <strong>Reporte de Tareas</strong>: se descarga desde MyBiG → <a href="https://vinatea.mybig.com.ar/informes/view/7624/" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>V&amp;T - Reporte Diario de Tareas</a>.
        </div>
        {dz('rt', 'dz1', '↓', 'Reporte Total', '.xlsx — Reporte Total que MyBiG envía todos los días por correo', f1)}
        {dz('ta', 'dz2', '☑', 'Reporte de Tareas', '.xlsx — «V&T - Reporte Diario de Tareas», se descarga desde MyBiG', f2, { marginTop: '1rem' })}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-dark" id="btnProcesar" disabled={!(rawRT && rawTA) || procesando} onClick={procesar}>
            {procesando ? 'Procesando…' : 'Procesar y actualizar'}
          </button>
        </div>
      </div>
    </div>
  );
}
