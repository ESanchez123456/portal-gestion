'use client';
// Modal agregar/editar magistrado (HTML 2197-2247; JS abrirModalJuzgado/guardarJuzgadoModal/borrarJuzgadoModal).
// payload: { id?, organoPre?, distritoPre?, tipoPre? }
import { useEffect, useMemo, useState } from 'react';
import { usePortal, showToast } from '@/store/portal';
import { esAdmin } from '@/lib/audit';
import { getJuzgados } from '@/lib/juzgados';
import { guardarJuzgado, borrarJuzgado } from '@/lib/juzgadosAdmin';

interface Payload { id?: string | null; organoPre?: string; distritoPre?: string; tipoPre?: string }

export default function JuzgadoModal({ payload, onClose }: { payload: unknown; onClose: () => void }) {
  const p = (payload && typeof payload === 'object' ? payload : {}) as Payload;
  usePortal((s) => s.kvRev);
  const id = p.id || '';
  const arr = getJuzgados();
  const row = id ? arr.find((j) => j.id === id) : undefined;

  const [distrito, setDistrito] = useState(row ? row.distrito || '' : p.distritoPre || '');
  const [tipo, setTipo] = useState(row ? row.tipoJuzgado || '' : p.tipoPre || '');
  const [organo, setOrgano] = useState(row ? row.organo || '' : p.organoPre || '');
  const [magistrado, setMagistrado] = useState(row ? row.magistrado || '' : '');
  const [condicion, setCondicion] = useState(row ? row.condicion || '' : '');
  const [encargado, setEncargado] = useState(row ? row.encargado || '' : '');

  // Editar sin permisos o fila inexistente: el original no abre el modal.
  const bloqueado = !!id && (!esAdmin() || !row);
  useEffect(() => {
    if (id && !esAdmin()) showToast('⚠ Solo el administrador puede editar o eliminar juzgados');
    if (id && !row) onClose();
    else if (id && !esAdmin()) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dl = useMemo(() => {
    const uniq = (xs: (string | undefined)[]) => Array.from(new Set(xs.filter(Boolean) as string[])).sort();
    return {
      distritos: uniq(arr.map((j) => j.distrito)),
      tipos: uniq(arr.map((j) => j.tipoJuzgado)),
      organos: uniq(arr.map((j) => j.organo)),
      encargados: ['ATG', 'CMP', 'RMR', 'SMO'].concat(uniq(arr.map((j) => j.encargado))).filter((v, i, a) => a.indexOf(v) === i),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (bloqueado) return null;

  const guardar = () => {
    if (guardarJuzgado(id, { distrito, tipoJuzgado: tipo, organo, magistrado, condicion, encargado })) onClose();
  };
  const borrar = () => {
    if (!id) return;
    onClose();
    borrarJuzgado(id);
  };

  return (
    <div className="overlay show" id="modalJuzgado" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 480 }}>
        <div className="modal-title" id="juz-modal-title">{id ? 'Editar magistrado' : 'Agregar magistrado'}</div>
        <div className="modal-sub">Esta información se guarda en línea y la ven los 8 usuarios del portal.</div>
        <div className="juz-form-row">
          <div className="juz-field">
            <label>Distrito</label>
            <input type="text" list="juz-dl-distrito" placeholder="Ej. LIMA" value={distrito} onChange={(e) => setDistrito(e.target.value)} />
            <datalist id="juz-dl-distrito">{dl.distritos.map((d) => <option key={d} value={d} />)}</datalist>
          </div>
          <div className="juz-field">
            <label>Tipo de juzgado</label>
            <input type="text" list="juz-dl-tipo" placeholder="Ej. JUZGADO LABORAL" value={tipo} onChange={(e) => setTipo(e.target.value)} />
            <datalist id="juz-dl-tipo">{dl.tipos.map((d) => <option key={d} value={d} />)}</datalist>
          </div>
        </div>
        <div className="juz-field">
          <label>Órgano jurisdiccional</label>
          <input type="text" list="juz-dl-organo" placeholder="Ej. 5° JUZGADO ESPECIALIZADO DE TRABAJO" value={organo} onChange={(e) => setOrgano(e.target.value)} />
          <datalist id="juz-dl-organo">{dl.organos.map((d) => <option key={d} value={d} />)}</datalist>
        </div>
        <div className="juz-field">
          <label>Magistrado (nombre y apellido)</label>
          <input type="text" placeholder="Ej. PEREZ GOMEZ JUAN CARLOS" value={magistrado} onChange={(e) => setMagistrado(e.target.value)} />
        </div>
        <div className="juz-form-row">
          <div className="juz-field">
            <label>Condición</label>
            <select value={condicion} onChange={(e) => setCondicion(e.target.value)}>
              <option value="">— Sin dato —</option>
              <option value="TITULAR">Titular</option>
              <option value="PROVISIONAL">Provisional</option>
              <option value="SUPERNUMERARIO">Supernumerario</option>
              <option value="PERMANENTE">Permanente</option>
            </select>
          </div>
          <div className="juz-field">
            <label>Encargado de gestión</label>
            <input type="text" list="juz-dl-encargado" placeholder="Iniciales, ej. RMR" value={encargado} onChange={(e) => setEncargado(e.target.value)} />
            <datalist id="juz-dl-encargado">{dl.encargados.map((d) => <option key={d} value={d} />)}</datalist>
          </div>
        </div>
        <div className="modal-actions">
          {id ? <button className="btn" style={{ color: 'var(--red)', borderColor: 'var(--red-b)', background: 'var(--red-l)', marginRight: 'auto' }} onClick={borrar}>🗑 Eliminar</button> : null}
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-dark" onClick={guardar}>💾 Guardar</button>
        </div>
      </div>
    </div>
  );
}
