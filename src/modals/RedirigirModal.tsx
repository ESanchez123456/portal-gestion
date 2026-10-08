'use client';
// Redirigir tarea (HTML 1602-1611; JS 4387-4412). Payload: { tareaId, tipo, actual }
import { TEAM_GESTION } from '@/lib/constants';
import { loadTareasGestion, saveTareasGestion } from '@/lib/gestion';

export default function RedirigirModal({ payload, onClose }: { payload: unknown; onClose: () => void }) {
  const p = (payload && typeof payload === 'object' ? payload : {}) as { tareaId?: string; tipo?: string; actual?: string };
  const confirmar = (nuevo: string) => {
    if (!p.tareaId) return;
    const arr = loadTareasGestion();
    const idx = arr.findIndex((t) => t.id === p.tareaId);
    if (idx >= 0) { arr[idx].asignado = nuevo; saveTareasGestion(arr); }
    onClose();
  };
  return (
    <div className="overlay show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="redir-modal">
        <div className="redir-title">Redirigir tarea</div>
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: '1rem' }}>{p.tipo}</div>
        <div>
          {TEAM_GESTION.map((m) => (
            <div key={m.nombre} className={'redir-member' + (m.nombre === p.actual ? ' selected' : '')} onClick={() => confirmar(m.nombre)}>
              <div className="tg-avatar" style={{ background: m.color, marginLeft: 0, width: 32, height: 32, fontSize: 12 }}>{m.iniciales}</div>
              <div>
                <div className="redir-member-info">{m.nombre} {m.nombre === p.actual && <span style={{ color: 'var(--text4)', fontWeight: 400 }}>(actual)</span>}</div>
                <div className="redir-member-role">{m.rol}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="modal-actions" style={{ marginTop: '1rem', paddingTop: '.75rem' }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
