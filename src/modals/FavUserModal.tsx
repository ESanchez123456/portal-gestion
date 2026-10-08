'use client';
// Modal "¿A quién se asigna este favorito?" (HTML 1999-2027; JS selFavUser/confirmarFav 6972-7050).
import { useState } from 'react';
import { usePortal, showToast } from '@/store/portal';
import { registrarAuditoriaFav } from '@/lib/audit';
import { getBackend } from '@/lib/backend';
import {
  MAX_FAV_USUARIOS, getFavs, saveFavs, getFavTareas, saveFavTareas, updateFavBadge,
} from '@/lib/favoritos';

interface Payload { mode: 'proc' | 'tarea'; id: number | string; cliente?: string; tipo?: string }

const USERS: { n: string; c: string; full?: boolean }[] = [
  { n: 'Roberto Matallana', c: '#dc2626' },
  { n: 'Carlos Morales', c: '#2563eb' },
  { n: 'Arturo Trelles', c: '#4f46e5' },
  { n: 'Silvia Maldonado', c: '#16a34a' },
  { n: 'Juan Jose Edquen', c: '#7c3aed', full: true },
];

export default function FavUserModal({ payload, onClose }: { payload: unknown; onClose: () => void }) {
  const p = (payload && typeof payload === 'object' ? payload : {}) as Partial<Payload>;
  const mode = p.mode === 'tarea' ? 'tarea' : 'proc';
  const id = p.id as number | string | undefined;
  const yo = usePortal.getState().user?.name || '';
  const DATA = usePortal((s) => s.DATA);
  // Preselecciona al usuario actual si es uno de los 5 del equipo de Gestión.
  const [sel, setSel] = useState<string[]>(() => (USERS.some((u) => u.n === yo) ? [yo] : []));

  let sub = '';
  if (mode === 'tarea') sub = (p.tipo ? p.tipo + ' — ' : '') + (p.cliente || 'Tarea #' + id);
  else { const proc = DATA.find((r) => r.id === id); sub = proc ? '#' + id + ' — ' + (proc.cliente || '').slice(0, 50) : '#' + id; }

  const toggle = (u: string) => {
    if (sel.includes(u)) { setSel(sel.filter((x) => x !== u)); return; }
    if (sel.length >= MAX_FAV_USUARIOS) { showToast('⭐ Máximo ' + MAX_FAV_USUARIOS + ' personas por favorito'); return; }
    setSel([...sel, u]);
  };

  const confirmar = () => {
    if (!id || !sel.length) return;
    const usuariosTxt = sel.join(', ');
    const byName = usePortal.getState().user?.name || '';
    if (mode === 'tarea') {
      const favs = getFavTareas();
      const tid = String(id);
      favs[tid] = { id: tid, cliente: p.cliente || '', tipo: p.tipo || '', usuarios: [...sel], ts: Date.now(), creadoPor: byName };
      saveFavTareas(favs);
      onClose();
      updateFavBadge();
      const ctx = (p.tipo ? p.tipo + ' — ' : '') + (p.cliente || 'Tarea #' + tid) + ' (asignado a ' + usuariosTxt + ')';
      getBackend().logAudit({ key: 'favtarea_' + tid, accion: 'fav_add', label: '', ctx, byName });
      showToast('⭐ Tarea agregada a favoritos de ' + usuariosTxt);
      return;
    }
    const favs = getFavs();
    favs[String(id)] = { id, usuarios: [...sel], ts: Date.now(), obs: '', creadoPor: byName };
    saveFavs(favs);
    onClose();
    updateFavBadge();
    registrarAuditoriaFav('fav_add', id, '(asignado a ' + usuariosTxt + ')');
    showToast('⭐ Agregado a favoritos de ' + usuariosTxt);
  };

  return (
    <div className="overlay show" id="modalFavUser" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--white)', borderRadius: 12, padding: '1.5rem', width: 380, maxWidth: '95vw', boxShadow: '0 16px 48px rgba(0,0,0,.2)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: '.4rem' }}>¿A quién se asigna este favorito?</div>
        <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: '.5rem' }}>Puedes elegir a más de una persona.</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: '1rem' }} id="fav-modal-proc">{sub}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: '1.2rem' }} id="fav-modal-users">
          {USERS.map((u) => (
            <button key={u.n} className={'fav-user-btn' + (sel.includes(u.n) ? ' sel' : '')} data-user={u.n}
              onClick={() => toggle(u.n)} style={u.full ? { gridColumn: '1/-1' } : undefined}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: u.c, display: 'inline-block', marginRight: 6 }} />{u.n}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-dark" id="fav-modal-confirm" onClick={confirmar} disabled={!sel.length} style={{ opacity: sel.length ? 1 : 0.4 }}>Marcar favorito</button>
        </div>
      </div>
    </div>
  );
}
