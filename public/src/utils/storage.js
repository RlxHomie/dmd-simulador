import { config } from '../config/config.js';
import { excelApi } from './excelApi.js';
import { authService } from './auth.js';
import { showNotification } from './notifications.js';

class StorageService {
  constructor() {
    this.isOnline = false;
    this.pendingSync = [];
    this.syncInterval = null;
  }
  
  async initialize() {
    // Check if we can connect to Excel
    // Load any pending sync items
    this.loadPendingSync();
    this.isOnline = await this.checkOnlineStatus();
    
    // Start sync interval
    this.startSyncInterval();
  }
  
  async checkOnlineStatus() {
    try {
      if (!authService.isAuthenticated()) {
        return false;
      }
      
      // Try a simple API call
      await excelApi.readSheet(config.graph.sheets.entradas);
      return true;
    } catch (error) {
      console.log('Offline mode - using localStorage');
      return false;
    }
  }
  
  startSyncInterval() {
    this.syncInterval = setInterval(async () => {
      if (!this.isOnline) {
        this.isOnline = await this.checkOnlineStatus();
        if (this.isOnline) {
          await this.syncPendingData();
        }
      }
    }, config.app.syncInterval); // 30 s según config
  }
  
  loadPendingSync() {
    const pending = localStorage.getItem('pendingSync');
    if (pending) {
      this.pendingSync = JSON.parse(pending);
    }
  }
  
  savePendingSync() {
    localStorage.setItem('pendingSync', JSON.stringify(this.pendingSync));
  }
  
  async syncPendingData() {
    if (this.pendingSync.length === 0) return;
    
    showNotification('Sincronizando datos pendientes...', 'info');
    
    const failedSync = [];
    
    for (const item of this.pendingSync) {
      try {
        switch (item.type) {
          case 'plan':
            await excelApi.savePlan(item.data);
            break;
          case 'entrada':
            await excelApi.saveEntrada(item.data);
            break;
        }
      } catch (error) {
        console.error('Failed to sync item:', error);
        failedSync.push(item);
      }
    }
    
    this.pendingSync = failedSync;
    this.savePendingSync();
    
    if (failedSync.length === 0) {
      showNotification('Todos los datos sincronizados correctamente', 'success');
    } else {
      showNotification(`${failedSync.length} elementos pendientes de sincronizar`, 'warning');
    }
  }
  
  // Guardar plan (híbrido)
  async savePlan(plan) {
    // Asegurar valores por defecto para fecha y estado
    plan.fecha = plan.fecha || new Date().toISOString();
    plan.estado = plan.estado || 'plan_creado';
    // Registrar fecha de modificación
    plan.fechaModificacion = new Date().toISOString();

    // Always save to localStorage
    const plans = this.getLocalPlans();
    const existingIndex = plans.findIndex(p => p.referencia === plan.referencia);
    
    if (existingIndex >= 0) {
      plans[existingIndex] = plan;
    } else {
      plans.push(plan);
    }
    
    localStorage.setItem('planesConfirmados', JSON.stringify(plans));
    
    // Try to save to Excel if online
    if (this.isOnline) {
      try {
        await excelApi.savePlan(plan);
        showNotification('Plan guardado en la nube', 'success');
      } catch (error) {
        console.error('Failed to save to Excel:', error);
        this.pendingSync.push({ type: 'plan', data: plan });
        this.savePendingSync();
        showNotification('Plan guardado localmente (se sincronizará cuando haya conexión)', 'warning');
      }
    } else {
      this.pendingSync.push({ type: 'plan', data: plan });
      this.savePendingSync();
      showNotification('Plan guardado localmente (modo offline)', 'info');
    }
  }
  
  // Obtener planes (híbrido)
  async getPlans() {
    const localPlans = this.getLocalPlans();
    
    if (this.isOnline) {
      try {
        const excelPlans = await excelApi.getPlanes();
        
        // Merge with local plans (local takes precedence for conflicts)
        const mergedPlans = [...excelPlans];
        
        localPlans.forEach(localPlan => {
          const index = mergedPlans.findIndex(p => p.referencia === localPlan.referencia);
          if (index >= 0) {
            // Update with local version if it's newer
            if (!mergedPlans[index].fechaModificacion || 
                new Date(localPlan.fechaModificacion || localPlan.fecha) > 
                new Date(mergedPlans[index].fechaModificacion || mergedPlans[index].fecha)) {
              mergedPlans[index] = localPlan;
            }
          } else {
            mergedPlans.push(localPlan);
          }
        });
        
        // Update localStorage with merged data
        localStorage.setItem('planesConfirmados', JSON.stringify(mergedPlans));
        
        return mergedPlans;
      } catch (error) {
        console.error('Failed to get plans from Excel:', error);
        showNotification('Usando datos locales (error al conectar con la nube)', 'warning');
        return localPlans;
      }
    }
    
    return localPlans;
  }
  
  getLocalPlans() {
    return JSON.parse(localStorage.getItem('planesConfirmados') || '[]');
  }
  
  // Guardar entrada (híbrido)
  async saveEntrada(entrada) {
    // Save to localStorage
    const entradas = this.getLocalEntradas();
    entradas.push(entrada);
    localStorage.setItem('entradas', JSON.stringify(entradas));
    
    // Try to save to Excel if online
    if (this.isOnline) {
      try {
        await excelApi.saveEntrada(entrada);
      } catch (error) {
        console.error('Failed to save entrada to Excel:', error);
        this.pendingSync.push({ type: 'entrada', data: entrada });
        this.savePendingSync();
      }
    } else {
      this.pendingSync.push({ type: 'entrada', data: entrada });
      this.savePendingSync();
    }
  }
  
  // Obtener entradas (híbrido)
  async getEntradas() {
    const localEntradas = this.getLocalEntradas();
    
    if (this.isOnline) {
      try {
        const excelEntradas = await excelApi.getEntradas();
        
        // Merge (avoiding duplicates)
        const merged = [...excelEntradas];
        localEntradas.forEach(local => {
          const exists = merged.some(e => 
            e.fecha === local.fecha && 
            e.cliente === local.cliente && 
            e.dni === local.dni
          );
          if (!exists) {
            merged.push(local);
          }
        });
        
        localStorage.setItem('entradas', JSON.stringify(merged));
        return merged;
      } catch (error) {
        console.error('Failed to get entradas from Excel:', error);
        return localEntradas;
      }
    }
    
    return localEntradas;
  }
  
  getLocalEntradas() {
    return JSON.parse(localStorage.getItem('entradas') || '[]');
  }
  
  // Get current sync status
  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      pendingCount: this.pendingSync.length
    };
  }
  
  // Clean up
  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

export const storageService = new StorageService();