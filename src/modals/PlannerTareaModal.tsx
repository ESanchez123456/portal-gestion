'use client';
import { useRef, useState } from 'react';
import { FSLS, showToast, usePortal } from '@/store/portal';
import { GCAL_MIEMBROS } from '@/lib/constants';
import MentionTextarea from '@/components/MentionTextarea';
import {
  buildTareaDesdeProc, dmyToISO, getAllTareasGestion, isoToDMY, loadTareasGestion, saveTareasGestion,
  type PlannerExcelTarea, type PlannerTareaPayload,
} from '@/lib/gestionD';

/**
 * Modal de tarea del Planner (nueva / editar / detalle de tarea Excel).
 * Abrir: usePortal.getState().openModal('plannerTarea', payload) con payload: PlannerTareaPayload
 *   { modo:'nueva',  fecha?:'yyyy-mm-dd', miembro?:'Nombre completo' }
 *   { modo:'editar', tareaId:string }              // id de getAllTareasGestion ('port_…', 'man_…', 'ex_…')
 *   { modo:'excel',  tarea:PlannerExcelTarea }     // solo notas + adjuntos (clave ptarea_notas_<nrotarea>)
 * Sin payload (o `true`) equivale a { modo:'nueva' }.
 */
const TIPOS = [
  'Gestión - Impulso de demanda/admisorio', 'Gestión - Impulso trámite primera instancia', 'Gestión - Impulso trámite segunda instancia',
  'Gestión - Elevación a Suprema/TC', 'Gestión - Ejecución de sentencia', 'Gestión - Consignaciones judiciales',
  'Gestión - Seguimiento', 'Gestión - Informar al cliente', 'Gestión - Otro',
];

interface Adj { nombre: string; tipo: string; data: string; ts: number; }
const readAdj = (key: string) => FSLS.getJSON<Adj[]>('ptarea_adj_' + key, []);

interface Init {
  modo: 'nueva' | 'editar' | 'excel'; title: string; sub: string; procText: string; procLabel: string; procSelId: number | null;
  tipo: string; estado: string; fecha: string; hora: string; miembro: string; notas: string;
  tareaId: string | null; exNr: number | string | null; adjKey: string;
}

function calcInit(payload: unknown): Init {
  const p = (payload && typeof payload === 'object' ? payload : { modo: 'nueva' }) as Partial<PlannerTareaPayload> & Record<string, unknown>;
  const nueva = (fecha?: string, miembro?: string): Init => ({
    modo: 'nueva', title: 'Nueva tarea de gestión',
    sub: fecha ? new Date(fecha + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'long' }) : '',
    procText: '', procLabel: '', procSelId: null, tipo: '', estado: 'Pendiente', fecha: fecha || '', hora: '', miembro: miembro || '', notas: '',
    tareaId: null, exNr: null, adjKey: 'tmp_' + Date.now(),
  });
  if (p.modo === 'editar' && typeof p.tareaId === 'string') {
    const t = getAllTareasGestion().find((x) => x.id === p.tareaId);
    if (!t) return nueva('', '');
    return {
      modo: 'editar', title: 'Editar tarea', sub: '#' + t.nroId + ' — ' + (t.cliente || '').slice(0, 40),
      procText: t.cliente || '', procLabel: t.nroId ? '#' + t.nroId : '', procSelId: null,
      tipo: t.tipo || '', estado: t.estado || 'Pendiente', fecha: dmyToISO(t.fecha), hora: t.hora || '',
      miembro: t.asignado || '', notas: t.obs || '', tareaId: t.id, exNr: null, adjKey: t.id,
    };
  }
  if (p.modo === 'excel' && p.tarea) {
    const t = p.tarea as PlannerExcelTarea;
    const tipoSel = TIPOS.find((o) => t.tipo && t.tipo.toLowerCase().includes(o.toLowerCase().replace('gestión - ', '')));
    const saved = FSLS.getJSON<{ notas?: string }>('ptarea_notas_' + t.nrotarea, {});
    return {
      modo: 'excel', title: t.tipo || 'Tarea', sub: '#' + (t.nrotarea || '—') + ' — ' + (t.cliente || '—'),
      procText: t.cliente || '', procLabel: t.nroId ? '#' + t.nroId : '', procSelId: t.nroId || null,
      tipo: tipoSel || '', estado: t.estado || 'Pendiente', fecha: dmyToISO(t.fecha), hora: t.hora || '',
      miembro: t.asignado || '', notas: saved.notas || t.notas || '', tareaId: null, exNr: t.nrotarea || '', adjKey: 'ex_' + t.nrotarea,
    };
  }
  const n = p as { fecha?: string; miembro?: string };
  return nueva(n.fecha, n.miembro);
}

