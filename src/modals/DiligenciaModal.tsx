'use client';
import { useMemo, useState } from 'react';
import { showToast, usePortal } from '@/store/portal';
import MentionTextarea from '@/components/MentionTextarea';
import { GCAL_MIEMBROS } from '@/lib/constants';
import {
  bumpDiligencias, getDiliNotas, loadTareasGestion, registrarEnPanel, saveDiliNotas, saveTareasGestion,
  type DiligenciaPayload, type DiligenciaTarea,
} from '@/lib/gestionD';

/**
 * Modal de diligencia (legacy abrirDiligencia / confirmarReasigDili / guardarDiligencia).
 * Abrir: usePortal.getState().openModal('diligencia', payload) con payload: DiligenciaPayload
 *   - { tarea: DiligenciaTarea }  (objeto de DILIGENCIAS_GESTION_EXCEL o tarea del portal con _esPortal/_portalId)
 *   - { nrotarea: number }        (se busca en DILIGENCIAS_GESTION_EXCEL)
 *   - o directamente el objeto DiligenciaTarea.
 */
function resolver(payload: unknown): DiligenciaTarea | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (p.tarea && typeof p.tarea === 'object') return p.tarea as DiligenciaTarea;
  const dilis = usePortal.getState().DILIGENCIAS_GESTION_EXCEL as DiligenciaTarea[];
  if (typeof p.nrotarea === 'number' && !('tipo' in p)) return dilis.find((d) => d.nrotarea === p.nrotarea) || null;
  if ('tipo' in p || 'cliente' in p) return p as DiligenciaTarea;
  return null;
}

