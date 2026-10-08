'use client';
// Badges y celdas reutilizables de las tablas Reporte total / Próximas audiencias.
import type { CSSProperties, ReactNode } from 'react';
import { colorEncargado } from '@/lib/juzgados';
import type { TareaGestion } from '@/types';

export function InstBadge({ i }: { i?: string }) {
  const m: Record<string, [string, string]> = { 'PRIMERA INSTANCIA': ['b-b', '1ra'], 'SEGUNDA INSTANCIA': ['b-p', '2da'], 'TERCERA INSTANCIA': ['b-a', '3ra'], 'EJECUCIÓN': ['b-g', 'Ejec.'] };
  const [c, t] = (i && m[i]) || ['b-n', i || '—'];
  return <span className={'badge ' + c}>{t}</span>;
}
export function SitBadge({ s }: { s?: string }) {
  return s === 'EJECUCION' ? <span className="badge b-g">Ejec.</span> : <span className="badge b-b">En giro</span>;
}
export function RelBadge({ r }: { r?: string }) {
  return r === 'SENSIBLE' ? <span className="badge b-r">Sensible</span> : <span style={{ color: 'var(--text4)' }}>—</span>;
}
export const Dash = () => <span style={{ color: 'var(--text4)' }}>—</span>;

/** <td> de texto con title y ancho máximo (equivale a tdT). */
export function TdT({ v, w, c, style }: { v?: string; w?: number; c?: string; style?: CSSProperties }) {
  return <td className={c} style={w ? { maxWidth: w, ...style } : style} title={v || ''}>{v || ''}</td>;
}

/** Chips de encargados de gestión de un órgano (juz-chip-mini). */
export function ChipsEncargados({ encs }: { encs: string[] }) {
  if (!encs.length) return null;
  return (
    <div style={{ display: 'flex', gap: 3, marginTop: 3, flexWrap: 'wrap' }}>
      {encs.map((e) => (
        <span key={e} className="juz-chip-mini" style={{ background: colorEncargado(e) }} title={'Encargado de gestión de este juzgado: ' + e}>{e}</span>
      ))}
    </div>
  );
}
/** <td> de órgano con chips de encargado (equivale a tdOrgano). */
export function TdOrgano({ v, w, c, encs }: { v?: string; w?: number; c?: string; encs: string[] }) {
  return (
    <td className={c} style={w ? { maxWidth: w } : undefined} title={v || ''}>
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v || ''}</div>
      <ChipsEncargados encs={encs} />
    </td>
  );
}

/** Celda "Próxima tarea". */
export function CeldaTarea({ tarea, nota, fecha }: { tarea?: string; nota?: string; fecha?: string }) {
  if (!tarea) return <Dash />;
  return (
    <>
      <span className="badge b-d" title={nota || ''}>{tarea}</span>
      {fecha ? <><br /><span style={{ color: 'var(--text4)', fontSize: 10 }}>{fecha}</span></> : null}
    </>
  );
}

// ── Tooltip y badge de Tareas de Gestión (getGestionBadge / showGestionTooltip) ──
function ensureTooltip(): HTMLElement {
  let t = document.getElementById('gestion-tooltip-box');
  if (!t) {
    t = document.createElement('div');
    t.id = 'gestion-tooltip-box';
    t.className = 'gestion-tooltip-box';
    document.body.appendChild(t);
    document.addEventListener('scroll', hideGestionTooltip, true);
  }
  return t;
}
export function hideGestionTooltip() {
  const box = document.getElementById('gestion-tooltip-box');
  if (box) box.classList.remove('show');
}
export function showGestionTooltip(el: HTMLElement, tareas: TareaGestion[]) {
  if (!tareas.length) return;
  const box = ensureTooltip();
  box.textContent = '';
  const mk = (tag: string, cls?: string, text?: string, style?: Partial<CSSStyleDeclaration>) => {
    const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text;
    if (style) Object.assign(e.style, style); return e;
  };
  box.appendChild(mk('div', '', 'Tareas de Gestión (' + tareas.length + ')', {
    fontSize: '10px', fontWeight: '600', color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '5px',
  }));
  tareas.slice(0, 6).forEach((t) => {
    const estadoColor = t.estado === 'Pendiente' ? '#fbbf24' : t.estado === 'Completada' ? '#34d399' : '#f87171';
    const row = mk('div', 'gestion-tooltip-row');
    row.appendChild(mk('div', 'gestion-tooltip-tipo', (t.tipo || '').replace('Gestión - ', '')));
    const meta = mk('div', 'gestion-tooltip-meta');
    meta.appendChild(mk('span', '', '👤 ' + (t.asignado || '—')));
    if (t.fecha) meta.appendChild(mk('span', '', '📅 ' + t.fecha));
    meta.appendChild(mk('span', '', '● ' + t.estado, { color: estadoColor }));
    row.appendChild(meta);
    box.appendChild(row);
  });
  if (tareas.length > 6) {
    box.appendChild(mk('div', '', '+ ' + (tareas.length - 6) + ' tarea(s) más', { paddingTop: '5px', color: 'rgba(255,255,255,.4)', fontSize: '10px' }));
  }
  const rect = el.getBoundingClientRect();
  box.style.top = (rect.bottom + 6) + 'px';
  box.style.left = Math.min(rect.left, window.innerWidth - 380) + 'px';
  box.classList.add('show');
}

/** <td> con el indicador "⚡ Gestión" / "✓ Gestión" de tareas agendadas del proceso. */
export function GestionBadgeTd({ tareas }: { tareas?: TareaGestion[] }) {
  if (!tareas || !tareas.length) return <td className="td-gestion-ind"></td>;
  const pend = tareas.filter((t) => t.estado === 'Pendiente').length;
  const cls = pend > 0 && tareas.length > 1 ? 'gestion-badge multiple' : 'gestion-badge';
  const label: ReactNode = pend > 0 ? '⚡ Gestión' : '✓ Gestión';
  return (
    <td className="td-gestion-ind">
      <span className={cls} onMouseEnter={(e) => showGestionTooltip(e.currentTarget, tareas)} onMouseLeave={hideGestionTooltip}>{label}</span>
    </td>
  );
}
