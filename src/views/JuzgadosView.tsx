'use client';
// Apartado Juzgados y Magistrados (HTML 2174-2195; JS renderJuzgados ~6755-6850).
import { useMemo, useState } from 'react';
import { usePortal, showToast } from '@/store/portal';
import { esAdmin } from '@/lib/audit';
import { getJuzgados, colorEncargado, normOrgano } from '@/lib/juzgados';
import { borrarJuzgado } from '@/lib/juzgadosAdmin';

export default function JuzgadosView() {
  const rev = usePortal((s) => s.kvRev);
  const dataRev = usePortal((s) => s.dataRev);
  const [q, setQ] = useState('');
  const [fDist, setFDist] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [fEnc, setFEnc] = useState('');

  const arr = useMemo(() => { void rev; void dataRev; return getJuzgados(); }, [rev, dataRev]);
  const opts = useMemo(() => {
    const u = (xs: string[]) => Array.from(new Set(xs.filter(Boolean))).sort();
    return { dists: u(arr.map((j) => j.distrito)), tipos: u(arr.map((j) => j.tipoJuzgado)), encs: u(arr.map((j) => j.encargado)) };
  }, [arr]);

  const stats = useMemo(() => {
    const porEnc: Record<string, number> = {};
    let sinEnc = 0;
    arr.forEach((j) => { if (j.encargado) porEnc[j.encargado] = (porEnc[j.encargado] || 0) + 1; else sinEnc++; });
    return { porEnc, sinEnc, magistrados: arr.filter((j) => j.magistrado).length, organos: new Set(arr.map((j) => normOrgano(j.organo))).size };
  }, [arr]);

  const qn = q.toLowerCase().trim();
  const rows = arr.filter((j) => {
    if (fDist && j.distrito !== fDist) return false;
    if (fTipo && j.tipoJuzgado !== fTipo) return false;
    if (fEnc === '__sin__' && j.encargado) return false;
    if (fEnc && fEnc !== '__sin__' && j.encargado !== fEnc) return false;
    if (qn && !((j.distrito || '') + (j.tipoJuzgado || '') + (j.organo || '') + (j.magistrado || '') + (j.encargado || '')).toLowerCase().includes(qn)) return false;
    return true;
  });

  const porDistrito: Record<string, Record<string, { tipo: string; items: typeof arr }>> = {};
  rows.forEach((j) => {
    const d = j.distrito || '— Sin distrito';
    const o = j.organo || '— Sin órgano';
    (porDistrito[d] = porDistrito[d] || {});
    (porDistrito[d][o] = porDistrito[d][o] || { tipo: j.tipoJuzgado || '', items: [] }).items.push(j);
  });

  const puedeEditar = esAdmin();
  const abrir = (payload?: { id?: string; organoPre?: string; distritoPre?: string; tipoPre?: string }) => {
    if (payload?.id && !esAdmin()) { showToast('⚠ Solo el administrador puede editar o eliminar juzgados'); return; }
    usePortal.getState().openModal('juzgado', payload || {});
  };

  const Stat = ({ color, val, lbl }: { color: string; val: number; lbl: string }) => (
    <div className="juz-stat"><div className="juz-stat-dot" style={{ background: color }} /><div><div className="juz-stat-val">{val}</div><div className="juz-stat-lbl">{lbl}</div></div></div>
  );

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '.9rem' }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>⚖ Juzgados y Magistrados</div>
        <span style={{ fontSize: 11.5, color: 'var(--text4)' }}>quién de Gestión impulsa/visita cada juzgado — se completa entre todos</span>
      </div>

      <div className="juz-stats" id="juz-stats-row">
        <Stat color="#64748b" val={stats.magistrados} lbl="Magistrados" />
        <Stat color="#64748b" val={stats.organos} lbl="Órganos/juzgados" />
        {Object.keys(stats.porEnc).sort().map((e) => <Stat key={e} color={colorEncargado(e)} val={stats.porEnc[e]} lbl={e} />)}
        <Stat color="var(--gray-b)" val={stats.sinEnc} lbl="Sin asignar" />
      </div>

      <div className="juz-filterbar">
        <input type="text" id="juz-search" placeholder="🔍 Buscar distrito, juzgado, órgano o magistrado..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="sel-inp" value={fDist} onChange={(e) => setFDist(e.target.value)}>
          <option value="">Todos los distritos</option>{opts.dists.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select className="sel-inp" value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
          <option value="">Todos los tipos</option>{opts.tipos.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select className="sel-inp" value={fEnc} onChange={(e) => setFEnc(e.target.value)}>
          <option value="">Todos los encargados</option>{opts.encs.map((d) => <option key={d}>{d}</option>)}<option value="__sin__">Sin encargado</option>
        </select>
        <span className="count-lbl" id="juz-count">{rows.filter((x) => x.magistrado).length.toLocaleString()} magistrado{rows.filter((x) => x.magistrado).length !== 1 ? 's' : ''} · {rows.length.toLocaleString()} registros</span>
        <button className="btn btn-dark" style={{ marginLeft: 'auto' }} onClick={() => abrir()}>+ Agregar magistrado</button>
      </div>

      <div id="juz-container">
        {!rows.length ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text4)', fontSize: 13 }}>
            <div style={{ fontSize: 40, marginBottom: '.75rem' }}>⚖</div>Sin resultados para este filtro.
          </div>
        ) : Object.keys(porDistrito).sort().map((dist) => (
          <div key={dist}>
            <div className="juz-dist-head">📍 {dist}</div>
            {Object.keys(porDistrito[dist]).sort().map((org) => {
              const g = porDistrito[dist][org];
              return (
                <div className="juz-org-card" key={org}>
                  <div className="juz-org-head">
                    <div>
                      <div className="juz-org-name">{org}</div>
                      <div className="juz-org-meta">{g.tipo} · {g.items.filter((x) => x.magistrado).length} magistrado{g.items.filter((x) => x.magistrado).length !== 1 ? 's' : ''}</div>
                    </div>
                    <button className="btn-sm" onClick={() => abrir({ organoPre: org, distritoPre: dist, tipoPre: g.tipo })}>+ Magistrado</button>
                  </div>
                  {g.items.map((j) => {
                    const encColor = j.encargado ? colorEncargado(j.encargado) : null;
                    return (
                      <div className="juz-mag-row" key={j.id}>
                        <div className="juz-mag-name" title={j.magistrado}>{j.magistrado || '—'}</div>
                        {j.condicion ? <span className="juz-cond-badge">{j.condicion}</span> : null}
                        <span className={'juz-enc-chip' + (j.encargado ? '' : ' vacio')} style={encColor ? { background: encColor } : undefined}>{j.encargado || '—'}</span>
                        {puedeEditar ? (
                          <div className="juz-mag-actions">
                            <button title="Editar" onClick={() => abrir({ id: j.id })}>✎</button>
                            <button className="del" title="Eliminar" onClick={() => borrarJuzgado(j.id)}>✕</button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
