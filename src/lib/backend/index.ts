import type { DataBackend } from './types';
import { createLocalBackend } from './localBackend';
import { createApiBackend } from './apiBackend';

let _b: DataBackend | null = null;
/** Backend activo según NEXT_PUBLIC_DATA_BACKEND = 'local' (default, pruebas) | 'api' (data warehouse). */
export function getBackend(): DataBackend {
  if (_b) return _b;
  _b = process.env.NEXT_PUBLIC_DATA_BACKEND === 'api'
    ? createApiBackend(process.env.NEXT_PUBLIC_API_URL || '/api')
    : createLocalBackend();
  return _b;
}
export type { DataBackend };
