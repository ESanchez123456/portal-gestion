'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FSLS, usePortal, showToast } from '@/store/portal';
import { getBackend } from '@/lib/backend';
import { esAdmin } from '@/lib/audit';
import type { AuditEntry } from '@/types';

interface EventoAudit { ts: number; quien: string; verbo: string; contexto: string; }

const AUDIT_AV_COLORS = ['var(--blue)', 'var(--green)', 'var(--amber)', 'var(--purple)', 'var(--red)', '#64748b'];
function avatarIniciales(nombre: string): string {
  return (nombre || '?').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?';
}
function avatarColor(nombre: string): string {
  let h = 0; for (let i = 0; i < (nombre || '').length; i++) h = (h * 31 + nombre.charCodeAt(i)) >>> 0;
  return AUDIT_AV_COLORS[h % AUDIT_AV_COLORS.length];
}

const VERBOS_PP: Record<string, string> = {
  obs: 'agregó una observación en el proceso',
  dili: 'agregó una nota de diligencia en el proceso',
  gestion: 'gestionó una tarea en el proceso',
  comentario: 'comentó en una tarea del proceso',
  aprobacion: 'solicitó aprobación de tarea en el proceso',
};

/** Une el log genérico (KV + vistas) con el log de acciones de negocio del Panel Paralegal (pp_all). */
function getAdminAuditUnificado(auditRows: AuditEntry[]): EventoAudit[] {
  const rows: EventoAudit[] = [];
  auditRows.forEach((r) => {
    let verbo: string;
    if (r.accion === 'vio') verbo = r.label || 'visualizó algo';
    else if (r.accion === 'fav_add') verbo = '⭐ marcó como favorito el proceso';
    else if (r.accion === 'fav_remove') verbo = '☆ quitó de favoritos el proceso';
    else if (r.accion === 'delete') verbo = 'eliminó ' + (r.label || 'un dato');
    else verbo = 'guardó ' + (r.label || 'un dato');
    rows.push({ ts: r.ts || 0, quien: r.byName || r.byEmail || '—', verbo, contexto: r.ctx || '' });
  });
  let pp: Record<string, string>[] = [];
  try { pp = JSON.parse(FSLS.getItem('pp_all') || '[]'); } catch { /* vacío */ }
  pp.forEach((e) => {
    let ts = 0;
    const m = /^pp_(\d+)_/.exec(e.id || '');
    if (m) ts = Number(m[1]);
    const ctx = [e.cliente && e.cliente !== '—' ? e.cliente : '', e.expediente && e.expediente !== '—' ? e.expediente : '', e.nroId ? '#' + e.nroId : ''].filter(Boolean).join(' · ');
    rows.push({
      ts,
      quien: e.autor || '—',
      verbo: VERBOS_PP[e.tipo] || 'realizó una acción en el proceso',
      contexto: (ctx ? ctx + ' — ' : '') + (e.texto || ''),
    });
  });
  rows.sort((a, b) => b.ts - a.ts);
  return rows;
}

const reChunk = /^xdata_chunk_\d+$/;

export function eliminarChunksExcel(): void {
  const kv = usePortal.getState().kv;
  const chunkKeys = Object.keys(kv).filter((k) => reChunk.test(k));
  if (!chunkKeys.length) { showToast('No hay datos de Excel guardados en línea'); return; }
  if (!confirm('¿Eliminar los datos del Excel guardados en línea (' + chunkKeys.length + ' parte(s))?\n\nEsto borra el Reporte Total y Tareas para TODO el equipo hasta que alguien vuelva a cargar el Excel. No se puede deshacer.')) return;
  chunkKeys.forEach((k) => FSLS.removeItem(k));
  showToast('✓ Datos del Excel eliminados (' + chunkKeys.length + ' parte(s))');
}

export function vaciarGrupoKV(matcher: (k: string) => boolean, label: string): void {
  const keys = Object.keys(usePortal.getState().kv).filter(matcher);
  if (!keys.length) { showToast('No hay datos en «' + label + '»'); return; }
  if (!confirm('¿Vaciar «' + label + '»?\n\n' + keys.length + ' registro(s) — afecta a TODO el equipo y no se puede deshacer.')) return;
  keys.forEach((k) => FSLS.removeItem(k));
  showToast('✓ «' + label + '» vaciado (' + keys.length + ' registro(s))');
}

