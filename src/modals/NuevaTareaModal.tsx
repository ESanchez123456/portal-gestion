'use client';
// Nueva tarea manual (JS 4348-4386 crearTareaGestion/autocompleteProceso). OJO: el HTML #modalNuevaTarea no existe en
// legacy/index.html (código heredado sin UI); este modal reproduce los campos nt-* que la función esperaba.
import { useState } from 'react';
import { usePortal } from '@/store/portal';
import { ASIGNADOS_GESTION, TIPOS_TAREA_GRUPOS, loadTareasGestion, saveTareasGestion, isoADmy, type TareaG } from '@/lib/gestion';

export default function NuevaTareaModal({ onClose }: { payload?: unknown; onClose: () => void }) {
  const DATA = usePortal((s) => s.DATA);
  const [id, setId] = useState('');
  const [tipo, setTipo] = useState('');
  const [asignado, setAsignado] = useState('');
  const [fecha, setFecha] = useState('');
  const [agend, setAgend] = useState('');
  const [obs, setObs] = useState('');
  const proc = DATA.find((r) => r.id === parseInt(id));

  const crear = () => {
    if (!id.trim() || !tipo || !asignado) { usePortal.getState().showError('Completa al menos: ID del proceso, tipo de tarea y responsable.'); return; }
    const p = DATA.find((r) => r.id === parseInt(id));
    const nueva: TareaG = {
      id: 'man_' + Date.now(), nroId: parseInt(id),
      cliente: p ? p.cliente : '—', expediente: p ? p.expediente : '—',
      tipo, asignado, agendadoPor: agend.trim() || '—', fecha: isoADmy(fecha),
      estado: 'Pendiente', obs: obs.trim(), origen: 'manual',
    };
    const arr = loadTareasGestion();
    arr.unshift(nueva);
    saveTareasGestion(arr);
    onClose();
  };

  return (
    <div className="overlay show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ag-modal">
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: '1rem' }}>Nueva tarea de gestión</div>
        <div className="ag-form-row">
          <div className="ag-field"><label>ID del proceso</label><input type="number" value={id} onChange={(e) => setId(e.target.value)} /></div>
          <div className="ag-field"><label>Expediente</label><input type="text" readOnly value={proc ? proc.expediente : ''} /></div>
        </div>
        <div className="ag-form-row full">
          <div className="ag-field"><label>Cliente</label><input type="text" readOnly value={proc ? proc.cliente : ''} /></div>
        </div>
        <div className="ag-form-row">
          <div className="ag-field">
            <label>Tipo de tarea</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Seleccionar...</option>
              {TIPOS_TAREA_GRUPOS.map((g) => <optgroup key={g.label} label={g.label}>{g.items.map((i) => <option key={i}>{i}</option>)}</optgroup>)}
            </select>
          </div>
          <div className="ag-field">
            <label>Asignado a</label>
            <select value={asignado} onChange={(e) => setAsignado(e.target.value)}>
              <option value="">Seleccionar...</option>
              {ASIGNADOS_GESTION.map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div className="ag-form-row">
          <div className="ag-field"><label>Fecha límite</label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
          <div className="ag-field"><label>Agendado por</label><input type="text" value={agend} onChange={(e) => setAgend(e.target.value)} /></div>
        </div>
        <div className="ag-form-row full">
          <div className="ag-field"><label>Observaciones</label><textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-dark" onClick={crear}>Crear tarea</button>
        </div>
      </div>
    </div>
  );
}
