// Estados simplificados
export const ESTADOS = {
  PLAN_CREADO:      'plan_creado',
  PLAN_CONTRATADO:  'plan_contratado',
  PRIMER_PAGO:      'primer_pago'
} as const;

export type EstadoPlan = typeof ESTADOS[keyof typeof ESTADOS];

/** Configuración visual y flujos permitidos de cada estado */
interface EstadoConfig {
  texto: string;
  color: string;
  icono: string;
  /** Estados a los que se puede transicionar, ordenados */
  siguiente: readonly EstadoPlan[];
  /** Posición para ordenar en tablas / timelines */
  orden: number;
}

export const ESTADOS_CONFIG: Record<EstadoPlan, EstadoConfig> = {
  [ESTADOS.PLAN_CREADO]: {
    texto: 'Plan Creado',
    color: '#0071e3',
    icono:
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    siguiente: [ESTADOS.PLAN_CONTRATADO],
    orden: 1
  },
  [ESTADOS.PLAN_CONTRATADO]: {
    texto: 'Plan Contratado',
    color: '#34c759',
    icono: '<polyline points="20 6 9 17 4 12"/>',
    siguiente: [ESTADOS.PRIMER_PAGO],
    orden: 2
  },
  [ESTADOS.PRIMER_PAGO]: {
    texto: 'Primer Pago',
    color: '#30d158',
    icono:
      '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    siguiente: [],
    orden: 3
  }
} as const;

/* ─────────────── Helpers ─────────────── */

export const getEstadoTexto  = (e: EstadoPlan) => ESTADOS_CONFIG[e].texto;
export const getEstadoColor  = (e: EstadoPlan) => ESTADOS_CONFIG[e].color;
export const getEstadoIcono  = (e: EstadoPlan) => ESTADOS_CONFIG[e].icono;

export const canTransitionTo = (from: EstadoPlan, to: EstadoPlan) =>
  ESTADOS_CONFIG[from].siguiente.includes(to);

export const getNextStates = (e: EstadoPlan): readonly EstadoPlan[] =>
  ESTADOS_CONFIG[e].siguiente;

export const getEstadoOrden = (e: EstadoPlan) => ESTADOS_CONFIG[e].orden;

/* ───────── Mapeo de compatibilidad ───────── */

export const LEGACY_ESTADO_MAP: Record<string, EstadoPlan> = {
  simulado:        ESTADOS.PLAN_CREADO,
  contratado:      ESTADOS.PLAN_CONTRATADO,
  en_negociacion:  ESTADOS.PLAN_CONTRATADO,
  aprobado:        ESTADOS.PLAN_CONTRATADO,
  en_pago:         ESTADOS.PRIMER_PAGO,
  completado:      ESTADOS.PRIMER_PAGO,
  cancelado:       ESTADOS.PLAN_CREADO
};

/**
 * Convierte un estado antiguo a los nuevos o devuelve uno válido si ya lo es.
 */
export function normalizarEstado(estado: string | undefined | null): EstadoPlan {
  if (!estado) return ESTADOS.PLAN_CREADO;

  // Object.values devuelve readonly (string | EstadoPlan)[], casteamos a string[]
  if ((Object.values(ESTADOS) as string[]).includes(estado)) {
    return estado as EstadoPlan;
  }
  return LEGACY_ESTADO_MAP[estado] ?? ESTADOS.PLAN_CREADO;
}
