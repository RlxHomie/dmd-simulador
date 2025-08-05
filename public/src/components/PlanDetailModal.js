export class PlanDetailModal {
  constructor() {
    this.modal = null;
    this.handleEscape = (e) => {
      if (e.key === 'Escape') this.close();
    };
  }
  
  show(plan) {
    this.close(); // Close any existing modal
    
    this.modal = document.createElement('div');
    this.modal.className = 'modal';
    this.modal.setAttribute('role', 'dialog');
    this.modal.setAttribute('aria-modal', 'true');
    this.modal.setAttribute('aria-labelledby', 'planTitle');
    this.modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="planTitle">Detalles del Plan - <span>${this.escapeHTML(plan.referencia)}</span></h3>
          <button type="button" class="btn btn-icon" id="closeModal" aria-label="Cerrar modal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-label="Ícono de cerrar">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          ${this.renderPlanDetails(plan)}
        </div>
      </div>
    `;
    
    document.body.appendChild(this.modal);
    
    // Add event listeners
    this.modal.querySelector('#closeModal').addEventListener('click', () => this.close());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });
    this.modal.addEventListener('keydown', (e) => {
      if (e.target === this.modal && (e.key === 'Enter' || e.key === 'Space')) {
        e.preventDefault();
        this.close();
      }
    });
    document.addEventListener('keydown', this.handleEscape);
    
    // Set focus to close button
    this.modal.querySelector('#closeModal').focus();
  }
  
  escapeHTML(str) {
    if (!str) return str || '';
    return str.replace(/[&<>"']/g, (match) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[match]));
  }
  
  renderPlanDetails(plan) {
    const timelineHTML = this.generateTimeline(plan);
    
    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
        <div style="background: var(--background); padding: 1rem; border-radius: var(--radius);">
          <h4 style="margin: 0 0 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">CLIENTE</h4>
          <p style="margin: 0; font-weight: 600;">${this.escapeHTML(plan.cliente)}</p>
          <p style="margin: 0.25rem 0 0; font-size: 0.875rem; color: var(--text-secondary);">${this.escapeHTML(plan.dni) || 'DNI no registrado'}</p>
          <p style="margin: 0.25rem 0 0; font-size: 0.875rem; color: var(--text-secondary);">${this.escapeHTML(plan.email) || 'Email no registrado'}</p>
        </div>
        
        <div style="background: var(--background); padding: 1rem; border-radius: var(--radius);">
          <h4 style="margin: 0 0 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">DEUDA TOTAL</h4>
          <p style="margin: 0; font-weight: 600; font-size: 1.25rem;">${plan.deudaTotal?.toLocaleString('es-ES', {minimumFractionDigits: 2}) || '0,00'} €</p>
          <p style="margin: 0.25rem 0 0; font-size: 0.875rem; color: var(--success);">Ahorro: ${plan.ahorro?.toLocaleString('es-ES', {minimumFractionDigits: 2}) || '0,00'} €</p>
          <p style="margin: 0.25rem 0 0; font-size: 0.875rem; color: var(--primary);">Final: ${plan.deudaFinal?.toLocaleString('es-ES', {minimumFractionDigits: 2}) || '0,00'} €</p>
        </div>
        
        <div style="background: var(--background); padding: 1rem; border-radius: var(--radius);">
          <h4 style="margin: 0 0 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">PLAN DE PAGO</h4>
          <p style="margin: 0; font-weight: 600; font-size: 1.25rem;">${plan.cuotaMensual?.toLocaleString('es-ES', {minimumFractionDigits: 2}) || '0,00'} €</p>
          <p style="margin: 0.25rem 0 0; font-size: 0.875rem; color: var(--text-secondary);">${plan.numCuotas || 0} cuotas mensuales</p>
        </div>
        
        <div style="background: var(--background); padding: 1rem; border-radius: var(--radius);">
          <h4 style="margin: 0 0 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">ESTADO ACTUAL</h4>
          <p style="margin: 0;">${this.getStatusBadge(plan.estado)}</p>
          <p style="margin: 0.5rem 0 0; font-size: 0.875rem; color: var(--text-secondary);">
            Progreso: ${this.getProgressByStatus(plan.estado)}%
          </p>
        </div>
      </div>
      
      <div class="timeline-container">
        <h4>Historia del Plan</h4>
        ${timelineHTML}
      </div>
      
      ${plan.deudas && plan.deudas.length > 0 ? `
        <h4 style="margin-top: 2rem;">Deudas Incluidas</h4>
        <div style="overflow-x: auto;">
          <table style="width: 100%; font-size: 0.875rem;">
            <thead>
              <tr style="background: var(--background);">
                <th style="padding: 0.75rem;">Contrato</th>
                <th style="padding: 0.75rem;">Producto</th>
                <th style="padding: 0.75rem;">Entidad</th>
                <th style="padding: 0.75rem; text-align: right;">Importe Original</th>
                <th style="padding: 0.75rem; text-align: right;">Descuento</th>
                <th style="padding: 0.75rem; text-align: right;">Importe Final</th>
              </tr>
            </thead>
            <tbody>
              ${plan.deudas.map(deuda => `
                <tr>
                  <td style="padding: 0.75rem;">${this.escapeHTML(deuda.contrato) || '-'}</td>
                  <td style="padding: 0.75rem;">${this.escapeHTML(deuda.producto) || '-'}</td>
                  <td style="padding: 0.75rem;">${this.escapeHTML(deuda.entidad) || '-'}</td>
                  <td style="padding: 0.75rem; text-align: right;">${deuda.importeOriginal?.toLocaleString('es-ES', {minimumFractionDigits: 2}) || '0,00'} €</td>
                  <td style="padding: 0.75rem; text-align: right;">${deuda.descuento || 0}%</td>
                  <td style="padding: 0.75rem; text-align: right; color: var(--success); font-weight: 600;">${deuda.importeFinal?.toLocaleString('es-ES', {minimumFractionDigits: 2}) || '0,00'} €</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
    `;
  }
  
  generateTimeline(plan) {
    if (!plan.historial || plan.historial.length === 0) {
      return '<p style="color: var(--text-secondary); text-align: center;">No hay historial disponible</p>';
    }
    
    return `
      <div class="timeline">
        ${plan.historial.map(evento => {
          const fecha = evento.fecha && !isNaN(new Date(evento.fecha))
            ? new Date(evento.fecha).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            : 'Fecha inválida';
          
          let markerClass = 'primary';
          let icon = '📋';
          
          if (evento.estado === 'plan_contratado') {
            markerClass = 'warning';
            icon = '✍️';
          } else if (evento.estado === 'primer_pago') {
            markerClass = 'success';
            icon = '💰';
          }
          
          return `
            <div class="timeline-item">
              <div class="timeline-marker ${markerClass}">
                <span style="font-size: 12px;">${icon}</span>
              </div>
              <div class="timeline-content">
                <div class="timeline-date">${this.escapeHTML(fecha)}</div>
                <div class="timeline-title">${this.escapeHTML(evento.accion)}</div>
                <div class="timeline-description">${this.escapeHTML(evento.descripcion)}</div>
                ${evento.usuario ? `<div class="timeline-user">Por: ${this.escapeHTML(evento.usuario)}</div>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
  
  getStatusBadge(status) {
    const badges = {
      'plan_creado': '<span class="estado-badge plan_creado">📋 Simulado</span>',
      'plan_contratado': '<span class="estado-badge plan_contratado">✍️ Contratado</span>',
      'primer_pago': '<span class="estado-badge primer_pago">💰 Primer Pago</span>'
    };
    return badges[status] || '<span class="estado-badge">❓ Desconocido</span>';
  }
  
  getProgressByStatus(status) {
    const progressMap = {
      'plan_creado': 25,
      'plan_contratado': 50,
      'primer_pago': 100
    };
    return progressMap[status] || 0;
  }
  
  close() {
    if (this.modal) {
      document.removeEventListener('keydown', this.handleEscape);
      this.modal.remove();
      this.modal = null;
    }
  }
}