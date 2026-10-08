'use client';
// Panel Paralegal (HTML 2145-2172; JS 7794-7988 + aprobarTarea/rechazarTarea 5974-6008). Solo admin (lo filtra PortalApp).
import { useState } from 'react';
import { FSLS, usePortal, showToast } from '@/store/portal';
import Pagination from '@/components/table/Pagination';
import { fechaHoraEs } from '@/lib/favoritos';

const PP_PAGE = 20;

interface PPEntry {
  id: string; tipo?: string; origen?: string; nroId?: number; nrotarea?: number;
  cliente?: string; expediente?: string; supervisor?: string; texto?: string; autor?: string;
  destinatario?: string; tareaId?: string; estado?: string; atendida?: boolean; ts?: string;
  extra?: { tipoAud?: string } & Record<string, unknown>;
}

const getAll = (): PPEntry[] => { try { return JSON.parse(FSLS.getItem('pp_all') || '[]'); } catch { return []; } };
const setAll = (a: PPEntry[]) => FSLS.setItem('pp_all', JSON.stringify(a));

function marcarPPAtendida(id: string, val: boolean) {
  const all = getAll();
  const idx = all.findIndex((e) => e.id === id);
  if (idx >= 0) { all[idx].atendida = val; setAll(all); }
  showToast(val ? '✓ Marcada como atendida' : '↩ Marcada como pendiente');
}
function eliminarPPEntry(id: string) {
  const all = getAll();
  const idx = all.findIndex((e) => e.id === id);
  if (idx >= 0) { all.splice(idx, 1); setAll(all); }
  showToast('Entrada eliminada');
}
function limpiarAtendidas() {
  setAll(getAll().filter((e) => !e.atendida));
  showToast('✓ Entradas atendidas eliminadas');
}
function setEstadoTarea(tareaId: string, estado: string, extra?: Record<string, unknown>) {
  let arr: Record<string, unknown>[] = [];
  try { arr = JSON.parse(FSLS.getItem('tareasGestion') || '[]'); } catch { /* */ }
  const idx = arr.findIndex((t) => t.id === tareaId);
  if (idx >= 0) { arr[idx].estado = estado; if (extra) Object.assign(arr[idx], extra); FSLS.setItem('tareasGestion', JSON.stringify(arr)); }
}
function aprobarTarea(ppId: string, tareaId: string) {
  setEstadoTarea(tareaId, 'Pendiente', { aprobadaEn: fechaHoraEs() });
  marcarPPAtendida(ppId, true);
  const all = getAll();
  const pidx = all.findIndex((e) => e.id === ppId);
  if (pidx >= 0) { all[pidx].estado = 'aprobada'; all[pidx].atendida = true; setAll(all); }
  showToast('✓ Tarea aprobada y enviada a Gestión');
}
function rechazarTarea(ppId: string, tareaId: string) {
  setEstadoTarea(tareaId, 'Rechazada');
  const all = getAll();
  const pidx = all.findIndex((e) => e.id === ppId);
  if (pidx >= 0) { all[pidx].estado = 'rechazada'; all[pidx].atendida = true; setAll(all); }
  showToast('✗ Tarea rechazada');
}

