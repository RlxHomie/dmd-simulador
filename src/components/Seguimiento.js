import { storageService } from '../utils/storage.js';
import { PlanDetailModal } from './PlanDetailModal.js';
import { showNotification } from '../utils/notifications.js';

export class Seguimiento {
  constructor(container, onUpdate, onSwitchTab) {
    this.container = container;
    this.onUpdate = onUpdate;
    this.onSwitchTab = onSwitchTab; // Callback para cambiar pestaña
    this.detailModal = null;
  }
  
  async render() {
    this.container.innerHTML = `
      <div class="contenedor-simulador">
        <h2>Seguimiento de Planes</h2>
        
        <!-- Filtros -->
        <div class="form-grid mb-3">
          <div class="campo">
            <label for="buscarSeguimiento">Buscar por cliente o referencia</label>
            <input type="text" id="buscarSeguimiento" placeholder="Nombre, DNI o referencia...">
          </div>
          <div class="campo">
            <label for="filtroEstado">Estado</label>
            <select id="filtroEstado">
              <option value="">Todos los estados</option>
              <option value="plan_creado">Plan Creado</option>
              <option value="plan_contratado">Plan Contratado</option>
              <option value="primer_pago">Primer Pago</option>
            </select>
          </div>
          <div class="campo">
            <label for="filtroPeriodo">Período</label>
            <select id="filtroPeriodo">
              <option value="7">Últimos 7 días</option>
              <option value="30" selected>Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
              <option value="365">Último año</option>
              <option value="0">Todo</option>
            </select>
          </div>
        </div>

        <!-- Tabla de seguimiento -->
        <div class="tabla-deudas">
          <h2>
            <span>Planes en Seguimiento</span>
            <span id="totalPlanesSeguimiento" style="font-size: 0.9rem; font-weight: normal;">0 planes</span>
          </h2>
          <div class="tabla-scroll">
            <table class="seguimiento-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Fecha Creación</th>
                  <th>Deuda Total</th>
                  <th>Cuota</th>
                  <th>Progreso</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody id="tablaSeguimiento">
                <!-- Se llenará dinámicamente -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    
    this.attachEventListeners();
    await this.updateTable();
  }
  
  attachEventListeners() {
    const filters = ['buscarSeguimiento', 'filtroEstado', 'filtroPeriodo'];
    filters.forEach(filterId => {
      const element = document.getElementById(filterId);
      if (element) {
        element.addEventListener('input', () => this.updateTable());
        element.addEventListener('change', () => this.updateTable());
        // Soporte para teclado
        element.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') this.updateTable();
        });
      }
    });
  }
  
  async updateTable() {
    const tbody = document.getElementById('tablaSeguimiento');
    const totalCounter = document.getElementById('totalPlanesSeguimiento');
    
    try {
      // Get all plans
      const plans = await storageService.getPlans();
      
      // Apply filters
      const filteredPlans = this.filterPlans(plans);
      
      // Update counter
      totalCounter.textContent = `${filteredPlans.length} planes`;
      
      // Clear table
      tbody.innerHTML = '';
      
      if (filteredPlans.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 2rem;">
              No hay planes que coincidan con los filtros seleccionados
            </td>
          </tr>
        `;
        return;
      }
      
