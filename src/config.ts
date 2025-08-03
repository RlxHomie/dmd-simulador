// Configuración global de la aplicación
export const CONFIG = {
  // URLs del sistema
  API_URL: window.location.hostname === 'localhost' 
    ? 'http://localhost:8888/.netlify/functions' 
    : '/.netlify/functions',
  
  GITHUB_REPO: 'RlxHomie/dmd-simulador',
  
  // Valores por defecto (se actualizarán desde los archivos JSON)
  ENTIDADES: [] as string[],
  TIPOS_PRODUCTO: [] as Array<{
    id?: string;
    tipo: string;
    maxDescuento: number;
    color: string;
    activo?: boolean;
    descripcion?: string;
  }>,
  
  MAX_DESCUENTO_TOTAL: 95,
  
  // Formato de moneda
  FORMATO_MONEDA: {
    style: "currency" as const,
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  },
  
  // Límites
  LIMITES: {
    minCuotas: 1,
    maxCuotas: 360,
    maxDeudasPorPlan: 50
  },
  
  // Comisiones por defecto
  COMISIONES: {
    porcentaje: 20,
    minimo: 500,
    iva: 21
  }
};