async function exportarParalegal() {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(getAll().map((e) => ({
    Tipo: e.tipo === 'obs' ? 'Observación' : e.tipo === 'dili' ? 'Nota diligencia' : 'Tarea gestión',
    Cliente: e.cliente, Expediente: e.expediente, Supervisor: e.supervisor,
    Texto: e.texto, Fecha: e.ts || '—', Atendida: e.atendida ? 'Sí' : 'No',
  })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Panel Paralegal');
  XLSX.writeFile(wb, 'panel_paralegal.xlsx');
  showToast('✓ Exportado');
}

const origenLabel: Record<string, string> = { reporte: '📊 Reporte Total', audiencias: '📅 Próximas Audiencias', gestion: '⚡ Tareas de Gestión', calendario: '🗓 Calendario' };
const origenColor: Record<string, string> = { reporte: 'var(--blue)', audiencias: 'var(--amber)', gestion: 'var(--green)', calendario: 'var(--purple)' };

const accionPP = (e: PPEntry): { label: string; cls: string } => {
  if (e.tipo === 'obs') return { label: '📝 Observación', cls: 'pp-tipo-obs' };
  if (e.tipo === 'dili') return { label: '📅 Nota de diligencia', cls: 'pp-tipo-dili' };
  if (e.tipo === 'aprobacion') return { label: '⏳ Solicitud de aprobación', cls: 'pp-tipo-aprobacion' };
  if (e.tipo === 'comentario') return { label: '💬 Comentario', cls: 'pp-tipo-gestion' };
  if (e.tipo === 'gestion') {
    const t = e.texto || '';
    if (t.startsWith('🆕')) return { label: '🆕 Tarea nueva', cls: 'pp-tipo-gestion' };
    if (t.startsWith('🗑')) return { label: '🗑 Tarea eliminada', cls: 'pp-tipo-gestion-del' };
    if (t.startsWith('↔')) return { label: '↔ Reasignación', cls: 'pp-tipo-gestion' };
    if (t.startsWith('↩')) return { label: '↩ Tarea devuelta', cls: 'pp-tipo-gestion-del' };
    return { label: '✎ Cambio en tarea', cls: 'pp-tipo-gestion' };
  }
  return { label: 'Tarea gestión', cls: 'pp-tipo-gestion' };
};
const queHacer = (e: PPEntry): string | null => {
  if (e.tipo === 'aprobacion') {
    if (e.estado === 'aprobada' || e.estado === 'rechazada') return null;
    return '👉 Aprobar o rechazar esta solicitud de tarea.';
  }
  if (e.tipo === 'obs') return '👉 Revisar la observación y darle seguimiento con el equipo.';
  if (e.tipo === 'dili') return '👉 Revisar la nota de la diligencia y coordinar lo que corresponda.';
  if (e.tipo === 'comentario') return e.destinatario ? '👉 Coordinar con ' + e.destinatario + ' sobre este comentario.' : '👉 Dar seguimiento a este comentario.';
  if (e.tipo === 'gestion') {
    const t = e.texto || '';
    if (t.startsWith('🆕')) return '👉 Verificar que la tarea agendada esté correcta.';
    if (t.startsWith('🗑')) return '👉 Confirmar que la eliminación de esta tarea es correcta.';
    if (t.startsWith('↔')) return '👉 Confirmar la reasignación con el nuevo responsable.';
    if (t.startsWith('↩')) return '👉 Revisar el motivo de la devolución y volver a agendar si corresponde.';
    return '👉 Revisar el cambio realizado en esta tarea.';
  }
  return null;
};
// alta = requiere decisión · media = algo se quitó/devolvió · baja = informativo
const urgencia = (e: PPEntry): 'alta' | 'media' | 'baja' => {
  if (e.tipo === 'aprobacion' && e.estado !== 'aprobada' && e.estado !== 'rechazada') return 'alta';
  if (e.tipo === 'gestion') { const t = e.texto || ''; if (t.startsWith('🗑') || t.startsWith('↩')) return 'media'; }
  return 'baja';
};

function Card({ e }: { e: PPEntry }) {
  const procUrl = 'https://vinatea.mybig.com.ar/trabajos/overview/' + (e.nroId || 0) + '/';
  const tareaUrl = e.nrotarea ? 'https://vinatea.mybig.com.ar/tareas/' + e.nrotarea + '/edit/' : procUrl;
  const acc = accionPP(e);
  const accionTxt = e.atendida ? null : queHacer(e);
  const urg = e.atendida ? '' : ' pp-urg-' + urgencia(e);
  const parts = (e.texto || '—').split(' · ').map((p) => p.trim()).filter(Boolean);
  const tieneCliente = e.cliente && e.cliente !== '—';
  const pendAprob = e.tipo === 'aprobacion' && e.estado !== 'aprobada' && e.estado !== 'rechazada';
  return (
    <div className={'pp-card' + urg + (e.atendida ? ' atendida' : '')}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
        <span className={'pp-card-tipo ' + acc.cls} title="Tipo de acción">{acc.label}</span>
        {e.origen ? <span title="Sección del portal donde ocurrió" style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'var(--gray-l)', border: '1px solid var(--gray-b)', color: origenColor[e.origen] }}>{origenLabel[e.origen]}</span> : null}
        <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text4)', whiteSpace: 'nowrap' }}>🕐 {e.ts || '—'}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid var(--gray-b)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text)' }}>{tieneCliente ? (e.cliente as string).slice(0, 45) : <span style={{ color: 'var(--text4)', fontWeight: 500 }}>Sin proceso vinculado</span>}</span>
          {e.expediente && e.expediente !== '—' ? <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>{e.expediente}</span> : null}
          {e.supervisor && e.supervisor !== '—' ? <span style={{ fontSize: 10, color: 'var(--text4)' }}>· Sup: {e.supervisor}</span> : null}
        </div>
        <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexShrink: 0 }}>
          {e.nroId ? <a className="id-link" href={procUrl} target="_blank" rel="noreferrer" title="Ver proceso en MyBiG" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>🔗 Proceso</a> : null}
          {e.nrotarea ? <a className="id-link" href={tareaUrl} target="_blank" rel="noreferrer" title="Ver tarea en MyBiG" style={{ fontSize: 11, whiteSpace: 'nowrap', color: 'var(--text3)' }}>📋 #{e.nrotarea}</a> : null}
        </div>
      </div>
      {parts.length > 1
        ? <ul style={{ margin: '2px 0 0 18px', padding: 0, fontSize: 12, color: 'var(--text)' }}>{parts.map((p, i) => <li key={i} style={{ marginBottom: 2 }}>{p}</li>)}</ul>
        : <div className={'pp-card-body' + (e.tipo === 'dili' ? ' obs-cid' : '')} style={{ margin: 0 }}>{e.texto || '—'}</div>}
      {e.extra && e.extra.tipoAud ? <div style={{ fontSize: 10.5, color: 'var(--text4)', marginTop: 3 }}>Tipo: {e.extra.tipoAud}</div> : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, fontSize: 10.5, color: 'var(--text3)', margin: '6px 0 0' }}>
        <span>👤 <strong style={{ color: 'var(--text)' }}>{e.autor && e.autor !== '—' ? e.autor : 'Sistema'}</strong></span>
        {e.destinatario ? <span>📨 <strong style={{ color: 'var(--amber)' }}>{e.destinatario}</strong></span> : null}
        {accionTxt ? <span style={{ marginLeft: 'auto', fontWeight: 600, color: urgencia(e) === 'alta' ? '#c2410c' : urgencia(e) === 'media' ? 'var(--red)' : '#1d4ed8' }}>{accionTxt}</span> : null}
      </div>
      <div className="pp-card-actions" style={{ marginTop: 8 }}>
        {pendAprob ? (
          <>
            <button className="pp-btn pp-btn-apro" onClick={() => aprobarTarea(e.id, e.tareaId || '')}>✓ Aprobar</button>
            <button className="pp-btn pp-btn-rech" onClick={() => rechazarTarea(e.id, e.tareaId || '')}>✗ Rechazar</button>
          </>
        ) : e.estado === 'aprobada' ? <span className="pp-apro-badge pp-apro-ok">✓ Aprobada</span>
          : e.estado === 'rechazada' ? <span className="pp-apro-badge pp-apro-rech">✗ Rechazada</span> : null}
        {!pendAprob ? (e.atendida
          ? <button className="pp-btn pp-btn-resp" onClick={() => marcarPPAtendida(e.id, false)}>↩ Pendiente</button>
          : <button className="pp-btn pp-btn-ok" onClick={() => marcarPPAtendida(e.id, true)}>✓ Atendida</button>) : null}
        <button className="pp-btn pp-btn-del" title="Descarta esta notificación del panel — NO borra la tarea" onClick={() => eliminarPPEntry(e.id)}>✕ Descartar</button>
      </div>
    </div>
  );
}

