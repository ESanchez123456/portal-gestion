'use client';
import type { TextareaHTMLAttributes } from 'react';
/**
 * Textarea con @menciones. (Versión base: textarea simple; el agente de Planner la reemplaza
 * por la implementación completa con dropdown de usuarios, manteniendo estas props.)
 */
export interface MentionTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string; onChange: (v: string) => void;
}
export default function MentionTextarea({ value, onChange, ...rest }: MentionTextareaProps) {
  return <textarea {...rest} value={value} onChange={(e) => onChange(e.target.value)} />;
}
