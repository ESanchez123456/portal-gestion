'use client';
// Devolver tarea (HTML 1963-1981; JS 6178-6220). Payload: { tareaId } | string
import { useMemo, useState } from 'react';
import { showToast, usePortal } from '@/store/portal';
import { tareaIdDePayload, getAllTareasGestion, loadTareasGestion, saveTareasGestion, registrarEnPanel, fechaHoraPE, nombreActual } from '@/lib/gestion';

export default function DevolverTareaModal({ payload, onClose }: { payload: unknown; onClose: () => void }) {
  const id = tareaIdDePayload(payload);
  const t = useMemo(() => getAllTareasGestion().find((x) => x.id === id), [id]);
  const [com, setCom] = useState('');

  const confirmar = () => {
    const comentario = com.trim();
    if (!comentario) { usePortal.getState().showError('Escribe el motivo para devolver la tarea.'); return; }
    const arr = loadTareasGestion();
    const idx = arr.findIndex((x) => x.id === id);
    if (idx >= 0) {
      arr[idx].estado = 'Devuelta';
      if (!arr[idx].comentarios) arr[idx].comentarios = [];
      arr[idx].comentarios!.unshift({ texto: '↩ DEVUELTA: ' + comentario, autor: nombreActual() || 'Equipo Gestión', fecha: fechaHoraPE() });
      saveTareasGestion(arr);
      registrarEnPanel({
        tipo: 'gestion', origen: 'gestion', nroId: arr[idx].nroId || 0,
        cliente: arr[idx].cliente || '—', expediente: arr[idx].expediente || '—', supervisor: arr[idx].supervisor || '—',
        texto: '↩ Tarea devuelta por Gestión: ' + comentario, autor: nombreActual() || 'Equipo Gestión', tareaId: id,
      });
    }
    onClose();
    showToast('↩ Tarea devuelta');
  };

  return (
    <div className="overlay show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--white)', borderRadius: 12, padding: '1.5rem', width: 460, maxWidth: '95vw', boxShadow: '0 16px 48px rgba(0,0,0,.2)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: '.3rem' }}>↩ Devolver tarea</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: '1rem' }}>{t ? (t.tipo || '—') + ' — ' + (t.cliente || '').slice(0, 40) : '#' + id}</div>
        <div style={{ marginBottom: '.75rem' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: '.3rem' }}>Motivo o comentario <span style={{ color: 'var(--red)' }}>*</span></label>
          <textarea value={com} onChange={(e) => setCom(e.target.value)} placeholder="Explica por qué se devuelve la tarea..." maxLength={250}
            style={{ width: '100%', minHeight: 80, padding: '8px 10px', border: '1px solid var(--gray-b)', borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'var(--font)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
          <div style={{ textAlign: 'right', fontSize: 10.5, color: 'var(--text4)' }}>{com.length}/250</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-dark" style={{ background: 'var(--red)', borderColor: 'var(--red)' }} onClick={confirmar}>↩ Devolver tarea</button>
        </div>
      </div>
    </div>
  );
}
