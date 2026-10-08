import type { DataBackend } from './types';
import { createFirebaseBackend } from './firebaseBackend';
import { createApiBackend } from './apiBackend';
import { createMockBackend } from './mockBackend';

let _b: DataBackend | null = null;
/** Backend activo según NEXT_PUBLIC_DATA_BACKEND = 'firebase' (default) | 'api' | 'mock'. */
export function getBackend(): DataBackend {
  if (_b) return _b;
  const kind = process.env.NEXT_PUBLIC_DATA_BACKEND;
  _b = kind === 'api' ? createApiBackend(process.env.NEXT_PUBLIC_API_URL || '/api')
    : kind === 'mock' ? createMockBackend()
    : createFirebaseBackend();
  return _b;
}
export type { DataBackend };
