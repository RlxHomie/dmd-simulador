// src/config/roles.js
export const ROLE_CAPS = {
  Admin:       { ui: 'gestion',   simulate: true, savePlan: true, advance: true, exportPDF: true, remove: true, readOnly: false },
  Supervisor:  { ui: 'gestion',   simulate: true, savePlan: true, advance: true, exportPDF: true, remove: false, readOnly: false },
  Gestion:     { ui: 'gestion',   simulate: true, savePlan: true, advance: false, exportPDF: true, remove: false, readOnly: false },
  Comercial:   { ui: 'gestion',   simulate: true, savePlan: false, advance: false, exportPDF: true, remove: false, readOnly: true  },
  Auditoria:   { ui: 'gestion',   simulate: false, savePlan: false, advance: false, exportPDF: true, remove: false, readOnly: true  },
  Invitado:    { ui: 'gestion',   simulate: false, savePlan: false, advance: false, exportPDF: false, remove: false, readOnly: true  },
  Negociacion: { ui: 'negociacion', simulate: true, savePlan: true, advance: true, exportPDF: true, remove: false, readOnly: false }
};

const NORM = s => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu,'').trim().toLowerCase();
const CANON = { administracion:'admin', administrador:'admin', gestion:'gestion', gestora:'gestion', gestor:'gestion', supervisor:'supervisor', comercial:'comercial', auditor:'auditoria', auditoria:'auditoria', invitado:'invitado', negociacion:'negociacion' };

export function normalizePerfil(p) {
  const key = CANON[NORM(p)] || NORM(p);
  const title = key.charAt(0).toUpperCase() + key.slice(1);
  return ROLE_CAPS[title] ? title : 'Gestion';
}

export function capsFor(perfil) {
  const p = normalizePerfil(perfil);
  return ROLE_CAPS[p] || ROLE_CAPS.Gestion;
}
