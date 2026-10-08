'use client';
import { useMemo, useState } from 'react';
import { showToast, usePortal } from '@/store/portal';
import { GCAL_MIEMBROS } from '@/lib/constants';
import {
  HORAS_DIA, dateFromISO, eliminarTareaGestion, getAllTareasGestion, getHorasTarea, isoLocal,
  loadTareasGestion, registrarEnPanel, saveTareasGestion, toISO, currentUserName,
  type DiligenciaTarea, type PlannerExcelTarea,
} from '@/lib/gestionD';

interface Item {
  id?: string; nroId?: number; nrotarea?: number; cliente?: string; expediente?: string; tipo?: string;
  asignado?: string; asignadoAlt?: string; fecha?: string; hora?: string;
  _src: 'portal' | 'excel'; _key: string; _plannerAsig?: string;
  [k: string]: unknown;
}

// Reasignaciones del planner (en memoria, como plannerReasignaciones del original): {tareaKey: nuevoAsignado}
const plannerReasignaciones: Record<string, string> = {};

/** Planner: filas = días, columnas = miembros; arrastrar y soltar para reasignar; carga horaria por persona. */
export default function PlannerPanel() {
  const rev = usePortal((s) => s.kvRev);
  const dataRev = usePortal((s) => s.dataRev);
  const plannerExcel = usePortal((s) => s.PLANNER_EXCEL_TAREAS);
  const dilis = usePortal((s) => s.DILIGENCIAS_GESTION_EXCEL);
  const procs = usePortal((s) => s.DATA);
  const tareasExcel = usePortal((s) => s.TAREAS_GESTION_EXCEL);

  const [dateStr, setDateStr] = useState(isoLocal(new Date())); // plannerToday() al entrar
  const [nDays, setNDays] = useState(7);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overCell, setOverCell] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const base = useMemo(() => dateFromISO(dateStr || isoLocal(new Date())), [dateStr]);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const dias = Array.from({ length: nDays }, (_, i) => { const d = new Date(base); d.setDate(base.getDate() + i); d.setHours(0, 0, 0, 0); return d; });
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  const lbl = dias[0].toLocaleDateString('es-PE', opts) + ' – ' + dias[dias.length - 1].toLocaleDateString('es-PE', opts);

  const nav = (d: number) => {
    const dt = new Date(base); dt.setDate(dt.getDate() + d * (nDays || 7)); setDateStr(isoLocal(dt));
  };

  // Todas las tareas: portal (con fecha) + tareas Excel pendientes del equipo Gestión
  const todasBase = useMemo<Item[]>(() => {
    void rev; void dataRev; void dilis; void procs; void tareasExcel;
    const portal: Item[] = getAllTareasGestion().filter((t) => t.fecha).map((t) => ({ ...(t as unknown as Item), _src: 'portal' as const, _key: 'portal_' + t.id }));
    const excel: Item[] = (plannerExcel as PlannerExcelTarea[]).map((t) => ({ ...(t as unknown as Item), _src: 'excel' as const, _key: t._key || 'excel_' + (t.nrotarea ?? '') }));
    return [...portal, ...excel];
  }, [rev, dataRev, plannerExcel, dilis, procs, tareasExcel]);
  // Aplicar reasignaciones del planner (memoria de sesión)
  const todas: Item[] = todasBase.map((t) => (plannerReasignaciones[t._key] ? { ...t, _plannerAsig: plannerReasignaciones[t._key] } : t));

  const abrirPlannerModal = (key: string) => {
    const st = usePortal.getState();
    if (key.startsWith('portal_')) {
      st.openModal('plannerTarea', { modo: 'editar', tareaId: key.replace('portal_', '') });
      return;
    }
    const nr = parseInt(key.replace('excel_', ''));
    const d = (st.DILIGENCIAS_GESTION_EXCEL as DiligenciaTarea[]).find((x) => x.nrotarea === nr);
    if (d) { st.openModal('diligencia', { tarea: d }); return; }
    const t = (st.PLANNER_EXCEL_TAREAS as PlannerExcelTarea[]).find((x) => x.nrotarea === nr);
    if (t) st.openModal('plannerTarea', { modo: 'excel', tarea: t });
  };

  const onDrop = (e: React.DragEvent, miembro: string) => {
    e.preventDefault();
    setOverCell(null);
    const key = dragKey;
    if (!key) return;
    plannerReasignaciones[key] = miembro;
    if (key.startsWith('portal_')) {
      const tId = key.replace('portal_', '');
      const arr = loadTareasGestion();
      const idx = arr.findIndex((t) => t.id === tId);
      if (idx >= 0) {
        const anterior = arr[idx].asignado;
        arr[idx].asignado = miembro;
        saveTareasGestion(arr);
        if (anterior !== miembro) {
          registrarEnPanel({
            tipo: 'gestion', origen: 'gestion', nroId: arr[idx].nroId || 0, nrotarea: arr[idx].nrotarea || 0,
            cliente: arr[idx].cliente || '—', expediente: arr[idx].expediente || '—', supervisor: arr[idx].supervisor || '—',
            texto: '↔ Reasignada (Planner): ' + (anterior || '—') + ' → ' + miembro,
            autor: currentUserName(), tareaId: tId, extra: { asignado: miembro },
          });
        }
      }
    }
    setDragKey(null);
    setTick((n) => n + 1);
    showToast('✓ Reasignada a ' + miembro + ' (original mantiene copia)');
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '.75rem', flexWrap: 'wrap' }}>
        <input
          type="date" value={dateStr} onChange={(e) => { if (e.target.value) setDateStr(e.target.value); }}
          style={{ padding: '5px 10px', borderRadius: 'var(--r)', border: '1px solid var(--gray-b)', fontSize: 12, fontFamily: 'var(--font)' }}
        />
        <button className="gcal-nav-btn" onClick={() => nav(-1)}>‹</button>
        <button className="gcal-nav-btn" onClick={() => setDateStr(isoLocal(new Date()))}>Hoy</button>
        <button className="gcal-nav-btn" onClick={() => nav(1)}>›</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{lbl}</span>
        <select
          value={nDays} onChange={(e) => setNDays(parseInt(e.target.value) || 7)}
          style={{ padding: '5px 10px', borderRadius: 'var(--r)', border: '1px solid var(--gray-b)', fontSize: 12, fontFamily: 'var(--font)' }}
        >
          <option value={1}>Ver: 1 día</option>
          <option value={3}>Ver: 3 días</option>
          <option value={7}>Ver: 7 días</option>
          <option value={14}>Ver: 14 días</option>
        </select>
      </div>
      <div className="planner-wrap">
        <table className="planner-table">
          <thead>
            <tr>
              <th style={{ minWidth: 80 }}>Fecha</th>
              {GCAL_MIEMBROS.map((m) => (
                <th key={m.nombre} style={{ minWidth: 190 }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: m.color, marginRight: 5 }}></span>
                  {m.nombre}
                  <div style={{ fontSize: 9, opacity: 0.6, fontWeight: 400 }}>{m.iniciales}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dias.map((dia) => {
              const dStr = isoLocal(dia);
              const esHoy = dia.toDateString() === hoy.toDateString();
              const nomDia = dia.toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short' });
              return (
                <tr key={dStr}>
                  <td className={'planner-date-col' + (esHoy ? ' hoy' : '')}>{nomDia}</td>
                  {GCAL_MIEMBROS.map((m) => {
                    const mNorm = m.nombre.trim().toLowerCase();
                    const propias = todas.filter((t) => {
                      const asig = (t.asignado || '').trim().toLowerCase();
                      const alt = (t.asignadoAlt || '').trim().toLowerCase();
                      const pAsig = t._plannerAsig ? t._plannerAsig.trim().toLowerCase() : '';
                      if (toISO(t.fecha) !== dStr) return false;
                      if (m.nombre === 'Team Gestión') {
                        const esOtro = GCAL_MIEMBROS.filter((x) => x.nombre !== 'Team Gestión')
                          .some((x) => x.nombre.toLowerCase() === asig || x.nombre.toLowerCase() === alt || x.nombre.toLowerCase() === pAsig);
                        return !esOtro && !!(asig || alt);
                      }
                      return asig === mNorm || alt === mNorm || pAsig === mNorm;
                    });
                    const horasTotal = propias.reduce((s, t) => s + getHorasTarea(t.tipo), 0);
                    const horasRed = Math.round(horasTotal * 10) / 10;
                    const pct = Math.min((horasTotal / HORAS_DIA) * 100, 100);
                    const clsFill = horasTotal > HORAS_DIA ? 'planner-load-over' : horasTotal >= HORAS_DIA * 0.8 ? 'planner-load-warn' : 'planner-load-ok';
                    const loadColor = horasTotal > HORAS_DIA ? 'var(--red)' : horasTotal >= HORAS_DIA * 0.8 ? 'var(--amber)' : 'var(--green)';
                    const cellKey = dStr + '|' + m.nombre;
                    return (
                      <td
                        key={m.nombre}
                        className={'planner-drop-zone' + (overCell === cellKey ? ' drag-over' : '')}
                        data-fecha={dStr} data-miembro={m.nombre}
                        onDragOver={(e) => { e.preventDefault(); if (overCell !== cellKey) setOverCell(cellKey); }}
                        onDragLeave={() => setOverCell((c) => (c === cellKey ? null : c))}
                        onDrop={(e) => onDrop(e, m.nombre)}
                      >
                        <div className="planner-cell-add" onClick={() => usePortal.getState().openModal('plannerTarea', { modo: 'nueva', fecha: dStr, miembro: m.nombre })}>＋ Nueva tarea</div>
                        {propias.map((t) => {
                          const asigOrig = (t.asignado || '').trim().toLowerCase();
                          const reasignada = !!t._plannerAsig && t._plannerAsig.trim().toLowerCase() !== asigOrig;
                          const esOriginal = reasignada && asigOrig === mNorm;
                          const tipoUp = (t.tipo || '').toUpperCase();
                          const tipoLabel = t.tipo ? (tipoUp.startsWith('DILIGENCIA -') ? 'Diligencia' : t.tipo.startsWith('Gestión') ? 'Gestión' : t.tipo.slice(0, 14)) : '—';
                          const cls = 'planner-card' + (esOriginal ? ' original' : reasignada ? ' reasignada' : '');
                          const bColor = t.tipo && tipoUp.startsWith('DILIGENCIA -') ? 'var(--amber)' : t.tipo && t.tipo.startsWith('Gestión') ? 'var(--green)' : 'var(--blue)';
                          const horas = getHorasTarea(t.tipo);
                          const horasLabel = horas >= 1 ? horas + 'h' : Math.round(horas * 60) + 'min';
                          return (
                            <div
                              key={t._key}
                              className={cls + (dragKey === t._key ? ' dragging' : '')}
                              draggable
                              onDragStart={(e) => { setDragKey(t._key); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t._key); }}
                              onDragEnd={() => { setDragKey(null); setOverCell(null); }}
                              onClick={(e) => { e.stopPropagation(); abrirPlannerModal(t._key); }}
                              style={{ borderLeftColor: bColor }}
                            >
                              {t._src === 'portal' && (
                                <button
                                  className="btn-redir btn-eliminar-tarea" data-tarea-id={t.id} title="Eliminar tarea"
                                  onClick={(e) => { e.stopPropagation(); if (t.id) eliminarTareaGestion(t.id); }}
                                  style={{ position: 'absolute', top: 3, right: 3, width: 16, height: 16, lineHeight: '14px', padding: 0, fontSize: 9, border: 'none', borderRadius: 3, background: 'var(--red)', color: '#fff', opacity: 0.55, cursor: 'pointer' }}
                                >🗑</button>
                              )}
                              <div className="planner-card-tipo">{tipoLabel}{esOriginal ? ' · original' : ''}{reasignada && !esOriginal ? ' · reasignada' : ''}</div>
                              <div className="planner-card-cliente">{t.cliente || '—'}</div>
                              <div className="planner-card-tipo-full">{t.tipo || ''}</div>
                              <div className="planner-card-meta">
                                {t.hora ? <><span className="planner-card-hora">{t.hora}</span> · </> : null}{t.expediente ? t.expediente : ''}
                              </div>
                              <div className="planner-card-hours">⏱ {horasLabel}</div>
                              {t.asignadoAlt && t.asignadoAlt !== t.asignado ? <div style={{ fontSize: 9, color: 'var(--purple)', marginTop: 2 }}>Alt: {t.asignadoAlt}</div> : null}
                            </div>
                          );
                        })}
                        {propias.length > 0 && (
                          <div style={{ padding: '4px 6px', marginTop: 4, background: 'var(--gray-l)', borderRadius: 4, borderTop: '1px solid var(--gray-b)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, fontWeight: 600, color: loadColor }}>
                              <span>Total del día</span><span>{horasRed} / {HORAS_DIA}h</span>
                            </div>
                            <div className="planner-load-bar"><div className={'planner-load-fill ' + clsFill} style={{ width: pct + '%' }}></div></div>
                            {horasTotal > HORAS_DIA && <div style={{ fontSize: 9, color: 'var(--red)', fontWeight: 600 }}>⚠ +{Math.round((horasTotal - HORAS_DIA) * 10) / 10}h sobre el límite</div>}
                            {horasTotal < HORAS_DIA && <div style={{ fontSize: 9, color: 'var(--text4)' }}>Disponible: {Math.round((HORAS_DIA - horasTotal) * 10) / 10}h</div>}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
