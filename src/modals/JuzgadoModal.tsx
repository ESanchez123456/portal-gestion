'use client';
// TODO(migración): JuzgadoModal — pendiente de portar desde index.html
export default function JuzgadoModal({ payload, onClose }: { payload: unknown; onClose: () => void }) {
  void payload;
  return (<div className="overlay show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className="modal" style={{ padding: 24 }}>JuzgadoModal pendiente <button onClick={onClose}>Cerrar</button></div></div>);
}
