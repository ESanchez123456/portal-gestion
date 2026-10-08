'use client';
import { create } from 'zustand';
import type { ExcelPayload, PortalUser, Proceso, TareaGestion } from '@/types';
import { getBackend } from '@/lib/backend';
import { registrarAuditoria } from '@/lib/audit';

export type TabName = 'reporte' | 'audiencias' | 'gestion' | 'paralegal' | 'juzgados' | 'admin';

/** Modales compartidos entre vistas. Cada uno vive en src/modals/<Nombre>Modal.tsx */
export type ModalName =
  | 'carga' | 'agendar' | 'bulkAgendar' | 'obsProc' | 'gestionarTarea' | 'nuevaTarea'
  | 'redirigir' | 'devolverTarea' | 'comentariosTarea' | 'favUser' | 'diligencia'
  | 'plannerTarea' | 'juzgado';

interface PortalState {
  // sesión
  user: PortalUser | null;
  authReady: boolean;
  kvReady: boolean;
  // almacén clave→valor compartido (equivale al antiguo window.__KV_CACHE / FSLS)
  kv: Record<string, string>;
  kvRev: number;                      // se incrementa en cada cambio de kv → los componentes se re-renderizan
  // datos del Excel
  DATA: Proceso[];
  TAREAS_GESTION_EXCEL: TareaGestion[];
  DILIGENCIAS_GESTION_EXCEL: Record<string, unknown>[];
  SENTENCIAS_BY_ID: Record<string, unknown>;
  PLANNER_EXCEL_TAREAS: Record<string, unknown>[];
  DILIGENCIAS_EQUIPOS_EXCEL: Record<string, unknown>[];
  /** Estado de carpeta por id (para explicar favoritos "ya no activos") */
  RAWRT_ESTADO_BY_ID: Record<number, string>;
  dataRev: number;                    // +1 cada vez que se cargan datos nuevos (reiniciar filtros/páginas)
  dataLabel: string;                  // "Actualizado el … · "
  // UI
  activeTab: TabName;
  toast: string;
  modals: Partial<Record<ModalName, unknown>>;   // payload del modal abierto (undefined = cerrado)
  errorMsg: string;

  setUser(u: PortalUser | null): void;
  setAuthReady(v: boolean): void;
  setKVAll(kv: Record<string, string>): void;
  applyKVChanges(changes: { key: string; value: string | null }[]): void;
  setPayload(p: Partial<ExcelPayload>, label?: string): void;
  setActiveTab(t: TabName): void;
  showToast(msg: string): void;
  openModal(name: ModalName, payload?: unknown): void;
  closeModal(name: ModalName): void;
  showError(msg: string): void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const usePortal = create<PortalState>((set, get) => ({
  user: null, authReady: false, kvReady: false,
  kv: {}, kvRev: 0,
  DATA: [], TAREAS_GESTION_EXCEL: [], DILIGENCIAS_GESTION_EXCEL: [], SENTENCIAS_BY_ID: {},
  PLANNER_EXCEL_TAREAS: [], DILIGENCIAS_EQUIPOS_EXCEL: [], RAWRT_ESTADO_BY_ID: {},
  dataRev: 0, dataLabel: '',
  activeTab: 'reporte', toast: '', modals: {}, errorMsg: '',

  setUser: (user) => set({ user }),
  setAuthReady: (authReady) => set({ authReady }),
  setKVAll: (kv) => set((s) => ({ kv, kvReady: true, kvRev: s.kvRev + 1 })),
  applyKVChanges: (changes) => set((s) => {
    const kv = { ...s.kv };
    changes.forEach((c) => { if (c.value === null) delete kv[c.key]; else kv[c.key] = c.value; });
    return { kv, kvRev: s.kvRev + 1 };
  }),
  setPayload: (p, label) => set((s) => ({
    DATA: p.DATA ?? s.DATA,
    TAREAS_GESTION_EXCEL: p.TAREAS_GESTION_EXCEL ?? s.TAREAS_GESTION_EXCEL,
    DILIGENCIAS_GESTION_EXCEL: p.DILIGENCIAS_GESTION_EXCEL ?? s.DILIGENCIAS_GESTION_EXCEL,
    SENTENCIAS_BY_ID: p.SENTENCIAS_BY_ID ?? s.SENTENCIAS_BY_ID,
    PLANNER_EXCEL_TAREAS: p.PLANNER_EXCEL_TAREAS ?? s.PLANNER_EXCEL_TAREAS,
    DILIGENCIAS_EQUIPOS_EXCEL: p.DILIGENCIAS_EQUIPOS_EXCEL ?? s.DILIGENCIAS_EQUIPOS_EXCEL,
    dataRev: s.dataRev + 1,
    dataLabel: label ?? s.dataLabel,
  })),
  setActiveTab: (activeTab) => set({ activeTab }),
  showToast: (msg) => {
    set({ toast: msg });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toast: '' }), 3200);
  },
  openModal: (name, payload = true) => set((s) => ({ modals: { ...s.modals, [name]: payload } })),
  closeModal: (name) => set((s) => { const m = { ...s.modals }; delete m[name]; return { modals: m }; }),
  showError: (errorMsg) => set({ errorMsg }),
}));

/**
 * FSLS: mismo API que el antiguo localStorage-sobre-Firestore.
 * Lectura síncrona desde el caché en memoria; escritura optimista + persistencia vía backend.
 * Para que un componente se re-renderice cuando cambian las claves: `usePortal(s => s.kvRev)`.
 */
export const FSLS = {
  getItem(key: string): string | null {
    const kv = usePortal.getState().kv;
    return Object.prototype.hasOwnProperty.call(kv, key) ? kv[key] : null;
  },
  setItem(key: string, value: string): void {
    usePortal.getState().applyKVChanges([{ key, value }]);
    getBackend().setKV(key, value).catch((e) => console.error('KV set error', key, e));
    registrarAuditoria(key, 'set');
  },
  removeItem(key: string): void {
    usePortal.getState().applyKVChanges([{ key, value: null }]);
    getBackend().removeKV(key).catch((e) => console.error('KV delete error', key, e));
    registrarAuditoria(key, 'delete');
  },
  /** Helper JSON: lee y parsea con valor por defecto. */
  getJSON<T>(key: string, def: T): T {
    try { const r = FSLS.getItem(key); return r ? (JSON.parse(r) as T) : def; } catch { return def; }
  },
  setJSON(key: string, v: unknown): void { FSLS.setItem(key, JSON.stringify(v)); },
};

export const showToast = (m: string) => usePortal.getState().showToast(m);
