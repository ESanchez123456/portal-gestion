'use client';
// Sub-vista Favoritos de Tareas de Gestión (HTML 1554-1572; JS renderFavoritos 7127-7260, exportar 6316-6486).
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePortal, showToast } from '@/store/portal';
import MentionTextarea from '@/components/MentionTextarea';
import {
  getFavs, getFavTareas, getFavUsuarios, getFavHist, getFavHistTarea, getSentencias, haySentenciasDisponibles,
  fmtFechaEs, fmtMonto, toggleFav, toggleFavTarea, guardarFavComentario, borrarFavComentario,
  guardarFavTareaComentario, borrarFavTareaComentario, getAllTareasGestion, updateFavBadge,
  type FavEntry, type Sentencia,
} from '@/lib/favoritos';
import type { Proceso, TareaGestion } from '@/types';

const USER_COLORS: Record<string, string> = {
  'Roberto Matallana': '#dc2626', 'Carlos Morales': '#2563eb', 'Arturo Trelles': '#4f46e5',
  'Silvia Maldonado': '#16a34a', 'Juan Jose Edquen': '#7c3aed',
};
const FILTRO_USERS = ['Roberto Matallana', 'Carlos Morales', 'Arturo Trelles', 'Silvia Maldonado', 'Juan Jose Edquen', 'Talía León'];
const MYBIG = 'https://vinatea.mybig.com.ar/trabajos/overview/';

const escH = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Color de alerta de la próxima diligencia: hoy → rojo, 3 días → ámbar, 2 o 1 → verde. */
function colorDiligCountdown(fechaStr?: string): string | null {
  if (!fechaStr) return null;
  const [d, m, y] = fechaStr.split('/');
  if (!d || !m || !y) return null;
  const f = new Date(+y, +m - 1, +d); f.setHours(0, 0, 0, 0);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const dias = Math.round((f.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  if (dias === 0) return 'var(--red)';
  if (dias === 3) return 'var(--amber)';
  if (dias === 2 || dias === 1) return 'var(--green)';
  return null;
}
interface Campo { l: string; v: unknown; style?: React.CSSProperties }
function campoProxDilig(proc: Proceso): Campo {
  if (!proc.proxDiligencia) return { l: 'Próx.dilig.', v: '—' };
  const color = colorDiligCountdown(proc.proxDiliFecha);
  return { l: 'Próx.dilig.', v: proc.proxDiligencia + ' · ' + proc.proxDiliFecha, style: color ? { color, fontWeight: 700 } : undefined };
}
const camposProc = (proc: Proceso): Campo[] => [
  { l: 'Supervisor', v: proc.supervisor }, { l: 'Responsable', v: proc.responsable },
  { l: 'Instancia', v: proc.instancia }, { l: 'Situación', v: proc.situacion },
  { l: 'Pacto', v: proc.pacto }, { l: 'Relevancia', v: proc.relevancia },
  { l: 'Distrito', v: proc.distrito }, campoProxDilig(proc),
  { l: 'Bitácora', v: proc.bitacora || '—' }, { l: 'Órgano', v: proc.organo || '—' },
  { l: 'Cuantía', v: proc.cuantia ? 'S/ ' + fmtMonto(proc.cuantia) : '—' }, { l: 'Reposición', v: proc.reposicion || '—' },
];

function Grid({ proc }: { proc: Proceso }) {
  return (
    <div className="fav-card-grid">
      {camposProc(proc).map((c) => (
        <div className="fav-card-field" key={c.l}><label>{c.l}</label><span style={c.style}>{String(c.v || '—').slice(0, 45)}</span></div>
      ))}
    </div>
  );
}

function Sentencias({ nroId }: { nroId: number }) {
  const sents = getSentencias(nroId);
  if (!sents.length) return <div style={{ fontSize: 11, color: 'var(--text4)', padding: '.3rem 0' }}>Sin sentencias registradas.</div>;
  const clsR = (r: string) => (r === 'Favorable' ? 'sent-fav' : r.includes('Desfavorable') || r.includes('Adverso') ? 'sent-des' : 'sent-neu');
  return (
    <div className="sent-grid">
      {sents.map((s, i) => (
        <div className="sent-card" key={i}>
          <div className="sent-card-header"><span className="sent-inst">{s.label}</span>{s.resultado ? <span className={'sent-resultado ' + clsR(s.resultado)}>{s.resultado}</span> : null}</div>
          <div className="sent-sentencia">{s.sentencia || '—'}</div>
          {s.fecha ? <div className="sent-fecha">📅 {fmtFechaEs(s.fecha)}</div> : null}
          {s.monto && String(s.monto) !== '0' ? <div className="sent-monto">S/ {fmtMonto(s.monto)}</div> : null}
          {s.detalle ? <div className="sent-detalle">{String(s.detalle).slice(0, 80)}</div> : null}
        </div>
      ))}
    </div>
  );
}
const SentBlock = ({ nroId }: { nroId: number }) => (
  <div style={{ marginBottom: '.5rem' }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '.3rem' }}>⚖ Sentencias previas</div>
    <Sentencias nroId={nroId} />
  </div>
);

const warnBox: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: 'var(--amber)', background: 'var(--amber-l)', border: '1px solid var(--amber-b)', borderRadius: 'var(--r)', padding: '5px 9px', marginBottom: '.6rem' };
function MotivoInactivo({ id, etiqueta }: { id: number; etiqueta: string }) {
  const mapa = usePortal((s) => s.RAWRT_ESTADO_BY_ID) || {};
  let motivo: string;
  if (!(id in mapa)) motivo = 'no está en el último Excel cargado';
  else {
    const ec = mapa[id];
    motivo = ec === '(vacío)' ? 'su Estado Carpeta está vacío pero igual no aparece activo (revisar con sistemas)' : 'su Estado Carpeta en el Excel es "' + ec + '" (no "Activo")';
  }
  return <div style={warnBox}>⚠ {etiqueta} ya no está activo en el Reporte Total: {motivo} — sus datos no se pueden mostrar, pero el favorito y sus comentarios se conservan.</div>;
}

