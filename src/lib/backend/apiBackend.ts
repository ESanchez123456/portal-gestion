import type { DataBackend } from './types';
import type { AuditEntry } from '@/types';

/**
 * Backend contra la API Node → Data Warehouse (pendiente de TI). Ver docs/API.md.
 * La autenticación la resuelve el servidor (SSO Microsoft / cookie de sesión): la app no maneja contraseñas.
 */
export function createApiBackend(baseUrl: string): DataBackend {
  const call = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const r = await fetch(baseUrl + path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
    if (!r.ok) throw new Error(path + ' → ' + r.status);
    return r.json() as Promise<T>;
  };
  return {
    getUser: () => call<{ email: string; name?: string }>('/me'),
    loadAllKV: () => call<Record<string, string>>('/kv'),
    // TODO(TI): SSE o polling para cambios en vivo entre usuarios
    listenKV: () => () => {},
    setKV: async (key, value) => { await call('/kv/' + encodeURIComponent(key), { method: 'PUT', body: JSON.stringify({ value }) }); },
    removeKV: async (key) => { await call('/kv/' + encodeURIComponent(key), { method: 'DELETE' }); },
    logAudit: (e) => { call('/audit', { method: 'POST', body: JSON.stringify(e) }).catch(() => {}); },
    listenAudit: (cb) => { call<AuditEntry[]>('/audit?limit=400').then(cb).catch(() => {}); return () => {}; },
  };
}
