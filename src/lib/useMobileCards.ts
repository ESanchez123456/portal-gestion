'use client';
import { useEffect } from 'react';

/**
 * En pantallas angostas (<=768px) las tablas se muestran como tarjetas: etiqueta cada celda con el
 * encabezado de su columna (data-label), marca las columnas secundarias (se ven al tocar la tarjeta)
 * y habilita el toque para expandir. En escritorio no hace nada (el CSS solo actúa en móvil).
 * Excluir una tabla: añadir la clase `no-cards`.
 */
function textoConEspacios(n: Node): string {
  if (n.nodeType === 3) return n.textContent || '';
  let out = '';
  n.childNodes.forEach((c) => { out += textoConEspacios(c) + ' '; });
  return out;
}
const PRIMARY_MAX = 7;
// Columnas que siempre se ven en la tarjeta (el resto queda en "ver más")
const PRIORITY = /^(id( proc\.?)?|cliente|expediente|tipo de tarea|tipo|estado|asignado a|fecha l[ií]mite|fecha|hora|responsable|[oó]rgano.*|pr[oó]xima audiencia|pr[oó]xima tarea|supervisor|bit[aá]cora|distrito|magistrado|encargado|d[ií]as s\/dilig\.?|gesti[oó]n)$/i;
export function useMobileCards() {
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const label = () => {
      if (!mq.matches) return;
      document.querySelectorAll<HTMLTableElement>('#appRoot table:not(.no-cards)').forEach((t) => {
        const ths = Array.from(t.querySelectorAll<HTMLElement>('thead tr:first-child th'));
        if (!ths.length) return;
        const labels = ths.map((th) => { const x = textoConEspacios(th).replace(/\s+/g, ' ').trim(); return /[a-z0-9áéíóúñ]/i.test(x) ? x : ''; });
        const hasPriority = labels.some((l) => PRIORITY.test(l));
        t.classList.add('rc');
        t.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((tr) => {
          const tds = Array.from(tr.children) as HTMLElement[];
          if (tds.length === 1 && tds[0].hasAttribute('colspan')) { tr.classList.add('rc-empty'); return; }
          let shown = 0; let extras = 0;
          tds.forEach((td, i) => {
            const lb = labels[i] || '';
            if (td.dataset.label !== lb) td.dataset.label = lb;
            const hasText = (td.textContent || '').trim().length > 0 || td.querySelector('button,a,input');
            const isAction = !lb || /acciones|cambios/i.test(lb) || !!td.querySelector('button,input[type=checkbox]');
            const prioritized = hasPriority ? PRIORITY.test(lb) : true;
            const primary = isAction || (prioritized && shown < PRIMARY_MAX);
            if (!isAction && hasText && primary) shown++;
            td.classList.toggle('m-extra', !primary);
            if (!primary && hasText) extras++;
          });
          tr.classList.toggle('has-extra', extras > 0);
          tr.classList.add('rc-row');
        });
      });
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(label, 60); };
    const obs = new MutationObserver(schedule);
    obs.observe(document.body, { childList: true, subtree: true });
    mq.addEventListener('change', schedule);
    const onClick = (e: MouseEvent) => {
      if (!mq.matches) return;
      const el = e.target as HTMLElement;
      if (el.closest('a,button,input,select,textarea,label,.tg-fav-star')) return;
      const tr = el.closest<HTMLTableRowElement>('tr.rc-row.has-extra');
      if (tr) tr.classList.toggle('open');
    };
    document.addEventListener('click', onClick);
    schedule();
    return () => { obs.disconnect(); mq.removeEventListener('change', schedule); document.removeEventListener('click', onClick); clearTimeout(timer); };
  }, []);
}
