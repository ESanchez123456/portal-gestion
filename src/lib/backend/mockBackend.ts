import type { DataBackend } from './types';
import type { AuditEntry } from '@/types';

/** Backend en memoria para pruebas locales/demos (NEXT_PUBLIC_DATA_BACKEND=mock). No persiste nada. */
export function createMockBackend(): DataBackend {
  const kv: Record<string, string> = {};
  const audit: AuditEntry[] = [];
  const kvListeners = new Set<(c: { key: string; value: string | null }[]) => void>();
  const auditListeners = new Set<(r: AuditEntry[]) => void>();
  const email = process.env.NEXT_PUBLIC_MOCK_USER || 'esanchez@vinateatoyama.com';
  return {
    async signIn() {}, async signOut() {}, async resetPassword() {},
    onAuthChanged(cb) { setTimeout(() => cb({ email }), 0); return () => {}; },
    async loadAllKV() { return { ...kv }; },
    listenKV(cb) { kvListeners.add(cb); return () => kvListeners.delete(cb); },
    async setKV(key, value) { kv[key] = value; },
    async removeKV(key) { delete kv[key]; },
    logAudit(e) { audit.unshift({ ...e, byEmail: email, ts: Date.now() } as AuditEntry); auditListeners.forEach((l) => l([...audit])); },
    listenAudit(cb) { auditListeners.add(cb); cb([...audit]); return () => auditListeners.delete(cb); },
  };
}
