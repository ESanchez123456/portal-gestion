import type { AuditEntry } from '@/types';

/**
 * Contrato de acceso a datos. La app SOLO habla con esta interfaz.
 * Hoy: `local` (pruebas, en este navegador). Mañana: `api` (API Node → Data Warehouse).
 * Cambiar de backend = cambiar NEXT_PUBLIC_DATA_BACKEND, sin tocar las vistas.
 */
export interface DataBackend {
  /** Usuario actual. En modo local es fijo; con la API lo resuelve el servidor (SSO). */
  getUser(): Promise<{ email: string; name?: string }>;

  /** Almacén clave→valor compartido. */
  loadAllKV(): Promise<Record<string, string>>;
  listenKV(onChange: (changes: { key: string; value: string | null }[]) => void): () => void;
  setKV(key: string, value: string): Promise<void>;
  removeKV(key: string): Promise<void>;

  /** Bitácora de auditoría. */
  logAudit(entry: Omit<AuditEntry, 'ts' | 'byEmail'> & { byName?: string }): void;
  listenAudit(onChange: (rows: AuditEntry[]) => void): () => void;
}
