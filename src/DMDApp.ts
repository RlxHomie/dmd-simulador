// This file shows only the key changes needed for the DMDApp class
// The full implementation would maintain all existing functionality

import { ESTADOS, normalizarEstado, getEstadoTexto, getEstadoColor, getEstadoIcono } from './constants/estados';
import { graphService } from './services/graphService';
import { storageService } from './services/storageService';
import { uiService } from './services/uiService';
import { SimuladorTable } from './components/SimuladorTable';

export class DMDApp {
  // ... existing properties ...
  private simuladorTable: SimuladorTable | null = null;

  // Updated method to use new estados
  generarTimelinePlan(plan: any) {
    const eventos = [];
    const estado = normalizarEstado(plan.estado);
    
    // Evento de creación
    eventos.push({
      fecha: plan.fecha,
      tipo: 'creacion',
      titulo: 'Plan creado',
      descripcion: 'Se creó el plan de reestructuración',
      estado: 'success'
    });
    
    // Eventos según el estado
    if (estado === ESTADOS.PLAN_CONTRATADO || estado === ESTADOS.PRIMER_PAGO) {
      eventos.push({
        fecha: plan.fechaContratacion || plan.fecha,
        tipo: 'contratacion',
        titulo: 'Plan contratado',
        descripcion: 'El cliente aceptó y contrató el plan',
        estado: 'success'
      });
    }
    
    if (estado === ESTADOS.PRIMER_PAGO) {
      eventos.push({
        fecha: plan.fechaPrimerPago || plan.fecha,
        tipo: 'pago',
        titulo: 'Primer pago realizado',
        descripcion: 'Se realizó el primer pago del plan',
        estado: 'success'
      });
    }
    
    // Ordenar por fecha
    return eventos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  }

  // Updated method for funnel calculation
  calcularFunnel() {
    const funnel = {
      plan_creado: 0,
      plan_contratado: 0,
      primer_pago: 0
    };
    
    this.planes.forEach(plan => {
      const estado = normalizarEstado(plan.estado);
      
      switch(estado) {
        case ESTADOS.PLAN_CREADO:
          funnel.plan_creado++;
          break;
        case ESTADOS.PLAN_CONTRATADO:
          funnel.plan_contratado++;
          break;
        case ESTADOS.PRIMER_PAGO:
          funnel.primer_pago++;
          break;
      }
    });
    
    return funnel;
  }

  // New method for Excel sync
  async syncWithExcel(): Promise<void> {
    if (!graphService.isAuthenticated()) {
      console.log('Not authenticated with Graph');
      return;
    }

    try {
      uiService.actualizarEstadoSincronizacion('syncing');
      
      // Create Excel file if it doesn't exist
      await graphService.createExcelFileIfNotExists('/Simulador/plans.xlsx');
      
      // Load plans from Excel
      const excelPlans = await graphService.loadPlansFromExcel();
      
      // Merge with local plans
      const mergedPlans = this.mergePlans(this.planes, excelPlans);
      
      // Save merged plans back to Excel
      await graphService.syncPlansWithExcel(mergedPlans);
      
      // Update local plans
      this.planes = mergedPlans;
      storageService.savePlansLocal(mergedPlans);
      
      uiService.actualizarEstadoSincronizacion('synced');
      uiService.mostrarNotificacion('Sincronización con Excel completada', 'success');
      
      // Update UI
      this.actualizarDashboard();
      this.actualizarTablaSeguimiento();
      
    } catch (error: any) {
      console.error('Error syncing with Excel:', error);
      
      if (error.message.includes('CONFLICT')) {
        // Handle conflict
        await this.handleSyncConflict(error);
      } else {
        uiService.actualizarEstadoSincronizacion('error');
        uiService.mostrarNotificacion('Error al sincronizar con Excel', 'error');
      }
    }
  }

  // Handle sync conflicts
  private async handleSyncConflict(error: Error): Promise<void> {
    const localData = this.planes;
    const remoteData = await graphService.loadPlansFromExcel();
    
    const resolution = await uiService.mostrarModalConflicto(localData, remoteData);
    
    switch (resolution) {
      case 'local':
        // Force write local data
        await graphService.syncPlansWithExcel(localData);
        uiService.mostrarNotificacion('Usando versión local', 'info');
        break;
      case 'remote':
        // Use remote data
        this.planes = remoteData;
        storageService.savePlansLocal(remoteData);
        uiService.mostrarNotificacion('Usando versión remota', 'info');
        break;
      case 'cancel':
        uiService.mostrarNotificacion('Sincronización cancelada', 'warning');
        break;
    }
  }

  // Merge plans helper
  private mergePlans(localPlans: any[], remotePlans: any[]): any[] {
    const merged = new Map();
    
    // Add all remote plans
    remotePlans.forEach(plan => {
      merged.set(plan.referencia, plan);
    });
    
    // Merge or add local plans
    localPlans.forEach(localPlan => {
      const remotePlan = merged.get(localPlan.referencia);
      
      if (remotePlan) {
        // Compare timestamps and keep the newer one
        const localTime = new Date(localPlan.ultimaActualizacion || localPlan.fecha).getTime();
        const remoteTime = new Date(remotePlan.ultimaActualizacion || remotePlan.fecha).getTime();
        
        if (localTime > remoteTime) {
          merged.set(localPlan.referencia, localPlan);
        }
      } else {
        // Plan only exists locally
        merged.set(localPlan.referencia, localPlan);
      }
    });
    
    return Array.from(merged.values());
  }

  // Updated state badge rendering
  obtenerTextoEstado(estado: string): string {
    return getEstadoTexto(normalizarEstado(estado));
  }

  // Initialize simulador table with new structure
  initializeSimuladorTable(): void {
    this.simuladorTable = new SimuladorTable('tablaDeudas');
    this.simuladorTable.onUpdate(() => this.actualizarTotales());
  }

  // Updated agregarFilaDeuda to use the new component
  agregarFilaDeuda(datos = {}): void {
    if (!this.simuladorTable) {
      this.initializeSimuladorTable();
    }
    this.simuladorTable?.agregarFilaDeuda(datos);
  }

  // Sync pending operations when coming back online
  async syncPendingOperations(): Promise<void> {
    const pendingOps = storageService.getPendingOperations();
    
    if (pendingOps.length === 0) return;
    
    uiService.mostrarNotificacion(`Sincronizando ${pendingOps.length} operaciones pendientes...`, 'info');
    
    for (const op of pendingOps) {
      try {
        switch (op.type) {
          case 'save_plan':
            await this.guardarPlanEnGitHub(op.data);
            break;
          case 'update_estado':
            await this.actualizarEstadoPlanRemoto(op.data.referencia, op.data.estado);
            break;
        }
        
        storageService.removePendingOperation(op.id);
      } catch (error) {
        console.error('Error syncing operation:', error);
      }
    }
    
    uiService.mostrarNotificacion('Sincronización completada', 'success');
  }
}