import type { AuditEntry } from '@/types';

/**
 * Contrato de acceso a datos. La app SOLO habla con esta interfaz.
 * Hoy: Firebase (firebaseBackend). Mañana: API Node → Data Warehouse (apiBackend).
 * Cambiar de backend = cambiar NEXT_PUBLIC_DATA_BACKEND, sin tocar las vistas.
 */
export interface DataBackend {
  /** Auth */
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  onAuthChanged(cb: (user: { email: string } | null) => void): () => void;

  /** Almacén clave→valor compartido (hoy colección portal_kv). */
  loadAllKV(): Promise<Record<string, string>>;
  listenKV(onChange: (changes: { key: string; value: string | null }[]) => void): () => void;
  setKV(key: string, value: string): Promise<void>;
  removeKV(key: string): Promise<void>;

  /** Bitácora de auditoría. */
  logAudit(entry: Omit<AuditEntry, 'ts' | 'byEmail'> & { byName?: string }): void;
  listenAudit(onChange: (rows: AuditEntry[]) => void): () => void;
}