export function eliminarKVIndividual(key: string): void {
  if (!confirm('¿Eliminar la clave:\n\n' + key + '\n\nEsto puede hacer que algo deje de verse para todo el equipo.')) return;
  FSLS.removeItem(key);
  showToast('✓ Eliminado: ' + key);
}

export default function AdminView() {
  const activeTab = usePortal((s) => s.activeTab);
  const kv = usePortal((s) => s.kv);
  const [auditRows, setAuditRows] = useState<AuditEntry[]>([]);
  const escuchando = useRef(false);

  const [qAudit, setQAudit] = useState('');
  const [usuario, setUsuario] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [qKeys, setQKeys] = useState('');

  const admin = esAdmin();

  // Escucha en vivo del log de auditoría (se activa la primera vez que se abre la pestaña)
  useEffect(() => {
    if (!admin || activeTab !== 'admin' || escuchando.current) return;
    escuchando.current = true;
    getBackend().listenAudit((rows) => setAuditRows(rows));
  }, [admin, activeTab]);

  // pp_all (log de Paralegal) se lee del KV; kv en deps para refrescar al cambiar
  const todos = useMemo(() => getAdminAuditUnificado(auditRows), [auditRows, kv]);
  const nombres = useMemo(() => [...new Set(todos.map((r) => r.quien).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [todos]);

  const filtradas = useMemo(() => {
    let rows = todos;
    const q = qAudit.toLowerCase().trim();
    if (usuario) rows = rows.filter((r) => r.quien === usuario);
    if (desde) { const dIni = new Date(desde + 'T00:00:00').getTime(); rows = rows.filter((r) => r.ts >= dIni); }
    if (hasta) { const dFin = new Date(hasta + 'T23:59:59').getTime(); rows = rows.filter((r) => r.ts <= dFin); }
    if (q) rows = rows.filter((r) => (r.contexto || '').toLowerCase().includes(q) || (r.quien || '').toLowerCase().includes(q) || (r.verbo || '').toLowerCase().includes(q));
    return rows;
  }, [todos, qAudit, usuario, desde, hasta]);

  const { keyRows, chunkCount } = useMemo(() => {
    const allKeys = Object.keys(kv);
    // Las xdata_chunk_N se agrupan en una sola fila resumen (borrar una sola corrompe los datos)
    const chunkKeys = allKeys.filter((k) => reChunk.test(k));
    const otherKeys = allKeys.filter((k) => !reChunk.test(k));
    let rows = otherKeys.map((k) => ({ key: k, size: (kv[k] || '').length, preview: kv[k] || '', grupo: false }));
    if (chunkKeys.length) {
      rows.push({
        key: 'xdata_chunk_* — Excel procesado',
        size: chunkKeys.reduce((s, k) => s + (kv[k] || '').length, 0),
        preview: chunkKeys.length + ' parte(s) · Reporte Total + Tareas del último Excel cargado',
        grupo: true,
      });
    }
    const q = qKeys.toLowerCase().trim();
    rows = rows.filter((r) => !q || r.key.toLowerCase().includes(q)).sort((a, b) => a.key.localeCompare(b.key));
    return { keyRows: rows, chunkCount: chunkKeys.length };
  }, [kv, qKeys]);

  if (!admin) return null;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '.9rem' }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>⚙ Administración de la plataforma</div>
        <span style={{ fontSize: 11.5, color: 'var(--text4)' }}>— control de cambios y gestión de datos de los 8 usuarios</span>
      </div>

      {/* CONTROL DE CAMBIOS */}
      <div style={{ background: 'var(--white)', border: '1px solid var(--gray-b)', borderRadius: 'var(--r2)', padding: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '.75rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>🕒 Control de cambios</div>
          <span style={{ fontSize: 11, color: 'var(--text4)' }}>quién hizo qué y cuándo, en vivo</span>
          <span style={{ fontSize: 11, color: 'var(--text4)', marginLeft: 'auto' }}>
            {filtradas.length.toLocaleString()} evento{filtradas.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '.75rem', flexWrap: 'wrap' }}>
          <select className="sel-inp" style={{ maxWidth: 220 }} value={usuario} onChange={(e) => setUsuario(e.target.value)}>
            <option value="">Todos los usuarios</option>
            {nombres.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <div className="tg-date-filter">
            <span>Fecha:</span>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} title="Desde" />
            <span>—</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} title="Hasta" />
            <button className="btn-sm" onClick={() => { setDesde(''); setHasta(''); }} title="Limpiar fechas">✕</button>
          </div>
          <div className="srch-wrap" style={{ maxWidth: 260, marginLeft: 'auto' }}>
            <span>🔍</span>
            <input className="srch-inp" type="text" placeholder="Buscar por usuario, proceso, acción..." value={qAudit} onChange={(e) => setQAudit(e.target.value)} />
          </div>
        </div>
        <div style={{ maxHeight: 460, overflowY: 'auto', border: '1px solid var(--gray-b)', borderRadius: 'var(--r)' }}>
          {!filtradas.length ? (
            <div style={{ padding: '1rem', color: 'var(--text4)', fontSize: 12 }}>Sin cambios registrados para este filtro.</div>
          ) : filtradas.slice(0, 400).map((r, i) => {
            const d = r.ts ? new Date(r.ts) : null;
            const fecha = d ? d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
            const hora = d ? d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '';
            return (
              <div className="audit-row" key={i}>
                <div className="audit-av" style={{ background: avatarColor(r.quien) }}>{avatarIniciales(r.quien)}</div>
                <div className="audit-body">
                  <div className="audit-main"><strong>{r.quien || '—'}</strong> {r.verbo}</div>
                  {r.contexto && <div className="audit-ctx">{r.contexto}</div>}
                </div>
                <div className="audit-time"><div>{fecha}</div><div>{hora} hs.</div></div>
              </div>
            );
          })}
        </div>
      </div>

      {/* EXPLORADOR DE DATOS (eliminación puntual) */}
      <div style={{ background: 'var(--white)', border: '1px solid var(--gray-b)', borderRadius: 'var(--r2)', padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '.75rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>🔎 Explorador de datos</div>
          <span style={{ fontSize: 11, color: 'var(--text4)' }}>
            {keyRows.length.toLocaleString()} clave{keyRows.length !== 1 ? 's' : ''} en Firestore{chunkCount ? ' (' + chunkCount + ' partes de Excel agrupadas en 1)' : ''}
          </span>
          <div className="srch-wrap" style={{ maxWidth: 280, marginLeft: 'auto' }}>
            <span>🔍</span>
            <input className="srch-inp" type="text" placeholder="Buscar clave..." value={qKeys} onChange={(e) => setQKeys(e.target.value)} />
          </div>
        </div>
        <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--gray-b)', borderRadius: 'var(--r)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--gray-l)' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Clave</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Tamaño</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Vista previa</th>
                <th style={{ padding: '6px 8px' }}></th>
              </tr>
            </thead>
            <tbody>
              {!keyRows.length ? (
                <tr><td colSpan={4} style={{ padding: '1rem', color: 'var(--text4)' }}>Sin resultados</td></tr>
              ) : keyRows.map((r) => (
                <tr key={r.key} style={{ borderTop: '1px solid var(--gray-b)', background: r.grupo ? 'var(--gray-l)' : undefined }}>
                  <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 10.5 }}>{r.grupo ? '📊 ' : ''}{r.key}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{r.size.toLocaleString()} car.</td>
                  <td style={{ padding: '6px 8px', color: 'var(--text3)', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.preview.length > 90 ? r.preview.slice(0, 90) + '…' : r.preview}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                    <button
                      className="btn" style={{ fontSize: 10, padding: '3px 8px', color: 'var(--red)', borderColor: 'var(--red-b)' }}
                      onClick={() => (r.grupo ? eliminarChunksExcel() : eliminarKVIndividual(r.key))}
                      title={r.grupo ? 'Elimina TODAS las partes del Excel guardado' : 'Eliminar esta clave'}
                    >🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
