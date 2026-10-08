'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { showToast, usePortal } from '@/store/portal';
import { exportarXlsx } from '@/lib/reporte';
import type { Proceso } from '@/types';

/**
 * Selección de filas (checkbox), fila resaltada y acciones masivas de una tabla
 * (onRowCheck, toggleAllRows, selectAllFiltered, clearBulk, bulkAgendar, bulkExportar del original).
 */
export function useBulkSelection(tab: 'rep' | 'aud', pageRows: Proceso[], filtered: Proceso[], universo: Proceso[]) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selRow, setSelRow] = useState<number | null>(null);
  const masterRef = useRef<HTMLInputElement>(null);

  const cnt = selected.size;
  const totalPage = pageRows.length;
  useEffect(() => {
    const m = masterRef.current; if (!m) return;
    m.indeterminate = cnt > 0 && cnt < totalPage;
  }, [cnt, totalPage]);
  const masterChecked = cnt > 0 && cnt >= totalPage;

  const onCheck = useCallback((id: number, checked: boolean) => {
    setSelected((p) => { const n = new Set(p); if (checked) n.add(id); else n.delete(id); return n; });
  }, []);
  const toggleAll = useCallback((checked: boolean) => {
    setSelected((p) => { const n = new Set(p); pageRows.forEach((r) => { if (checked) n.add(r.id); else n.delete(r.id); }); return n; });
  }, [pageRows]);
  const selectAllFiltered = () => {
    setSelected((p) => { const n = new Set(p); filtered.forEach((r) => n.add(r.id)); return n; });
    showToast('☑ ' + filtered.length + ' proceso(s) seleccionado(s)');
  };
  const clear = useCallback(() => setSelected(new Set()), []);
  const selectRow = (id: number) => setSelRow((p) => (p === id ? null : id));

  const bulkAgendar = () => {
    const ids = [...selected];
    if (!ids.length) return;
    // El modal 'bulkAgendar' recibe { procIds }; onDone (opcional) limpia la selección al confirmar.
    usePortal.getState().openModal('bulkAgendar', { procIds: ids, tab, onDone: clear });
  };
  const bulkExportar = () => {
    const ids = [...selected];
    if (!ids.length) { showToast('Selecciona al menos un proceso'); return; }
    const rows = universo.filter((r) => ids.includes(r.id));
    exportarXlsx(rows, 'Selección', 'seleccion_portal_gestion.xlsx').then(() => showToast('✓ Exportado: ' + rows.length + ' proceso(s)'));
  };

  return { selected, selRow, selectRow, masterRef, masterChecked, onCheck, toggleAll, selectAllFiltered, clear, bulkAgendar, bulkExportar };
}