export default function PlannerTareaModal({ payload, onClose }: { payload: unknown; onClose: () => void }) {
  usePortal((s) => s.kvRev);
  const procs = usePortal((s) => s.DATA);
  const init = useRef<Init | null>(null);
  if (!init.current) init.current = calcInit(payload);
  const I = init.current;

  const [procText, setProcText] = useState(I.procText);
  const [procLabel, setProcLabel] = useState(I.procLabel);
  const [procSelId, setProcSelId] = useState<number | null>(I.procSelId);
  const [ddOpen, setDdOpen] = useState(false);
  const [tipo, setTipo] = useState(I.tipo);
  const [estado, setEstado] = useState(I.estado);
  const [fecha, setFecha] = useState(I.fecha);
  const [hora, setHora] = useState(I.hora);
  const [miembro, setMiembro] = useState(I.miembro);
  const [notas, setNotas] = useState(I.notas);
  const [adj, setAdj] = useState<Adj[]>(() => (I.modo === 'nueva' ? [] : readAdj(I.adjKey)));
  const fileRef = useRef<HTMLInputElement>(null);
  const guardado = useRef(false);

  const q = procText.toLowerCase().trim();
  const matches = ddOpen && q.length >= 2
    ? procs.filter((r) => (r.cliente + r.expediente + String(r.id)).toLowerCase().includes(q)).slice(0, 8)
    : [];

  const cerrar = () => {
    // Adjuntos temporales de una tarea nueva que no se guardó: se descartan
    if (I.modo === 'nueva' && !guardado.current && FSLS.getItem('ptarea_adj_' + I.adjKey) !== null) FSLS.removeItem('ptarea_adj_' + I.adjKey);
    onClose();
  };

  const agregarAdjuntos = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const cur = readAdj(I.adjKey);
        cur.push({ nombre: file.name, tipo: file.type, data: String(e.target?.result || ''), ts: Date.now() });
        FSLS.setItem('ptarea_adj_' + I.adjKey, JSON.stringify(cur));
        setAdj(cur);
      };
      reader.readAsDataURL(file);
    });
    if (fileRef.current) fileRef.current.value = '';
  };
  const borrarAdj = (idx: number) => {
    const cur = readAdj(I.adjKey);
    cur.splice(idx, 1);
    FSLS.setItem('ptarea_adj_' + I.adjKey, JSON.stringify(cur));
    setAdj(cur);
  };

  const guardar = () => {
    const notasT = notas.trim();
    const fechaDMY = isoToDMY(fecha);

    if (I.modo === 'excel') {
      FSLS.setItem('ptarea_notas_' + I.exNr, JSON.stringify({ notas: notasT }));
      showToast('✓ Notas guardadas');
      onClose();
      return;
    }

    const procId = procSelId || (I.tareaId ? (getAllTareasGestion().find((t) => t.id === I.tareaId)?.nroId ?? 0) : 0);
    const proc = usePortal.getState().DATA.find((r) => r.id === procId);

    if (I.tareaId) {
      const arr = loadTareasGestion();
      const idx = arr.findIndex((t) => t.id === I.tareaId);
      if (idx >= 0) {
        arr[idx].tipo = tipo; arr[idx].estado = estado; arr[idx].fecha = fechaDMY;
        arr[idx].hora = hora; arr[idx].obs = notasT; arr[idx].asignado = miembro || arr[idx].asignado;
        saveTareasGestion(arr);
        const tmpAdj = FSLS.getJSON<Adj[]>('ptarea_adj_tmp_' + I.tareaId, []);
        if (tmpAdj.length) {
          const existing = readAdj(I.tareaId);
          FSLS.setItem('ptarea_adj_' + I.tareaId, JSON.stringify([...existing, ...tmpAdj]));
          FSLS.removeItem('ptarea_adj_tmp_' + I.tareaId);
        }
      } else {
        // Tarea proveniente del Excel de Gestión: los cambios se guardan como override (tgOverrides)
        const overrides = FSLS.getJSON<Record<string, Record<string, unknown>>>('tgOverrides', {});
        const actual = overrides[I.tareaId] || {};
        if (miembro) actual.asignado = miembro;
        if (fechaDMY) actual.fecha = fechaDMY;
        if (notasT) actual.obs = notasT;
        if (estado) actual.estado = estado;
        overrides[I.tareaId] = actual;
        FSLS.setItem('tgOverrides', JSON.stringify(overrides));
      }
      showToast('✓ Tarea actualizada');
    } else {
      const id = 'port_' + Date.now();
      const nueva = buildTareaDesdeProc(procId, proc, {
        id, tipo, asignado: miembro || '—', agendadoPor: 'Roberto Matallana', fecha: fechaDMY, hora, estado, obs: notasT, origen: 'portal',
      });
      const arr = loadTareasGestion();
      arr.unshift(nueva);
      saveTareasGestion(arr);
      // Mover adjuntos temporales a la tarea creada
      const tmp = readAdj(I.adjKey);
      if (tmp.length) {
        FSLS.setItem('ptarea_adj_' + id, JSON.stringify(tmp));
        FSLS.removeItem('ptarea_adj_' + I.adjKey);
      }
      guardado.current = true;
      showToast('✓ Tarea creada correctamente');
    }
    guardado.current = true;
    onClose();
  };

  return (
    <div className="overlay show" onClick={(e) => { if (e.target === e.currentTarget) cerrar(); }}>
      <div className="ptarea-modal">
        <div className="ptarea-head">
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{I.title}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{I.sub}</div>
          </div>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)' }} onClick={cerrar}>✕</button>
        </div>
        <div className="ptarea-body">
          <div className="ptarea-field">
            <label>Proceso (ID o buscar)</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text" placeholder="Buscar cliente, expediente o ID..." autoComplete="off" style={{ flex: 1 }}
                value={procText} onChange={(e) => { setProcText(e.target.value); setDdOpen(true); }}
              />
              <span style={{ padding: '7px 10px', background: 'var(--gray-l)', borderRadius: 'var(--r)', fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', alignSelf: 'center' }}>{procLabel}</span>
            </div>
            {matches.length > 0 && (
              <div style={{ display: 'block', position: 'absolute', background: 'var(--white)', border: '1px solid var(--gray-b)', borderRadius: 'var(--r)', zIndex: 100, maxHeight: 160, overflowY: 'auto', boxShadow: 'var(--sh)', width: 340, fontSize: 12 }}>
                {matches.map((r) => (
                  <div
                    key={r.id}
                    style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid var(--gray-b)' }}
                    onMouseOver={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = ''; }}
                    onClick={() => { setProcSelId(r.id); setProcText(r.cliente); setProcLabel('#' + r.id); setDdOpen(false); }}
                  >
                    #{r.id} — <strong>{r.cliente.slice(0, 30)}</strong> <span style={{ color: 'var(--text4)', fontSize: 10.5 }}>{r.expediente}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="ptarea-row">
            <div className="ptarea-field">
              <label>Tipo de tarea</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="">Seleccionar...</option>
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="ptarea-field">
              <label>Estado</label>
              <select value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option>Pendiente</option><option>Completada</option><option>Cancelada</option>
              </select>
            </div>
          </div>

          <div className="ptarea-row">
            <div className="ptarea-field"><label>Fecha límite</label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
            <div className="ptarea-field"><label>Hora (opcional)</label><input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></div>
          </div>

          <div className="ptarea-field">
            <label>Asignado a</label>
            <div className="ptarea-members">
              {GCAL_MIEMBROS.map((m) => (
                <div key={m.nombre} className={'ptarea-member' + (m.nombre === miembro ? ' sel' : '')} onClick={() => setMiembro(m.nombre)}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: m.color, flexShrink: 0, display: 'inline-block' }}></span>
                  <span>{m.nombre.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="ptarea-field">
            <label>Notas / Observaciones</label>
            <MentionTextarea value={notas} onChange={setNotas} placeholder="Observaciones, instrucciones, contexto..." />
          </div>

          <div className="ptarea-field">
            <label>Adjuntos</label>
            <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={(e) => agregarAdjuntos(e.target.files)} />
            <button className="btn" onClick={() => fileRef.current?.click()} style={{ fontSize: 11.5, marginBottom: '.4rem' }}>📎 Adjuntar archivo</button>
            <div className="ptarea-adjuntos">
              {adj.map((a, i) => (
                <div className="ptarea-adj-item" key={a.ts + '_' + i}>
                  <span style={{ fontSize: 14 }}>{a.tipo.includes('image') ? '🖼️' : a.tipo.includes('pdf') ? '📄' : '📎'}</span>
                  <a href={a.data} download={a.nombre}>{a.nombre}</a>
                  <button className="ptarea-adj-del" onClick={() => borrarAdj(i)}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="ptarea-footer">
          <button className="btn" onClick={cerrar}>Cancelar</button>
          <button className="btn btn-dark" onClick={guardar}>💾 Guardar tarea</button>
        </div>
      </div>
    </div>
  );
}
