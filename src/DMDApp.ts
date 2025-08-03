// src/DMDApp.ts
import { ESTADOS, normalizarEstado, getEstadoTexto } from './constants/estados';
import { SimuladorTable } from './components/SimuladorTable';
import { uiService } from './services/uiService';
import { graphService } from './services/graphService';
import { storageService } from './services/storageService';

export interface Plan {            // 🔹 modelo mínimo
  referencia: string;
  cliente: { nombre: string; dni: string; email?: string };
  fecha: string;
  estado: string;
  totalImporte: number;
  descuentoMedio: number;
  cuotaMensual: number;
  ahorro: number;
  ultimaActualizacion?: string;
  fechaContratacion?: string;
  fechaPrimerPago?: string;
}

export class DMDApp {
  /** Listado local de planes */
  public planes: Plan[] = [];

  private simuladorTable?: SimuladorTable;

  /* ---------- Ciclo de vida ---------- */
  async initApp(): Promise<void> {
    this.planes = storageService.getPlansLocal() ?? [];
    this.initializeSimuladorTable();
    this.actualizarDashboard();
    this.actualizarTablaSeguimiento();
    uiService.actualizarUltimaActualizacion();
  }

  /* ---------- Simulador ---------- */
  private initializeSimuladorTable(): void {
    this.simuladorTable = new SimuladorTable('tablaDeudas');
    this.simuladorTable.onUpdate(() => this.actualizarTotales());
  }

  agregarFilaDeuda(datos: Partial<Plan> = {}): void {
    this.simuladorTable ??= new SimuladorTable('tablaDeudas');
    this.simuladorTable.agregarFilaDeuda(datos as any);
  }

  private actualizarTotales(): void {
    // ejemplo sencillo; tu lógica puede sobrescribir esto
    uiService.mostrarNotificacion('Totales actualizados', 'info', { duracion: 1500 });
  }

  /* ---------- Dashboard & seguimiento ---------- */
  private actualizarDashboard(): void {
    const el = document.getElementById('totalPlanesDashboard');
    if (el) el.textContent = `${this.planes.length}`;
  }

  private actualizarTablaSeguimiento(): void {
    // TODO: rellenar tbody #tablaSeguimiento con this.planes
  }

  /* ---------- Métricas ---------- */
  generarTimelinePlan(plan: Plan) {
    const eventos = [
      { fecha: plan.fecha, titulo: 'Plan creado', estado: 'success' }
    ];
    const estado = normalizarEstado(plan.estado);

    if (estado === ESTADOS.PLAN_CONTRATADO || estado === ESTADOS.PRIMER_PAGO) {
      eventos.push({
        fecha: plan.fechaContratacion ?? plan.fecha,
        titulo: 'Plan contratado',
        estado: 'success'
      });
    }
    if (estado === ESTADOS.PRIMER_PAGO) {
      eventos.push({
        fecha: plan.fechaPrimerPago ?? plan.fecha,
        titulo: 'Primer pago',
        estado: 'success'
      });
    }
    //  🔹 diferencia en milisegundos para sort
    return eventos.sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
    );
  }

  calcularFunnel() {
    return this.planes.reduce(
      (acc, p) => {
        switch (normalizarEstado(p.estado)) {
          case ESTADOS.PLAN_CREADO:
            acc.plan_creado++; break;
          case ESTADOS.PLAN_CONTRATADO:
            acc.plan_contratado++; break;
          case ESTADOS.PRIMER_PAGO:
            acc.primer_pago++; break;
        }
        return acc;
      },
      { plan_creado: 0, plan_contratado: 0, primer_pago: 0 }
    );
  }

  /* ---------- Persistencia ---------- */
  async guardarPlanEnGitHub(plan: Plan): Promise<void> {
    try {
      const r = await fetch('/.netlify/functions/save-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan)
      });
      if (!r.ok) throw new Error(await r.text());
      uiService.mostrarNotificacion('Plan guardado en GitHub', 'success');
    } catch (e) {
      uiService.mostrarNotificacion('Error al guardar el plan', 'error');
      throw e;
    }
  }

  async actualizarEstadoPlanRemoto(referencia: string, estado: string): Promise<void> {
    // Implementa tu llamada; aquí solo evita error de TS
    console.debug('Actualizar estado remoto', referencia, estado);
  }

  /* ---------- Sincronización OneDrive / Excel ---------- */
  async syncWithExcel(): Promise<void> {
    if (!graphService.isAuthenticated()) return;

    uiService.actualizarEstadoSincronizacion('syncing');
    const excelPlans = await graphService.loadPlansFromExcel();
    const merged = this.mergePlans(this.planes, excelPlans);
    await graphService.syncPlansWithExcel(merged);
    this.planes = merged;
    storageService.savePlansLocal(merged);
    uiService.actualizarEstadoSincronizacion('synced');
    this.actualizarDashboard();
    this.actualizarTablaSeguimiento();
  }

  private mergePlans(localPlans: Plan[], remotePlans: Plan[]): Plan[] {
    const map = new Map<string, Plan>();
    remotePlans.forEach(p => map.set(p.referencia, p));
    localPlans.forEach(lp => {
      const rp = map.get(lp.referencia);
      if (!rp) return map.set(lp.referencia, lp);
      const newer =
        new Date(lp.ultimaActualizacion ?? lp.fecha).getTime() >
        new Date(rp.ultimaActualizacion ?? rp.fecha).getTime();
      if (newer) map.set(lp.referencia, lp);
    });
    return [...map.values()];
  }
}
