'use client';
// Agendar tarea en masa (HTML 1785-1877; JS 4636-4704). Payload: { ids: number[]; onDone?: () => void } | number[]
import { useState } from 'react';
import { usePortal, showToast } from '@/store/portal';
import {
  ASIGNADOS_GESTION, TIPOS_TAREA_GRUPOS, AGENDADO_POR_EXT, AGENDADO_POR_INT,
  buildTareaDesdeProc, loadTareasGestion, saveTareasGestion, isoADmy,
} from '@/lib/gestion';

export default function BulkAgendarModal({ payload, onClose }: { payload: unknown; onClose: () => void }) {
  const DATA = usePortal((s) => s.DATA);
  const p = payload as { ids?: number[]; procIds?: number[]; onDone?: () => void } | number[] | null;
  const ids: number[] = Array.isArray(p) ? p : (p && (p.ids || p.procIds)) || [];
  const onDone = !Array.isArray(p) && p ? p.onDone : undefined;
  const procs = DATA.filter((r) => ids.includes(r.id));

  const [tipo, setTipo] = useState('');
  const [asig, setAsig] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [agendRaw, setAgendRaw] = useState('');
  const [obs, setObs] = useState('');

  const confirmar = () => {
    if (!tipo || !asig || !agendRaw) { usePortal.getState().showError('Completa: tipo de tarea, asignado a y agendado por.'); return; }
    const agend = agendRaw.split(':').slice(1).join(':');
    const origen = agendRaw.startsWith('int:') ? 'portal' : 'excel';
    const arr = loadTareasGestion();
    ids.forEach((id) => {
      const proc = DATA.find((r) => r.id === id);
      arr.unshift(buildTareaDesdeProc(id, proc, {
        id: 'port_' + Date.now() + '_' + id,
        tipo, asignado: asig, agendadoPor: agend || '—',
        fecha: isoADmy(fecha), hora: hora || '', estado: 'Pendiente', obs: obs.trim(), origen,
      }));
    });
    saveTareasGestion(arr);
    onClose();
    onDone?.();
    showToast('✓ ' + ids.length + ' tarea(s) agendada(s) correctamente');
  };

  return (
    <div className="overlay show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ag-modal" style={{ width: 580 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Agendar tarea en masa</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: '1rem' }}>Se creará <strong>{ids.length}</strong> tarea(s) — una por cada proceso seleccionado</div>
        <div style={{ maxHeight: 130, overflowY: 'auto', border: '1px solid var(--gray-b)', borderRadius: 'var(--r)', marginBottom: '1rem', fontSize: 11.5 }}>
          {procs.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderBottom: '1px solid var(--gray-b)' }}>
              <a className="id-link" href={'https://vinatea.mybig.com.ar/trabajos/overview/' + r.id + '/'} target="_blank" rel="noreferrer">#{r.id}</a>
              <span style={{ fontWeight: 500, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.cliente}</span>
              <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>{r.expediente}</span>
              <span style={{ fontSize: 10.5, color: 'var(--text4)' }}>{r.supervisor}</span>
            </div>
          ))}
        </div>
        <div className="ag-form-row">
          <div className="ag-field">
            <label>Tipo de tarea <span style={{ color: 'var(--red)' }}>*</span></label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Seleccionar...</option>
              {TIPOS_TAREA_GRUPOS.map((g) => <optgroup key={g.label} label={g.label}>{g.items.map((i) => <option key={i}>{i}</option>)}</optgroup>)}
            </select>
          </div>
          <div className="ag-field">
            <label>Asignado a <span style={{ color: 'var(--red)' }}>*</span></label>
            <select value={asig} onChange={(e) => setAsig(e.target.value)}>
              <option value="">Seleccionar...</option>
              {ASIGNADOS_GESTION.map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div className="ag-form-row">
          <div className="ag-field"><label>Fecha límite</label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
          <div className="ag-field">
            <label>Hora <span style={{ color: 'var(--text4)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></label>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
        </div>
        <div className="ag-form-row">
          <div className="ag-field">
            <label>Agendado por <span style={{ color: 'var(--red)' }}>*</span></label>
            <select value={agendRaw} onChange={(e) => setAgendRaw(e.target.value)}>
              <option value="">Seleccionar quién agenda...</option>
              <optgroup label="— Abogados de equipos —">{AGENDADO_POR_EXT.map(([v, l]) => <option key={v} value={'ext:' + v}>{l}</option>)}</optgroup>
              <optgroup label="— Equipo Gestión —">{AGENDADO_POR_INT.map(([v, l]) => <option key={v} value={'int:' + v}>{l}</option>)}</optgroup>
            </select>
          </div>
        </div>
        <div className="ag-form-row full">
          <div className="ag-field">
            <label>Observaciones</label>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Indicaciones que aplican a todos los procesos..." style={{ minHeight: 55 }} />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-dark" onClick={confirmar}>Agendar <span>{ids.length}</span> tarea(s)</button>
        </div>
      </div>
    </div>
  );
}
