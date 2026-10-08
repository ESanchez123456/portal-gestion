'use client';
import { useEffect, useState } from 'react';
import { usePortal, showToast } from '@/store/portal';
import { getObsProc, saveObsProc } from '@/lib/obsProc';
import { registrarEnPanel } from '@/lib/gestion';
import MentionTextarea from '@/components/MentionTextarea';

/** Observaciones del proceso. payload: { procId: number } (o directamente el id). Original: abrirObsProc / guardarObsProc / borrarObs. */
export default function ObsProcModal({ payload, onClose }: { payload: unknown; onClose: () => void }) {
  const p = payload as { procId?: number } | number | boolean | undefined;
  const procId = typeof p === 'number' ? p : (typeof p === 'object' && p ? p.procId ?? null : null);
  const DATA = usePortal((s) => s.DATA);
  usePortal((s) => s.kvRev); // refresca el historial cuando cambian las observaciones
  const [texto, setTexto] = useState('');
  const proc = procId != null ? DATA.find((r) => r.id === procId) : undefined;

  useEffect(() => { setTexto(''); }, [procId]);
  if (procId == null) return null;

  const obs = getObsProc(procId);
  const sub = proc ? '#' + procId + ' — ' + (proc.cliente || '').slice(0, 40) + ' · ' + proc.expediente : '#' + procId;

  const guardar = () => {
    const t = texto.trim();
    if (!t) { usePortal.getState().showError('Escribe una observación antes de guardar.'); return; }
    const arr = getObsProc(procId);
    arr.unshift({
      texto: t, autor: usePortal.getState().user?.name || '—',
      fecha: new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      mine: true,
    });
    saveObsProc(procId, arr);
    // Registrar en Panel Paralegal
    registrarEnPanel({
      tipo: 'obs', nroId: procId, nrotarea: 0,
      cliente: proc ? proc.cliente : '—', expediente: proc ? proc.expediente : '—', supervisor: proc ? proc.supervisor : '—',
      texto: t, autor: '—',
    });
    setTexto('');
    showToast('✓ Observación guardada');
  };
  const borrar = (idx: number) => {
    const arr = getObsProc(procId);
    arr.splice(idx, 1);
    saveObsProc(procId, arr);
  };

  return (
    <div className="overlay show" id="modalObsProc" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="obs-modal">
        <div className="obs-proc-header">
          <div className="obs-proc-title">Observaciones del proceso</div>
          <div className="obs-proc-sub">{sub}</div>
        </div>
        <div className="obs-history">
          {!obs.length ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text4)', fontSize: 12 }}>Sin observaciones aún</div>
          ) : obs.map((o, i) => (
            <div className="obs-entry" key={i}>
              <div style={{ fontSize: 12, color: 'var(--text)' }}>{o.texto}</div>
              <div className="obs-entry-meta">{o.autor || '—'} · {o.fecha || ''}
                <button onClick={() => borrar(i)} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 10, padding: 0 }}>✕ borrar</button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: '.75rem' }}>
          <MentionTextarea value={texto} onChange={setTexto} autoFocus placeholder="Escribe una observación o comentario..."
            style={{ width: '100%', minHeight: 80, resize: 'vertical', padding: '8px 10px', border: '1px solid var(--gray-b)', borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'var(--font)', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>Cerrar</button>
          <button className="btn btn-dark" onClick={guardar}>Guardar observación</button>
        </div>
      </div>
    </div>
  );
}
