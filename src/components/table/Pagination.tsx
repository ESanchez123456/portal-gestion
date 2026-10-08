'use client';
/** Paginador (equivale a buildPag). */
export default function Pagination({ cur, total, perPage, onPage }: { cur: number; total: number; perPage: number; onPage: (p: number) => void }) {
  const pages = new Set<number>([1]);
  for (let i = Math.max(2, cur - 2); i <= Math.min(total - 1, cur + 2); i++) pages.add(i);
  if (total > 1) pages.add(total);
  const arr = [...pages].sort((a, b) => a - b);
  const out: React.ReactNode[] = [];
  let last = 0;
  arr.forEach((p) => {
    if (last && p - last > 1) out.push(<span key={'e' + p} className="pg-ell">…</span>);
    out.push(<button key={p} className={'pg-btn' + (p === cur ? ' active' : '')} onClick={() => onPage(p)}>{p}</button>);
    last = p;
  });
  return (
    <div className="pagination">
      <span>Página {cur} de {total} · {perPage} por página</span>
      <div className="pg-btns">
        <button className="pg-btn" disabled={cur <= 1} onClick={() => onPage(Math.max(1, cur - 1))}>‹</button>
        {out}
        <button className="pg-btn" disabled={cur >= total} onClick={() => onPage(Math.min(total, cur + 1))}>›</button>
      </div>
    </div>
  );
}
