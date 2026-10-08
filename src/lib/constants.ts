// Equipo, usuarios y reglas de acceso (portado de index.html).
export const PORTAL_USERS: Record<string, string> = {
  'rmatallana@vinateatoyama.com': 'Roberto Matallana',
  'cmorales@vinateatoyama.com': 'Carlos Morales',
  'tleon@vinateatoyama.com': 'Talía León',
  'jedquen@vinateatoyama.com': 'Juan Jose Edquen',
  'smaldonado@vinateatoyama.com': 'Silvia Maldonado',
  'atrelles@vinateatoyama.com': 'Arturo Trelles',
  'esanchez@vinateatoyama.com': 'Edu Sánchez',
  'lchavez@vinateatoyama.com': 'Luis Chávez',
};
export const ADMIN_EMAILS = ['esanchez@vinateatoyama.com'];
export const EXCEL_UPLOADER_EMAIL = 'esanchez@vinateatoyama.com';

export const TEAM_GESTION = [
  { nombre: 'Arturo Trelles', rol: 'Team Gestión', iniciales: 'AT', color: '#1a1a2e' },
  { nombre: 'Carlos Morales', rol: 'Team Gestión', iniciales: 'CM', color: '#2563eb' },
  { nombre: 'Juan Jose Edquen', rol: 'Team Gestión', iniciales: 'JJ', color: '#7c3aed' },
  { nombre: 'Roberto Matallana', rol: 'Team Gestión', iniciales: 'RM', color: '#dc2626' },
  { nombre: 'Silvia Maldonado', rol: 'Team Gestión', iniciales: 'SM', color: '#16a34a' },
  { nombre: 'Talía León', rol: 'Team Gestión', iniciales: 'TL', color: '#d97706' },
];
export const GCAL_MIEMBROS = [
  { nombre: 'Roberto Matallana', iniciales: 'RM', cls: 'gcal-RM', color: '#dc2626' },
  { nombre: 'Carlos Morales', iniciales: 'CM', cls: 'gcal-CM', color: '#2563eb' },
  { nombre: 'Arturo Trelles', iniciales: 'AT', cls: 'gcal-AT', color: '#4f46e5' },
  { nombre: 'Silvia Maldonado', iniciales: 'SM', cls: 'gcal-SM', color: '#16a34a' },
  { nombre: 'Juan Jose Edquen', iniciales: 'JJ', cls: 'gcal-JJ', color: '#7c3aed' },
  { nombre: 'Team Gestión', iniciales: 'TG', cls: 'gcal-TL', color: '#ca8a04' },
];
export const GCAL_HORAS = Array.from({ length: 22 }, (_, i) => `${7 + Math.floor(i / 2)}:${i % 2 ? '30' : '00'}`);
export const GESTION_FAV_USERS = ['Roberto Matallana', 'Carlos Morales', 'Arturo Trelles', 'Silvia Maldonado', 'Juan Jose Edquen'];
export const INICIALES_GESTION: Record<string, string> = { ATG: 'Arturo Trelles', CMP: 'Carlos Morales', RMR: 'Roberto Matallana', SMO: 'Silvia Maldonado' };
