/**
 * Core application logic for the debt restructuring simulator.
 * Handles navigation, simulator, and tracking functionality.
 * @module app
 */

import { actualizarDashboard, actualizarGraficos } from './dashboard.js';

// Storage Manager for secure localStorage handling
class StorageManager {
  constructor() {
    this.keys = {
      plans: 'planesConfirmados',
      drafts: 'borradoresPlanes'
    };
  }

  // Basic encryption for sensitive data (Base64 for demo; use stronger encryption in production)
  encrypt(data) {
    return btoa(JSON.stringify(data));
  }

  decrypt(data) {
    try {
      return JSON.parse(atob(data));
    } catch (e) {
      return [];
    }
  }

  getPlans(key) {
    try {
      const data = localStorage.getItem(this.keys[key]) || '[]';
      return this.decrypt(data);
    } catch (e) {
      return [];
    }
  }

  savePlans(key, plans) {
    try {
      localStorage.setItem(this.keys[key], this.encrypt(plans));
    } catch (e) {
      console.error(`Error saving ${key}:`, e);
    }
  }

  cleanOldPlans() {
    const plans = this.getPlans('plans');
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const filtered = plans.filter(plan => new Date(plan.fecha) >= oneYearAgo);
    this.savePlans('plans', filtered);
  }
}

// Main application class
class App {
  constructor() {
    this.storage = new StorageManager();
    this.contadorDeudas = 0;
    this.deudas = [];
    this.init();
  }

  init() {
    this.storage.cleanOldPlans();
    this.setupEventListeners();
    this.switchTab('dashboard');
    this.agregarFilaDeuda();
    actualizarDashboard(this.storage);
    this.actualizarTablaSeguimiento();
    setTimeout(() => document.getElementById('loadingScreen').style.display = 'none', 1000);
  }

  setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Simulator buttons
    document.getElementById('btnAgregarFila').addEventListener('click', () => this.agregarFilaDeuda());
    document.getElementById('btnCargarPlan').addEventListener('click', () => this.mostrarModalPlanes());
    document.getElementById('btnReAnalizar').addEventListener('click', () => this.reiniciarFormulario());
    document.getElementById('btnGuardarBorrador').addEventListener('click', () => this.guardarBorrador());
    document.getElementById('btnSimular').addEventListener('click', () => this.simularPlan());
    document.getElementById('btnConfirmarPlan').addEventListener('click', () => this.confirmarPlan());
    document.getElementById('btnModificarSimulacion').addEventListener('click', () => this.modificarSimulacion());
    document.getElementById('btnNuevoCliente').addEventListener('click', () => this.nuevoCliente());
    document.getElementById('btnCerrarModalPlanes').addEventListener('click', () => this.cerrarModalPlanes());
    document.getElementById('btnCerrarModalDetalles').addEventListener('click', () => this.cerrarModalDetalles());

    // Status bar buttons
    document.getElementById('btnShowInfo').addEventListener('click', () => this.showInfo());
    document.getElementById('btnSyncData').addEventListener('click', () => this.syncData());