const histBox: React.CSSProperties = { maxHeight: 100, overflowY: 'auto', marginBottom: '.4rem', display: 'flex', flexDirection: 'column', gap: 4 };
const taStyle: React.CSSProperties = { flex: 1, padding: '7px 10px', border: '1px solid var(--gray-b)', borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'var(--font)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' };
const delBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 10, padding: 0 };
const grpHead = (color: string, usr: string, n: number, unit: string) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '.5rem', padding: '.4rem .6rem', background: 'var(--white)', borderRadius: 'var(--r)', border: '1px solid var(--gray-b)' }}>
    <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
    <span style={{ fontWeight: 600, fontSize: 12.5 }}>{usr}</span>
    <span style={{ fontSize: 11, color: 'var(--text4)' }}>{n} {unit}{n !== 1 ? 's' : ''}</span>
  </div>
);

function ProcCard({ f, usr, proc }: { f: FavEntry; usr: string; proc?: Proceso }) {
  const [txt, setTxt] = useState('');
  const hist = getFavHist(f.id);
  const id = Number(f.id);
  const otros = getFavUsuarios(f).filter((u) => u !== usr);
  const openModal = usePortal.getState().openModal;
  usePortal((s) => s.SENTENCIAS_BY_ID);
  return (
    <div className="fav-card">
      <div className="fav-card-header">
        <span className="fav-star activo" onClick={() => toggleFav(id)} style={{ flexShrink: 0 }}>⭐</span>
        <div style={{ flex: 1 }}>
          <div className="fav-card-title">{proc ? proc.cliente : '#' + f.id}</div>
          <div className="fav-card-exp">{proc ? proc.expediente : ''}{proc && proc.instancia ? <> · <span style={{ color: 'var(--blue)' }}>{proc.instancia}</span></> : null}</div>
          {otros.length ? <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 600, color: 'var(--amber)', background: 'var(--amber-l)', border: '1px solid var(--amber-b)', borderRadius: 10, padding: '2px 9px', marginTop: 4 }}>👥 También lo tiene {otros.join(', ')}</div> : null}
        </div>
        <a className="id-link" href={MYBIG + f.id + '/'} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>#{f.id}</a>
      </div>
      {!proc ? <MotivoInactivo id={id} etiqueta="Este proceso" /> : null}
      {proc ? <Grid proc={proc} /> : null}
      {haySentenciasDisponibles() && getSentencias(id).length ? <SentBlock nroId={id} /> : null}
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: '.3rem' }}>💬 Comentarios</div>
      {hist.length ? (
        <div style={histBox}>
          {hist.map((h, i) => (
            <div key={i} style={{ padding: '5px 9px', background: 'var(--gray-l)', borderRadius: 'var(--r)', borderLeft: '3px solid #f59e0b', fontSize: 11.5 }}>
              <div>{h.texto}</div>
              <div style={{ fontSize: 10, color: 'var(--text4)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{h.fecha || ''}</span><button onClick={() => borrarFavComentario(id, i)} style={delBtn}>✕</button>
              </div>
            </div>
          ))}
        </div>
      ) : <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: '.4rem' }}>Sin comentarios.</div>}
      <div style={{ display: 'flex', gap: 6, marginBottom: '.6rem' }}>
        <MentionTextarea value={txt} onChange={setTxt} placeholder="Comentario... @nombre para mencionar" style={{ ...taStyle, minHeight: 45 }} />
      </div>
      <div className="fav-card-actions">
        <button className="btn btn-dark" onClick={() => { if (guardarFavComentario(id, txt)) setTxt(''); }} style={{ fontSize: 11 }}>💾 Guardar</button>
        <button className="btn-sm" onClick={() => openModal('agendar', { procId: id })} style={{ fontSize: 11 }}>+ Agendar</button>
        <button className="btn-sm" onClick={() => openModal('obsProc', { procId: id })} style={{ fontSize: 11 }}>📋 CID</button>
      </div>
    </div>
  );
}

