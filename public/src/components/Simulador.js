import { storageService } from '../utils/storage.js';
import { showNotification, showConfirm } from '../utils/notifications.js';

export class Simulador {
  constructor(container, onUpdate) {
    this.container = container;
    this.onUpdate = onUpdate;
    this.debtCounter = 0;
    this.currentPlan = null;
  }
  
  render() {
    this.container.innerHTML = `
      <div class="contenedor-simulador">
        <div class="header-simulador">
          <img src="/logo.png" alt="Logo DMD Asesores" class="logo">
          <h1>Simulador de Reestructuración de Deuda</h1>
          <p style="color: var(--text-secondary); margin-top: -0.5rem;">
            Sistema colaborativo con sincronización en la nube
          </p>
        </div>

        <form id="formularioSimulador">
          <div class="form-grid">
            <div class="campo">
              <label for="nombreDeudor">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                Nombre del Cliente
              </label>
              <input type="text" id="nombreDeudor" required placeholder="Ej: Juan Pérez García">
              <span class="help-text">Nombre completo del deudor</span>
            </div>

            <div class="campo">
              <label for="dniDeudor">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <path d="M14 2v6h6"></path>
                  <line x1="12" y1="11" x2="12" y2="17"></line>
                  <line x1="9" y1="14" x2="15" y2="14"></line>
                </svg>
                DNI/NIE
              </label>
              <input type="text" id="dniDeudor" required placeholder="Ej: 12345678A o X1234567A" pattern="^([0-9]{8}[A-Za-z]|[XYZKLM][0-9]{7}[A-Za-z])$">
              <span class="help-text">Documento de identidad</span>
            </div>

            <div class="campo">
              <label for="emailDeudor">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                Email
              </label>
              <input type="email" id="emailDeudor" placeholder="correo@ejemplo.com">
              <span class="help-text">Para enviar el plan por correo</span>
            </div>

            <div class="campo">
              <label for="numCuotas">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                Número de cuotas
              </label>
              <input type="number" id="numCuotas" min="1" max="360" value="12" required>
              <span class="help-text">Entre 1 y 360 meses</span>
            </div>
          </div>

          <div class="tabla-deudas">
            <h2>
              <span>Deudas a Incluir</span>
              <span id="totalDeudasCount" style="font-size: 0.9rem; font-weight: normal;">0 deudas</span>
            </h2>
            <div class="tabla-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Nº Contrato</th>
                    <th>Producto</th>
                    <th>Entidad</th>
                    <th>Antigüedad</th>
                    <th>Importe (€)</th>
                    <th>% Desc.</th>
                    <th>Importe Final</th>
                    <th style="width: 50px;">Acción</th>
                  </tr>
                </thead>
                <tbody id="tablaDeudas"></tbody>
                <tfoot>
                  <tr style="background: #f8f9fa;">
                    <td colspan="4" style="text-align: right; font-weight: 600;">Totales:</td>
                    <td style="text-align: right; font-weight: 600;" id="totalImporte">0,00 €</td>
                    <td style="text-align: center; font-weight: 600;" id="totalDescuentoMedio">0%</td>
                    <td style="text-align: right; font-weight: 600; color: var(--success);" id="totalImporteFinal">0,00 €</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style="padding: 1rem;">
              <button type="button" class="btn btn-secundario" id="btnAgregarFila">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Añadir Deuda
              </button>
              <button type="button" class="btn btn-secundario" id="btnCargarPlan">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Cargar Plan Guardado
              </button>
            </div>
          </div>

          <div class="d-flex justify-between align-center">
            <button type="button" class="btn btn-secundario" id="btnReAnalizar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              Reiniciar
            </button>
            <div class="d-flex gap-1">
              <button type="button" class="btn btn-secundario" id="btnGuardarBorrador">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                Guardar Borrador
              </button>
              <button type="button" class="btn btn-secundario" id="btnSimular">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 11H3v10h6V11zm4-8H7v18h6V3zm4 4h-6v14h6V7zm4 4h-6v10h6V11z"></path>
                </svg>
                Simular Plan
              </button>
              <button type="submit" class="btn btn-primario" id="btnCalcular" style="display: none;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Contratar y Guardar
              </button>
            </div>
          </div>
        </form>

        <!-- Vista previa de simulación -->
        <div class="resultado-simulacion" id="resultadoSimulacion" style="display: none;">
          <h3>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
              <path d="M9 11H3v10h6V11zm4-8H7v18h6V3zm4 4h-6v14h6V7zm4 4h-6v10h6V11z"></path>
            </svg>
            Simulación del Plan
          </h3>
          <div id="simulacion-content"></div>
          <div class="alerta-rentabilidad" id="alertaRentabilidad" style="display: none;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <div>
              <strong>Atención: Plan poco rentable</strong>
              <p id="mensajeRentabilidad"></p>
            </div>
          </div>
          <div class="d-flex gap-1 mt-2 justify-between">
            <button type="button" class="btn btn-secundario" id="btnModificarSimulacion">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Modificar
            </button>
            <div class="d-flex gap-1">
              <button type="button" class="btn btn-success" id="btnConfirmarPlan">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Confirmar y Contratar
              </button>
            </div>
          </div>
        </div>

        <div class="resultado-final" id="resultadoFinal">
          <h3>✓ Plan Guardado Correctamente</h3>
          <p>El plan ha sido guardado y está listo para ser enviado al cliente.</p>
          <div class="resumen-final" id="resumenFinal"></div>
          <div class="d-flex gap-1 mt-3 justify-center">
            <button class="btn btn-secundario" id="btnEnviarEmail">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              Enviar por Email
            </button>
            <button class="btn btn-primario" id="btnNuevoCliente">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Nuevo Cliente
            </button>
          </div>
        </div>
      </div>
    `;
    
    this.attachEventListeners();
    this.addDebtRow();
  }
  
