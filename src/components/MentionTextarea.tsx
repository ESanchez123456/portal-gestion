'use client';
import { useEffect, useRef, useState, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { MENTION_USERS, type MentionUser } from '@/lib/gestionD';

/**
 * Textarea con @menciones (legacy/index.html 5836-5973).
 * Al escribir "@" (sin espacio/salto de línea entre la @ y el cursor) se abre un dropdown con MENTION_USERS
 * filtrado por nombre/alias. Teclado: ↑ ↓ navegan, Enter/Tab insertan, Esc cierra. Inserta "@Nombre ".
 * Props: value / onChange(valor) / placeholder / rows / className (+ cualquier atributo de textarea).
 */
export interface MentionTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string; onChange: (v: string) => void;
}

interface DD { startPos: number; matches: MentionUser[]; idx: number; top: number; left: number; }

export default function MentionTextarea({ value, onChange, onKeyDown, onBlur, style, ...rest }: MentionTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [dd, setDd] = useState<DD | null>(null);
  const [flash, setFlash] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const close = () => setDd(null);

  const detect = (ta: HTMLTextAreaElement) => {
    const val = ta.value; const pos = ta.selectionStart;
    let atIdx = -1;
    for (let i = pos - 1; i >= 0; i--) {
      if (val[i] === '@') { atIdx = i; break; }
      if (val[i] === ' ' || val[i] === '\n') break;
    }
    if (atIdx >= 0) {
      const query = val.slice(atIdx + 1, pos).toLowerCase();
      const matches = MENTION_USERS.filter((u) => u.nombre.toLowerCase().includes(query) || u.alias.includes(query));
      if (matches.length) {
        const rect = ta.getBoundingClientRect();
        setDd({ startPos: atIdx, matches, idx: 0, top: rect.bottom + 4, left: rect.left });
        return;
      }
    }
    close();
  };

  const insert = (u: MentionUser) => {
    const ta = ref.current; if (!ta || !dd) return;
    const val = ta.value;
    const before = val.slice(0, dd.startPos);
    const after = val.slice(ta.selectionStart);
    const mention = '@' + u.nombre + ' ';
    const next = before + mention + after;
    const newPos = before.length + mention.length;
    onChange(next);
    close();
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(newPos, newPos); });
    setFlash(true);
    timers.current.push(setTimeout(() => setFlash(false), 800));
  };

  const keydown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (dd) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setDd({ ...dd, idx: Math.min(dd.idx + 1, dd.matches.length - 1) }); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setDd({ ...dd, idx: Math.max(dd.idx - 1, 0) }); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insert(dd.matches[dd.idx] || dd.matches[0]); return; }
      if (e.key === 'Escape') { close(); return; }
    }
    onKeyDown?.(e);
  };

  return (
    <>
      <textarea
        {...rest}
        ref={ref}
        value={value}
        style={flash ? { ...style, borderColor: 'var(--blue)' } : style}
        onChange={(e) => { onChange(e.target.value); detect(e.target); }}
        onKeyDown={keydown}
        onBlur={(e) => { onBlur?.(e); timers.current.push(setTimeout(close, 150)); }}
      />
      {dd && typeof document !== 'undefined' && createPortal(
        <div className="mention-dropdown" id="mention-dropdown" style={{ top: dd.top, left: dd.left, display: 'block' }}>
          {dd.matches.map((u, i) => (
            <div
              key={u.alias}
              className={'mention-item' + (i === dd.idx ? ' selected' : '')}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(u)}
            >
              <span className="mention-item-dot" style={{ background: u.color }} />
              <div>
                <div className="mention-item-name">{u.nombre}</div>
                <div className="mention-item-role">{u.rol}</div>
              </div>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
