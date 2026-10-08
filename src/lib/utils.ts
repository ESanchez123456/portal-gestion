// Utilidades compartidas (portadas de index.html). Cada vista agrega las suyas en su propio archivo.
export function fmtFechaHora(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
/** 'dd/mm/yyyy' | ISO → Date | null */
export function parseFechaTarea(f?: string): Date | null {
  if (!f) return null;
  if (f.includes('/')) { const [d, m, y] = f.split('/'); return new Date(Number(y), Number(m) - 1, Number(d)); }
  return new Date(f);
}