export default function ParalegalView() {
  const rev = usePortal((s) => s.kvRev);
  void rev;
  const [q, setQ] = useState('');
  const [verAtendidas, setVerAtendidas] = useState(false);
  const [page, setPage] = useState(1);

  const all = getAll();
  const pendientes = all.filter((e) => !e.atendida).length;
  const ql = q.toLowerCase();
  const entries = all.filter((e) => {
    if (!verAtendidas && e.atendida) return false;
    if (ql && !((e.cliente || '') + (e.expediente || '') + (e.texto || '')).toLowerCase().includes(ql)) return false;
    return true;
  });
  const total = entries.length;
  const tp = Math.ceil(total / PP_PAGE) || 1;
  const cur = page > tp ? 1 : page;
  const slice = entries.slice((cur - 1) * PP_PAGE, cur * PP_PAGE);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '.9rem' }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>📋 Panel Paralegal</div>
        <span id="pp-cnt-todas" className="fdd-cnt show" style={{ background: 'var(--amber)' }} title="Entradas pendientes de revisar">{pendientes}</span>
        <span style={{ fontSize: 11.5, color: 'var(--text4)' }}>pendientes — todo lo que Gestión hace, en un solo lugar</span>
      </div>
      <div className="search-row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: '.75rem' }}>
        <div className="srch-wrap" style={{ maxWidth: 320 }}>
          <span>🔍</span>
          <input className="srch-inp" type="text" id="pp-search" placeholder="Buscar cliente, expediente, texto..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <button type="button" className={'pp-toggle-atend' + (verAtendidas ? ' on' : '')} id="pp-toggle-atendidas" onClick={() => { setVerAtendidas(!verAtendidas); setPage(1); }}>
          <span>{verAtendidas ? '🙈' : '👁'}</span> <span>{verAtendidas ? 'Ocultar atendidas' : 'Ver atendidas'}</span>
        </button>
        <span className="count-lbl" id="pp-count">{total} entrada{total !== 1 ? 's' : ''}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn" onClick={limpiarAtendidas} style={{ fontSize: 11.5, color: 'var(--red)', borderColor: 'var(--red-b)', background: 'var(--red-l)' }}>🗑 Limpiar atendidas</button>
          <button className="btn btn-dark" onClick={() => { void exportarParalegal(); }} style={{ fontSize: 11.5 }}>↓ Exportar</button>
        </div>
      </div>
      <div id="pp-entries" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!slice.length ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text4)' }}>
            <div style={{ fontSize: 32, marginBottom: '.5rem' }}>📋</div>
            <div>No hay entradas registradas.</div>
          </div>
        ) : slice.map((e) => <Card key={e.id} e={e} />)}
      </div>
      <div style={{ marginTop: '.75rem' }}><Pagination cur={cur} total={tp} perPage={PP_PAGE} onPage={setPage} /></div>
    </>
  );
}
