import type { DataBackend } from './types';
import type { AuditEntry } from '@/types';

/**
 * Backend LOCAL para pruebas: sin usuarios, sin servidor, sin Firebase.
 * Guarda todo en IndexedDB de ESTE navegador (sobrevive a recargas; no se comparte con nadie).
 * Se reemplaza por `apiBackend` cuando TI conecte el data warehouse.
 */
const DB = 'portal_gestion_local';
const STORE_KV = 'kv';
const STORE_AUDIT = 'audit';

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(STORE_KV); r.result.createObjectStore(STORE_AUDIT, { autoIncrement: true }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const tx = <T,>(db: IDBDatabase, store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
  new Promise((res, rej) => { const r = fn(db.transaction(store, mode).objectStore(store)); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export function createLocalBackend(): DataBackend {
  const email = process.env.NEXT_PUBLIC_LOCAL_USER_EMAIL || 'esanchez@vinateatoyama.com';
  const name = process.env.NEXT_PUBLIC_LOCAL_USER_NAME || 'Edu Sánchez';
  let dbp: Promise<IDBDatabase> | null = null;
  const db = () => (dbp ??= open());
  const audit: AuditEntry[] = [];
  const auditListeners = new Set<(r: AuditEntry[]) => void>();

  return {
    async getUser() { return { email, name }; },
    async loadAllKV() {
      try {
        const d = await db();
        const out: Record<string, string> = {};
        await new Promise<void>((res, rej) => {
          const c = d.transaction(STORE_KV).objectStore(STORE_KV).openCursor();
          c.onsuccess = () => { const cur = c.result; if (cur) { out[String(cur.key)] = cur.value as string; cur.continue(); } else res(); };
          c.onerror = () => rej(c.error);
        });
        return out;
      } catch (e) { console.error('IndexedDB no disponible; se trabaja solo en memoria', e); return {}; }
    },
    listenKV() { return () => {}; },     // un solo usuario: no hay cambios externos
    async setKV(key, value) { try { await tx(await db(), STORE_KV, 'readwrite', (s) => s.put(value, key)); } catch (e) { console.error(e); } },
    async removeKV(key) { try { await tx(await db(), STORE_KV, 'readwrite', (s) => s.delete(key)); } catch (e) { console.error(e); } },
    logAudit(e) {
      const row = { ...e, byEmail: email, ts: Date.now() } as AuditEntry;
      audit.unshift(row); if (audit.length > 400) audit.pop();
      auditListeners.forEach((l) => l([...audit]));
      db().then((d) => tx(d, STORE_AUDIT, 'readwrite', (s) => s.add(row))).catch(() => {});
    },
    listenAudit(cb) {
      auditListeners.add(cb);
      db().then(async (d) => {
        const all = await tx(d, STORE_AUDIT, 'readonly', (s) => s.getAll() as IDBRequest<AuditEntry[]>);
        audit.splice(0, audit.length, ...all.sort((a, b) => b.ts - a.ts).slice(0, 400)); cb([...audit]);
      }).catch(() => cb([...audit]));
      return () => auditListeners.delete(cb);
    },
  };
}
