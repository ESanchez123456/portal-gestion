// Tipos del dominio. Son la base del diccionario de datos (ver /docs/DATOS.md).

/** Un proceso (fila del Reporte Total de MyBiG, ya normalizada). */
export interface Proceso {
  id: number;
  cliente: string; contraparte: string; expediente: string;
  supervisor: string; responsable: string;
  instancia: string;            // "Estado interno"
  distrito: string; organo: string; tipoJuzgado: string; especialista: string;
  relevancia: string; pacto: string; bitacora: string; situacion: string;
  materia: string; submateria: string; viaprocesal: string;
  cuantia: string; reposicion: string; estadoCarpeta: string;
  sensible: boolean; porSentenciar: boolean; alertLectura: boolean;
  porNuevaSentencia: boolean; porAdmitir: boolean; porArchivo: boolean;
  proxTarea: string; proxTareaFecha: string; proxTareaHora: string; proxTareaId: number | string;
  proxTareaNota: string;
  proxDiligencia: string; proxDiliFecha: string; proxDiliHora: string; proxDiliId: number | string;
  proxDiliTipo: string; ultimaDiliFecha: string;
  tareaGestion: string; tareaGestionFecha: string; tareaGestionAsigPor: string; tareaGestionNota: string;
  [k: string]: unknown;
}

export interface TareaGestion {
  id: string;                 // 'ex_<nrotarea>' (Excel) | 'man_<ts>' (manual)
  nroId: number; nrotarea?: number;
  cliente: string; contraparte?: string; expediente: string;
  tipo: string; asignado: string; agendadoPor: string;
  fecha: string;              // dd/mm/yyyy
  hora?: string; fechaEncargo?: string;
  estado: string;             // Pendiente | Pendiente aprobación | Rechazada | Completada | Cancelada
  obs: string; origen: 'excel' | 'portal' | 'manual' | string;
  supervisor?: string; responsable?: string; organo?: string; distrito?: string;
  comentarios?: unknown[]; adjuntos?: unknown[];
  [k: string]: unknown;
}

export interface Juzgado {
  id: string; distrito: string; tipoJuzgado: string; organo: string;
  magistrado: string; condicion: string; encargado: string;
  editado?: boolean; deRT?: boolean; rt?: boolean; organoOriginal?: string;
}

export interface PortalUser { email: string; name: string; }

export interface AuditEntry {
  id?: string; key: string; accion: string; label: string; ctx?: string;
  byEmail?: string; byName?: string; ts: number;
}

/** Datos publicados del Excel (hoy en xdata_chunk_N). */
export interface ExcelPayload {
  DATA: Proceso[];
  TAREAS_GESTION_EXCEL: TareaGestion[];
  DILIGENCIAS_GESTION_EXCEL: Record<string, unknown>[];
  SENTENCIAS_BY_ID: Record<string, unknown>;
  PLANNER_EXCEL_TAREAS: Record<string, unknown>[];
  DILIGENCIAS_EQUIPOS_EXCEL: Record<string, unknown>[];
}