  resetView() {
    const resSim = document.getElementById('resultadoSimulacion');
    const resOk  = document.getElementById('resultadoFinal');
    if (resSim) resSim.style.display = 'none';
    if (resOk)  resOk.style.display  = 'none';
  }
  
  attachEventListeners() {
    // Form submission
    const form = document.getElementById('formularioSimulador');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.contractPlan();
    });
    
    // Buttons
    document.getElementById('btnAgregarFila').addEventListener('click', () => this.addDebtRow());
    document.getElementById('btnCargarPlan').addEventListener('click', () => this.showLoadPlanModal());
    document.getElementById('btnReAnalizar').addEventListener('click', () => this.reset());
    document.getElementById('btnGuardarBorrador').addEventListener('click', () => this.saveDraft());
    document.getElementById('btnSimular').addEventListener('click', () => this.simulatePlan());
    document.getElementById('btnModificarSimulacion').addEventListener('click', () => this.modifySimulation());
    document.getElementById('btnConfirmarPlan').addEventListener('click', () => this.contractPlan());
    document.getElementById('btnNuevoCliente').addEventListener('click', () => this.newClient());
    document.getElementById('btnEnviarEmail').addEventListener('click', () => this.sendEmail());
    
    // Delegated event listener for delete buttons
    document.getElementById('tablaDeudas').addEventListener('click', (e) => {
      if (e.target.closest('.btn-danger')) {
        e.target.closest('tr').remove();
        this.calculateTotals();
        this.updateDebtCounter();
      }
    });
  }
  
  addDebtRow() {
    this.debtCounter++;
    const tbody = document.getElementById('tablaDeudas');
    const newRow = document.createElement('tr');
    
    newRow.innerHTML = `
      <td><input type="text" placeholder="Contrato-${this.debtCounter}" data-field="contrato" /></td>
      <td>
        <select data-field="producto">
          <option value="">Seleccionar...</option>
          <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
          <option value="Préstamo Personal">Préstamo Personal</option>
          <option value="Hipoteca">Hipoteca</option>
          <option value="Línea de Crédito">Línea de Crédito</option>
          <option value="Financiación">Financiación</option>
        </select>
      </td>
      <td>
        <select data-field="entidad">
          <option value="">Seleccionar...</option>
          <option value="BBVA">BBVA</option>
          <option value="Santander">Santander</option>
          <option value="CaixaBank">CaixaBank</option>
          <option value="Sabadell">Sabadell</option>
          <option value="Bankinter">Bankinter</option>
          <option value="ING">ING</option>
          <option value="Otra">Otra</option>
        </select>
      </td>
      <td><input type="date" data-field="antiguedad" /></td>
      <td><input type="number" step="0.01" min="0" placeholder="0,00" data-field="importe" /></td>
      <td><input type="number" step="0.1" min="0" max="100" value="0" data-field="descuento" />%</td>
      <td class="importe-descuento" data-field="importeFinal">0,00 €</td>
      <td>
        <button type="button" class="btn btn-danger btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </td>
    `;
    
    // Add event listeners for auto-calculation
    const inputs = newRow.querySelectorAll('input[data-field="importe"], input[data-field="descuento"]');
    inputs.forEach(input => {
      input.addEventListener('input', () => this.calculateTotals());
    });
    
    tbody.appendChild(newRow);
    this.updateDebtCounter();
  }
  
  calculateTotals() {
    const rows = document.querySelectorAll('#tablaDeudas tr');
    let totalImporte = 0;
    let totalImporteFinal = 0;
    let totalDescuentos = 0;
    let numDebts = 0;
    
    rows.forEach(row => {
      const importe = parseFloat(row.querySelector('[data-field="importe"]')?.value || 0);
      const descuento = parseFloat(row.querySelector('[data-field="descuento"]')?.value || 0);
      
      if (importe > 0) {
        const importeFinal = importe * (1 - descuento / 100);
        row.querySelector('[data-field="importeFinal"]').textContent = importeFinal.toLocaleString('es-ES', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }) + ' €';
        
        totalImporte += importe;
        totalImporteFinal += importeFinal;
        totalDescuentos += descuento;
        numDebts++;
      }
    });
    
    // Update totals
    document.getElementById('totalImporte').textContent = totalImporte.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' €';
    
    document.getElementById('totalImporteFinal').textContent = totalImporteFinal.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' €';
    
    const avgDiscount = numDebts > 0 ? (totalDescuentos / numDebts) : 0;
    document.getElementById('totalDescuentoMedio').textContent = avgDiscount.toFixed(1) + '%';
  }
  
  updateDebtCounter() {
    const numDebts = document.querySelectorAll('#tablaDeudas tr').length;
    document.getElementById('totalDeudasCount').textContent = `${numDebts} deuda${numDebts !== 1 ? 's' : ''}`;
  }
  
  async simulatePlan() {
    const formData = this.getFormData();
    
    if (!formData.nombreDeudor) {
      showNotification('Por favor, ingresa el nombre del cliente', 'error');
      return;
    }
    
    if (formData.deudas.length === 0) {
      showNotification('Agrega al menos una deuda para simular', 'error');
      return;
    }
    
    // Calculate simulation
    const simulation = this.calculateSimulation(formData);
    
    // Save simulated plan
    const plan = {
      referencia: `PLAN-${Date.now()}`,
      fecha: new Date().toISOString(),
      fechaModificacion: new Date().toISOString(),
      cliente: formData.nombreDeudor,
      dni: formData.dniDeudor,
      email: formData.emailDeudor,
      estado: 'plan_creado',
      deudaTotal: simulation.totalOriginal,
      deudaFinal: simulation.totalFinal,
      ahorro: simulation.ahorro,
      cuotaMensual: simulation.cuotaMensual,
      numCuotas: formData.numCuotas,
      deudas: formData.deudas,
      progreso: 25,
      historial: [{
        fecha: new Date().toISOString(),
        accion: 'Plan simulado',
        estado: 'plan_creado',
        descripcion: `Plan simulado con ${formData.deudas.length} deuda(s) por un total de ${simulation.totalOriginal.toLocaleString('es-ES', {minimumFractionDigits: 2})} €`,
        usuario: 'Usuario' // In production, get from auth service
      }]
    };
    
    this.currentPlan = plan;
    await storageService.savePlan(plan);
    
    // Show simulation results
    this.showSimulationResults(simulation);
    
    // Update dashboard
    if (this.onUpdate) this.onUpdate();
  }
  
  getFormData() {
    const rows = document.querySelectorAll('#tablaDeudas tr');
    const deudas = [];
    
    rows.forEach(row => {
      const importe = parseFloat(row.querySelector('[data-field="importe"]')?.value || 0);
      
      if (importe > 0) {
        const descuento = parseFloat(row.querySelector('[data-field="descuento"]')?.value || 0);
        deudas.push({
          contrato: row.querySelector('[data-field="contrato"]')?.value || '',
          producto: row.querySelector('[data-field="producto"]')?.value || '',
          entidad: row.querySelector('[data-field="entidad"]')?.value || '',
          antiguedad: row.querySelector('[data-field="antiguedad"]')?.value || '',
          importeOriginal: importe,
          descuento: descuento,
          importeFinal: importe * (1 - descuento / 100)
        });
      }
    });
    
    return {
      nombreDeudor: document.getElementById('nombreDeudor').value,
      dniDeudor: document.getElementById('dniDeudor').value,
      emailDeudor: document.getElementById('emailDeudor').value,
      numCuotas: parseInt(document.getElementById('numCuotas').value),
      deudas: deudas
    };
  }
  
  calculateSimulation(formData) {
    let totalOriginal = 0;
    let totalFinal = 0;
    
    formData.deudas.forEach(deuda => {
      totalOriginal += deuda.importeOriginal;
      totalFinal += deuda.importeFinal;
    });
    
    const ahorro = totalOriginal - totalFinal;
    const cuotaMensual = totalFinal / formData.numCuotas;
    const comisionBase = totalFinal * 0.15;
    const comisionExito = ahorro * 0.25;
    const comisionTotal = comisionBase + comisionExito;
    
    return {
      totalOriginal,
      totalFinal,
      ahorro,
      cuotaMensual,
      comisionBase,
      comisionExito,
      comisionTotal
    };
  }
  
  showSimulationResults(simulation) {
    const resultDiv = document.getElementById('resultadoSimulacion');
    const contentDiv = document.getElementById('simulacion-content');
    
    contentDiv.innerHTML = `
      <div class="resumen-grid">
        <div class="resumen-item">
          <label>Deuda Original</label>
          <div class="valor">${simulation.totalOriginal.toLocaleString('es-ES', {minimumFractionDigits: 2})} €</div>
        </div>
        <div class="resumen-item warning">
          <label>Deuda Final</label>
          <div class="valor">${simulation.totalFinal.toLocaleString('es-ES', {minimumFractionDigits: 2})} €</div>
        </div>
        <div class="resumen-item">
          <label>Ahorro Total</label>
          <div class="valor">${simulation.ahorro.toLocaleString('es-ES', {minimumFractionDigits: 2})} €</div>
        </div>
        <div class="resumen-item">
          <label>Cuota Mensual</label>
          <div class="valor">${simulation.cuotaMensual.toLocaleString('es-ES', {minimumFractionDigits: 2})} €</div>
        </div>
      </div>
      
      <div class="comisiones-desglose">
        <h4>Desglose de Comisiones</h4>
        <table>
          <tr><td>Comisión base (15%):</td><td style="text-align: right">${simulation.comisionBase.toLocaleString('es-ES', {minimumFractionDigits: 2})} €</td></tr>
          <tr><td>Comisión por ahorro (25%):</td><td style="text-align: right">${simulation.comisionExito.toLocaleString('es-ES', {minimumFractionDigits: 2})} €</td></tr>
          <tr class="total"><td><strong>Total comisiones:</strong></td><td style="text-align: right"><strong>${simulation.comisionTotal.toLocaleString('es-ES', {minimumFractionDigits: 2})} €</strong></td></tr>
        </table>
      </div>
    `;
    
    // Check profitability
    const alertDiv = document.getElementById('alertaRentabilidad');
    if (simulation.comisionTotal < 500) {
      alertDiv.style.display = 'flex';
      document.getElementById('mensajeRentabilidad').textContent = 
        `La comisión total de ${simulation.comisionTotal.toLocaleString('es-ES', {minimumFractionDigits: 2})} € está por debajo del mínimo recomendado de 500 €.`;
    } else {
      alertDiv.style.display = 'none';
    }
    
    resultDiv.style.display = 'block';
    document.getElementById('btnCalcular').style.display = 'inline-flex';
    
    showNotification('Simulación completada', 'success');
  }
  
  modifySimulation() {
    document.getElementById('resultadoSimulacion').style.display = 'none';
    document.getElementById('btnCalcular').style.display = 'none';
  }
  
  async contractPlan() {
    if (!this.currentPlan) {
      showNotification('No hay un plan simulado para contratar', 'error');
      return;
    }
    
    // Update plan status
    this.currentPlan.estado = 'plan_contratado';
    this.currentPlan.progreso = 50;
    this.currentPlan.fechaContratacion = new Date().toISOString();
    this.currentPlan.fechaModificacion = new Date().toISOString();
    
    // Add to history
    this.currentPlan.historial.push({
      fecha: new Date().toISOString(),
      accion: 'Plan contratado',
      estado: 'plan_contratado',
      descripcion: `Cliente firmó el contrato de reestructuración. Cuota mensual: ${this.currentPlan.cuotaMensual?.toLocaleString('es-ES', {minimumFractionDigits: 2})} €`,
      usuario: 'Usuario'
    });
    
    // Save plan
    await storageService.savePlan(this.currentPlan);
    
    // Add entrada
    const entrada = {
      fecha: new Date().toISOString(),
      cliente: this.currentPlan.cliente,
      dni: this.currentPlan.dni,
      deudaOriginal: this.currentPlan.deudaTotal,
      deudaFinal: this.currentPlan.deudaFinal,
      estado: 'Plan Contratado'
    };
    
    await storageService.saveEntrada(entrada);
    
    // Show final result
    document.getElementById('resultadoSimulacion').style.display = 'none';
    document.getElementById('resultadoFinal').style.display = 'block';
    
    showNotification('Plan contratado correctamente', 'success');
    
    // Update dashboard
    if (this.onUpdate) this.onUpdate();
  }
  
  saveDraft() {
    const formData = this.getFormData();
    
    const draft = {
      referencia: `BORR-${Date.now()}`,
      fecha: new Date().toISOString(),
      datos: formData,
      estado: 'borrador'
    };
    
    const drafts = JSON.parse(localStorage.getItem('borradoresPlanes') || '[]');
    drafts.push(draft);
    localStorage.setItem('borradoresPlanes', JSON.stringify(drafts));
    
    showNotification(`Borrador guardado con referencia: ${draft.referencia}`, 'success');
  }
  
  reset() {
    showConfirm(
      '¿Estás seguro de que quieres reiniciar el formulario? Se perderán todos los datos.',
      () => {
        document.getElementById('formularioSimulador').reset();
        document.getElementById('tablaDeudas').innerHTML = '';
        document.getElementById('resultadoSimulacion').style.display = 'none';
        document.getElementById('resultadoFinal').style.display = 'none';
        document.getElementById('btnCalcular').style.display = 'none';
        this.debtCounter = 0;
        this.currentPlan = null;
        this.addDebtRow();
        this.calculateTotals();
        this.updateDebtCounter();
        showNotification('Formulario reiniciado', 'info');
      }
    );
  }
  
  newClient() {
    this.reset();
  }
  
  sendEmail() {
    if (!this.currentPlan || !this.currentPlan.email) {
      showNotification('No hay email configurado para este cliente', 'error');
      return;
    }
    
    // In production, this would call an email service
    showNotification(`Email enviado a ${this.currentPlan.email}`, 'success');
  }
  
  async showLoadPlanModal() {
    const plans = await storageService.getPlans();
    const drafts = JSON.parse(localStorage.getItem('borradoresPlanes') || '[]');
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Cargar Plan Guardado</h3>
          <button type="button" class="btn btn-icon" onclick="this.closest('.modal').remove()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <input type="text" class="search-box" placeholder="Buscar por nombre, DNI o referencia..." id="searchPlan">
          <div id="plansList" class="planes-grid">
            ${[...drafts, ...plans].map(plan => `
              <div class="plan-card" data-ref="${plan.referencia}">
                <div class="plan-card-header">
                  <div>
                    <div class="plan-card-title">${plan.datos?.nombreDeudor || plan.cliente || 'Sin nombre'}</div>
                    <div class="plan-card-ref">${plan.referencia}</div>
                  </div>
                  <div class="plan-card-date">${new Date(plan.fecha).toLocaleDateString('es-ES')}</div>
                </div>
                <div class="estado-badge ${plan.estado}">${plan.estado.replace('_', ' ').toUpperCase()}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    const searchInput = modal.querySelector('#searchPlan');
    searchInput.addEventListener('input', (e) => {
      const search = e.target.value.toLowerCase();
      modal.querySelectorAll('.plan-card').forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(search) ? '' : 'none';
      });
    });
    
    modal.querySelectorAll('.plan-card').forEach(card => {
      card.addEventListener('click', () => {
        const ref = card.dataset.ref;
        const plan = [...drafts, ...plans].find(p => p.referencia === ref);
        if (plan) {
          this.loadPlan(plan);
          modal.remove();
        }
      });
    });
  }
  
  loadPlan(plan) {
    // Reset form first
    document.getElementById('formularioSimulador').reset();
    document.getElementById('tablaDeudas').innerHTML = '';
    
    if (plan.datos) {
      // Load draft
      document.getElementById('nombreDeudor').value = plan.datos.nombreDeudor || '';
      document.getElementById('dniDeudor').value = plan.datos.dniDeudor || '';
      document.getElementById('emailDeudor').value = plan.datos.emailDeudor || '';
      document.getElementById('numCuotas').value = plan.datos.numCuotas || 12;
      
      plan.datos.deudas?.forEach(deuda => {
        this.addDebtRow();
        const lastRow = document.querySelector('#tablaDeudas tr:last-child');
        lastRow.querySelector('[data-field="contrato"]').value = deuda.contrato || '';
        lastRow.querySelector('[data-field="producto"]').value = deuda.producto || '';
        lastRow.querySelector('[data-field="entidad"]').value = deuda.entidad || '';
        lastRow.querySelector('[data-field="antiguedad"]').value = deuda.antiguedad || '';
        lastRow.querySelector('[data-field="importe"]').value = deuda.importeOriginal || '';
        lastRow.querySelector('[data-field="descuento"]').value = deuda.descuento || '';
      });
    } else {
      // Load confirmed plan
      document.getElementById('nombreDeudor').value = plan.cliente || '';
      document.getElementById('dniDeudor').value = plan.dni || '';
      document.getElementById('emailDeudor').value = plan.email || '';
      document.getElementById('numCuotas').value = plan.numCuotas || 12;
      
      plan.deudas?.forEach(deuda => {
        this.addDebtRow();
        const lastRow = document.querySelector('#tablaDeudas tr:last-child');
        lastRow.querySelector('[data-field="contrato"]').value = deuda.contrato || '';
        lastRow.querySelector('[data-field="producto"]').value = deuda.producto || '';
        lastRow.querySelector('[data-field="entidad"]').value = deuda.entidad || '';
        lastRow.querySelector('[data-field="antiguedad"]').value = deuda.antiguedad || '';
        lastRow.querySelector('[data-field="importe"]').value = deuda.importeOriginal || '';
        lastRow.querySelector('[data-field="descuento"]').value = deuda.descuento || '';
      });
    }
    
    this.calculateTotals();
    showNotification('Plan cargado correctamente', 'success');
  }

}
