'use client';
import { useEffect } from 'react';

// La clase body.has-bulk-bar se activa si CUALQUIERA de las dos tablas tiene selección.
const activos = new Set<string>();
function sync() { if (typeof document !== 'undefined') document.body.classList.toggle('has-bulk-bar', activos.size > 0); }

/** Barra de acciones masivas (bulk-bar). */
export default function BulkBar({ tab, count, totalFiltrados, onSelectAll, onAgendar, onExportar, onCancel }: {
  tab: string; count: number; totalFiltrados: number;
  onSelectAll: () => void; onAgendar: () => void; onExportar: () => void; onCancel: () => void;
}) {
  useEffect(() => {
    if (count > 0) activos.add(tab); else activos.delete(tab);
    sync();
    return () => { activos.delete(tab); sync(); };
  }, [tab, count]);
  return (
    <div className={'bulk-bar' + (count > 0 ? ' show' : '')} id={'bulk-bar-' + tab}>
      <span className="bulk-bar-cnt">{count}</span> proceso(s) seleccionado(s)
      <button className="bulk-btn" style={count < totalFiltrados ? undefined : { display: 'none' }} onClick={onSelectAll}>☑ Seleccionar los {totalFiltrados} filtrados</button>
      <button className="bulk-btn" onClick={onAgendar}>+ Agendar gestión</button>
      <button className="bulk-btn" onClick={onExportar}>↓ Exportar selección</button>
      <button className="bulk-btn bulk-btn-cancel" onClick={onCancel}>✕ Cancelar</button>
    </div>
  );
}