function TareaCard({ f, usr, tarea, proc }: { f: FavEntry; usr: string; tarea?: TareaGestion; proc?: Proceso | null }) {
  const [txt, setTxt] = useState('');
  const fid = String(f.id);
  const hist = getFavHistTarea(fid);
  const adj = ((tarea && tarea.adjuntos) || []) as { nombre: string; tipo: string; data: string }[];
  const otros = getFavUsuarios(f).filter((u) => u !== usr);
  const openModal = usePortal.getState().openModal;
  usePortal((s) => s.SENTENCIAS_BY_ID);
  return (
    <div className="fav-card" style={{ borderLeftColor: 'var(--green)' }}>
      <div className="fav-card-header">
        <span className="tg-fav-star activo" onClick={() => toggleFavTarea(fid)} style={{ fontSize: 14, flexShrink: 0 }}>⭐</span>
        <div style={{ flex: 1 }}>
          <div className="fav-card-title">{proc ? proc.cliente : (f.cliente || 'Tarea #' + f.id)}</div>
          <div className="fav-card-exp">{proc ? proc.expediente : (tarea ? tarea.expediente : '')}{proc && proc.instancia ? <> · <span style={{ color: 'var(--blue)' }}>{proc.instancia}</span></> : null}</div>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'var(--green-l)', color: 'var(--green)', border: '1px solid var(--green-b)', textTransform: 'uppercase', letterSpacing: '.03em' }}>⚡ Tarea</span>
            {tarea ? <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>{f.tipo || tarea.tipo || '—'}{tarea.obs ? ' — ' + String(tarea.obs).slice(0, 60) : ''}</span> : null}
          </div>
          {otros.length ? <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 600, color: 'var(--amber)', background: 'var(--amber-l)', border: '1px solid var(--amber-b)', borderRadius: 10, padding: '2px 9px', marginTop: 4 }}>👥 También la tiene {otros.join(', ')}</div> : null}
          {tarea ? <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 3 }}>→ {tarea.asignado || '—'} · {tarea.fecha || '—'} · {tarea.estado || ''}</div> : null}
        </div>
        {proc ? <a className="id-link" href={MYBIG + proc.id + '/'} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>#{proc.id}</a> : null}
      </div>
      {!tarea
        ? <div style={warnBox}>⚠ Esta tarea ya no existe en Tareas de Gestión (fue eliminada o ya no está en el último Excel) — el favorito y sus comentarios se conservan.</div>
        : (!proc ? <MotivoInactivo id={tarea.nroId} etiqueta="El proceso de esta tarea" /> : null)}
      {proc ? <Grid proc={proc} /> : null}
      {proc && haySentenciasDisponibles() && getSentencias(proc.id).length ? <SentBlock nroId={proc.id} /> : null}
      {tarea && tarea.obs ? <div style={{ padding: '6px 9px', background: 'var(--gray-l)', borderRadius: 'var(--r)', fontSize: 11.5, marginBottom: '.4rem', color: 'var(--text3)' }}><b>Nota de la tarea:</b> {tarea.obs}</div> : null}
      {adj.length ? (
        <div style={{ marginBottom: '.4rem' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '.3rem' }}>📎 Adjuntos</div>
          {adj.map((a, i) => (
            <div className="ag-adj-item" key={i}><span>{(a.tipo || '').includes('image') ? '🖼️' : (a.tipo || '').includes('pdf') ? '📄' : '📎'}</span><a href={a.data} download={a.nombre}>{a.nombre}</a></div>
          ))}
        </div>
      ) : null}
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: '.3rem' }}>💬 Comentarios</div>
      {hist.length ? (
        <div style={histBox}>
          {hist.map((h, i) => (
            <div key={i} style={{ padding: '5px 9px', background: 'var(--gray-l)', borderRadius: 'var(--r)', borderLeft: '3px solid var(--green)', fontSize: 11.5 }}>
              <div>{h.texto}</div>
              <div style={{ fontSize: 10, color: 'var(--text4)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{h.fecha || ''}</span><button onClick={() => borrarFavTareaComentario(fid, i)} style={delBtn}>✕</button>
              </div>
            </div>
          ))}
        </div>
      ) : <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: '.4rem' }}>Sin comentarios.</div>}
      <div style={{ display: 'flex', gap: 6, marginBottom: '.6rem' }}>
        <textarea value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Comentario sobre esta tarea..." style={{ ...taStyle, minHeight: 40 }} />
      </div>
      <div className="fav-card-actions">
        <button className="btn btn-dark" onClick={() => { if (guardarFavTareaComentario(fid, txt)) setTxt(''); }} style={{ fontSize: 11 }}>💾 Guardar</button>
        {proc ? <>
          <button className="btn-sm" onClick={() => openModal('agendar', { procId: proc.id })} style={{ fontSize: 11 }}>+ Agendar</button>
          <button className="btn-sm" onClick={() => openModal('obsProc', { procId: proc.id })} style={{ fontSize: 11 }}>📋 CID</button>
        </> : null}
      </div>
    </div>
  );
}

