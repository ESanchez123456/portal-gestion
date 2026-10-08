'use client';
// Tareas de Gestión: contenedor + sub-vista Lista (HTML 1388-1507; JS 4142-4420).
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePortal } from '@/store/portal';
import { TEAM_GESTION } from '@/lib/constants';
import { parseFechaTarea } from '@/lib/utils';
import { getFavTareas, getFavUsuarios, favTituloEstrella, toggleFavTarea } from '@/lib/favoritos';
import { getAllTareasGestion, loadOverrides, eliminarTareaGestion, ASIGNADOS_GESTION, MYBIG_PROC, type TareaG } from '@/lib/gestion';
import Pagination from '@/components/table/Pagination';
import { useResizableColumns } from '@/lib/useResizableColumns';
import CalendarPanel from './gestion/CalendarPanel';
import PlannerPanel from './gestion/PlannerPanel';
import EquiposPanel from './gestion/EquiposPanel';
import FavoritosPanel from './gestion/FavoritosPanel';

const TG_PAGE = 50;
type SubVista = 'lista' | 'cal' | 'planner' | 'favoritos' | 'equipos';

function InstBadge({ i }: { i?: string }) {
  const m: Record<string, [string, string]> = { 'PRIMERA INSTANCIA': ['b-b', '1ra'], 'SEGUNDA INSTANCIA': ['b-p', '2da'], 'TERCERA INSTANCIA': ['b-a', '3ra'], 'EJECUCIÓN': ['b-g', 'Ejec.'] };
  const [c, t] = (i && m[i]) || ['b-n', i || '—'];
  return <span className={'badge ' + c}>{t}</span>;
}

function EstadoBadge({ estado }: { estado: string }) {
  if (estado === 'Pendiente') return <span className="badge badge-estado-pend">Pend.</span>;
  if (estado === 'Pendiente aprobación') return <span className="badge" style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', fontSize: 10 }}>⏳ Aprobación</span>;
  if (estado === 'Rechazada') return <span className="badge" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontSize: 10 }}>✗ Rechazada</span>;
  if (estado === 'Completada') return <span className="badge badge-estado-done">OK</span>;
  return <span className="badge badge-estado-canc">Canc.</span>;
}

