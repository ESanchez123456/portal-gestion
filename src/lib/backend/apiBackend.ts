import type { DataBackend } from './types';
import type { AuditEntry } from '@/types';

/**
 * Backend contra la API Node → Data Warehouse (pendiente de TI).
 * Endpoints esperados (ver docs/API.md):
 *   POST /auth/login | /auth/logout | /auth/reset      — o SSO Microsoft (Entra ID)
 *   GET  /kv                      → { [key]: value }
 *   PUT  /kv/:key   {value}       DELETE /kv/:key
 *   GET  /kv/stream (SSE)         → cambios en vivo   (o polling cada N s)
 *   POST /audit     GET /audit?limit=400
 * Mientras no exista, esta clase falla de forma explícita.
 */
export function createApiBackend(baseUrl: string): DataBackend {
  const nope = (): never => { throw new Error('apiBackend aún no implementado: falta la API de TI (' + baseUrl + ')'); };
  const call = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const r = await fetch(baseUrl + path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
    if (!r.ok) throw new Error(path + ' → ' + r.status);
    return r.json() as Promise<T>;
  };
  return {
    signIn: async (email, password) => { await call('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); },
    signOut: async () => { await call('/auth/logout', { method: 'POST' }); },
    resetPassword: async (email) => { await call('/auth/reset', { method: 'POST', body: JSON.stringify({ email }) }); },
    onAuthChanged: (cb) => { call<{ email: string }>('/auth/me').then(cb).catch(() => cb(null)); return () => {}; },
    loadAllKV: () => call<Record<string, string>>('/kv'),
    listenKV: () => { nope(); return () => {}; },
    setKV: async (key, value) => { await call('/kv/' + encodeURIComponent(key), { method: 'PUT', body: JSON.stringify({ value }) }); },
    removeKV: async (key) => { await call('/kv/' + encodeURIComponent(key), { method: 'DELETE' }); },
    logAudit: (e) => { call('/audit', { method: 'POST', body: JSON.stringify(e) }).catch(() => {}); },
    listenAudit: (cb) => { call<AuditEntry[]>('/audit?limit=400').then(cb).catch(() => {}); return () => {}; },
  };
}
