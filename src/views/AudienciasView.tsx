'use client';
// Próximas audiencias (legacy/index.html HTML 1154-1387, JS renderAud 3040-3160 / 4421-4760).
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePortal, showToast } from '@/store/portal';
import { logVistaExterna } from '@/lib/audit';
import { getFavBadge } from '@/lib/favoritos';
import { useResizableColumns } from '@/lib/useResizableColumns';
import {
  PAGE, FDD_GROUPS_AUD, CHIP_LABELS, SUPERVISORES, emptyFddAud, filtrarAudiencias, baseAudParaColumna, statsAudiencias, isoLocal,
  parseAudFecha, useEncargadosMap, useTareasPorProc, exportarXlsx, encargadosOpts, type FddGroupAud, type AudFilters,
} from '@/lib/reporte';
import { FddMulti, ColFilter, ActiveChips, type FddOpt, type Chip } from '@/components/table/Dropdowns';
import PagInline from '@/components/table/PagInline';
import BulkBar from '@/components/table/BulkBar';
import { useBulkSelection } from '@/components/table/useBulkSelection';
import { GestionBadgeTd, TdT, TdOrgano, InstBadge, SitBadge, RelBadge, Dash } from '@/components/table/Badges';

const ESTADO_OPTS: FddOpt[] = [
  { key: 'sensible', label: 'Solo sensibles', cls: 'c-red', dot: 'var(--red)' },
  { key: 'ejecucion', label: 'Solo ejecución', cls: 'c-green', dot: 'var(--green)' },
  { key: 'tarea', label: 'Con tarea pendiente', cls: 'c-blue', dot: 'var(--blue)' },
];
const INST_OPTS: FddOpt[] = [
  { key: 'PRIMERA INSTANCIA', label: '1ra instancia', cls: 'c-blue', dot: 'var(--blue)' },
  { key: 'SEGUNDA INSTANCIA', label: '2da instancia', cls: 'c-purple', dot: 'var(--purple)' },
  { key: 'TERCERA INSTANCIA', label: '3ra / Suprema', cls: 'c-amber', dot: 'var(--amber)' },
  { key: 'EJECUCIÓN', label: 'Ejecución', cls: 'c-green', dot: 'var(--green)' },
];
const PACTO_OPTS: FddOpt[] = ['Fijo', 'Horas', 'Etapas o Hitos', 'Retainer'].map((k) => ({ key: k, label: k, dot: 'var(--text3)' }));
const uniqSorted = (vals: string[], plain = false) => {
  const u = [...new Set(vals.filter(Boolean))];
  return plain ? u.sort() : u.sort((a, b) => a.localeCompare(b));
};

