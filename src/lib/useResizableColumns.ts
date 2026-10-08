'use client';
import { useEffect, type RefObject } from 'react';

/** Agrega manijas para redimensionar columnas a la(s) tabla(s) dentro de `ref` (equivale a addResizeHandles). */
export function useResizableColumns(ref: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const root = ref.current; if (!root) return;
    const t = setTimeout(() => {
      root.querySelectorAll<HTMLElement>('.table-wrap, .tg-list-wrap').forEach((wrap) => {
        const table = wrap.querySelector('table'); if (!table) return;
        const ths = Array.from(table.querySelectorAll<HTMLElement>('thead tr:first-child th'));
        if (table.style.tableLayout !== 'fixed') ths.forEach((th) => { th.style.minWidth = th.style.minWidth || th.offsetWidth + 'px'; });
        ths.forEach((th) => {
          let rh = th.querySelector<HTMLElement>('.rh');
          if (!rh) { rh = document.createElement('div'); rh.className = 'rh'; th.style.position = 'relative'; th.appendChild(rh); }
          const fresh = rh.cloneNode(true) as HTMLElement; rh.replaceWith(fresh);
          fresh.addEventListener('mousedown', (e) => {
            e.stopPropagation(); e.preventDefault();
            const x0 = e.clientX; const w0 = th.getBoundingClientRect().width;
            if (table.style.tableLayout !== 'fixed') {
              ths.forEach((x) => { x.style.width = x.getBoundingClientRect().width + 'px'; });
              table.style.width = table.getBoundingClientRect().width + 'px'; table.style.tableLayout = 'fixed';
            }
            fresh.classList.add('active'); document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
            const move = (ev: MouseEvent) => { th.style.width = Math.max(40, w0 + ev.clientX - x0) + 'px'; };
            const up = () => { fresh.classList.remove('active'); document.body.style.cursor = ''; document.body.style.userSelect = '';
              document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
            document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
          });
        });
      });
    }, 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
