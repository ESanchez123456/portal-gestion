'use client';
// Reporte total (legacy/index.html HTML 872-1281, JS 2631-3340 / 4421-4760).
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePortal, showToast } from '@/store/portal';
import { logVistaExterna } from '@/lib/audit';
import { getFavBadge } from '@/lib/favoritos';
import { getObsBadge } from '@/lib/obsProc';
import { useResizableColumns } from '@/lib/useResizableColumns';
import {
  PAGE, FDD_GROUPS, CHIP_LABELS, COL_LABELS, SUPERVISORES, emptyFdd, filtrarReporte, statsReporte,
  useEncargadosMap, useTareasPorProc, exportarXlsx, encargadosOpts, type FddGroup, type RepFilters,
} from '@/lib/reporte';
import { FddMulti, ColFilter, ActiveChips, type FddOpt, type Chip } from '@/components/table/Dropdowns';
import PagInline from '@/components/table/PagInline';
import BulkBar from '@/components/table/BulkBar';
import { useBulkSelection } from '@/components/table/useBulkSelection';
import { GestionBadgeTd, TdT, TdOrgano, CeldaTarea, Dash } from '@/components/table/Badges';
import type { Proceso } from '@/types';

type MF = '' | 'sent' | 'adm' | 'arch';
const INST_OPTS: FddOpt[] = [
  { key: 'PRIMERA INSTANCIA', label: '1ra instancia', cls: 'c-blue', dot: 'var(--blue)' },
  { key: 'SEGUNDA INSTANCIA', label: '2da instancia', cls: 'c-purple', dot: 'var(--purple)' },
  { key: 'TERCERA INSTANCIA', label: '3ra / Suprema', cls: 'c-amber', dot: 'var(--amber)' },
  { key: 'EJECUCIÓN', label: 'Ejecución', cls: 'c-green', dot: 'var(--green)' },
];
const PACTO_OPTS: FddOpt[] = ['Fijo', 'Horas', 'Etapas o Hitos', 'Retainer'].map((k) => ({ key: k, label: k, dot: 'var(--text3)' }));
const FILTER_COLS = ['id', 'cliente', 'contraparte', 'expediente', 'supervisor', 'responsable', 'especialista', 'organo', 'bitacora', 'proxTarea', 'proxDiligencia'];

const uniqSorted = (vals: string[], plain = false) => {
  const u = [...new Set(vals.filter(Boolean))];
  return plain ? u.sort() : u.sort((a, b) => a.localeCompare(b));
};

