// Estados simplificados según requerimiento
export const ESTADOS = {
  PLAN_CREADO: 'plan_creado',
  PLAN_CONTRATADO: 'plan_contratado',
  PRIMER_PAGO: 'primer_pago'
} as const;

export type EstadoPlan = typeof ESTADOS[keyof typeof ESTADOS];

// Configuración de estados
export const ESTADOS_CONFIG = {
  [ESTADOS.PLAN_CREADO]: {
    texto: 'Plan Creado',
    color: '#0071e3',
    icono: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>',
    siguiente: [ESTADOS.PLAN_CONTRATADO],
    orden: 1
  },
  [ESTADOS.PLAN_CONTRATADO]: {
    texto: 'Plan Contratado',
    color: '#34c759',
    icono: '<polyline points="20 6 9 17 4 12"></polyline>',
    siguiente: [ESTADOS.PRIMER_PAGO],
    orden: 2
  },
  [ESTADOS.PRIMER_PAGO]: {
    texto: 'Primer Pago',
    color: '#30d158',
    icono: '<line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>',
    siguiente: [],
    orden: 3
  }
} as const;

// Helper functions
export function getEstadoTexto(estado: EstadoPlan): string {
  return ESTADOS_CONFIG[estado]?.texto || estado;
}

export function getEstadoColor(estado: EstadoPlan): string {
  return ESTADOS_CONFIG[estado]?.color || '#666';
}

export function getEstadoIcono(estado: EstadoPlan): string {
  return ESTADOS_CONFIG[estado]?.icono || '';
}

export function canTransitionTo(currentState: EstadoPlan, nextState: EstadoPlan): boolean {
  const config = ESTADOS_CONFIG[currentState];
  return config?.siguiente.includes(nextState) || false;
}

export function getNextStates(currentState: EstadoPlan): EstadoPlan[] {
  return ESTADOS_CONFIG[currentState]?.siguiente || [];
}

export function getEstadoOrden(estado: EstadoPlan): number {
  return ESTADOS_CONFIG[estado]?.orden || 0;
}

// Mapeo para compatibilidad con estados antiguos
export const LEGACY_ESTADO_MAP: Record<string, EstadoPlan> = {
  'simulado': ESTADOS.PLAN_CREADO,
  'contratado': ESTADOS.PLAN_CONTRATADO,
  'en_negociacion': ESTADOS.PLAN_CONTRATADO,
  'aprobado': ESTADOS.PLAN_CONTRATADO,
  'en_pago': ESTADOS.PRIMER_PAGO,
  'completado': ESTADOS.PRIMER_PAGO,
  'cancelado': ESTADOS.PLAN_CREADO
};

export function normalizarEstado(estado: string | undefined | null): EstadoPlan {
  if (!estado) return ESTADOS.PLAN_CREADO;
  
  // Si es un estado nuevo, devolverlo tal cual
  if (Object.values(ESTADOS).includes(estado as EstadoPlan)) {
    return estado as EstadoPlan;
  }
  
  // Si es un estado antiguo, mapearlo
  return LEGACY_ESTADO_MAP[estado] || ESTADOS.PLAN_CREADO;
}