export default function DiligenciaModal({ payload, onClose }: { payload: unknown; onClose: () => void }) {
  usePortal((s) => s.kvRev);
  const t = useMemo(() => resolver(payload as DiligenciaPayload), [payload]);
  const proc = usePortal((s) => (t ? s.DATA.find((r) => r.id === t.nroId) : undefined));

  const [asignado, setAsignado] = useState(t?.asignado || '');
  const [reasignado, setReasignado] = useState(false);
  const [nuevoAsig, setNuevoAsig] = useState<string | null>(null);
  const saved = useMemo(() => (t ? getDiliNotas(t.nrotarea) : { notas: '', obsCid: '' }), [t]);
  const [notas, setNotas] = useState(saved.notas);
  const [obsCid, setObsCid] = useState(saved.obsCid);

  if (!t) return null;

  const tipo = t.tipo || '';
  const sup = t.supervisor || (proc ? proc.supervisor : '—');
  const estadoColor = t.estado === 'Pendiente' ? 'var(--amber)' : t.estado === 'Cumplida' ? 'var(--green)' : 'var(--text3)';
  const tipoAud = tipo.replace('DILIGENCIA - ', '');
  const nt = (t.notas || t.comentarios || '').toLowerCase();
  const esVirtual = nt.includes('meet.google') || nt.includes('zoom') || nt.includes('teams');
  const relev = proc ? proc.relevancia : t.relevancia || '';
  const esDist = !!nuevoAsig && nuevoAsig !== asignado;

  const confirmarReasig = () => {
    if (!nuevoAsig || nuevoAsig === asignado) return;
    t.asignado = nuevoAsig; // se muta el objeto, igual que el original (src[gi].asignado = ...)
    if (t._esPortal && t._portalId) {
      const arr = loadTareasGestion();
      const idx = arr.findIndex((x) => x.id === t._portalId);
      if (idx >= 0) { arr[idx].asignado = nuevoAsig; saveTareasGestion(arr); }
    }
    setAsignado(nuevoAsig);
    setNuevoAsig(null);
    setReasignado(true);
    bumpDiligencias(); // re-render de Calendario / Planner / Gestión
    showToast('✓ Reasignado a ' + nuevoAsig);
  };

  const guardar = () => {
    const n = notas.trim(); const o = obsCid.trim();
    saveDiliNotas(t.nrotarea, { notas: n, obsCid: o });
    if (o) {
      registrarEnPanel({
        tipo: 'dili', nroId: t.nroId || 0, nrotarea: t.nrotarea || 0, cliente: t.cliente || '—', expediente: t.expediente || '—',
        supervisor: t.supervisor || '—', texto: o, autor: t.asignado || '—', extra: { tipoAud: t.tipo, notas: n },
      });
    }
    onClose();
    showToast('✓ Notas guardadas');
  };

  return (
    <div className="overlay show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dili-modal">
        <div className="dili-modal-head">
          <div className="dili-sup-chip">Sup: {sup}</div>
          <button className="dili-modal-close" onClick={onClose}>✕</button>
          <div className="dili-modal-title">{t.tipo || 'Diligencia'}</div>
          <div className="dili-modal-sub">
            {t.fecha || '—'}{t.hora ? ' · ' + t.hora : ''}
            {t.nrotarea ? <> · <a className="id-link" href={'https://vinatea.mybig.com.ar/tareas/' + t.nrotarea + '/edit/'} target="_blank" rel="noreferrer">#{t.nrotarea}</a></> : null}
          </div>
        </div>
        <div className="dili-body">
          <div className="dili-grid">
            <div className="dili-field dili-field-full"><label>Cliente</label><span>{t.cliente || '—'}</span></div>
            <div className="dili-field"><label>Expediente</label><span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{t.expediente || '—'}</span></div>
            <div className="dili-field"><label>Órgano</label><span style={{ fontSize: 11 }}>{t.organo || (proc ? proc.organo : '') || '—'}</span></div>
            <div className="dili-field"><label>Tarea</label><span>{t.tipo || '—'}</span></div>
            <div className="dili-field"><label>Estado</label><span><span style={{ color: estadoColor, fontWeight: 600 }}>{t.estado || '—'}</span></span></div>
            <div className="dili-field">
              <label>Tipo audiencia</label>
              <span>
                {tipoAud}
                {esVirtual && <> <span className="badge" style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontSize: 9.5 }}>💻 VIRTUAL</span></>}
              </span>
            </div>
            <div className="dili-field">
              <label>Relevancia</label>
              <span>
                {relev === 'SENSIBLE'
                  ? <span className="badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', fontSize: 9.5 }}>⚠ SENSIBLE</span>
                  : (relev || '—')}
              </span>
            </div>
            <div className="dili-field"><label>Pacto</label><span>{proc ? proc.pacto || '—' : '—'}</span></div>
            <div className="dili-field"><label>Materia</label><span>{t.materia || '—'}</span></div>
            <div className="dili-field"><label>Submateria</label><span>{t.submateria || '—'}</span></div>
            <div className="dili-field"><label>Supervisor</label><span>{sup || '—'}</span></div>
            <div className="dili-field"><label>Responsable proceso</label><span>{t.responsable || (proc ? proc.responsable : '') || '—'}</span></div>
          </div>

          <div className="dili-reasig-wrap">
            <div className="dili-reasig-label">
              Responsable actual
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 12, textTransform: 'none', letterSpacing: 0 }}>{asignado || '—'}</span>
                <button
                  className="btn-sm" onClick={confirmarReasig} disabled={!esDist}
                  style={{ background: 'var(--dark)', color: '#fff', borderColor: 'var(--dark)', opacity: esDist ? 1 : 0.4, pointerEvents: esDist ? undefined : 'none' }}
                >→ Reasignar</button>
              </div>
            </div>
            <div className="dili-members">
              {GCAL_MIEMBROS.map((m) => {
                const actual = !reasignado && m.nombre === asignado;
                return (
                  <div key={m.nombre} className={'dili-member' + (actual ? ' current' : '') + (nuevoAsig === m.nombre ? ' selected' : '')} onClick={() => setNuevoAsig(m.nombre)}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, flexShrink: 0, display: 'inline-block' }}></span>
                    <div>
                      <div className="dili-member-name">{m.nombre}{actual && <> <span style={{ color: 'var(--text4)', fontSize: 10, fontWeight: 400 }}>(actual)</span></>}</div>
                      <div className="dili-member-tag">{m.iniciales}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: '.75rem' }}>
            <div className="dili-notes-label">Notas CID</div>
            <MT value={notas} onChange={setNotas} placeholder="Agrega observaciones sobre esta diligencia..." />
          </div>
          <div>
            <div className="dili-notes-label">Observación para CID <span className="dili-notes-sub">(aparecerá en Panel de Control)</span></div>
            <MT value={obsCid} onChange={setObsCid} placeholder="Escribe aquí tu consulta u observación para el equipo CID..." />
          </div>
        </div>
        <div className="dili-footer">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-dark" onClick={guardar}>💾 Guardar</button>
        </div>
      </div>
    </div>
  );
}

function MT(p: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <MentionTextarea className="dili-textarea" {...p} />;
}