      // Fill table
      filteredPlans.forEach(plan => {
        const row = this.createPlanRow(plan);
        tbody.appendChild(row);
      });
    } catch (error) {
      showNotification('Error al cargar los planes', 'error');
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 2rem;">
            Error al cargar los datos
          </td>
        </tr>
      `;
    }
  }
  
  filterPlans(plans) {
    const search = document.getElementById('buscarSeguimiento')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('filtroEstado')?.value || '';
    const periodFilter = parseInt(document.getElementById('filtroPeriodo')?.value) || 30;
    
    return plans.filter(plan => {
      // Search filter
      const matchesSearch = !search || 
        [plan.cliente, plan.dni, plan.referencia]
          .filter(Boolean)
          .some(txt => txt.toLowerCase().includes(search));
      
      // Status filter
      const matchesStatus = !statusFilter || plan.estado === statusFilter;
      
      // Period filter
      let matchesPeriod = true;
      if (periodFilter > 0) {
        if (!plan.fecha || isNaN(new Date(plan.fecha))) return false;
        const planDate = new Date(plan.fecha);
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - periodFilter);
        matchesPeriod = planDate >= limitDate;
      }
      
      return matchesSearch && matchesStatus && matchesPeriod;
    });
  }
  
  createPlanRow(plan) {
    const row = document.createElement('tr');
    const date = plan.fecha && !isNaN(new Date(plan.fecha)) 
      ? new Date(plan.fecha).toLocaleDateString('es-ES') 
      : 'Sin fecha';
    const progress = this.getProgressByStatus(plan.estado);
    const statusBadge = this.getStatusBadge(plan.estado);
    
    // Generate initials for avatar
    const initials = plan.cliente?.split(' ')
      ?.map(name => name.charAt(0))
      ?.join('')
      ?.substring(0, 2)
      ?.toUpperCase() || 'N/A';
    
    row.innerHTML = `
      <td>
        <div class="cliente-info">
          <div class="cliente-avatar" aria-label="Avatar del cliente ${plan.cliente || 'Sin nombre'}">${initials}</div>
          <div>
            <div class="cliente-nombre">${plan.cliente || 'Sin nombre'}</div>
            <div class="cliente-ref">${plan.referencia}</div>
          </div>
        </div>
      </td>
      <td>${statusBadge}</td>
      <td>${date}</td>
      <td style="text-align: right;">${plan.deudaTotal?.toLocaleString('es-ES', {minimumFractionDigits: 2}) || '0,00'} €</td>
      <td style="text-align: right;">${plan.cuotaMensual?.toLocaleString('es-ES', {minimumFractionDigits: 2}) || '0,00'} €</td>
      <td>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <div role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100" class="progress-bar-container">
            <div class="progress-bar" style="width: ${progress}%;"></div>
          </div>
          <span style="font-size: 0.875rem; color: var(--text-secondary);">${progress}%</span>
        </div>
      </td>
      <td>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-secundario btn-icon" data-action="view" data-ref="${plan.referencia}" title="Ver detalles" aria-label="Ver detalles del plan">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-label="Ícono de ver detalles">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
          <button class="btn btn-secundario btn-icon" data-action="edit" data-ref="${plan.referencia}" title="Editar" aria-label="Editar plan">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-label="Ícono de editar">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn btn-success btn-icon" data-action="advance" data-ref="${plan.referencia}" title="Avanzar fase" aria-label="Avanzar fase del plan">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-label="Ícono de avanzar fase">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      </td>
    `;
    
    // Add event listeners to action buttons
    row.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        const ref = e.currentTarget.dataset.ref;
        this.handleAction(action, ref);
      });
      // Soporte para teclado
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const action = e.currentTarget.dataset.action;
          const ref = e.currentTarget.dataset.ref;
          this.handleAction(action, ref);
        }
      });
    });
    
    return row;
  }
  
  getProgressByStatus(status) {
    const progressMap = {
      'plan_creado': 25,
      'plan_contratado': 50,
      'primer_pago': 100
    };
    return progressMap[status] || 0;
  }
  
  getStatusBadge(status) {
    const badges = {
      'plan_creado': '<span class="estado-badge plan_creado">📋 Simulado</span>',
      'plan_contratado': '<span class="estado-badge plan_contratado">✍️ Contratado</span>',
      'primer_pago': '<span class="estado-badge primer_pago">💰 Primer Pago</span>'
    };
    return badges[status] || '<span class="estado-badge">❓ Desconocido</span>';
  }
  
  async handleAction(action, reference) {
    try {
      const plans = await storageService.getPlans();
      const plan = plans.find(p => p.referencia === reference);
      
      if (!plan) {
        showNotification('Plan no encontrado', 'error');
        return;
      }
      
      switch (action) {
        case 'view':
          this.showPlanDetails(plan);
          break;
        case 'edit':
          this.editPlan(plan);
          break;
        case 'advance':
          await this.advancePhase(plan);
          break;
      }
    } catch (error) {
      showNotification('Error al procesar la acción', 'error');
    }
  }
  
  showPlanDetails(plan) {
    if (!this.detailModal) {
      this.detailModal = new PlanDetailModal();
    }
    this.detailModal.show(plan);
  }
  
  editPlan(plan) {
    if (this.onSwitchTab) {
      this.onSwitchTab('simulador', plan);
    }
    showNotification(`Editando plan ${plan.referencia}`, 'info');
  }
  
  async advancePhase(plan) {
    let newStatus = plan.estado;
    let message = '';
    let description = '';
    
    switch (plan.estado) {
      case 'plan_creado':
        newStatus = 'plan_contratado';
        message = 'Plan marcado como contratado';
        description = 'El cliente firmó el contrato de reestructuración';
        break;
      case 'plan_contratado':
        newStatus = 'primer_pago';
        message = 'Primer pago registrado';
        description = 'El cliente realizó el primer pago del plan de reestructuración';
        break;
      case 'primer_pago':
        showNotification('El plan ya está en la fase final', 'warning');
        return;
    }
    
    try {
      // Update plan
      plan.estado = newStatus;
      plan.progreso = this.getProgressByStatus(newStatus);
      plan.fechaModificacion = new Date().toISOString();
      
      // Add to history
      if (!plan.historial) plan.historial = [];
      plan.historial.push({
        fecha: new Date().toISOString(),
        accion: message,
        estado: newStatus,
        descripcion: description,
        usuario: 'Usuario' // En producción, usar servicio de autenticación
      });
      
      await storageService.savePlan(plan);
      
      // Update table
      await this.updateTable();
      
      showNotification(message, 'success');
      
      // Update dashboard if callback provided
      if (this.onUpdate) this.onUpdate();
    } catch (error) {
      showNotification('Error al avanzar la fase del plan', 'error');
    }
  }
}