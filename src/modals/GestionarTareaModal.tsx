'use client';
// Gestionar tarea (HTML 784-835; JS 7691-7790 abrirPanelEdicion/guardarGestionTarea). Payload: { tareaId } | string
import { useMemo, useState } from 'react';
import { usePortal, showToast } from '@/store/portal';
import {
  ASIGNADOS_GESTION, tareaIdDePayload, getAllTareasGestion, loadTareasGestion, saveTareasGestion,
  loadOverrides, saveOverrides, registrarEnPanel, nombreActual, dmyAIso, isoADmy, MYBIG_PROC,
} from '@/lib/gestion';

export default function GestionarTareaModal({ payload, onClose }: { payload: unknown; onClose: () => void }) {
  const tareaId = tareaIdDePayload(payload);
  const t = useMemo(() => getAllTareasGestion().find((x) => x.id === tareaId), [tareaId]);
  const [asignado, setAsignado] = useState('');
  const [fechaIso, setFechaIso] = useState(t ? dmyAIso(t.fecha) : '');
  const [comentario, setComentario] = useState(t?.obs || '');
  const [estado, setEstado] = useState('');

  if (!t) return null;

  const guardar = () => {
    const com = comentario.trim();
    const fecha = isoADmy(fechaIso);
    const arr = loadTareasGestion();
    const idx = arr.findIndex((x) => x.id === tareaId);
    const tarea = idx >= 0 ? arr[idx] : usePortal.getState().TAREAS_GESTION_EXCEL.find((x) => x.id === tareaId);
    if (idx >= 0) {
      if (asignado) arr[idx].asignado = asignado;
      if (fecha) arr[idx].fecha = fecha;
      if (com) arr[idx].obs = com;
      if (estado) arr[idx].estado = estado;
      saveTareasGestion(arr);
    } else {
      const ov = loadOverrides();
      const actual = ov[tareaId] || {};
      if (asignado) actual.asignado = asignado;
      if (fecha) actual.fecha = fecha;
      if (com) actual.obs = com;
      if (estado) actual.estado = estado;
      ov[tareaId] = actual;
      saveOverrides(ov);
    }
    const cambios: string[] = [];
    if (asignado) cambios.push('Reasignado → ' + asignado);
    if (fecha) cambios.push('Nueva fecha: ' + fecha);
    if (estado) cambios.push('Estado → ' + estado);
    if (com) cambios.push(com);
    if (cambios.length) {
      const arr2 = loadTareasGestion();
      const idx2 = arr2.findIndex((x) => x.id === tareaId);
      const tareaFinal = idx2 >= 0 ? arr2[idx2] : tarea;
      const proc = tareaFinal ? usePortal.getState().DATA.find((r) => r.id === tareaFinal.nroId) : null;
      registrarEnPanel({
        tipo: 'gestion', origen: 'gestion',
        nroId: tareaFinal ? tareaFinal.nroId : 0, nrotarea: tareaFinal ? tareaFinal.nrotarea : 0,
        cliente: tareaFinal ? tareaFinal.cliente : '—', expediente: tareaFinal ? tareaFinal.expediente : '—',
        supervisor: proc ? proc.supervisor : (tareaFinal ? tareaFinal.supervisor : '—'),
        texto: cambios.join(' · '), autor: nombreActual() || 'Equipo Gestión',
        extra: { asignado, fecha, estado, comentario: com },
      });
    }
    onClose();
    showToast('✓ Cambios guardados y registrados en Panel Paralegal');
  };

  return (
    <div className="overlay show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ag-modal">
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Gestionar tarea</div>
        <div className="ag-proceso-info" style={{ marginBottom: '1rem' }}>
          <strong>{t.tipo}</strong><br />
          <a href={MYBIG_PROC(t.nroId)} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontSize: 11 }}>#{t.nroId} — {t.expediente}</a>
          {' · '}<span style={{ color: 'var(--text3)', fontSize: 11 }}>{t.cliente}</span>
        </div>
        <div className="ag-form-row">
          <div className="ag-field">
            <label>Reasignar a</label>
            <select value={asignado} onChange={(e) => setAsignado(e.target.value)}>
              <option value="">— Sin cambio —</option>
              {ASIGNADOS_GESTION.map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
          <div className="ag-field"><label>Nueva fecha</label><input type="date" value={fechaIso} onChange={(e) => setFechaIso(e.target.value)} /></div>
        </div>
        <div className="ag-form-row full">
          <div className="ag-field">
            <label>Comentario / observación</label>
            <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Agrega un comentario o indicación..." />
          </div>
        </div>
        <div className="ag-form-row">
          <div className="ag-field">
            <label>Estado</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">— Sin cambio —</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Completada">Completada</option>
              <option value="Cancelada">Cancelada</option>
            </select>
          </div>
          <div className="ag-field" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', paddingBottom: 8 }}>Los cambios se verán reflejados en la tabla de Panel Paralegal</div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-dark" onClick={guardar}>Guardar cambios</button>
        </div>
      </div>
    </div>
  );
}