export default function AudienciasView() {
  const DATA = usePortal((s) => s.DATA);
  const dataRev = usePortal((s) => s.dataRev);
  usePortal((s) => s.kvRev); // favoritos / tareas se leen de FSLS
  const enc = useEncargadosMap();
  const tareasPorProc = useTareasPorProc();

  const [q, setQ] = useState('');
  const [sup, setSup] = useState('');
  const [tipo, setTipo] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [colSel, setColSel] = useState<Record<string, string>>({});
  const [fdd, setFdd] = useState(emptyFddAud);
  const [page, setPage] = useState(1);
  const [colsExpanded, setColsExpanded] = useState(false);

  // Al llegar datos nuevos: se reinician filtros y, por defecto, solo se muestran audiencias de hoy en adelante
  useEffect(() => {
    setColSel({}); setFdd(emptyFddAud()); setPage(1); setTipo('');
    setDesde(isoLocal(new Date())); setHasta('');
  }, [dataRev]);

  const colLower = useMemo(() => Object.fromEntries(Object.entries(colSel).map(([c, v]) => [c, v.toLowerCase()])), [colSel]);
  const filters: AudFilters = { q, sup, tipo, desde, hasta, sortAsc, fdd, col: colLower };
  const rows = useMemo(() => filtrarAudiencias(DATA, filters, enc),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [DATA, enc, q, sup, tipo, desde, hasta, sortAsc, fdd, colLower]);
  const total = rows.length;
  const tp = Math.ceil(total / PAGE) || 1;
  const cur = page > tp ? 1 : page;
  const slice = useMemo(() => rows.slice((cur - 1) * PAGE, cur * PAGE), [rows, cur]);

  const stats = useMemo(() => statsAudiencias(DATA), [DATA]);
  const tipos = useMemo(() => uniqSorted(DATA.map((r) => r.proxDiligencia), true), [DATA]);
  const clienteOpts = useMemo<FddOpt[]>(() => uniqSorted(DATA.map((r) => r.cliente)).map((v) => ({ key: v, label: v, trunc: 42, maxWidth: 260 })), [DATA]);
  const organoOpts = useMemo<FddOpt[]>(() => uniqSorted(DATA.map((r) => r.organo)).map((v) => ({ key: v, label: v, trunc: 50, maxWidth: 280 })), [DATA]);
  const encOpts = useMemo<FddOpt[]>(() => encargadosOpts(DATA, enc), [DATA, enc]);
  const universoExport = useMemo(() => DATA.filter((r) => r.proxDiligencia), [DATA]);

  const bulk = useBulkSelection('aud', slice, rows, universoExport);

  const wrapRef = useRef<HTMLDivElement>(null);
  useResizableColumns(wrapRef, [slice]);

  const toggleFdd = (g: FddGroupAud, key: string) => {
    setFdd((p) => { const n = new Set(p[g]); if (n.has(key)) n.delete(key); else n.add(key); return { ...p, [g]: n }; });
    setPage(1);
  };
  const clearGroup = (g: FddGroupAud) => { setFdd((p) => ({ ...p, [g]: new Set<string>() })); setPage(1); };
  const setCol = (c: string, v: string | null) => {
    setColSel((p) => { const n = { ...p }; if (v === null) delete n[c]; else n[c] = v; return n; });
    setPage(1);
  };
  const resetAll = () => { setFdd(emptyFddAud()); setColSel({}); setPage(1); };
  const limpiarFecha = () => { setDesde(''); setHasta(''); setPage(1); };

  const chips: Chip[] = [];
  FDD_GROUPS_AUD.forEach((g) => fdd[g].forEach((k) => chips.push({ key: g + ':' + k, label: CHIP_LABELS[k] || k, onRemove: () => toggleFdd(g, k) })));

  const exportarVista = () => {
    if (!rows.length) { showToast('No hay datos para exportar'); return; }
    exportarXlsx(rows, 'Vista actual', 'proximas_audiencias_' + new Date().toISOString().slice(0, 10) + '.xlsx')
      .then(() => showToast('✓ Exportado: ' + rows.length + ' proceso(s)'));
  };

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const diasLabel = (f?: string) => {
    const ft = parseAudFecha(f);
    if (!ft) return '—';
    const d = Math.round((ft.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    if (d === 0) return <span style={{ color: 'var(--green)', fontWeight: 600 }}>Hoy</span>;
    if (d > 0) return <span style={{ color: 'var(--text4)' }}>—</span>; // futuras: sin contador
    return <span style={{ color: 'var(--red)', fontWeight: 500 }}>hace {Math.abs(d)}d</span>;
  };

  const colInp = (c: string, ext = false) => (
    <th key={c} className={ext ? 'col-ext' : undefined}>
      <ColFilter col={c} tab="aud" value={colSel[c]} onSelect={(v) => setCol(c, v)}
        getValues={() => uniqSorted(baseAudParaColumna(DATA, { ...filters, col: colLower }, c).map((r) => String(r[c] || '')))} />
    </th>
  );

  return (
    <>
      <div className="stats">
        <div className="stat"><div><div className="stat-val">{stats.total.toLocaleString()}</div><div className="stat-lbl">Con audiencia</div></div>
          <div className="stat-icon" style={{ background: '#f1f5f9', color: '#64748b' }}><span>📅</span></div></div>
        <div className="stat"><div><div className="stat-val" style={{ color: 'var(--green)' }}>{stats.hoy.toLocaleString()}</div><div className="stat-lbl">Hoy</div></div>
          <div className="stat-icon" style={{ background: 'var(--green-l)', color: 'var(--green)' }}><span>✅</span></div></div>
        <div className="stat"><div><div className="stat-val" style={{ color: 'var(--amber)' }}>{stats.semana.toLocaleString()}</div><div className="stat-lbl">Esta semana</div></div>
          <div className="stat-icon" style={{ background: 'var(--amber-l)', color: 'var(--amber)' }}><span>🗓</span></div></div>
        <div className="stat"><div><div className="stat-val" style={{ color: 'var(--red)' }}>{stats.vencidas.toLocaleString()}</div><div className="stat-lbl">Atrasadas</div></div>
          <div className="stat-icon" style={{ background: 'var(--red-l)', color: 'var(--red)' }}><span>⏰</span></div></div>
        <div className="stat"><div><div className="stat-val" style={{ color: 'var(--red)' }}>{stats.sens.toLocaleString()}</div><div className="stat-lbl">Sensibles</div></div>
          <div className="stat-icon" style={{ background: 'var(--red-l)', color: 'var(--red)' }}><span>⚠</span></div></div>
      </div>

      <div className="search-row">
        <div className="srch-wrap"><span>🔍</span>
          <input className="srch-inp" type="text" placeholder="Buscar cliente, expediente, responsable, órgano..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="sel-inp" value={sup} onChange={(e) => setSup(e.target.value)}>
          <option value="">Todos los supervisores</option>
          {SUPERVISORES.map((v) => <option key={v}>{v}</option>)}
        </select>
        <select className="sel-inp" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos los tipos de audiencia</option>
          {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {/* Filtro rango fecha diligencia */}
        <div className="tg-date-filter">
          <span>Fecha:</span>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} title="Desde" />
          <span>—</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} title="Hasta" />
          <button className="btn-sm" onClick={limpiarFecha} title="Limpiar">✕</button>
        </div>
        <span className="count-lbl">{total.toLocaleString()} audiencia{total !== 1 ? 's' : ''}</span>
        <button className={'btn-cols-toggle' + (colsExpanded ? ' expanded' : '')} onClick={() => setColsExpanded((v) => !v)}>
          {colsExpanded ? '− Menos columnas' : '＋ Más columnas'}
        </button>
      </div>

      {/* Pills Estado/Instancia/Pacto — Audiencias */}
      <div className="filter-bar" id="filter-bar-aud">
        <FddMulti label="Cliente" selected={fdd.cliente} onToggle={(k) => toggleFdd('cliente', k)} onClear={() => clearGroup('cliente')} opts={clienteOpts} minWidth={240} searchPlaceholder="Buscar cliente..." />
        <div style={{ width: 1, height: 20, background: 'var(--gray-b)', margin: '0 2px' }} />
        <FddMulti label="Estado" selected={fdd.estado} onToggle={(k) => toggleFdd('estado', k)} onClear={() => clearGroup('estado')} opts={ESTADO_OPTS} />
        <FddMulti label="Instancia" selected={fdd.instancia} onToggle={(k) => toggleFdd('instancia', k)} onClear={() => clearGroup('instancia')} opts={INST_OPTS} />
        <FddMulti label="Pacto" selected={fdd.pacto} onToggle={(k) => toggleFdd('pacto', k)} onClear={() => clearGroup('pacto')} opts={PACTO_OPTS} />
        <FddMulti label="Órgano" selected={fdd.organo} onToggle={(k) => toggleFdd('organo', k)} onClear={() => clearGroup('organo')} opts={organoOpts} minWidth={280} searchPlaceholder="Buscar órgano..." />
        <FddMulti label="Responsable" selected={fdd.encargado} onToggle={(k) => toggleFdd('encargado', k)} onClear={() => clearGroup('encargado')} opts={encOpts} />
        <div style={{ width: 1, height: 20, background: 'var(--gray-b)', margin: '0 2px' }} />
        <button className="btn-sm" onClick={resetAll}><span style={{ fontSize: 13 }}>✕</span> Limpiar todo</button>
        <PagInline cur={cur} total={tp} perPage={PAGE} onPage={setPage} />
        <button className="btn-sm" onClick={exportarVista} style={{ fontSize: 11, whiteSpace: 'nowrap' }}>↓ Exportar vista</button>
        {/* chips activos audiencias */}
        <ActiveChips chips={chips} id="active-filters-aud" />
      </div>

      <div className="table-wrap-outer" ref={wrapRef}><div className="table-wrap" id="aud-table-wrap">
        <table className={colsExpanded ? '' : 'cols-collapsed'}>
          <thead>
            <tr>
              <th className="cb-th"><input type="checkbox" className="row-cb" ref={bulk.masterRef} checked={bulk.masterChecked} onChange={(e) => bulk.toggleAll(e.target.checked)} /></th>
              <th className="td-gestion-ind" title="Tareas de Gestión">⚡</th>
              <th style={{ width: 28, minWidth: 28, padding: '0 4px', textAlign: 'center' }} title="Favorito">⭐</th>
              <th style={{ width: 58, minWidth: 58, maxWidth: 58 }}>ID</th>
              <th style={{ width: 72, minWidth: 72, maxWidth: 72 }}>ID Tarea</th>
              <th style={{ minWidth: 150 }}>Cliente</th>
              <th className="col-ext" style={{ minWidth: 130 }}>Contraparte</th>
              <th style={{ minWidth: 125 }}>Expediente</th>
              <th style={{ minWidth: 90 }}>Supervisor</th>
              <th style={{ minWidth: 100 }}>Responsable</th>
              <th style={{ minWidth: 68 }}>Instancia</th>
              <th className="col-ext" style={{ minWidth: 65 }}>Situación</th>
              <th className="col-ext" style={{ minWidth: 68 }}>Relevancia</th>
              <th className="col-ext" style={{ minWidth: 60 }}>Pacto</th>
              <th className="col-ext" style={{ minWidth: 120 }}>Especialista legal</th>
              <th className="col-ext" style={{ minWidth: 130 }}>Distrito</th>
              <th style={{ minWidth: 175 }}>Órgano jurisdiccional</th>
              <th className="col-ext" style={{ minWidth: 185 }}>Bitácora</th>
              <th style={{ minWidth: 200 }}>Tipo de audiencia</th>
              <th style={{ minWidth: 110, cursor: 'pointer' }} onClick={() => { setSortAsc((v) => !v); setPage(1); }}>Fecha y hora ↕</th>
              <th style={{ minWidth: 70 }}>Días</th>
              <th style={{ minWidth: 85 }}>Gestión</th>
            </tr>
            <tr className="filter-row-th">
              <th></th><th></th><th></th>
              {colInp('id')}
              <th></th>
              {colInp('cliente')}
              {colInp('contraparte', true)}
              {colInp('expediente')}
              {colInp('supervisor')}
              {colInp('responsable')}
              {colInp('instancia')}
              {colInp('situacion', true)}
              {colInp('relevancia', true)}
              {colInp('pacto', true)}
              {colInp('especialista', true)}
              {colInp('distrito', true)}
              {colInp('organo')}
              {colInp('bitacora', true)}
              {colInp('proxDiligencia')}
              {colInp('proxDiliFecha')}
              <th></th><th></th>
            </tr>
          </thead>
          <tbody>
            {!slice.length ? (
              <tr><td colSpan={22}><div className="empty"><span>—</span>Sin audiencias</div></td></tr>
            ) : slice.map((r) => {
              const cls = (r.sensible ? 'row-s' : '') + (bulk.selRow === r.id ? ' row-selected' : '');
              const cp = r.contraparte || '';
              const bit = r.bitacora || '';
              return (
                <tr key={r.id} className={cls.trim() || undefined} onClick={() => bulk.selectRow(r.id)}>
                  <td className="cb-td" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="row-cb" checked={bulk.selected.has(r.id)} onChange={(e) => bulk.onCheck(r.id, e.target.checked)} />
                  </td>
                  <GestionBadgeTd tareas={tareasPorProc.get(r.id)} />
                  {getFavBadge(r.id)}
                  <td style={{ maxWidth: 58, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <a className="id-link" href={'https://vinatea.mybig.com.ar/trabajos/overview/' + r.id + '/'} target="_blank" onClick={() => logVistaExterna(r.id)}>{r.id}</a>
                  </td>
                  <td style={{ maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.proxDiliId ? <a className="id-link" href={'https://vinatea.mybig.com.ar/tareas/' + r.proxDiliId + '/edit/'} target="_blank">#{r.proxDiliId}</a> : <Dash />}
                  </td>
                  <TdT v={r.cliente} w={150} c="td-p" />
                  <td className="col-ext td-d" title={cp}>{cp.slice(0, 20) + (cp.length > 20 ? '…' : '')}</td>
                  <td className="td-m" title={r.expediente}>{r.expediente}</td>
                  <TdT v={r.supervisor} w={90} /><TdT v={r.responsable} w={100} />
                  <td><InstBadge i={r.instancia} /></td>
                  <td className="col-ext"><SitBadge s={r.situacion} /></td>
                  <td className="col-ext"><RelBadge r={r.relevancia} /></td>
                  <td className="col-ext td-d" style={{ fontSize: 10.5 }}>{r.pacto}</td>
                  <td className="col-ext td-d" style={{ fontSize: 11 }}>{(r.especialista || '').slice(0, 16)}</td>
                  <td className="col-ext td-d" style={{ fontSize: 11 }}>{(r.distrito || '').slice(0, 18)}</td>
                  <TdOrgano v={r.organo} w={175} c="td-d" encs={enc.get(r.organo) || []} />
                  <td className="col-ext td-d" style={{ fontSize: 11 }}>{bit.slice(0, 24) + (bit.length > 24 ? '…' : '')}</td>
                  <td><span className="badge b-a">{r.proxDiligencia}</span></td>
                  <td><strong style={{ color: 'var(--amber)' }}>{r.proxDiliFecha}</strong>{r.proxDiliHora ? <> <span style={{ color: 'var(--text3)', fontSize: 11 }}>{r.proxDiliHora}</span></> : null}</td>
                  <td style={{ textAlign: 'center', fontSize: 11 }}>{diasLabel(r.proxDiliFecha)}</td>
                  <td><button className="btn-agendar" onClick={(e) => { e.stopPropagation(); usePortal.getState().openModal('agendar', { procId: r.id }); }}>+ Gestión</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div></div>

      <BulkBar tab="aud" count={bulk.selected.size} totalFiltrados={total}
        onSelectAll={bulk.selectAllFiltered} onAgendar={bulk.bulkAgendar} onExportar={bulk.bulkExportar} onCancel={bulk.clear} />
    </>
  );
}
