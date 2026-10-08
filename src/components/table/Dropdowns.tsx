'use client';
// Filtros desplegables de las tablas: FddMulti (filtro múltiple "fdd") y ColFilter (dropdown de valores por columna "cvd").
import { useEffect, useId, useState, type ReactNode } from 'react';

const EVT = 'portal-dd-open';
/** Estado abierto/cerrado de un dropdown: solo uno abierto por tipo y se cierra al hacer clic fuera. */
function useDropdown(kind: 'fdd' | 'cvd') {
  const id = useId();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOther = (e: Event) => { const d = (e as CustomEvent<{ kind: string; id: string }>).detail; if (d.kind === kind && d.id !== id) setOpen(false); };
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Element | null; if (!t || !t.closest) return;
      if (kind === 'fdd') { if (!t.closest('.fdd') && !t.closest('.col-val-dropdown')) setOpen(false); }
      else if (!t.closest('.col-filter-wrap')) setOpen(false);
    };
    window.addEventListener(EVT, onOther); document.addEventListener('click', onDoc);
    return () => { window.removeEventListener(EVT, onOther); document.removeEventListener('click', onDoc); };
  }, [id, kind]);
  const toggle = () => {
    if (!open) window.dispatchEvent(new CustomEvent(EVT, { detail: { kind, id } }));
    setOpen(!open);
  };
  return { open, setOpen, toggle };
}

const CheckMark = () => (
  <div className="fdd-check"><svg className="fdd-check-mark" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
);

export interface FddOpt {
  key: string; label: string;
  /** clase de color del ítem (c-red, c-green, c-blue, c-amber, c-purple) */
  cls?: string;
  /** color del punto (fdd-dot) */
  dot?: string;
  /** trunca la etiqueta a N caracteres (ítems largos de lista buscable) y muestra el título completo */
  trunc?: number;
  /** ancho máximo del ítem con elipsis */
  maxWidth?: number;
}

export interface FddMultiProps {
  label: string;
  selected: Set<string>;
  onToggle: (key: string) => void;
  onClear: () => void;
  opts: FddOpt[];
  minWidth?: number;
  /** si se define, muestra un buscador interno con este placeholder y limita el alto con scroll */
  searchPlaceholder?: string;
}

/** Píldora desplegable de selección múltiple. */
export function FddMulti({ label, selected, onToggle, onClear, opts, minWidth, searchPlaceholder }: FddMultiProps) {
  const { open, toggle } = useDropdown('fdd');
  const [needle, setNeedle] = useState('');
  const n = selected.size;
  const nl = needle.toLowerCase();
  return (
    <div className={'fdd' + (open ? ' open' : '')}>
      <div className="fdd-btn" onClick={toggle} style={n > 0 ? { borderColor: 'var(--dark)', color: 'var(--dark)' } : undefined}>
        {label}
        <span className={'fdd-cnt' + (n > 0 ? ' show' : '')}>{n}</span>
        <span style={{ fontSize: 12 }}>▾</span>
      </div>
      <div className="fdd-panel" onClick={(e) => e.stopPropagation()} style={minWidth ? { minWidth } : undefined}>
        {searchPlaceholder !== undefined && (
          <input type="text" className="fdd-search" placeholder={searchPlaceholder} value={needle} onChange={(e) => setNeedle(e.target.value)} />
        )}
        <div className={searchPlaceholder !== undefined ? 'fdd-panel-scroll' : undefined}>
          {opts.map((o) => {
            if (nl && !o.key.toLowerCase().includes(nl)) return null;
            const text = o.trunc && o.label.length > o.trunc ? o.label.slice(0, o.trunc) + '…' : o.label;
            return (
              <div key={o.key} className={'fdd-item' + (o.cls ? ' ' + o.cls : '') + (selected.has(o.key) ? ' active' : '')}
                onClick={() => onToggle(o.key)}
                title={o.trunc || o.maxWidth ? o.label : undefined}
                style={o.maxWidth ? { maxWidth: o.maxWidth, overflow: 'hidden', textOverflow: 'ellipsis' } : undefined}>
                <CheckMark />
                {o.dot && <span className="fdd-dot" style={{ background: o.dot }} />}
                {o.dot ? text : <span>{text}</span>}
              </div>
            );
          })}
        </div>
        <span className="fdd-clear" onClick={onClear}>Limpiar</span>
      </div>
    </div>
  );
}

export interface ColFilterProps {
  col: string;
  tab?: string;
  /** valor actualmente filtrado (con su capitalización original) */
  value?: string;
  /** valores únicos disponibles; se evalúa al abrir el dropdown (ya excluyendo el filtro de esta columna) */
  getValues: () => string[];
  /** v = valor elegido, null = quitar el filtro */
  onSelect: (v: string | null) => void;
}

/** Input de solo lectura que abre un dropdown con los valores únicos de la columna (cvd). */
export function ColFilter({ col, tab, value, getValues, onSelect }: ColFilterProps) {
  const { open, setOpen, toggle } = useDropdown('cvd');
  const [vals, setVals] = useState<string[]>([]);
  const [needle, setNeedle] = useState('');
  const current = (value || '').toLowerCase();
  const onClick = () => { if (!open) { setVals(getValues()); setNeedle(''); } toggle(); };
  const nl = needle.toLowerCase();
  const pick = (v: string | null) => { onSelect(v); setOpen(false); };
  return (
    <div className="col-filter-wrap">
      <input className={'col-filter-inp' + (value ? ' has-value' : '')} data-col={col} data-tab={tab} placeholder="Filtrar..." readOnly value={value || ''} onClick={onClick} />
      <div className={'col-val-dropdown' + (open ? ' open' : '')}>
        {open && (
          <>
            <input className="cvd-search" placeholder="Buscar valor..." autoFocus value={needle}
              onClick={(e) => e.stopPropagation()} onChange={(e) => setNeedle(e.target.value)} />
            <div className="cvd-list">
              {!vals.length ? <div className="cvd-empty">Sin valores</div> : vals.map((v) => {
                if (nl && !v.toLowerCase().includes(nl)) return null;
                return (
                  <div key={v} className={'cvd-item' + (current === v.toLowerCase() ? ' selected' : '')} title={v}
                    onClick={() => pick(current === v.toLowerCase() ? null : v)}>
                    {v.length > 38 ? v.slice(0, 38) + '…' : v}
                  </div>
                );
              })}
            </div>
            <span className="cvd-clear" onClick={() => pick(null)}>Limpiar filtro</span>
          </>
        )}
      </div>
    </div>
  );
}

export interface Chip { key: string; label: ReactNode; onRemove: () => void }
/** Chips de filtros activos (af-chip). */
export function ActiveChips({ chips, id }: { chips: Chip[]; id?: string }) {
  return (
    <div className="active-filters" id={id}>
      {chips.map((c) => (
        <div className="af-chip" key={c.key}>{c.label}<button onClick={c.onRemove}>×</button></div>
      ))}
    </div>
  );
}