export default function ReporteView() {
  const DATA = usePortal((s) => s.DATA);
  const TAREAS = usePortal((s) => s.TAREAS_GESTION_EXCEL);
  const dataRev = usePortal((s) => s.dataRev);
  const dataLabel = usePortal((s) => s.dataLabel);
  const kvReady = usePortal((s) => s.kvReady);
  usePortal((s) => s.kvRev); // favoritos / observaciones / tareas se leen de FSLS
  const enc = useEncargadosMap();
  const tareasPorProc = useTareasPorProc();

  const [mf, setMf] = useState<MF>('');
  const [colSel, setColSel] = useState<Record<string, string>>({});
  const [fdd, setFdd] = useState(emptyFdd);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [sup, setSup] = useState('');
  const [dist, setDist] = useState('');

  // Al llegar datos nuevos se reinician filtros de columna, filtros múltiples y página (finalizarVistaDespuesDeCarga)
  useEffect(() => {
    setColSel({}); setFdd(emptyFdd()); setPage(1); setDist('');
  }, [dataRev]);

  const colLower = useMemo(() => Object.fromEntries(Object.entries(colSel).map(([c, v]) => [c, v.toLowerCase()])), [colSel]);
  const filters: RepFilters = { q, sup, dist, mf, fdd, col: colLower };
  const rows = useMemo(() => filtrarReporte(DATA, filters, enc),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [DATA, enc, q, sup, dist, mf, fdd, colLower]);
  const total = rows.length;
  const tp = Math.ceil(total / PAGE) || 1;
  const cur = page > tp ? 1 : page;
  const slice = useMemo(() => rows.slice((cur - 1) * PAGE, cur * PAGE), [rows, cur]);

  const stats = useMemo(() => statsReporte(DATA), [DATA]);
  const distritos = useMemo(() => uniqSorted(DATA.map((r) => r.distrito), true), [DATA]);

  // Opciones de los filtros múltiples
  const clienteOpts = useMemo<FddOpt[]>(() => uniqSorted(DATA.map((r) => r.cliente)).map((v) => ({ key: v, label: v, trunc: 42, maxWidth: 260 })), [DATA]);
  const bitacoraOpts = useMemo<FddOpt[]>(() => uniqSorted(DATA.map((r) => r.bitacora)).map((v) => ({ key: v, label: v, trunc: 50, maxWidth: 280 })), [DATA]);
  const organoOpts = useMemo<FddOpt[]>(() => uniqSorted(DATA.map((r) => r.organo)).map((v) => ({ key: v, label: v, trunc: 50, maxWidth: 280 })), [DATA]);
  const relevOpts = useMemo<FddOpt[]>(() => uniqSorted(DATA.map((r) => r.relevancia), true).map((v) => ({ key: v, label: v, dot: 'var(--text3)' })), [DATA]);
  const encOpts = useMemo<FddOpt[]>(() => encargadosOpts(DATA, enc), [DATA, enc]);

  const bulk = useBulkSelection('rep', slice, rows, DATA);

  const wrapRef = useRef<HTMLDivElement>(null);
  useResizableColumns(wrapRef, [slice]);

  const toggleFdd = (g: FddGroup, key: string) => {
    setFdd((p) => { const n = new Set(p[g]); if (n.has(key)) n.delete(key); else n.add(key); return { ...p, [g]: n }; });
    setPage(1);
  };
  const clearGroup = (g: FddGroup) => { setFdd((p) => ({ ...p, [g]: new Set<string>() })); setPage(1); };
  const setCol = (c: string, v: string | null) => {
    setColSel((p) => { const n = { ...p }; if (v === null) delete n[c]; else n[c] = v; return n; });
    setPage(1);
  };
  const clearColFilters = () => { setColSel({}); setPage(1); };
  const resetAll = () => { setFdd(emptyFdd()); setColSel({}); setQ(''); setSup(''); setDist(''); setMf(''); setPage(1); };
  const toggleMF = (f: Exclude<MF, ''>) => { setMf((p) => (p === f ? '' : f)); setPage(1); };

  const chips: Chip[] = [];
  FDD_GROUPS.forEach((g) => fdd[g].forEach((k) => chips.push({ key: g + ':' + k, label: CHIP_LABELS[k] || k, onRemove: () => toggleFdd(g, k) })));
  Object.entries(colLower).forEach(([c, v]) => chips.push({ key: 'col:' + c, label: <>{COL_LABELS[c] || c}: <strong>{v}</strong></>, onRemove: () => setCol(c, null) }));

  const exportarVista = () => {
    if (!rows.length) { showToast('No hay datos para exportar'); return; }
    exportarXlsx(rows, 'Vista actual', 'reporte_total_' + new Date().toISOString().slice(0, 10) + '.xlsx')
      .then(() => showToast('✓ Exportado: ' + rows.length + ' proceso(s)'));
  };

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const diasSinDili = (r: Proceso) => {
    if (!r.ultimaDiliFecha) return <Dash />;
    const parts = r.ultimaDiliFecha.split('/');
    if (parts.length < 3) return <Dash />;
    const ft = new Date(+parts[2], +parts[1] - 1, +parts[0]);
    const d = Math.round((hoy.getTime() - ft.getTime()) / (1000 * 60 * 60 * 24));
    const color = d > 30 ? 'var(--red)' : d > 14 ? 'var(--amber)' : 'var(--text3)';
    return <span style={{ color, fontWeight: 600, fontSize: 11 }}>{d}d</span>;
  };

  const colInp = (c: string) => (
    <th key={c}><ColFilter col={c} value={colSel[c]} onSelect={(v) => setCol(c, v)}
      getValues={() => uniqSorted(filtrarReporte(DATA, { ...filters, col: colLower }, enc, c).map((r) => String(r[c] || '')).filter((v) => v !== '-'))} /></th>
  );

  const labelSem = dataLabel
    ? dataLabel
    : 'Sin datos cargados';

  return (
    <>
      <div className="stats">
        <div className="stat"><div><div className="stat-val">{stats.total.toLocaleString()}</div><div className="stat-lbl">Procesos activos</div></div>
          <div className="stat-icon" style={{ background: '#f1f5f9', color: '#64748b' }}><span>📁</span></div></div>
        <div className="stat"><div><div className="stat-val" style={{ color: 'var(--red)' }}>{stats.sent.toLocaleString()}</div><div className="stat-lbl">Por sentenciar</div></div>
          <div className="stat-icon" style={{ background: 'var(--red-l)', color: 'var(--red)' }}><span>⚖</span></div></div>
        <div className="stat"><div><div className="stat-val" style={{ color: 'var(--amber)' }}>{stats.dili.toLocaleString()}</div><div className="stat-lbl">Con audiencia</div></div>
          <div className="stat-icon" style={{ background: 'var(--amber-l)', color: 'var(--amber)' }}><span>📅</span></div></div>
        <div className="stat"><div><div className="stat-val" style={{ color: 'var(--red)' }}>{stats.sens.toLocaleString()}</div><div className="stat-lbl">Sensibles</div></div>
          <div className="stat-icon" style={{ background: 'var(--red-l)', color: 'var(--red)' }}><span>⚠</span></div></div>
        <div className="stat"><div><div className="stat-val" style={{ color: 'var(--green)' }}>{stats.ej.toLocaleString()}</div><div className="stat-lbl">En ejecución</div></div>
          <div className="stat-icon" style={{ background: 'var(--green-l)', color: 'var(--green)' }}><span>⚖</span></div></div>
      </div>

      {/* BOTONES PRINCIPALES */}
      <div className="main-filters">
        <button className={'mfb mfb-s' + (mf === 'sent' ? ' active' : '')} onClick={() => toggleMF('sent')}>
          <span>⚖</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Procesos por sentenciar</div>
            <div style={{ fontSize: 10.5, opacity: 0.65, marginTop: 1 }}>Lectura pendiente · Nueva sentencia</div>
          </div>
          <span className="mfb-cnt">{stats.sent.toLocaleString()}</span>
        </button>
        <button className={'mfb mfb-s' + (mf === 'adm' ? ' active' : '')} onClick={() => toggleMF('adm')} style={{ '--mfb-color': 'var(--blue)' } as React.CSSProperties}>
          <span>📥</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Pendiente admitir demanda</div>
            <div style={{ fontSize: 10.5, opacity: 0.65, marginTop: 1 }}>Bitácora: Pendiente de admitir demanda</div>
          </div>
          <span className="mfb-cnt">{stats.adm.toLocaleString()}</span>
        </button>
        <button className={'mfb mfb-s' + (mf === 'arch' ? ' active' : '')} onClick={() => toggleMF('arch')} style={{ '--mfb-color': 'var(--text3)' } as React.CSSProperties}>
          <span>🗂</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Pendiente archivo definitivo</div>
            <div style={{ fontSize: 10.5, opacity: 0.65, marginTop: 1 }}>Bitácora: Pendiente de archivo</div>
          </div>
          <span className="mfb-cnt">{stats.arch.toLocaleString()}</span>
        </button>
        <div className="mfb-semana">
          <span style={{ fontSize: 13 }}>⏱</span>
          <strong style={{ color: 'var(--text2)' }}>{labelSem}</strong>
          <span style={{ display: kvReady ? 'inline-flex' : 'none', alignItems: 'center', gap: 5, marginLeft: 10, fontSize: 10.5, fontWeight: 700, color: '#16a34a', letterSpacing: '.3px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'pulseEnVivo 1.6s infinite' }} />
            EN VIVO
          </span>
        </div>
      </div>

      {/* PÍLDORAS DROPDOWN */}
      <div className="filter-bar" id="filter-bar">
        <FddMulti label="Cliente" selected={fdd.cliente} onToggle={(k) => toggleFdd('cliente', k)} onClear={() => clearGroup('cliente')} opts={clienteOpts} minWidth={240} searchPlaceholder="Buscar cliente..." />
        <FddMulti label="Bitácora" selected={fdd.bitacora} onToggle={(k) => toggleFdd('bitacora', k)} onClear={() => clearGroup('bitacora')} opts={bitacoraOpts} minWidth={260} searchPlaceholder="Buscar bitácora..." />
        <FddMulti label="Órgano" selected={fdd.organo} onToggle={(k) => toggleFdd('organo', k)} onClear={() => clearGroup('organo')} opts={organoOpts} minWidth={280} searchPlaceholder="Buscar órgano..." />
        <FddMulti label="Responsable" selected={fdd.encargado} onToggle={(k) => toggleFdd('encargado', k)} onClear={() => clearGroup('encargado')} opts={encOpts} />
        <div style={{ width: 1, height: 20, background: 'var(--gray-b)', margin: '0 2px' }} />
        <FddMulti label="Instancia" selected={fdd.instancia} onToggle={(k) => toggleFdd('instancia', k)} onClear={() => clearGroup('instancia')} opts={INST_OPTS} />
        <FddMulti label="Pacto" selected={fdd.pacto} onToggle={(k) => toggleFdd('pacto', k)} onClear={() => clearGroup('pacto')} opts={PACTO_OPTS} />
        <FddMulti label="Relevancia" selected={fdd.relevancia} onToggle={(k) => toggleFdd('relevancia', k)} onClear={() => clearGroup('relevancia')} opts={relevOpts} />
        <div style={{ width: 1, height: 20, background: 'var(--gray-b)', margin: '0 2px' }} />
        <button className="btn-sm" onClick={resetAll}><span style={{ fontSize: 13 }}>✕</span> Limpiar todo</button>
        <PagInline cur={cur} total={tp} perPage={PAGE} onPage={setPage} />
        <button className="btn-sm" onClick={exportarVista} style={{ marginLeft: 4, fontSize: 11, whiteSpace: 'nowrap' }}>↓ Exportar vista</button>
      </div>

      <ActiveChips chips={chips} id="active-filters" />

      <div className="search-row">
        <div className="srch-wrap">
          <span>🔍</span>
          <input className="srch-inp" type="text" placeholder="Buscar en todas las columnas..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <select className="sel-inp" value={sup} onChange={(e) => setSup(e.target.value)}>
          <option value="">Todos los supervisores</option>
          {SUPERVISORES.map((v) => <option key={v}>{v}</option>)}
        </select>
        <select className="sel-inp" value={dist} onChange={(e) => setDist(e.target.value)}>
          <option value="">Todos los distritos</option>
          {distritos.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <button className="btn-sm" onClick={clearColFilters}><span style={{ fontSize: 13 }}>✕</span> Limpiar filtros columna</button>
        <span className="count-lbl">{total.toLocaleString()} proceso{total !== 1 ? 's' : ''}</span>
      </div>

      <div className="table-wrap-outer" ref={wrapRef}><div className="table-wrap">
        <table id="rep-table">
          <thead>
            <tr id="thead-main">
              <th className="cb-th"><input type="checkbox" className="row-cb" ref={bulk.masterRef} checked={bulk.masterChecked} onChange={(e) => bulk.toggleAll(e.target.checked)} /></th>
              <th className="td-gestion-ind" title="Tareas de Gestión">⚡</th>
              <th style={{ width: 28, minWidth: 28, padding: '0 4px', textAlign: 'center' }} title="Favorito">⭐</th>
              <th style={{ width: 58, minWidth: 58, maxWidth: 58 }} data-col="id">ID</th>
              <th style={{ width: 240, minWidth: 240, maxWidth: 240 }} data-col="cliente">Cliente</th>
              <th style={{ width: 200, minWidth: 200, maxWidth: 200 }} data-col="contraparte">Contraparte</th>
              <th style={{ minWidth: 130 }} data-col="expediente">Expediente</th>
              <th style={{ minWidth: 95 }} data-col="supervisor">Supervisor</th>
              <th style={{ minWidth: 105 }} data-col="responsable">Responsable</th>
              <th style={{ minWidth: 130 }} data-col="especialista">Especialista legal</th>
              <th style={{ minWidth: 185 }} data-col="organo">Órgano jurisdiccional</th>
              <th style={{ width: 160, minWidth: 160, maxWidth: 160 }} data-col="bitacora">Bitácora</th>
              <th style={{ minWidth: 160 }} data-col="proxTarea">Próxima tarea</th>
              <th style={{ minWidth: 175 }} data-col="proxDiligencia">Próxima audiencia</th>
              <th style={{ minWidth: 75 }} data-col="ultimaDiliFecha">Días s/dilig.</th>
              <th style={{ minWidth: 90 }}>Gestión</th>
              <th style={{ minWidth: 70 }}>Obs.</th>
            </tr>
            <tr className="filter-row-th">
              <th></th><th></th><th></th>
              {FILTER_COLS.map(colInp)}
              <th></th><th></th><th></th>
            </tr>
          </thead>
          <tbody>
            {!slice.length ? (
              <tr><td colSpan={17}><div className="empty"><span>—</span>Sin resultados</div></td></tr>
            ) : slice.map((r) => {
              const cls = r.sensible ? 'row-s' : r.alertLectura ? 'row-alert' : '';
              const selCls = bulk.selRow === r.id ? ' row-selected' : '';
              return (
                <tr key={r.id} className={(cls + selCls).trim() || undefined} onClick={() => bulk.selectRow(r.id)}>
                  <td className="cb-td" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="row-cb" checked={bulk.selected.has(r.id)} onChange={(e) => bulk.onCheck(r.id, e.target.checked)} />
                  </td>
                  <GestionBadgeTd tareas={tareasPorProc.get(r.id)} />
                  {getFavBadge(r.id)}
                  <td style={{ maxWidth: 58, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <a className="id-link" href={'https://vinatea.mybig.com.ar/trabajos/overview/' + r.id + '/'} target="_blank" title={'Ver en MyBiG #' + r.id} onClick={() => logVistaExterna(r.id)}>{r.id}</a>
                  </td>
                  <TdT v={r.cliente} w={240} c="td-p" /><TdT v={r.contraparte} w={200} c="td-d" />
                  <td className="td-m" title={r.expediente}>{r.expediente}</td>
                  <TdT v={r.supervisor} w={95} /><TdT v={r.responsable} w={105} /><TdT v={r.especialista} w={130} c="td-d" />
                  <TdOrgano v={r.organo} w={185} c="td-d" encs={enc.get(r.organo) || []} />
                  {r.alertLectura ? (
                    <td style={{ maxWidth: 160 }}>
                      <div className="alert-lectura-badge"><span>⚠</span>INCONSISTENCIA</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 3 }} title={r.bitacora}>{r.bitacora.length > 28 ? r.bitacora.slice(0, 28) + '…' : r.bitacora}</div>
                    </td>
                  ) : <TdT v={r.bitacora} w={160} c="td-d" />}
                  <td style={{ lineHeight: 1.7 }}><CeldaTarea tarea={r.proxTarea} nota={r.proxTareaNota} fecha={r.proxTareaFecha} /></td>
                  <td style={{ maxWidth: 175, lineHeight: 1.7 }}>
                    {r.proxDiligencia ? (
                      <>
                        <span className="badge b-a">{r.proxDiligencia}</span><br />
                        <strong style={{ color: 'var(--amber)', fontSize: 10.5 }}>{r.proxDiliFecha}{r.proxDiliHora ? <> <span style={{ fontWeight: 400, color: 'var(--text3)' }}>{r.proxDiliHora}</span></> : null}</strong>
                      </>
                    ) : <Dash />}
                  </td>
                  <td style={{ textAlign: 'center' }}>{diasSinDili(r)}</td>
                  <td><button className="btn-agendar btn-agendar-fila" data-row-id={r.id} onClick={(e) => { e.stopPropagation(); usePortal.getState().openModal('agendar', { procId: r.id }); }}>+ Gestión</button></td>
                  <td style={{ textAlign: 'center' }}>{getObsBadge(r.id)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div></div>

      <BulkBar tab="rep" count={bulk.selected.size} totalFiltrados={total}
        onSelectAll={bulk.selectAllFiltered} onAgendar={bulk.bulkAgendar} onExportar={bulk.bulkExportar} onCancel={bulk.clear} />
    </>
  );
}
