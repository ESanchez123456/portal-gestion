'use client';
import { useMemo, useState } from 'react';
import { usePortal } from '@/store/portal';
import { esAdmin } from '@/lib/audit';

interface DiliEq {
  nrotarea: number; supervisor: string; usuario: string; cliente: string; expediente: string;
  tipo: string; fecha: string; hora: string; estado: string;
}

const EQUIPOS_DEFAULT = ['Carlos Morales', 'Cynthia Lagos', 'Elyana Arias', 'Katia Jacinto', 'Samuel Paz', 'Solanch Estrella'];
const sortKey = (f?: string) => (f ? f.split('/').reverse().join('-') : '');

/** Vista "Todos los equipos": diligencias de todos los supervisores (renderEquipos, legacy 5469-5560). */
export default function EquiposPanel() {
  usePortal((s) => s.kvRev);
  const base = usePortal((s) => s.DILIGENCIAS_EQUIPOS_EXCEL) as unknown as DiliEq[];
  const [q, setQ] = useState('');
  const [equipo, setEquipo] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const hayData = !!(base && base.length);
  const sups = useMemo(
    () => (hayData ? [...new Set(base.map((r) => r.supervisor).filter(Boolean))].sort((a, b) => a.localeCompare(b)) : EQUIPOS_DEFAULT),
    [base, hayData],
  );
  const equipoEf = sups.includes(equipo) ? equipo : '';

  const dilis = useMemo(() => {
    if (!hayData) return [];
    const ql = q.toLowerCase();
    return base.filter((r) => {
      if (equipoEf && r.supervisor !== equipoEf) return false;
      if (ql && !((r.cliente || '') + (r.usuario || '') + (r.expediente || '')).toLowerCase().includes(ql)) return false;
      const fd = sortKey(r.fecha);
      if (desde && fd < desde) return false;
      if (hasta && fd > hasta) return false;
      return true;
    });
  }, [base, hayData, q, equipoEf, desde, hasta]);

  const grupos = useMemo(() => {
    const g: Record<string, DiliEq[]> = {};
    dilis.forEach((r) => { (g[r.supervisor || 'Sin equipo'] = g[r.supervisor || 'Sin equipo'] || []).push(r); });
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  }, [dilis]);

  const limpiarFecha = () => { setDesde(''); setHasta(''); };

  let contenido: React.ReactNode;
  if (!hayData) {
    contenido = (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text4)' }}>
        Aún no hay diligencias publicadas. {esAdmin() ? 'Carga el Excel de tareas (Cargar Excel) para publicarlas a todo el equipo.' : 'El administrador debe cargar el Excel de tareas para que aparezcan aquí.'}
      </div>
    );
  } else if (!dilis.length) {
    contenido = <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text4)' }}>Sin diligencias para los filtros seleccionados.</div>;
  } else {
    contenido = grupos.map(([sup, rows]) => (
      <div className="eq-group" key={sup}>
        <div className="eq-group-header">⚖ {sup} <span style={{ fontSize: 10.5, opacity: 0.6, fontWeight: 400 }}>({rows.length} diligencias)</span></div>
        <table className="eq-table">
          <thead><tr><th>ID Tarea</th><th>Cliente</th><th>Expediente</th><th>Tipo</th><th>Responsable</th><th>Fecha y hora</th><th>Estado</th></tr></thead>
          <tbody>
            {[...rows].sort((a, b) => sortKey(a.fecha).localeCompare(sortKey(b.fecha))).map((r, i) => {
              const est = r.estado || '';
              const estColor = est === 'Pendiente' ? 'var(--amber)' : est === 'Cumplida' ? 'var(--green)' : 'var(--text4)';
              return (
                <tr key={r.nrotarea + '_' + i}>
                  <td><a className="id-link" href={'https://vinatea.mybig.com.ar/tareas/' + r.nrotarea + '/edit/'} target="_blank" rel="noreferrer">#{r.nrotarea}</a></td>
                  <td className="td-p" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.cliente || '—'}</td>
                  <td className="td-m" style={{ fontSize: 10.5 }}>{r.expediente || '—'}</td>
                  <td style={{ fontSize: 11 }}>{r.tipo}</td>
                  <td style={{ fontSize: 11 }}>{r.usuario || '—'}</td>
                  <td style={{ fontWeight: 600, color: 'var(--amber)', whiteSpace: 'nowrap' }}>{r.fecha}{r.hora ? ' ' + r.hora : ''}</td>
                  <td><span style={{ color: estColor, fontSize: 10.5, fontWeight: 600 }}>{est}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ));
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: '.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="srch-wrap" style={{ maxWidth: 280 }}>
          <span>🔍</span>
          <input className="srch-inp" type="text" placeholder="Buscar cliente, responsable..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="sel-inp" value={equipoEf} onChange={(e) => setEquipo(e.target.value)}>
          <option value="">Todos los equipos</option>
          {sups.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="tg-date-filter">
          <span>Fecha:</span>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          <span>—</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          <button className="btn-sm" onClick={limpiarFecha}>✕</button>
        </div>
        <span className="count-lbl">{hayData ? dilis.length.toLocaleString() : 0} diligencias</span>
      </div>
      <div>{contenido}</div>
    </div>
  );
}