function TareaFila({ t, clase }: { t: TareaG; clase: string }) {
  const st = usePortal.getState();
  const proc = st.DATA.find((r) => r.id === t.nroId);
  const supervisor = proc ? proc.supervisor : '—';
  const instancia = proc ? proc.instancia : '—';
  const bitacora = (proc && proc.bitacora) || '—';
  const ov = loadOverrides()[t.id] || {};
  const cambios: string[] = [];
  if (ov.asignado && ov.asignado !== t.asignado) cambios.push('→' + ov.asignado);
  if (ov.fecha && ov.fecha !== t.fecha) cambios.push('📅' + ov.fecha);
  if (ov.estado && ov.estado !== t.estado) cambios.push(ov.estado);
  const member = TEAM_GESTION.find((m) => m.nombre === t.asignado);
  const favMap = getFavTareas();
  const fav = favMap[t.id];
  const usFav = getFavUsuarios(fav);
  const cliente = t.cliente || '—';
  const tipo = t.tipo || '';
  const obs = t.obs || '';
  const adj = t.adjuntos || [];
  const open = (name: 'gestionarTarea' | 'comentariosTarea' | 'devolverTarea') => st.openModal(name, { tareaId: t.id });
  return (
    <tr className={clase}>
      <td style={{ width: 24, textAlign: 'center', padding: '0 2px' }} onClick={(e) => e.stopPropagation()}>
        <span className={'tg-fav-star' + (fav ? ' activo' : '')} onClick={() => toggleFavTarea(t.id)} title={fav ? favTituloEstrella(fav) : 'Marcar como favorito'}>⭐</span>
        {fav && usFav.length > 1 && <span style={{ display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--amber)', lineHeight: 1 }}>×{usFav.length}</span>}
      </td>
      <td>{t.nroId ? <a className="id-link" href={MYBIG_PROC(t.nroId)} target="_blank" rel="noreferrer">#{t.nroId}</a> : <span style={{ color: 'var(--text4)' }}>—</span>}</td>
      <td className="td-p" title={cliente}>{cliente.slice(0, 22) + (t.cliente && t.cliente.length > 22 ? '…' : '')}</td>
      <td className="td-m" title={t.expediente || '—'}>{t.expediente || '—'}</td>
      <td className="td-d" style={{ fontSize: 11 }}>{supervisor}</td>
      <td><InstBadge i={instancia} /></td>
      <td className="td-d" style={{ fontSize: 11 }} title={bitacora}>{bitacora.slice(0, 40) + (bitacora.length > 40 ? '…' : '')}</td>
      <td title={tipo}>{tipo.replace('Gestión - ', '').slice(0, 35) + (tipo.length > 40 ? '…' : '')}</td>
      <td style={{ display: 'flex', alignItems: 'center' }}>
        {member && <span style={{ width: 8, height: 8, borderRadius: '50%', background: member.color, display: 'inline-block', marginRight: 4, flexShrink: 0 }} />}
        {t.asignado || '—'}
      </td>
      <td className="td-d" style={{ fontSize: 11 }}>{t.agendadoPor || '—'}</td>
      <td style={{ fontSize: 11, color: 'var(--text2)' }}>{t.fecha || '—'}</td>
      <td style={{ fontSize: 10.5, color: 'var(--text4)', whiteSpace: 'nowrap' }}>{t.fechaEncargo || '—'}</td>
      <td>
        <EstadoBadge estado={t.estado} />
        {adj.length > 0 && <> <span title={adj.length + ' adjunto' + (adj.length !== 1 ? 's' : '')} style={{ fontSize: 10.5, color: 'var(--text3)' }}>📎{adj.length}</span></>}
      </td>
      <td className="td-d" style={{ fontSize: 11 }} title={obs}>{obs.slice(0, 30) + (obs.length > 30 ? '…' : '')}</td>
      <td>{cambios.length ? <span style={{ color: 'var(--amber)', fontSize: 10.5 }}>⏳ {cambios.join(' · ')}</span> : <span style={{ color: 'var(--text4)' }}>—</span>}</td>
      <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button className="btn-redir btn-editar-tarea" onClick={() => open('gestionarTarea')} style={{ borderColor: 'var(--blue-b)', color: 'var(--blue)', background: 'var(--blue-l)', padding: '3px 8px', fontSize: 11 }}>✎ Editar</button>
        <button className="btn-redir btn-comentar-tarea" onClick={() => open('comentariosTarea')} style={{ borderColor: 'var(--green)', color: 'var(--green)', background: 'var(--green-l)', padding: '3px 8px', fontSize: 11 }}>💬</button>
        <button className="btn-redir btn-devolver-tarea" onClick={() => open('devolverTarea')} style={{ borderColor: 'var(--red-b)', color: 'var(--red)', background: 'var(--red-l)', padding: '3px 8px', fontSize: 11 }}>↩</button>
        <button className="btn-redir btn-eliminar-tarea" title="Eliminar tarea" onClick={() => eliminarTareaGestion(t.id)} style={{ borderColor: 'var(--red-b)', color: '#fff', background: 'var(--red)', padding: '3px 8px', fontSize: 11 }}>🗑</button>
      </td>
    </tr>
  );
}

function TablaTareas({ rows, clase, vacio }: { rows: TareaG[]; clase: string; vacio: string }) {
  return (
    <div className="tg-list-wrap">
      <table>
        <thead><tr>
          <th style={{ width: 28 }}>⭐</th>
          <th style={{ minWidth: 65 }}>ID Proc.</th>
          <th style={{ minWidth: 155 }}>Cliente</th>
          <th style={{ minWidth: 130 }}>Expediente</th>
          <th style={{ minWidth: 90 }}>Supervisor</th>
          <th style={{ minWidth: 85 }}>Instancia</th>
          <th style={{ minWidth: 170 }}>Bitácora</th>
          <th style={{ minWidth: 210 }}>Tipo de tarea</th>
          <th style={{ minWidth: 115 }}>Asignado a</th>
          <th style={{ minWidth: 100 }}>Agendado por</th>
          <th style={{ minWidth: 90 }}>Fecha límite</th>
          <th style={{ minWidth: 120 }}>Fecha encargo</th>
          <th style={{ minWidth: 70 }}>Estado</th>
          <th style={{ minWidth: 180 }}>Observaciones</th>
          <th style={{ minWidth: 80 }}>Cambios</th>
          <th style={{ minWidth: 90 }}>Acciones</th>
        </tr></thead>
        <tbody>
          {rows.length
            ? rows.map((t) => <TareaFila key={t.id} t={t} clase={clase} />)
            : <tr><td colSpan={16} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text4)' }}>{vacio}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

const esInterna = (t: TareaG) => t.origen === 'portal' && !!t.agendadoPor && t.agendadoPor !== '—';

export default function GestionView() {
  const kvRev = usePortal((s) => s.kvRev);
  const dataRev = usePortal((s) => s.dataRev);
  const DATA = usePortal((s) => s.DATA);
  const EXCEL = usePortal((s) => s.TAREAS_GESTION_EXCEL);

  const [vista, setVista] = useState<SubVista>('lista');
  const [sub, setSub] = useState<'ext' | 'int'>('ext');
  const [q, setQ] = useState('');
  const [resp, setResp] = useState('');
  const [estado, setEstado] = useState('');
  const [origen, setOrigen] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [pgExt, setPgExt] = useState(1);
  const [pgInt, setPgInt] = useState(1);
  const listaRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setPgExt(1); setPgInt(1); }, [dataRev]);

  const tareas = useMemo(() => {
    const ql = q.toLowerCase();
    return getAllTareasGestion().filter((t) => {
      if (ql && !(t.cliente + t.expediente + t.tipo + t.asignado + (t.agendadoPor || '')).toLowerCase().includes(ql)) return false;
      if (resp && t.asignado !== resp) return false;
      if (estado && t.estado !== estado) return false;
      if (origen) {
        if (origen === 'ext' && esInterna(t)) return false;
        if (origen === 'int' && !esInterna(t)) return false;
      }
      if (desde || hasta) {
        const ft = parseFechaTarea(t.fecha);
        if (!ft) return false;
        if (desde && ft < new Date(desde)) return false;
        if (hasta && ft > new Date(hasta + 'T23:59:59')) return false;
      }
      return true;
    });
    // kvRev/DATA/EXCEL: las tareas y overrides viven en el almacén clave→valor y en los datos del Excel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, resp, estado, origen, desde, hasta, kvRev, DATA, EXCEL]);

  const externas = useMemo(() => tareas.filter((t) => !esInterna(t)), [tareas]);
  const internas = useMemo(() => tareas.filter(esInterna), [tareas]);
  const tpExt = Math.ceil(externas.length / TG_PAGE) || 1;
  const tpInt = Math.ceil(internas.length / TG_PAGE) || 1;
  const curExt = pgExt > tpExt ? 1 : pgExt;
  const curInt = pgInt > tpInt ? 1 : pgInt;
  const sliceExt = externas.slice((curExt - 1) * TG_PAGE, curExt * TG_PAGE);
  const sliceInt = internas.slice((curInt - 1) * TG_PAGE, curInt * TG_PAGE);

  useResizableColumns(listaRef, [vista, sub, tareas.length, curExt, curInt]);

  let favCnt = 0;
  try { favCnt = Object.keys(JSON.parse((usePortal.getState().kv['fav_procs'] as string) || '{}')).length; } catch { /* */ }

  const limpiarFecha = () => { setDesde(''); setHasta(''); };
  const tabBtn = (id: SubVista, label: React.ReactNode, hidden = false) => (
    <button className={'tg-view-tab' + (vista === id ? ' active' : '')} id={'tgv-' + id} onClick={() => setVista(id)} style={hidden ? { display: 'none' } : undefined}>{label}</button>
  );

  return (
    <div>
      <div className="tg-toolbar">
        <button className="btn-primary-red" onClick={() => usePortal.getState().openModal('agendar', {})}>
          <span style={{ fontSize: 14 }}>+</span> Nueva tarea de gestión
        </button>
        <div className="tg-view-tabs">
          {tabBtn('lista', '📋 Lista')}
          {tabBtn('cal', '📅 Calendario', true)}
          {tabBtn('planner', '🗂 Planner')}
          {tabBtn('favoritos', <>⭐ Favoritos<span className="fav-tab-badge" id="fav-tab-cnt">{favCnt}</span></>)}
          {tabBtn('equipos', '👥 Todos los equipos')}
        </div>
        {vista === 'lista' && (
          <div id="tg-filters" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="srch-wrap" style={{ maxWidth: 300 }}>
              <span>🔍</span>
              <input className="srch-inp" type="text" value={q} placeholder="Buscar proceso, cliente, responsable..." onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="sel-inp" value={resp} onChange={(e) => setResp(e.target.value)}>
              <option value="">Todos los responsables</option>
              {ASIGNADOS_GESTION.map((n) => <option key={n}>{n}</option>)}
            </select>
            <select className="sel-inp" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              <option>Pendiente</option><option>Completada</option><option>Cancelada</option>
            </select>
            <select className="sel-inp" value={origen} onChange={(e) => setOrigen(e.target.value)}>
              <option value="">Todos los orígenes</option>
              <option value="ext">Externas (de equipos)</option>
              <option value="int">Internas (propias)</option>
            </select>
            <div className="tg-date-filter">
              <span>Fecha:</span>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} title="Desde" />
              <span>—</span>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} title="Hasta" />
              <button className="btn-sm" onClick={limpiarFecha} title="Limpiar fechas">✕</button>
            </div>
            <span className="count-lbl">{tareas.length} tarea{tareas.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {vista === 'lista' && (
        <div id="tg-view-lista" ref={listaRef}>
          <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--gray-b)', marginBottom: '1rem' }}>
            <button onClick={() => setSub('ext')}
              style={{ padding: '8px 20px', fontSize: 12.5, fontWeight: 500, fontFamily: 'var(--font)', background: 'none', border: 'none', borderBottom: '2px solid ' + (sub === 'ext' ? 'var(--blue)' : 'transparent'), cursor: 'pointer', color: sub === 'ext' ? 'var(--blue)' : 'var(--text3)', marginBottom: -2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#eff6ff', border: '2px solid var(--blue)', display: 'inline-block' }} />
              Agendadas por equipos <span style={{ background: 'var(--blue)', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10.5, marginLeft: 2 }}>{externas.length}</span>
            </button>
            <button onClick={() => setSub('int')}
              style={{ padding: '8px 20px', fontSize: 12.5, fontWeight: 500, fontFamily: 'var(--font)', background: 'none', border: 'none', borderBottom: '2px solid ' + (sub === 'int' ? 'var(--green)' : 'transparent'), cursor: 'pointer', color: sub === 'int' ? 'var(--green)' : 'var(--text3)', marginBottom: -2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#f0fdf4', border: '2px solid var(--green)', display: 'inline-block' }} />
              Autoagendadas por Gestión <span style={{ background: 'var(--green)', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10.5, marginLeft: 2 }}>{internas.length}</span>
            </button>
          </div>
          {sub === 'ext' ? (
            <div id="tg-panel-ext">
              <TablaTareas rows={sliceExt} clase="tg-origen-ext" vacio="Sin tareas agendadas por equipos" />
              <Pagination cur={curExt} total={tpExt} perPage={TG_PAGE} onPage={setPgExt} />
            </div>
          ) : (
            <div id="tg-panel-int">
              <TablaTareas rows={sliceInt} clase="tg-origen-int" vacio="Sin tareas autoagendadas por Gestión" />
              <Pagination cur={curInt} total={tpInt} perPage={TG_PAGE} onPage={setPgInt} />
            </div>
          )}
        </div>
      )}
      {vista === 'cal' && <div id="tg-view-cal"><CalendarPanel /></div>}
      {vista === 'planner' && <div id="tg-view-planner"><PlannerPanel /></div>}
      {vista === 'favoritos' && <div id="tg-view-favoritos"><FavoritosPanel /></div>}
      {vista === 'equipos' && <div id="tg-view-equipos"><EquiposPanel /></div>}
    </div>
  );
}
