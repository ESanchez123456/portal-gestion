'use client';
// Comentarios de tarea (HTML 1983-1999; JS 6222-6315). Payload: { tareaId } | string
import { useEffect, useState } from 'react';
import { showToast, usePortal } from '@/store/portal';
import { registrarVista } from '@/lib/audit';
import MentionTextarea from '@/components/MentionTextarea';
import {
  tareaIdDePayload, getAllTareasGestion, loadTareasGestion, saveTareasGestion, loadOverrides, saveOverrides,
  registrarEnPanel, fechaHoraPE, nombreActual,
} from '@/lib/gestion';

export default function ComentariosTareaModal({ payload, onClose }: { payload: unknown; onClose: () => void }) {
  usePortal((s) => s.kvRev); // re-render al cambiar los comentarios
  const id = tareaIdDePayload(payload);
  const t = getAllTareasGestion().find((x) => x.id === id);
  const coms = (t && t.comentarios) || [];
  const [nuevo, setNuevo] = useState('');

  useEffect(() => {
    const tt = getAllTareasGestion().find((x) => x.id === id);
    registrarVista('visualizó los comentarios de una tarea', tt ? (tt.tipo || '').replace('Gestión - ', '') + ' · ' + (tt.cliente || '') : '#' + id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guardar = () => {
    const texto = nuevo.trim();
    if (!texto) { showToast('Escribe un comentario'); return; }
    const tarea = getAllTareasGestion().find((x) => x.id === id);
    const nc = { texto, autor: '—', fecha: fechaHoraPE() };
    const arr = loadTareasGestion();
    const idx = arr.findIndex((x) => x.id === id);
    if (idx >= 0) {
      if (!arr[idx].comentarios) arr[idx].comentarios = [];
      arr[idx].comentarios!.unshift(nc);
      saveTareasGestion(arr);
    } else if (tarea) {
      const ov = loadOverrides();
      const actuales = ov[id]?.comentarios || tarea.comentarios || [];
      ov[id] = { ...(ov[id] || {}), comentarios: [nc, ...actuales] };
      saveOverrides(ov);
    }
    if (tarea) {
      const esDestReal = !!tarea.agendadoPor && tarea.agendadoPor !== '—' && tarea.agendadoPor !== 'Excel/MyBiG';
      registrarEnPanel({
        tipo: 'comentario', origen: 'gestion', nroId: tarea.nroId, nrotarea: tarea.nrotarea,
        cliente: tarea.cliente || '—', expediente: tarea.expediente || '—', supervisor: tarea.supervisor || '',
        texto, autor: nombreActual() || 'Equipo Gestión', destinatario: esDestReal ? tarea.agendadoPor : '',
        tareaId: id, estado: 'comentario',
      });
    }
    setNuevo('');
    showToast(tarea && tarea.agendadoPor && tarea.agendadoPor !== '—' && tarea.agendadoPor !== 'Excel/MyBiG'
      ? '✓ Comentario enviado a ' + tarea.agendadoPor : '✓ Comentario agregado');
  };

  const borrar = (i: number) => {
    const arr = loadTareasGestion();
    const ti = arr.findIndex((x) => x.id === id);
    if (ti >= 0 && arr[ti].comentarios) { arr[ti].comentarios!.splice(i, 1); saveTareasGestion(arr); }
    else {
      const ov = loadOverrides();
      const tarea = getAllTareasGestion().find((x) => x.id === id);
      const actuales = (ov[id]?.comentarios || (tarea && tarea.comentarios) || []).slice();
      actuales.splice(i, 1);
      ov[id] = { ...(ov[id] || {}), comentarios: actuales };
      saveOverrides(ov);
    }
  };

  return (
    <div className="overlay show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--white)', borderRadius: 12, padding: 0, width: 520, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '1.1rem 1.4rem .8rem', borderBottom: '1px solid var(--gray-b)', position: 'sticky', top: 0, background: 'var(--white)', zIndex: 2 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>💬 Comentarios de la tarea</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{t ? (t.tipo || '—') + ' — ' + (t.cliente || '').slice(0, 40) : '#' + id}</div>
        </div>
        <div style={{ padding: '1rem 1.4rem' }}>
          <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '.75rem' }}>
            {!coms.length
              ? <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text4)', fontSize: 12 }}>Sin comentarios aún.</div>
              : coms.map((cm, i) => {
                const dev = cm.texto.startsWith('↩');
                return (
                  <div key={i} style={{ padding: '8px 10px', background: dev ? '#fef2f2' : 'var(--gray-l)', borderRadius: 'var(--r)', borderLeft: '3px solid ' + (dev ? 'var(--red)' : 'var(--blue)') }}>
                    <div style={{ fontSize: 12, color: 'var(--text)' }}>{cm.texto}</div>
                    <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 3, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{cm.autor || '—'} · {cm.fecha || ''}</span>
                      <button onClick={() => borrar(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 10, padding: 0 }}>✕</button>
                    </div>
                  </div>
                );
              })}
          </div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: '.3rem' }}>Nuevo comentario</label>
          <MentionTextarea value={nuevo} onChange={setNuevo} placeholder="Escribe un comentario o solicita información adicional... @nombre para mencionar" maxLength={250}
            style={{ width: '100%', minHeight: 70, padding: '8px 10px', border: '1px solid var(--gray-b)', borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'var(--font)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
          <div style={{ textAlign: 'right', fontSize: 10.5, color: 'var(--text4)', marginBottom: '.5rem' }}>{nuevo.length}/250</div>
        </div>
        <div style={{ padding: '.85rem 1.4rem', borderTop: '1px solid var(--gray-b)', display: 'flex', justifyContent: 'flex-end', gap: 8, position: 'sticky', bottom: 0, background: 'var(--white)' }}>
          <button className="btn" onClick={onClose}>Cerrar</button>
          <button className="btn btn-dark" onClick={guardar}>💬 Agregar comentario</button>
        </div>
      </div>
    </div>
  );
}
