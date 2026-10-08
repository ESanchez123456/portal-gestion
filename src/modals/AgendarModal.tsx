'use client';
// Agendar tarea de gestión (HTML 1611-1783; JS 7368-7650). Payload: { procId?: number } | number
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePortal, showToast } from '@/store/portal';
import { registrarVista } from '@/lib/audit';
import { gestionDuenoPorOrgano } from '@/lib/juzgados';
import MentionTextarea from '@/components/MentionTextarea';
import {
  ASIGNADOS_GESTION, TIPOS_TAREA_GRUPOS, AGENDADO_POR_EXT, AGENDADO_POR_INT,
  buildTareaDesdeProc, loadTareasGestion, saveTareasGestion, registrarEnPanel, fechaHoraPE, isoADmy,
  type AdjuntoTarea,
} from '@/lib/gestion';
import type { Proceso } from '@/types';

function procIdDePayload(p: unknown): number | null {
  if (typeof p === 'number') return p || null;
  if (p && typeof p === 'object' && 'procId' in p) { const n = Number((p as { procId: unknown }).procId); return n || null; }
  return null;
}

export default function AgendarModal({ payload, onClose }: { payload: unknown; onClose: () => void }) {
  const DATA = usePortal((s) => s.DATA);
  const idInicial = useMemo(() => procIdDePayload(payload), [payload]);

  const [procId, setProcId] = useState<number | null>(idInicial);
  const [busq, setBusq] = useState('');
  const [ddOpen, setDdOpen] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [solicitante, setSolicitante] = useState('');
  const [tipo, setTipo] = useState('');
  const [asignado, setAsignado] = useState('');
  const [hint, setHint] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [agendadoPor, setAgendadoPor] = useState('');
  const [obs, setObs] = useState('');
  const [adjuntos, setAdjuntos] = useState<AdjuntoTarea[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const busqRef = useRef<HTMLInputElement>(null);

  // Preselecciona "Asignado a" con la persona de Gestión dueña del juzgado del proceso (editable).
  const aplicarAsignadoPorJuzgado = (proc?: Proceso | null) => {
    setHint('');
    if (!proc) return;
    const dueno = gestionDuenoPorOrgano(proc.organo);
    if (dueno && ASIGNADOS_GESTION.includes(dueno)) {
      setAsignado(dueno);
      setHint('Sugerido: encargado de ' + (proc.organo || 'este juzgado') + ' (puedes cambiarlo)');
    } else {
      setAsignado('');
      if (proc.organo) setHint('Este juzgado no tiene encargado de Gestión asignado en Juzgados');
    }
  };

  // Apertura: con proceso preseleccionado (botón + Gestión en fila) o desde la barra (buscador)
  useEffect(() => {
    if (idInicial) {
      const proc = DATA.find((r) => r.id === idInicial);
      if (proc) {
        registrarVista('visualizó el proceso', '#' + idInicial + ' · ' + (proc.cliente || '') + (proc.expediente ? ' · ' + proc.expediente : ''));
        aplicarAsignadoPorJuzgado(proc);
      } else registrarVista('visualizó el proceso', '#' + idInicial);
    } else setTimeout(() => busqRef.current?.focus(), 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const procSel = procId ? DATA.find((r) => r.id === procId) : undefined;
  const resultados = useMemo(() => {
    const q = busq.trim().toLowerCase();
    if (!q) return [];
    return DATA.filter((r) => String(r.id).includes(q) || (r.cliente || '').toLowerCase().includes(q) || (r.expediente || '').toLowerCase().includes(q)).slice(0, 12);
  }, [busq, DATA]);

  const onBusq = (v: string) => {
    setBusq(v);
    if (!v.trim()) { setDdOpen(false); setProcId(null); return; }
    setDdOpen(true);
  };
  const seleccionar = (id: number) => {
    const proc = DATA.find((r) => r.id === id); if (!proc) return;
    setProcId(id); aplicarAsignadoPorJuzgado(proc);
    setDdOpen(false); setBusq('#' + id + ' — ' + proc.cliente);
  };
  const limpiarSeleccion = () => {
    setProcId(null); setHint(''); setBusq(''); setDdOpen(false);
    setTimeout(() => busqRef.current?.focus(), 50);
  };

  const agregarAdjuntos = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => setAdjuntos((a) => [...a, { nombre: file.name, tipo: file.type, data: String(e.target?.result || '') }]);
      reader.readAsDataURL(file);
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  const confirmar = () => {
    const showErr = usePortal.getState().showError;
    const agend = agendadoPor ? agendadoPor.split(':').slice(1).join(':') : '';
    const origen = agendadoPor.startsWith('int:') ? 'portal' : agendadoPor.startsWith('ext:') ? 'excel' : 'portal';
    const solNombre = solicitante ? solicitante.split('|')[0] : '';
    const solRol = solicitante ? solicitante.split('|')[1] : '';

    let pid = procId;
    if (!pid) {
      const idRaw = parseInt(busq || '0');
      if (!idRaw) { showErr('Ingresa el ID del proceso para continuar.'); return; }
      pid = idRaw;
    }
    if (!tipo || !asignado) { showErr('Completa el tipo de tarea y el responsable asignado.'); return; }
    if (!solNombre) { showErr('Indica quién solicita la tarea.'); return; }

    const proc = DATA.find((r) => r.id === pid);
    const esSup = solRol === 'sup' || solRol === 'gest';
    const estadoInicial = esSup ? 'Pendiente' : 'Pendiente aprobación';
    const supervisorDelProc = proc ? proc.supervisor : '';

    const nueva = buildTareaDesdeProc(pid, proc, {
      id: 'port_' + Date.now(),
      tipo, asignado, agendadoPor: agend || '—',
      solicitadoPor: solNombre, supervisorAprobador: supervisorDelProc,
      fecha: isoADmy(fecha), hora: hora || '', estado: estadoInicial, obs, origen,
      adjuntos: [...adjuntos], fechaEncargo: fechaHoraPE(), comentarios: [],
    });
    const arr = loadTareasGestion();
    arr.unshift(nueva);
    saveTareasGestion(arr);

    if (estadoInicial === 'Pendiente aprobación') {
      registrarEnPanel({
        tipo: 'aprobacion', origen: 'gestion', nroId: pid,
        cliente: proc ? proc.cliente : '—', expediente: proc ? proc.expediente : '—', supervisor: supervisorDelProc,
        texto: solNombre + ' solicita tarea: ' + tipo + (obs ? ' · ' + obs : ''),
        autor: solNombre, tareaId: nueva.id, estado: 'pendiente_aprobacion',
      });
      showToast('📋 Tarea enviada al supervisor ' + supervisorDelProc + ' para aprobación');
    } else {
      registrarEnPanel({
        tipo: 'gestion', origen: 'gestion', nroId: pid,
        cliente: proc ? proc.cliente : '—', expediente: proc ? proc.expediente : '—', supervisor: supervisorDelProc,
        texto: '🆕 Nueva tarea agendada: ' + tipo + ' → ' + asignado + (fecha ? ' · Fecha límite: ' + nueva.fecha : '') + (obs ? ' · ' + obs : ''),
        autor: agend || solNombre || '—', tareaId: nueva.id, extra: { asignado, fecha: nueva.fecha },
      });
      showToast('✓ Tarea agendada correctamente');
    }
    onClose();
  };

  return (
    <div className="overlay show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ag-modal">
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Agendar tarea de gestión</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: '1rem' }}>Requiere aprobación del supervisor del equipo</div>

        {!idInicial && (
          <div className="ag-form-row full" style={{ marginBottom: '.85rem' }}>
            <div className="ag-field">
              <label>Buscar proceso <span style={{ color: 'var(--red)' }}>*</span></label>
              <div style={{ position: 'relative' }}>
                <input ref={busqRef} type="text" value={busq} placeholder="Escribe ID, cliente o expediente..." autoComplete="off"
                  onChange={(e) => onBusq(e.target.value)} style={{ width: '100%', paddingRight: '2rem' }} />
                {ddOpen && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#1e2140', border: '1px solid rgba(255,255,255,.18)', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,.35)', zIndex: 400, maxHeight: 220, overflowY: 'auto', padding: 4 }}>
                    {!resultados.length
                      ? <div style={{ padding: '8px 10px', fontSize: 11.5, color: 'rgba(255,255,255,.4)' }}>Sin resultados</div>
                      : resultados.map((r) => (
                        <div key={r.id} className="ag-proc-item" onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)} onClick={() => seleccionar(r.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 11.5, color: 'rgba(255,255,255,.85)', transition: 'background .12s', background: hover === r.id ? 'rgba(255,255,255,.1)' : '' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,.45)', flexShrink: 0, minWidth: 52 }}>#{r.id}</span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.cliente}</span>
                          <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,.4)', flexShrink: 0 }}>{r.expediente}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              {procId && procSel && (
                <div style={{ marginTop: 6, padding: '7px 10px', background: 'var(--green-l)', border: '1px solid var(--green-b)', borderRadius: 'var(--r)', fontSize: 11.5, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  ✓ <strong>#{procId}</strong> {procSel.cliente}
                  <span style={{ color: 'var(--green)', opacity: .7, fontSize: 11 }}>{procSel.expediente}</span>
                  {procSel.instancia && <span style={{ marginLeft: 4, padding: '1px 7px', borderRadius: 10, background: 'var(--green-b)', fontSize: 10 }}>{procSel.instancia}</span>}
                  <button onClick={limpiarSeleccion} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                </div>
              )}
            </div>
          </div>
        )}
        {idInicial && (
          <div className="ag-proceso-info">
            {procSel ? (
              <>
                <strong>#{idInicial} — {procSel.cliente}</strong>
                <span style={{ color: 'var(--text3)' }}>{procSel.expediente}</span>
                {procSel.instancia && <span className="badge b-n" style={{ marginLeft: 6, fontSize: 10 }}>{procSel.instancia}</span>}
              </>
            ) : <strong>#{idInicial}</strong>}
          </div>
        )}

        <div className="ag-form-row">
          <div className="ag-field">
            <label>Solicitado por <span style={{ color: 'var(--red)' }}>*</span></label>
            <select value={solicitante} onChange={(e) => setSolicitante(e.target.value)}>
              <option value="">Seleccionar abogado/responsable...</option>
              <optgroup label="Supervisores">
                <option value="Elyana Arias|sup">Elyana Arias (Supervisora)</option>
                <option value="Solanch Estrella|sup">Solanch Estrella (Supervisora)</option>
                <option value="Samuel Paz|sup">Samuel Paz (Supervisor)</option>
                <option value="Carlos Morales|sup">Carlos Morales (Supervisor)</option>
                <option value="Cynthia Lagos|sup">Cynthia Lagos (Supervisora)</option>
                <option value="Katia Jacinto|sup">Katia Jacinto (Supervisora)</option>
              </optgroup>
              <optgroup label="Equipo Gestión">
                <option value="Roberto Matallana|gest">Roberto Matallana</option>
                <option value="Arturo Trelles|gest">Arturo Trelles</option>
                <option value="Silvia Maldonado|gest">Silvia Maldonado</option>
                <option value="Carlos Morales|gest">Carlos Morales</option>
                <option value="Juan Jose Edquen|gest">Juan Jose Edquen</option>
              </optgroup>
            </select>
          </div>
        </div>
        <div className="ag-form-row">
          <div className="ag-field">
            <label>Tipo de tarea</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Seleccionar...</option>
              {TIPOS_TAREA_GRUPOS.map((g) => (
                <optgroup key={g.label} label={g.label}>{g.items.map((i) => <option key={i}>{i}</option>)}</optgroup>
              ))}
            </select>
          </div>
          <div className="ag-field">
            <label>Asignado a</label>
            <select value={asignado} onChange={(e) => setAsignado(e.target.value)}>
              <option value="">Seleccionar...</option>
              {ASIGNADOS_GESTION.map((n) => <option key={n}>{n}</option>)}
            </select>
            {hint && <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 3 }}>{hint}</div>}
          </div>
        </div>
        <div className="ag-form-row">
          <div className="ag-field"><label>Fecha límite</label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
          <div className="ag-field">
            <label>Hora <span style={{ color: 'var(--text4)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></label>
            <input type="time" placeholder="HH:MM" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
        </div>
        <div className="ag-form-row">
          <div className="ag-field">
            <label>Agendado por</label>
            <select value={agendadoPor} onChange={(e) => setAgendadoPor(e.target.value)}>
              <option value="">Seleccionar quién agenda...</option>
              <optgroup label="— Abogados de equipos —">{AGENDADO_POR_EXT.map(([v, l]) => <option key={v} value={'ext:' + v}>{l}</option>)}</optgroup>
              <optgroup label="— Equipo Gestión —">{AGENDADO_POR_INT.map(([v, l]) => <option key={v} value={'int:' + v}>{l}</option>)}</optgroup>
            </select>
          </div>
        </div>
        <div className="ag-form-row full">
          <div className="ag-field">
            <label>Observaciones</label>
            <MentionTextarea value={obs} onChange={setObs} placeholder="Indicaciones, contexto o acción requerida..." maxLength={250} />
            <div style={{ textAlign: 'right', fontSize: 10.5, color: 'var(--text4)', marginTop: 2 }}>{obs.length}/250</div>
          </div>
        </div>
        <div className="ag-form-row full">
          <div className="ag-field">
            <label>Adjuntos</label>
            <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={(e) => agregarAdjuntos(e.target.files)} />
            <button className="btn-sm" onClick={() => fileRef.current?.click()}>📎 Adjuntar archivo</button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
              {adjuntos.map((a, i) => (
                <div key={i} className="ag-adj-item">
                  <span>{a.tipo.includes('image') ? '🖼️' : a.tipo.includes('pdf') ? '📄' : '📎'}</span>
                  <a href={a.data} download={a.nombre}>{a.nombre}</a>
                  <button onClick={() => setAdjuntos((x) => x.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 12, padding: 0 }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-dark" onClick={confirmar}>Agendar tarea</button>
        </div>
      </div>
    </div>
  );
}
