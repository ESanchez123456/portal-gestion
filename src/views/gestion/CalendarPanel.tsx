'use client';
import { useMemo, useState } from 'react';
import { usePortal } from '@/store/portal';
import { GCAL_HORAS, GCAL_MIEMBROS } from '@/lib/constants';
import { parseFechaTarea } from '@/lib/utils';
import { dateFromISO, getAllTareasGestion, isoLocal, type DiligenciaTarea } from '@/lib/gestionD';

// Estado que persiste entre montajes (en el original gcalView/gcalDate eran globales)
let gcalViewPersist: 'dia' | 'sem' = 'dia';
let gcalDatePersist = '';

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const ymd = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const norm = (s?: string) => (s || '').trim().toLowerCase();

/** Calendario estilo Google (vistas Día / Semana). Portado de renderGCal (legacy 4762-4945). */
export default function CalendarPanel() {
  const rev = usePortal((s) => s.kvRev);
  const dataRev = usePortal((s) => s.dataRev);
  const dilis = usePortal((s) => s.DILIGENCIAS_GESTION_EXCEL);
  const tareasExcel = usePortal((s) => s.TAREAS_GESTION_EXCEL);
  const procs = usePortal((s) => s.DATA);

  const [view, setViewS] = useState<'dia' | 'sem'>(gcalViewPersist);
  const [dateStr, setDateS] = useState<string>(gcalDatePersist || isoLocal(new Date()));
  const setView = (v: 'dia' | 'sem') => { gcalViewPersist = v; setViewS(v); };
  const setDate = (s: string) => { gcalDatePersist = s; setDateS(s); };

  const gcalDate = useMemo(() => dateFromISO(dateStr || isoLocal(new Date())), [dateStr]);

  // Diligencias del Excel + tareas agendadas desde el portal (con fecha)
  const tareas = useMemo<DiligenciaTarea[]>(() => {
    void rev; void dataRev; void tareasExcel; void procs;
    const portal: DiligenciaTarea[] = getAllTareasGestion().filter((t) => t.fecha).map((t) => ({
      nroId: t.nroId, nrotarea: t.nrotarea || 0, cliente: t.cliente || '—', expediente: t.expediente || '—',
      tipo: (t.tipo || '').replace('Gestión - ', ''), asignado: t.asignado || '—', responsable: t.responsable || '—',
      supervisor: t.supervisor || '—', organo: t.organo || '—', materia: '', submateria: '', notas: t.obs || '',
      comentarios: '', fecha: t.fecha, hora: t.hora || '', estado: t.estado || 'Pendiente', _esPortal: true, _portalId: t.id,
    }));
    return [...(dilis as DiligenciaTarea[]).filter((t) => t.fecha), ...portal];
  }, [dilis, rev, dataRev, tareasExcel, procs]);

  const nav = (d: number) => {
    const dt = new Date(gcalDate);
    dt.setDate(dt.getDate() + (view === 'dia' ? d : d * 7));
    setDate(isoLocal(dt));
  };
  const abrir = (t: DiligenciaTarea) => usePortal.getState().openModal('diligencia', { tarea: t });

  let lbl = '';
  let tabla: React.ReactNode = null;

  if (view === 'dia') {
    const ds = gcalDate.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    lbl = ds.charAt(0).toUpperCase() + ds.slice(1);
    const dStr = ymd(gcalDate);
    // slotMap[miembroIdx][hora | 'sin-hora'] = tareas
    const slotMap: Record<string, DiligenciaTarea[]>[] = GCAL_MIEMBROS.map(() => ({}));
    tareas.forEach((t) => {
      const ft = parseFechaTarea(t.fecha);
      if (!ft) return;
      if (ymd(ft) !== dStr) return;
      const mi = GCAL_MIEMBROS.findIndex((m) => norm(m.nombre) === norm(t.asignado));
      if (mi < 0) return;
      if (t.hora) {
        const [hh, mm] = t.hora.split(':').map(Number);
        const slot = hh + ':' + (mm < 30 ? '00' : '30');
        (slotMap[mi][slot] = slotMap[mi][slot] || []).push(t);
      } else {
        (slotMap[mi]['sin-hora'] = slotMap[mi]['sin-hora'] || []).push(t);
      }
    });
    const haySinHora = GCAL_MIEMBROS.some((_, mi) => slotMap[mi]['sin-hora'] && slotMap[mi]['sin-hora'].length);
    tabla = (
      <>
        <thead>
          <tr>
            <th className="hora-col">Hora</th>
            {GCAL_MIEMBROS.map((m) => (
              <th key={m.nombre} style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, color: '#fff' }}>{m.iniciales}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)' }}>{m.nombre.split(' ')[0]}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {haySinHora && (
            <tr style={{ background: '#fffbeb' }}>
              <td className="hora-cell" style={{ color: 'var(--amber)', fontSize: 10 }}>Sin hora</td>
              {GCAL_MIEMBROS.map((m, mi) => {
                const eventos = slotMap[mi]['sin-hora'] || [];
                return (
                  <td key={m.nombre} className="gcal-slot" style={{ background: eventos.length ? '#fffbeb' : undefined, verticalAlign: 'top' }}>
                    {eventos.map((t, k) => (
                      <div key={k} className={'gcal-event ' + m.cls} style={{ cursor: 'pointer', borderLeftColor: t._esPortal ? 'var(--green)' : 'var(--amber)' }} onClick={() => abrir(t)}>
                        <div className="gcal-event-title">{(t.tipo || '').slice(0, 26)}</div>
                        <div className="gcal-event-sub">{t.cliente || ''}</div>
                      </div>
                    ))}
                  </td>
                );
              })}
            </tr>
          )}
          {GCAL_HORAS.map((hora) => {
            const isHalf = hora.includes(':30');
            return (
              <tr key={hora} className={isHalf ? 'half-hour' : ''}>
                <td className="hora-cell">{hora}</td>
                {GCAL_MIEMBROS.map((m, mi) => {
                  const eventos = slotMap[mi][hora] || [];
                  return (
                    <td key={m.nombre} className={'gcal-slot' + (eventos.length ? ' gcal-slot-occ' : '')} style={{ verticalAlign: 'top' }}>
                      {eventos.map((t, k) => (
                        <div
                          key={k}
                          className={t._esPortal ? 'gcal-event gcal-AT' : 'gcal-event ' + m.cls}
                          style={{ cursor: 'pointer', opacity: t.estado === 'Cancelada' ? 0.5 : undefined, borderLeftColor: t._esPortal ? 'var(--amber)' : undefined }}
                          onClick={() => abrir(t)}
                        >
                          <div className="gcal-event-title">{(t.tipo || '').slice(0, 26)}</div>
                          <div className="gcal-event-sub">{t.cliente || ''}</div>
                        </div>
                      ))}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </>
    );
  } else {
    const lunes = new Date(gcalDate);
    lunes.setDate(gcalDate.getDate() - ((gcalDate.getDay() + 6) % 7));
    const dias = Array.from({ length: 7 }, (_, i) => { const d = new Date(lunes); d.setDate(lunes.getDate() + i); return d; });
    lbl = 'Semana del ' + lunes.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) + ' al ' + dias[6].toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
    tabla = (
      <>
        <thead>
          <tr>
            <th className="hora-col">Hora</th>
            {dias.map((d) => (
              <th key={ymd(d)} colSpan={GCAL_MIEMBROS.length} style={{ textAlign: 'center', fontSize: 10.5 }}>
                {DIAS_SEMANA[d.getDay()].slice(0, 3).toUpperCase() + ' ' + d.getDate()}
              </th>
            ))}
          </tr>
          <tr>
            <th></th>
            {dias.map((d) => GCAL_MIEMBROS.map((m) => (
              <th key={ymd(d) + m.iniciales} style={{ fontSize: 9, padding: '4px 3px', color: 'rgba(255,255,255,.5)' }}>{m.iniciales}</th>
            )))}
          </tr>
        </thead>
        <tbody>
          {GCAL_HORAS.filter((h) => !h.includes(':30')).map((hora) => (
            <tr key={hora}>
              <td className="hora-cell">{hora}</td>
              {dias.map((d) => {
                const dStr = ymd(d);
                return GCAL_MIEMBROS.map((m) => {
                  const eventos = tareas.filter((t) => {
                    if (!t.asignado) return false;
                    if (norm(m.nombre) !== norm(t.asignado)) return false;
                    const ft = parseFechaTarea(t.fecha);
                    if (!ft) return false;
                    if (ymd(ft) !== dStr) return false;
                    if (t.hora) { const [hh] = t.hora.split(':').map(Number); return hh + ':00' === hora; }
                    return hora === '9:00';
                  });
                  if (eventos.length) {
                    return (
                      <td key={dStr + m.iniciales} className="gcal-slot gcal-slot-occ" title={eventos[0].tipo} style={{ padding: 2 }}>
                        <div className={'gcal-event ' + m.cls} style={{ fontSize: 9, padding: '2px 4px', cursor: 'pointer' }} onClick={() => abrir(eventos[0])}>
                          <div className="gcal-event-title" style={{ fontSize: 9 }}>{(eventos[0].cliente || '').slice(0, 12)}</div>
                        </div>
                      </td>
                    );
                  }
                  return <td key={dStr + m.iniciales} className="gcal-slot"></td>;
                });
              })}
            </tr>
          ))}
        </tbody>
      </>
    );
  }

  return (
    <div className="gcal-wrap">
      <div className="gcal-header">
        <button className={'gcal-nav-btn' + (view === 'dia' ? ' active' : '')} onClick={() => setView('dia')}>Día</button>
        <button className={'gcal-nav-btn' + (view === 'sem' ? ' active' : '')} onClick={() => setView('sem')}>Semana</button>
        <input
          type="date" value={dateStr}
          onChange={(e) => { if (e.target.value) setDate(e.target.value); }}
          style={{ padding: '4px 8px', borderRadius: 'var(--r)', border: '1px solid var(--gray-b)', fontSize: 12, fontFamily: 'var(--font)' }}
        />
        <button className="gcal-nav-btn" onClick={() => nav(-1)}>‹</button>
        <button className="gcal-nav-btn" onClick={() => setDate(isoLocal(new Date()))}>Hoy</button>
        <button className="gcal-nav-btn" onClick={() => nav(1)}>›</button>
        <span className="gcal-date-lbl">{lbl}</span>
        <div className="gcal-legend">
          {[['#4f46e5', 'A. Trelles'], ['#2563eb', 'C. Morales'], ['#7c3aed', 'JJ. Edquen'], ['#dc2626', 'R. Matallana'], ['#16a34a', 'S. Maldonado'], ['#ca8a04', 'T. León']].map(([c, n]) => (
            <span key={n} className="gcal-legend-item"><span className="gcal-legend-dot" style={{ background: c }}></span> {n}</span>
          ))}
        </div>
      </div>
      <div className="gcal-table-wrap">
        <table className="gcal-table">{tabla}</table>
      </div>
    </div>
  );
}