// ── Exportar ──
const fmtSentencias = (sents: Sentencia[]) => sents.length
  ? sents.map((s) => s.label + ': ' + (s.resultado || s.sentencia || '—') + (s.fecha ? ' (' + fmtFechaEs(s.fecha) + ')' : '') + (s.monto && String(s.monto) !== '0' ? ' — S/ ' + fmtMonto(s.monto) : '')).join('  |  ')
  : '—';
const fmtComentarios = (hist: { fecha?: string; texto: string }[]) => hist.length ? hist.map((h) => '[' + (h.fecha || '—') + '] ' + h.texto).join('  |  ') : '—';

async function exportarFavoritosExcel() {
  const favs = getFavs(); const favTar = getFavTareas();
  if (!Object.keys(favs).length && !Object.keys(favTar).length) { showToast('No hay favoritos para exportar'); return; }
  const XLSX = await import('xlsx');
  const DATA = usePortal.getState().DATA;
  const autoCols = (rows: Record<string, unknown>[]) => {
    if (!rows.length) return [];
    return Object.keys(rows[0]).map((h) => {
      const maxLen = Math.max(h.length, ...rows.map((r) => String(r[h] == null ? '' : r[h]).length));
      return { wch: Math.min(Math.max(maxLen + 2, 10), 60) };
    });
  };
  const wb = XLSX.utils.book_new();
  const rowsProc = Object.values(favs).map((f) => {
    const proc = DATA.find((r) => r.id === f.id);
    return {
      'Usuario': getFavUsuarios(f).join(', ') || '—', 'ID Proceso': f.id,
      'Cliente': proc ? proc.cliente : '—', 'Expediente': proc ? proc.expediente : '—',
      'Supervisor': proc ? proc.supervisor : '—', 'Responsable': proc ? proc.responsable : '—',
      'Instancia': proc ? proc.instancia : '—', 'Situación': proc ? proc.situacion : '—',
      'Pacto': proc ? (proc.pacto || '—') : '—', 'Relevancia': proc ? (proc.relevancia || '—') : '—',
      'Distrito': proc ? (proc.distrito || '—') : '—', 'Próx. Diligencia': proc ? (proc.proxDiligencia || '—') : '—',
      'Fecha Diligencia': proc ? (proc.proxDiliFecha || '—') : '—', 'Bitácora': proc ? (proc.bitacora || '—') : '—',
      'Órgano': proc ? (proc.organo || '—') : '—', 'Cuantía': proc ? (proc.cuantia ? 'S/ ' + fmtMonto(proc.cuantia) : '—') : '—',
      'Reposición': proc ? (proc.reposicion || '—') : '—',
      'Sentencias': fmtSentencias(getSentencias(Number(f.id))), 'Comentarios': fmtComentarios(getFavHist(f.id)),
    };
  });
  if (rowsProc.length) {
    const ws = XLSX.utils.json_to_sheet(rowsProc);
    ws['!cols'] = autoCols(rowsProc);
    ws['!autofilter'] = { ref: ws['!ref'] as string };
    XLSX.utils.book_append_sheet(wb, ws, 'Procesos favoritos');
  }
  const todas = getAllTareasGestion();
  const rowsTar = Object.values(favTar).map((f) => {
    const tarea = todas.find((x) => x.id === f.id);
    const proc = tarea ? DATA.find((r) => r.id === tarea.nroId) : null;
    const adj = ((tarea && tarea.adjuntos) || []) as { nombre: string }[];
    return {
      'Usuario': getFavUsuarios(f).join(', ') || '—', 'Tipo de tarea': f.tipo || (tarea ? tarea.tipo : '—') || '—',
      'Cliente': proc ? proc.cliente : (f.cliente || '—'), 'Expediente': proc ? proc.expediente : (tarea ? tarea.expediente : '—'),
      'ID Proceso': proc ? proc.id : '—', 'Supervisor': proc ? (proc.supervisor || '—') : '—',
      'Instancia': proc ? (proc.instancia || '—') : '—', 'Situación': proc ? (proc.situacion || '—') : '—',
      'Asignado a': tarea ? (tarea.asignado || '—') : '—', 'Fecha tarea': tarea ? (tarea.fecha || '—') : '—',
      'Estado': tarea ? (tarea.estado || '—') : '—', 'Nota de la tarea': tarea ? (tarea.obs || '—') : '—',
      'Adjuntos': adj.length ? adj.map((a) => a.nombre).join(', ') : '—', 'Comentarios': fmtComentarios(getFavHistTarea(f.id)),
    };
  });
  if (rowsTar.length) {
    const ws = XLSX.utils.json_to_sheet(rowsTar);
    ws['!cols'] = autoCols(rowsTar);
    ws['!autofilter'] = { ref: ws['!ref'] as string };
    XLSX.utils.book_append_sheet(wb, ws, 'Tareas favoritas');
  }
  XLSX.writeFile(wb, 'favoritos_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  showToast('✓ Favoritos exportados a Excel');
}

// El original arma una página HTML imprimible (window.print) — no usa jsPDF; se mantiene igual.
function exportarFavoritosPDF() {
  const favs = getFavs(); const favTar = getFavTareas();
  const DATA = usePortal.getState().DATA;
  const fecha = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  let html = '<html><head><meta charset="UTF-8"><style>'
    + 'body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:20px}'
    + 'h1{font-size:18px;color:#1a1a2e;border-bottom:2px solid #1a1a2e;padding-bottom:6px}'
    + 'h2{font-size:14px;color:#1a1a2e;margin-top:20px}'
    + '.card{border:1px solid #e5e7eb;border-left:4px solid #f59e0b;border-radius:6px;padding:12px;margin-bottom:12px;page-break-inside:avoid}'
    + '.grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:11px;margin:8px 0;padding:8px;background:#f9fafb;border-radius:4px}'
    + '.field label{font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;display:block}'
    + '.field span{color:#111;font-weight:500}'
    + '.sent{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;margin:2px}'
    + '.ok{background:#f0fdf4;color:#15803d}.bad{background:#fef2f2;color:#dc2626}.neu{background:#f3f4f6;color:#6b7280}'
    + '.com{padding:6px 8px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:4px;font-size:11px;margin:3px 0}'
    + '@media print{body{padding:0}}'
    + '</style></head><body>'
    + '<h1>⭐ Favoritos — Portal Gestión V&T</h1>'
    + '<p style="color:#6b7280;font-size:11px">Generado el ' + fecha + '</p>';
  const comHtml = (hist: { fecha?: string; texto: string }[]) => hist.length
    ? '<div><strong style="font-size:10px;color:#6b7280">COMENTARIOS:</strong>' + hist.map((h) => '<div class="com">' + escH(h.fecha) + ': ' + escH(h.texto) + '</div>').join('') + '</div>' : '';
  if (Object.keys(favs).length) {
    html += '<h2>Procesos favoritos</h2>';
    Object.values(favs).forEach((f) => {
      const proc = DATA.find((r) => r.id === f.id);
      const sents = getSentencias(Number(f.id));
      html += '<div class="card">'
        + '<div style="display:flex;justify-content:space-between;margin-bottom:6px">'
        + '<div><strong>' + (proc ? escH(proc.cliente) : '#' + f.id) + '</strong><br><span style="font-size:10px;color:#6b7280">' + (proc ? escH(proc.expediente) : '') + '</span></div>'
        + '<div style="font-size:10px;color:#6b7280">Usuario: <strong>' + escH(getFavUsuarios(f).join(', ') || '—') + '</strong> · #' + f.id + '</div>'
        + '</div>'
        + (proc ? '<div class="grid">'
          + '<div class="field"><label>Supervisor</label><span>' + escH(proc.supervisor || '—') + '</span></div>'
          + '<div class="field"><label>Responsable</label><span>' + escH(proc.responsable || '—') + '</span></div>'
          + '<div class="field"><label>Instancia</label><span>' + escH(proc.instancia || '—') + '</span></div>'
          + '<div class="field"><label>Situación</label><span>' + escH(proc.situacion || '—') + '</span></div>'
          + '<div class="field"><label>Próx. audiencia</label><span>' + escH(proc.proxDiligencia ? proc.proxDiligencia + ' · ' + proc.proxDiliFecha : '—') + '</span></div>'
          + '<div class="field"><label>Bitácora</label><span>' + escH((proc.bitacora || '—').slice(0, 40)) + '</span></div>'
          + '<div class="field"><label>Cuantía</label><span>' + escH(proc.cuantia ? 'S/ ' + fmtMonto(proc.cuantia) : '—') + '</span></div>'
          + '<div class="field"><label>Reposición</label><span>' + escH(proc.reposicion || '—') + '</span></div>'
          + '</div>' : '')
        + (sents.length ? '<div style="margin:6px 0"><strong style="font-size:10px;color:#6b7280">SENTENCIAS:</strong> '
          + sents.map((s) => '<span class="sent ' + (s.resultado === 'Favorable' ? 'ok' : s.resultado.includes('Desfavorable') ? 'bad' : 'neu') + '">' + escH(s.label) + ': ' + escH(s.sentencia || s.resultado || '—') + ' (' + escH(s.resultado) + ')' + (s.fecha ? ' · ' + escH(fmtFechaEs(s.fecha)) : '') + (s.monto && String(s.monto) !== '0' ? ' · S/ ' + escH(fmtMonto(s.monto)) : '') + '</span>').join('') + '</div>' : '')
        + comHtml(getFavHist(f.id))
        + '</div>';
    });
  }
  if (Object.keys(favTar).length) {
    html += '<h2>Tareas favoritas</h2>';
    const todas = getAllTareasGestion();
    Object.values(favTar).forEach((f) => {
      const t = todas.find((x) => x.id === f.id);
      html += '<div class="card" style="border-left-color:#16a34a">'
        + '<div><strong>' + escH(f.cliente || 'Tarea') + '</strong> · <span style="color:#16a34a">' + escH(f.tipo || '—') + '</span></div>'
        + (t ? '<div class="grid">'
          + '<div class="field"><label>Asignado</label><span>' + escH(t.asignado || '—') + '</span></div>'
          + '<div class="field"><label>Estado</label><span>' + escH(t.estado || '—') + '</span></div>'
          + '<div class="field"><label>Fecha</label><span>' + escH(t.fecha || '—') + '</span></div>'
          + '<div class="field"><label>Encargo</label><span>' + escH(t.fechaEncargo || '—') + '</span></div>'
          + '</div>' : '')
        + comHtml(getFavHistTarea(f.id))
        + '</div>';
    });
  }
  html += '</body></html>';
  const win = window.open('', '_blank');
  if (!win) { showToast('El navegador bloqueó la ventana emergente'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

export default function FavoritosPanel() {
  const rev = usePortal((s) => s.kvRev);
  const DATA = usePortal((s) => s.DATA);
  const user = usePortal((s) => s.user);
  const [userFil, setUserFil] = useState('');
  const defAplicado = useRef(false);
  // Por defecto cada persona ve SUS favoritos (una sola vez).
  useEffect(() => {
    if (!defAplicado.current && user?.name) {
      defAplicado.current = true;
      if (FILTRO_USERS.includes(user.name)) setUserFil(user.name);
    }
  }, [user]);
  useEffect(() => { updateFavBadge(); }, [rev]);

  const { procEnt, tarEnt, tareas } = useMemo(() => {
    void rev;
    const favs = getFavs(); const favTar = getFavTareas();
    return {
      procEnt: Object.values(favs).filter((f) => !userFil || getFavUsuarios(f).includes(userFil)),
      tarEnt: Object.values(favTar).filter((f) => !userFil || getFavUsuarios(f).includes(userFil)),
      tareas: getAllTareasGestion(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev, userFil, DATA]);
  const total = procEnt.length + tarEnt.length;

  const byUser = (ents: FavEntry[], vacio: boolean) => {
    const m: Record<string, FavEntry[]> = {};
    ents.forEach((f) => {
      const us = getFavUsuarios(f);
      (vacio && !us.length ? ['Sin asignar'] : us).forEach((u) => { if (userFil && u !== userFil) return; (m[u] = m[u] || []).push(f); });
    });
    return Object.entries(m);
  };

  return (
    <div id="tg-view-favoritos">
      <div style={{ display: 'flex', gap: 10, marginBottom: '.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="sel-inp" id="fav-user" value={userFil} onChange={(e) => setUserFil(e.target.value)} title="Por defecto ves tus favoritos; elige otro usuario o 'Todos' para ver los de los demás">
          <option value="">Todos los usuarios</option>
          {FILTRO_USERS.map((u) => <option key={u}>{u}</option>)}
        </select>
        <span className="count-lbl" id="fav-count">{total} favorito{total !== 1 ? 's' : ''}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className="btn-sm" onClick={() => { void exportarFavoritosExcel(); }} style={{ fontSize: 11.5 }}>↓ Excel</button>
          <button className="btn-sm" onClick={exportarFavoritosPDF} style={{ fontSize: 11.5 }}>↓ PDF</button>
        </div>
      </div>
      <div id="fav-container">
        {!total ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text4)', fontSize: 13 }}>
            <div style={{ fontSize: 40, marginBottom: '.75rem' }}>⭐</div>Sin favoritos aún.<br />Márcalos desde Reporte Total, Próximas Audiencias o Tareas de Gestión.
          </div>
        ) : (
          <>
            {procEnt.length ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.6rem' }}>⭐ Procesos favoritos</div>
                {byUser(procEnt, false).map(([usr, items]) => (
                  <div key={usr} style={{ marginBottom: '1.5rem' }}>
                    {grpHead(USER_COLORS[usr] || '#6b7280', usr, items.length, 'proceso')}
                    {items.map((f) => <ProcCard key={'p' + f.id} f={f} usr={usr} proc={DATA.find((r) => r.id === f.id)} />)}
                  </div>
                ))}
              </>
            ) : null}
            {tarEnt.length ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '.75rem 0 .6rem' }}>⚡ Tareas favoritas</div>
                {byUser(tarEnt, true).map(([usr, items]) => (
                  <div key={usr} style={{ marginBottom: '1.5rem' }}>
                    {grpHead(USER_COLORS[usr] || '#6b7280', usr, items.length, 'tarea')}
                    {items.map((f) => {
                      const tarea = tareas.find((t) => t.id === f.id);
                      const proc = tarea ? DATA.find((r) => r.id === tarea.nroId) : null;
                      return <TareaCard key={'t' + f.id} f={f} usr={usr} tarea={tarea} proc={proc} />;
                    })}
                  </div>
                ))}
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