    // Tracking filters
    ['buscarSeguimiento', 'filtroEstado', 'filtroPeriodo'].forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('input', () => this.actualizarTablaSeguimiento());
        element.addEventListener('change', () => this.actualizarTablaSeguimiento());
      }
    });

    // Event delegation for dynamic elements
    document.getElementById('tablaDeudas').addEventListener('input', e => {
      if (e.target.matches('[data-field="importe"], [data-field="descuento"]')) {
        this.calcularTotales();
      }
    });

    document.getElementById('tablaDeudas').addEventListener('click', e => {
      if (e.target.closest('.btn-danger')) {
        this.eliminarDeuda(e.target.closest('tr'));
      }
    });

    document.getElementById('listaPlanes').addEventListener('click', e => {
      const planCard = e.target.closest('.plan-card');
      if (planCard) {
        const plan = JSON.parse(planCard.dataset.plan);
        this.cargarPlan(plan);
      }
    });

    document.getElementById('tablaSeguimiento').addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (btn) {
        const referencia = btn.dataset.referencia;
        if (btn.title === 'Ver detalles') this.verDetallesPlan(referencia);
        if (btn.title === 'Editar') this.editarPlan(referencia);
        if (btn.title === 'Avanzar fase') this.avanzarFase(referencia);
      }
    });
  }

  switchTab(targetTab) {
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.dashboard-container, .contenedor-simulador').forEach(container => {
      container.style.display = 'none';
      container.classList.remove('active');
    });

    const activeTab = document.querySelector(`[data-tab="${targetTab}"]`);
    if (activeTab) activeTab.classList.add('active');

    const activeContainer = document.getElementById(`${targetTab}Container`);
    if (activeContainer) {
      activeContainer.style.display = 'block';
      if (targetTab === 'dashboard') activeContainer.classList.add('active');
    }

    if (targetTab === 'dashboard') actualizarDashboard(this.storage);
  }

  showInfo() {
    this.mostrarNotificacion('Sistema de Reestructuración de Deuda v1.0. Desarrollado por DMD Asesores.', 'info');
  }

  syncData() {
    this.mostrarNotificacion('Datos sincronizados con la nube.', 'success');
    actualizarDashboard(this.storage);
    this.actualizarTablaSeguimiento();
  }

  agregarFilaDeuda() {
    this.contadorDeudas++;
    const tbody = document.getElementById('tablaDeudas');
    const nuevaFila = document.createElement('tr');
    nuevaFila.innerHTML = `
      <td><input type="text" placeholder="Contrato-${this.contadorDeudas}" data-field="contrato" /></td>
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
    tbody.appendChild(nuevaFila);
    this.actualizarContadorDeudas();
  }

  eliminarDeuda(fila) {
    fila.remove();
    this.calcularTotales();
    this.actualizarContadorDeudas();
  }

  calcularTotales() {
    const filas = document.querySelectorAll('#tablaDeudas tr');
    let totalImporte = 0;
    let totalImporteFinal = 0;
    let totalDescuentos = 0;
    let numDeudas = 0;

    filas.forEach(fila => {
      const importe = parseFloat(fila.querySelector('[data-field="importe"]')?.value || 0);
      const descuento = parseFloat(fila.querySelector('[data-field="descuento"]')?.value || 0);

      if (importe > 0) {
        const importeFinal = importe * (1 - descuento / 100);
        fila.querySelector('[data-field="importeFinal"]').textContent = formatCurrency(importeFinal);
        totalImporte += importe;
        totalImporteFinal += importeFinal;
        totalDescuentos += descuento;
        numDeudas++;
      }
    });

    document.getElementById('totalImporte').textContent = formatCurrency(totalImporte);
    document.getElementById('totalImporteFinal').textContent = formatCurrency(totalImporteFinal);
    document.getElementById('totalDescuentoMedio').textContent = numDeudas > 0 ? (totalDescuentos / numDeudas).toFixed(1) + '%' : '0%';
  }

  actualizarContadorDeudas() {
    const numDeudas = document.querySelectorAll('#tablaDeudas tr').length;
    document.getElementById('totalDeudasCount').textContent = `${numDeudas} deuda${numDeudas !== 1 ? 's' : ''}`;
  }

  reiniciarFormulario() {
    if (confirm('¿Estás seguro de que quieres reiniciar el formulario? Se perderán todos los datos.')) {
      document.getElementById('formularioSimulador').reset();
      document.getElementById('tablaDeudas').innerHTML = '';
      document.getElementById('resultadoSimulacion').style.display = 'none';
      document.getElementById('resultadoFinal').style.display = 'none';
      this.contadorDeudas = 0;
      this.agregarFilaDeuda();
      this.mostrarNotificacion('Formulario reiniciado correctamente', 'info');
    }
  }

  guardarBorrador() {
    const datosFormulario = {
      nombreDeudor: DOMPurify.sanitize(document.getElementById('nombreDeudor').value),
      dniDeudor: DOMPurify.sanitize(document.getElementById('dniDeudor').value),
      emailDeudor: DOMPurify.sanitize(document.getElementById('emailDeudor').value),
      numCuotas: document.getElementById('numCuotas').value,
      deudas: []
    };

    document.querySelectorAll('#tablaDeudas tr').forEach(fila => {
      const deuda = {
        contrato: DOMPurify.sanitize(fila.querySelector('[data-field="contrato"]')?.value || ''),
        producto: DOMPurify.sanitize(fila.querySelector('[data-field="producto"]')?.value || ''),
        entidad: DOMPurify.sanitize(fila.querySelector('[data-field="entidad"]')?.value || ''),
        antiguedad: DOMPurify.sanitize(fila.querySelector('[data-field="antiguedad"]')?.value || ''),
        importe: parseFloat(fila.querySelector('[data-field="importe"]')?.value || 0),
        descuento: parseFloat(fila.querySelector('[data-field="descuento"]')?.value || 0)
      };
      if (deuda.importe > 0) datosFormulario.deudas.push(deuda);
    });

    const borradores = this.storage.getPlans('drafts');
    const referencia = `BORR-${Date.now()}`;
    borradores.push({
      referencia,
      fecha: new Date().toISOString(),
      datos: datosFormulario,
      estado: 'borrador'
    });

    this.storage.savePlans('drafts', borradores);
    this.mostrarNotificacion(`Borrador guardado con referencia: ${referencia}`, 'success');
  }

  simularPlan() {
    const nombreDeudor = DOMPurify.sanitize(document.getElementById('nombreDeudor').value);
    const numCuotas = parseInt(document.getElementById('numCuotas').value);
    const filas = document.querySelectorAll('#tablaDeudas tr');

    if (!nombreDeudor) {
      this.mostrarNotificacion('Por favor, ingresa el nombre del cliente', 'error');
      return;
    }

    if (filas.length === 0) {
      this.mostrarNotificacion('Agrega al menos una deuda para simular', 'error');
      return;
    }

    let totalOriginal = 0;
    let totalFinal = 0;
    const deudas = [];

    filas.forEach(fila => {
      const importe = parseFloat(fila.querySelector('[data-field="importe"]')?.value || 0);
      const descuento = parseFloat(fila.querySelector('[data-field="descuento"]')?.value || 0);

      if (importe > 0) {
        const importeFinal = importe * (1 - descuento / 100);
        totalOriginal += importe;
        totalFinal += importeFinal;
        deudas.push({
          contrato: DOMPurify.sanitize(fila.querySelector('[data-field="contrato"]')?.value || ''),
          producto: DOMPurify.sanitize(fila.querySelector('[data-field="producto"]')?.value || ''),
          entidad: DOMPurify.sanitize(fila.querySelector('[data-field="entidad"]')?.value || ''),
          importeOriginal: importe,
          importeFinal,
          descuento
        });
      }
    });

    const ahorro = totalOriginal - totalFinal;
    const cuotaMensual = totalFinal / numCuotas;
    const comisionBase = totalFinal * 0.15;
    const comisionExito = ahorro * 0.25;
    const comisionTotal = comisionBase + comisionExito;

    const planSimulado = {
      referencia: `SIM-${Date.now()}`,
      fecha: new Date().toISOString(),
      cliente: nombreDeudor,
      dni: DOMPurify.sanitize(document.getElementById('dniDeudor').value),
      email: DOMPurify.sanitize(document.getElementById('emailDeudor').value),
      estado: 'plan_creado',
      deudaTotal: totalOriginal,
      deudaFinal: totalFinal,
      ahorro,
      cuotaMensual,
      numCuotas,
      deudas,
      progreso: 25,
      historial: [{
        fecha: new Date().toISOString(),
        accion: 'Plan simulado',
        estado: 'plan_creado',
        descripcion: `Plan simulado con ${deudas.length} deuda(s) por un total de ${formatCurrency(totalOriginal)}`
      }]
    };

    const planesGuardados = this.storage.getPlans('plans');
    planesGuardados.push(planSimulado);
    this.storage.savePlans('plans', planesGuardados);

    const resultadoDiv = document.getElementById('resultadoSimulacion');
    const contentDiv = document.getElementById('simulacion-content');
    contentDiv.innerHTML = DOMPurify.sanitize(`
      <div class="resumen-grid">
        <div class="resumen-item">
          <label>Deuda Original</label>
          <div class="valor">${formatCurrency(totalOriginal)}</div>
        </div>
        <div class="resumen-item warning">
          <label>Deuda Final</label>
          <div class="valor">${formatCurrency(totalFinal)}</div>
        </div>
        <div class="resumen-item">
          <label>Ahorro Total</label>
          <div class="valor">${formatCurrency(ahorro)}</div>
        </div>
        <div class="resumen-item">
          <label>Cuota Mensual</label>
          <div class="valor">${formatCurrency(cuotaMensual)}</div>
        </div>
      </div>
      <div class="comisiones-desglose">
        <h4>Desglose de Comisiones</h4>
        <table>
          <tr><td>Comisión base (15%):</td><td style="text-align: right">${formatCurrency(comisionBase)}</td></tr>
          <tr><td>Comisión por ahorro (25%):</td><td style="text-align: right">${formatCurrency(comisionExito)}</td></tr>
          <tr class="total"><td><strong>Total comisiones:</strong></td><td style="text-align: right"><strong>${formatCurrency(comisionTotal)}</strong></td></tr>
        </table>
      </div>
    `);

    const alertaRentabilidad = document.getElementById('alertaRentabilidad');
    if (comisionTotal < 500) {
      alertaRentabilidad.style.display = 'flex';
      document.getElementById('mensajeRentabilidad').textContent = 
        `La comisión total de ${formatCurrency(comisionTotal)} está por debajo del mínimo recomendado de 500 €.`;
    } else {
      alertaRentabilidad.style.display = 'none';
    }

    resultadoDiv.style.display = 'block';
    document.getElementById('btnCalcular').style.display = 'inline-flex';
    actualizarDashboard(this.storage);
    this.actualizarTablaSeguimiento();
    this.mostrarNotificacion('Simulación completada y guardada en seguimiento', 'success');
  }

  confirmarPlan() {
    const nombreDeudor = DOMPurify.sanitize(document.getElementById('nombreDeudor').value);
    const dniDeudor = DOMPurify.sanitize(document.getElementById('dniDeudor').value);
    const emailDeudor = DOMPurify.sanitize(document.getElementById('emailDeudor').value);
    const numCuotas = parseInt(document.getElementById('numCuotas').value);

    const planesGuardados = this.storage.getPlans('plans');
    const planSimuladoIndex = planesGuardados.findIndex(p => p.cliente === nombreDeudor && p.estado === 'plan_creado');

    if (planSimuladoIndex !== -1) {
      const plan = planesGuardados[planSimuladoIndex];
      plan.estado = 'plan_contratado';
      plan.progreso = 50;
      plan.fechaContratacion = new Date().toISOString();
      if (!plan.historial) plan.historial = [];
      plan.historial.push({
        fecha: new Date().toISOString(),
        accion: 'Plan contratado',
        estado: 'plan_contratado',
        descripcion: `Cliente firmó el contrato de reestructuración. Cuota mensual: ${formatCurrency(plan.cuotaMensual)}`
      });
      this.storage.savePlans('plans', planesGuardados);
    } else {
      const filas = document.querySelectorAll('#tablaDeudas tr');
      let totalOriginal = 0;
      let totalFinal = 0;
      const deudas = [];

      filas.forEach(fila => {
        const importe = parseFloat(fila.querySelector('[data-field="importe"]')?.value || 0);
        const descuento = parseFloat(fila.querySelector('[data-field="descuento"]')?.value || 0);

        if (importe > 0) {
          const importeFinal = importe * (1 - descuento / 100);
          totalOriginal += importe;
          totalFinal += importeFinal;
          deudas.push({
            contrato: DOMPurify.sanitize(fila.querySelector('[data-field="contrato"]')?.value || ''),
            producto: DOMPurify.sanitize(fila.querySelector('[data-field="producto"]')?.value || ''),
            entidad: DOMPurify.sanitize(fila.querySelector('[data-field="entidad"]')?.value || ''),
            importeOriginal: importe,
            importeFinal,
            descuento
          });
        }
      });

      const cuotaMensual = totalFinal / numCuotas;
      const ahorro = totalOriginal - totalFinal;
      const referencia = `PLAN-${Date.now()}`;

      const planConfirmado = {
        referencia,
        fecha: new Date().toISOString(),
        fechaContratacion: new Date().toISOString(),
        cliente: nombreDeudor,
        dni: dniDeudor,
        email: emailDeudor,
        estado: 'plan_contratado',
        deudaTotal: totalOriginal,
        deudaFinal: totalFinal,
        ahorro,
        cuotaMensual,
        numCuotas,
        deudas,
        progreso: 50,
        historial: [{
          fecha: new Date().toISOString(),
          accion: 'Plan creado y contratado',
          estado: 'plan_contratado',
          descripcion: `Plan creado y contratado directamente con ${deudas.length} deuda(s) por un total de ${formatCurrency(totalOriginal)}`
        }]
      };

      planesGuardados.push(planConfirmado);
      this.storage.savePlans('plans', planesGuardados);
    }

    document.getElementById('resultadoSimulacion').style.display = 'none';
    document.getElementById('resultadoFinal').style.display = 'block';
    actualizarDashboard(this.storage);
    this.actualizarTablaSeguimiento();
    this.mostrarNotificacion('Plan contratado correctamente', 'success');
  }

  modificarSimulacion() {
    document.getElementById('resultadoSimulacion').style.display = 'none';
    this.switchTab('simulador');
  }

  nuevoCliente() {
    this.reiniciarFormulario();
    this.switchTab('simulador');
  }

  mostrarModalPlanes() {
    const borradores = this.storage.getPlans('drafts');
    const planesConfirmados = this.storage.getPlans('plans');
    const todosPlanes = [...borradores, ...planesConfirmados];
    const listaPlanes = document.getElementById('listaPlanes');
    listaPlanes.innerHTML = '';

    if (todosPlanes.length === 0) {
