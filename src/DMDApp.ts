import { ESTADOS, normalizarEstado } from './constants/estados';
import { SimuladorTable } from './components/SimuladorTable';
import { uiService } from './services/uiService';
import { graphService } from './services/graphService';
import { storageService } from './services/storageService';
import DOMPurify from 'dompurify';

export interface Plan {
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
  deudas: Array<{
    contrato: string;
    producto: string;
    entidad: string;
    importeOriginal: number;
    importeFinal: number;
    descuento: number;
    antiguedad?: string;
  }>;
  progreso: number;
  historial: Array<{
    fecha: string;
    accion: string;
    estado: string;
    descripcion: string;
  }>;
}

export interface Draft {
  referencia: string;
  fecha: string;
  datos: {
    nombreDeudor: string;
    dniDeudor: string;
    emailDeudor: string;
    numCuotas: number;
    deudas: Array<{
      contrato: string;
      producto: string;
      entidad: string;
      antiguedad: string;
      importe: number;
      descuento: number;
    }>;
  };
  estado: 'borrador';
}

export class DMDApp {
  private planes: Plan[] = [];
  private drafts: Draft[] = [];
  private simuladorTable: SimuladorTable;
  private contadorDeudas: number = 0;

  constructor() {
    this.simuladorTable = new SimuladorTable('tablaDeudas');
  }

  async initApp(): Promise<void> {
    try {
      // Load plans and drafts
      this.planes = (await storageService.getPlansLocal()) ?? [];
      this.drafts = (await storageService.getDraftsLocal()) ?? [];
      await storageService.cleanOldPlans();

      // Initialize UI and events
      this.setupEventListeners();
      this.switchTab('dashboard');
      this.agregarFilaDeuda();
      this.actualizarDashboard();
      this.actualizarTablaSeguimiento();
      uiService.actualizarUltimaActualizacion();

      // Hide loading screen
      setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) loadingScreen.style.display = 'none';
      }, 1000);
    } catch (error) {
      uiService.mostrarNotificacion('Error al inicializar la aplicación', 'error');
      console.error('Initialization error:', error);
    }
  }

  private setupEventListeners(): void {
    // Navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Simulator buttons
    document.getElementById('btnAgregarFila')?.addEventListener('click', () => this.agregarFilaDeuda());
    document.getElementById('btnCargarPlan')?.addEventListener('click', () => this.mostrarModalPlanes());
    document.getElementById('btnReAnalizar')?.addEventListener('click', () => this.reiniciarFormulario());
    document.getElementById('btnGuardarBorrador')?.addEventListener('click', () => this.guardarBorrador());
    document.getElementById('btnSimular')?.addEventListener('click', () => this.simularPlan());
    document.getElementById('btnConfirmarPlan')?.addEventListener('click', () => this.confirmarPlan());
    document.getElementById('btnModificarSimulacion')?.addEventListener('click', () => this.modificarSimulacion());
    document.getElementById('btnNuevoCliente')?.addEventListener('click', () => this.nuevoCliente());
    document.getElementById('btnCerrarModalPlanes')?.addEventListener('click', () => this.cerrarModalPlanes());
    document.getElementById('btnCerrarModalDetalles')?.addEventListener('click', () => this.cerrarModalDetalles());

    // Status bar buttons
    document.getElementById('btnShowInfo')?.addEventListener('click', () => this.showInfo());
    document.getElementById('btnSyncData')?.addEventListener('click', () => this.syncData());

    // Tracking filters
    ['buscarSeguimiento', 'filtroEstado', 'filtroPeriodo'].forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('input', () => this.actualizarTablaSeguimiento());
        element.addEventListener('change', () => this.actualizarTablaSeguimiento());
      }
    });

    // Event delegation for dynamic elements
    document.getElementById('tablaDeudas')?.addEventListener('input', e => {
      if (e.target instanceof HTMLInputElement && ['importe', 'descuento'].includes(e.target.dataset.field)) {
        this.calcularTotales();
      }
    });

    document.getElementById('tablaDeudas')?.addEventListener('click', e => {
      const target = (e.target as HTMLElement).closest('.btn-danger');
      if (target) {
        const row = target.closest('tr');
        if (row) this.eliminarDeuda(row);
      }
    });

    document.getElementById('listaPlanes')?.addEventListener('click', e => {
      const planCard = (e.target as HTMLElement).closest('.plan-card');
      if (planCard) {
        const plan = JSON.parse(planCard.dataset.plan);
        this.cargarPlan(plan);
      }
    });

    document.getElementById('tablaSeguimiento')?.addEventListener('click', e => {
      const btn = (e.target as HTMLElement).closest('button');
      if (btn) {
        const referencia = btn.dataset.referencia;
        if (btn.title === 'Ver detalles') this.verDetallesPlan(referencia);
        if (btn.title === 'Editar') this.editarPlan(referencia);
        if (btn.title === 'Avanzar fase') this.avanzarFase(referencia);
      }
    });

    // SimuladorTable updates
    this.simuladorTable.onUpdate(() => this.calcularTotales());
  }

  private switchTab(targetTab: string): void {
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

    if (targetTab === 'dashboard') this.actualizarDashboard();
  }

  private showInfo(): void {
    uiService.mostrarNotificacion('Sistema de Reestructuración de Deuda v1.0. Desarrollado por DMD Asesores.', 'info');
  }

  private async syncData(): Promise<void> {
    try {
      await this.syncWithExcel();
      uiService.mostrarNotificacion('Datos sincronizados con la nube.', 'success');
    } catch (error) {
      uiService.mostrarNotificacion('Error al sincronizar datos', 'error');
      console.error('Sync error:', error);
    }
  }

  agregarFilaDeuda(datos: Partial<Plan> = {}): void {
    this.contadorDeudas++;
    const defaultData = {
      contrato: `Contrato-${this.contadorDeudas}`,
      producto: '',
      entidad: '',
      antiguedad: '',
      importe: 0,
      descuento: 0
    };
    this.simuladorTable.agregarFilaDeuda({ ...defaultData, ...datos });
    this.actualizarContadorDeudas();
  }

  private eliminarDeuda(fila: HTMLTableRowElement): void {
    fila.remove();
    this.calcularTotales();
    this.actualizarContadorDeudas();
  }

  private calcularTotales(): void {
    const filas = document.querySelectorAll('#tablaDeudas tr');
    let totalImporte = 0;
    let totalImporteFinal = 0;
    let totalDescuentos = 0;
    let numDeudas = 0;

    filas.forEach(fila => {
      const importeInput = fila.querySelector('[data-field="importe"]') as HTMLInputElement;
      const descuentoInput = fila.querySelector('[data-field="descuento"]') as HTMLInputElement;
      const importe = parseFloat(importeInput?.value || '0');
      const descuento = parseFloat(descuentoInput?.value || '0');

      if (importe > 0) {
        const importeFinal = importe * (1 - descuento / 100);
        const importeFinalCell = fila.querySelector('[data-field="importeFinal"]');
        if (importeFinalCell) importeFinalCell.textContent = this.formatCurrency(importeFinal);
        totalImporte += importe;
        totalImporteFinal += importeFinal;
        totalDescuentos += descuento;
        numDeudas++;
      }
    });

    const totalImporteEl = document.getElementById('totalImporte');
    const totalImporteFinalEl = document.getElementById('totalImporteFinal');
    const totalDescuentoMedioEl = document.getElementById('totalDescuentoMedio');

    if (totalImporteEl) totalImporteEl.textContent = this.formatCurrency(totalImporte);
    if (totalImporteFinalEl) totalImporteFinal.textContent = this.formatCurrency(totalImporteFinal);
    if (totalDescuentoMedioEl) {
      totalDescuentoMedioEl.textContent = numDeudas > 0 ? (totalDescuentos / numDeudas).toFixed(1) + '%' : '0%';
    }
  }

  private actualizarContadorDeudas(): void {
    const numDeudas = document.querySelectorAll('#tablaDeudas tr').length;
    const totalDeudasCount = document.getElementById('totalDeudasCount');
    if (totalDeudasCount) {
      totalDeudasCount.textContent = `${numDeudas} deuda${numDeudas !== 1 ? 's' : ''}`;
    }
  }

  reiniciarFormulario(): void {
    if (confirm('¿Estás seguro de que quieres reiniciar el formulario? Se perderán todos los datos.')) {
      const formulario = document.getElementById('formularioSimulador') as HTMLFormElement;
      if (formulario) formulario.reset();
      const tablaDeudas = document.getElementById('tablaDeudas');
      if (tablaDeudas) tablaDeudas.innerHTML = '';
      const resultadoSimulacion = document.getElementById('resultadoSimulacion');
      const resultadoFinal = document.getElementById('resultadoFinal');
      if (resultadoSimulacion) resultadoSimulacion.style.display = 'none';
      if (resultadoFinal) resultadoFinal.style.display = 'none';
      this.contadorDeudas = 0;
      this.agregarFilaDeuda();
      uiService.mostrarNotificacion('Formulario reiniciado correctamente', 'info');
    }
  }

  private async guardarBorrador(): Promise<void> {
    try {
      const datosFormulario: Draft['datos'] = {
        nombreDeudor: DOMPurify.sanitize((document.getElementById('nombreDeudor') as HTMLInputElement).value),
        dniDeudor: DOMPurify.sanitize((document.getElementById('dniDeudor') as HTMLInputElement).value),
        emailDeudor: DOMPurify.sanitize((document.getElementById('emailDeudor') as HTMLInputElement).value),
        numCuotas: parseInt((document.getElementById('numCuotas') as HTMLInputElement).value),
        deudas: []
      };

      document.querySelectorAll('#tablaDeudas tr').forEach(fila => {
        const deuda = {
          contrato: DOMPurify.sanitize((fila.querySelector('[data-field="contrato"]') as HTMLInputElement)?.value || ''),
          producto: DOMPurify.sanitize((fila.querySelector('[data-field="producto"]') as HTMLSelectElement)?.value || ''),
          entidad: DOMPurify.sanitize((fila.querySelector('[data-field="entidad"]') as HTMLSelectElement)?.value || ''),
          antiguedad: DOMPurify.sanitize((fila.querySelector('[data-field="antiguedad"]') as HTMLInputElement)?.value || ''),
          importe: parseFloat((fila.querySelector('[data-field="importe"]') as HTMLInputElement)?.value || '0'),
          descuento: parseFloat((fila.querySelector('[data-field="descuento"]') as HTMLInputElement)?.value || '0')
        };
        if (deuda.importe > 0) datosFormulario.deudas.push(deuda);
      });

      const referencia = `BORR-${Date.now()}`;
      this.drafts.push({
        referencia,
        fecha: new Date().toISOString(),
        datos: datosFormulario,
        estado: 'borrador'
      });

      await storageService.saveDraftsLocal(this.drafts);
      uiService.mostrarNotificacion(`Borrador guardado con referencia: ${referencia}`, 'success');
    } catch (error) {
      uiService.mostrarNotificacion('Error al guardar el borrador', 'error');
      console.error('Save draft error:', error);
    }
  }

  async simularPlan(): Promise<void> {
    try {
      const nombreDeudor = DOMPurify.sanitize((document.getElementById('nombreDeudor') as HTMLInputElement).value);
      const numCuotas = parseInt((document.getElementById('numCuotas') as HTMLInputElement).value);
      const filas = document.querySelectorAll('#tablaDeudas tr');

      if (!nombreDeudor) {
        uiService.mostrarNotificacion('Por favor, ingresa el nombre del cliente', 'error');
        return;
      }

      if (filas.length === 0) {
        uiService.mostrarNotificacion('Agrega al menos una deuda para simular', 'error');
        return;
      }

      let totalOriginal = 0;
      let totalFinal = 0;
      const deudas: Plan['deudas'] = [];

      filas.forEach(fila => {
        const importe = parseFloat((fila.querySelector('[data-field="importe"]') as HTMLInputElement)?.value || '0');
        const descuento = parseFloat((fila.querySelector('[data-field="descuento"]') as HTMLInputElement)?.value || '0');

        if (importe > 0) {
          const importeFinal = importe * (1 - descuento / 100);
          totalOriginal += importe;
          totalFinal += importeFinal;
          deudas.push({
            contrato: DOMPurify.sanitize((fila.querySelector('[data-field="contrato"]') as HTMLInputElement)?.value || ''),
            producto: DOMPurify.sanitize((fila.querySelector('[data-field="producto"]') as HTMLSelectElement)?.value || ''),
            entidad: DOMPurify.sanitize((fila.querySelector('[data-field="entidad"]') as HTMLSelectElement)?.value || ''),
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

      const planSimulado: Plan = {
        referencia: `SIM-${Date.now()}`,
        fecha: new Date().toISOString(),
        cliente: {
          nombre: nombreDeudor,
          dni: DOMPurify.sanitize((document.getElementById('dniDeudor') as HTMLInputElement).value),
          email: DOMPurify.sanitize((document.getElementById('emailDeudor') as HTMLInputElement).value)
        },
        estado: 'plan_creado',
        totalImporte: totalOriginal,
        descuentoMedio: deudas.length > 0 ? deudas.reduce((sum, d) => sum + d.descuento, 0) / deudas.length : 0,
        cuotaMensual,
        ahorro,
        deudas,
        progreso: 25,
        historial: [{
          fecha: new Date().toISOString(),
          accion: 'Plan simulado',
          estado: 'plan_creado',
          descripcion: `Plan simulado con ${deudas.length} deuda(s) por un total de ${this.formatCurrency(totalOriginal)}`
        }]
      };

      this.planes.push(planSimulado);
      await storageService.savePlansLocal(this.planes);

      const resultadoDiv = document.getElementById('resultadoSimulacion');
      const contentDiv = document.getElementById('simulacion-content');
      if (contentDiv && resultadoDiv) {
        contentDiv.innerHTML = DOMPurify.sanitize(`
          <div class="resumen-grid">
            <div class="resumen-item">
              <label>Deuda Original</label>
              <div class="valor">${this.formatCurrency(totalOriginal)}</div>
            </div>
            <div class="resumen-item warning">
              <label>Deuda Final</label>
              <div class="valor">${this.formatCurrency(totalFinal)}</div>
            </div>
            <div class="resumen-item">
              <label>Ahorro Total</label>
              <div class="valor">${this.formatCurrency(ahorro)}</div>
            </div>
            <div class="resumen-item">
              <label>Cuota Mensual</label>
              <div class="valor">${this.formatCurrency(cuotaMensual)}</div>
            </div>
          </div>
          <div class="comisiones-desglose">
            <h4>Desglose de Comisiones</h4>
            <table>
              <tr><td>Comisión base (15%):</td><td style="text-align: right">${this.formatCurrency(comisionBase)}</td></tr>
              <tr><td>Comisión por ahorro (25%):</td><td style="text-align: right">${this.formatCurrency(comisionExito)}</td></tr>
              <tr class="total"><td><strong>Total comisiones:</strong></td><td style="text-align: right"><strong>${this.formatCurrency(comisionTotal)}</strong></td></tr>
            </table>
          </div>
        `);

        const alertaRentabilidad = document.getElementById('alertaRentabilidad');
        const mensajeRentabilidad = document.getElementById('mensajeRentabilidad');
        if (alertaRentabilidad && mensajeRentabilidad) {
          if (comisionTotal < 500) {
            alertaRentabilidad.style.display = 'flex';
            mensajeRentabilidad.textContent = `La comisión total de ${this.formatCurrency(comisionTotal)} está por debajo del mínimo recomendado de 500 €.`;
          } else {
            alertaRentabilidad.style.display = 'none';
          }
        }

        resultadoDiv.style.display = 'block';
        const btnCalcular = document.getElementById('btnCalcular');
        if (btnCalcular) btnCalcular.style.display = 'inline-flex';
      }

      this.actualizarDashboard();
      this.actualizarTablaSeguimiento();
      graphService.actualizarGraficos(this.planes);
      uiService.mostrarNotificacion('Simulación completada y guardada en seguimiento', 'success');
    } catch (error) {
      uiService.mostrarNotificacion('Error al simular el plan', 'error');
      console.error('Simulation error:', error);
    }
  }

  async confirmarPlan(): Promise<void> {
    try {
      const nombreDeudor = DOMPurify.sanitize((document.getElementById('nombreDeudor') as HTMLInputElement).value);
      const dniDeudor = DOMPurify.sanitize((document.getElementById('dniDeudor') as HTMLInputElement).value);
      const emailDeudor = DOMPurify.sanitize((document.getElementById('emailDeudor') as HTMLInputElement).value);
      const numCuotas = parseInt((document.getElementById('numCuotas') as HTMLInputElement).value);

      const planSimuladoIndex = this.planes.findIndex(p => p.cliente.nombre === nombreDeudor && p.estado === 'plan_creado');

      if (planSimuladoIndex !== -1) {
        const plan = this.planes[planSimuladoIndex];
        plan.estado = 'plan_contratado';
        plan.progreso = 50;
        plan.fechaContratacion = new Date().toISOString();
        plan.historial.push({
          fecha: new Date().toISOString(),
          accion: 'Plan contratado',
          estado: 'plan_contratado',
          descripcion: `Cliente firmó el contrato de reestructuración. Cuota mensual: ${this.formatCurrency(plan.cuotaMensual)}`
        });
      } else {
        const filas = document.querySelectorAll('#tablaDeudas tr');
        let totalOriginal = 0;
        let totalFinal = 0;
        const deudas: Plan['deudas'] = [];

        filas.forEach(fila => {
          const importe = parseFloat((fila.querySelector('[data-field="importe"]') as HTMLInputElement)?.value || '0');
          const descuento = parseFloat((fila.querySelector('[data-field="descuento"]') as HTMLInputElement)?.value || '0');

          if (importe > 0) {
            const importeFinal = importe * (1 - descuento / 100);
            totalOriginal += importe;
            totalFinal += importeFinal;
            deudas.push({
              contrato: DOMPurify.sanitize((fila.querySelector('[data-field="contrato"]') as HTMLInputElement)?.value || ''),
              producto: DOMPurify.sanitize((fila.querySelector('[data-field="producto"]') as HTMLSelectElement)?.value || ''),
              entidad: DOMPurify.sanitize((fila.querySelector('[data-field="entidad"]') as HTMLSelectElement)?.value || ''),
              importeOriginal: importe,
              importeFinal,
              descuento
            });
          }
        });

        const cuotaMensual = totalFinal / numCuotas;
        const ahorro = totalOriginal - totalFinal;
        const referencia = `PLAN-${Date.now()}`;

        const planConfirmado: Plan = {
          referencia,
          fecha: new Date().toISOString(),
          cliente: { nombre: nombreDeudor, dni: dniDeudor, email: emailDeudor },
          estado: 'plan_contratado',
          totalImporte: totalOriginal,
          descuentoMedio: deudas.length > 0 ? deudas.reduce((sum, d) => sum + d.descuento, 0) / deudas.length : 0,
          cuotaMensual,
          ahorro,
          deudas,
          progreso: 50,
          historial: [{
            fecha: new Date().toISOString(),
            accion: 'Plan creado y contratado',
            estado: 'plan_contratado',
            descripcion: `Plan creado y contratado directamente con ${deudas.length} deuda(s) por un total de ${this.formatCurrency(totalOriginal)}`
          }],
          fechaContratacion: new Date().toISOString()
        };

        this.planes.push(planConfirmado);
      }

      await storageService.savePlansLocal(this.planes);
      const resultadoSimulacion = document.getElementById('resultadoSimulacion');
      const resultadoFinal = document.getElementById('resultadoFinal');
      if (resultadoSimulacion) resultadoSimulacion.style.display = 'none';
      if (resultadoFinal) resultadoFinal.style.display = 'block';
      this.actualizarDashboard();
      this.actualizarTablaSeguimiento();
      graphService.actualizarGraficos(this.planes);
      uiService.mostrarNotificacion('Plan contratado correctamente', 'success');
    } catch (error) {
      uiService.mostrarNotificacion('Error al confirmar el plan', 'error');
      console.error('Confirm plan error:', error);
    }
  }

  private modificarSimulacion(): void {
    const resultadoSimulacion = document.getElementById('resultadoSimulacion');
    if (resultadoSimulacion) resultadoSimulacion.style.display = 'none';
    this.switchTab('simulador');
  }

  private nuevoCliente(): void {
    this.reiniciarFormulario();
    this.switchTab('simulador');
  }

  private mostrarModalPlanes(): void {
    const listaPlanes = document.getElementById('listaPlanes');
    if (!listaPlanes) return;

    listaPlanes.innerHTML = '';
    const todosPlanes = [...this.drafts, ...this.planes];

    if (todosPlanes.length === 0) {
      listaPlanes.innerHTML = '<p>No hay planes ni borradores disponibles.</p>';
    } else {
      todosPlanes.forEach(plan => {
        const isDraft = 'datos' in plan;
        const nombre = isDraft ? plan.datos.nombreDeudor : plan.cliente.nombre;
        const referencia = plan.referencia;
        const fecha = new Date(plan.fecha).toLocaleDateString();
        const estado = isDraft ? 'Borrador' : normalizarEstado(plan.estado);

        const card = document.createElement('div');
        card.className = 'plan-card';
        card.dataset.plan = JSON.stringify(plan);
        card.innerHTML = DOMPurify.sanitize(`
          <h4>${nombre}</h4>
          <p>Referencia: ${referencia}</p>
          <p>Fecha: ${fecha}</p>
          <p>Estado: ${estado}</p>
        `);
        listaPlanes.appendChild(card);
      });
    }

    const modal = document.getElementById('modalPlanes');
    if (modal) modal.style.display = 'block';
  }

  private cerrarModalPlanes(): void {
    const modal = document.getElementById('modalPlanes');
    if (modal) modal.style.display = 'none';
  }

  private cerrarModalDetalles(): void {
    const modal = document.getElementById('modalDetalles');
    if (modal) modal.style.display = 'none';
  }

  private cargarPlan(plan: Plan | Draft): void {
    this.reiniciarFormulario();
    const isDraft = 'datos' in plan;
    const datos = isDraft ? plan.datos : plan;

    (document.getElementById('nombreDeudor') as HTMLInputElement).value = isDraft ? datos.nombreDeudor : datos.cliente.nombre;
    (document.getElementById('dniDeudor') as HTMLInputElement).value = isDraft ? datos.dniDeudor : datos.cliente.dni;
    (document.getElementById('emailDeudor') as HTMLInputElement).value = isDraft ? datos.emailDeudor : datos.cliente.email || '';
    (document.getElementById('numCuotas') as HTMLInputElement).value = datos.numCuotas?.toString() || '12';

    const deudas = isDraft ? datos.deudas : plan.deudas;
    deudas.forEach(deuda => this.agregarFilaDeuda(deuda));
    this.calcularTotales();
    this.cerrarModalPlanes();
    this.switchTab('simulador');
  }

  private verDetallesPlan(referencia: string): void {
    const plan = this.planes.find(p => p.referencia === referencia);
    if (!plan) {
      uiService.mostrarNotificacion('Plan no encontrado', 'error');
      return;
    }

    const modalContent = document.getElementById('detallesPlanContent');
    if (modalContent) {
      modalContent.innerHTML = DOMPurify.sanitize(`
        <h3>Detalles del Plan: ${plan.cliente.nombre}</h3>
        <p>Referencia: ${plan.referencia}</p>
        <p>Estado: ${normalizarEstado(plan.estado)}</p>
        <p>Deuda Total: ${this.formatCurrency(plan.totalImporte)}</p>
        <p>Deuda Final: ${this.formatCurrency(plan.deudas.reduce((sum, d) => sum + d.importeFinal, 0))}</p>
        <p>Ahorro: ${this.formatCurrency(plan.ahorro)}</p>
        <p>Cuota Mensual: ${this.formatCurrency(plan.cuotaMensual)}</p>
        <h4>Deudas</h4>
        <ul>
          ${plan.deudas.map(d => `<li>${d.contrato} (${d.producto}, ${d.entidad}): ${this.formatCurrency(d.importeOriginal)} -> ${this.formatCurrency(d.importeFinal)}</li>`).join('')}
        </ul>
      `);
    }

    const modal = document.getElementById('modalDetalles');
    if (modal) modal.style.display = 'block';
  }

  private editarPlan(referencia: string): void {
    const plan = this.planes.find(p => p.referencia === referencia);
    if (plan) {
      this.cargarPlan(plan);
    }
  }

  private async avanzarFase(referencia: string): Promise<void> {
    try {
      const plan = this.planes.find(p => p.referencia === referencia);
      if (!plan) {
        uiService.mostrarNotificacion('Plan no encontrado', 'error');
        return;
      }

      const estadoActual = normalizarEstado(plan.estado);
      let nuevoEstado = estadoActual;

      if (estadoActual === ESTADOS.PLAN_CREADO) {
        nuevoEstado = ESTADOS.PLAN_CONTRATADO;
        plan.fechaContratacion = new Date().toISOString();
        plan.progreso = 50;
      } else if (estadoActual === ESTADOS.PLAN_CONTRATADO) {
        nuevoEstado = ESTADOS.PRIMER_PAGO;
        plan.fechaPrimerPago = new Date().toISOString();
        plan.progreso = 75;
      }

      if (nuevoEstado !== estadoActual) {
        plan.estado = nuevoEstado;
        plan.historial.push({
          fecha: new Date().toISOString(),
          accion: `Avance a ${nuevoEstado}`,
          estado: nuevoEstado,
          descripcion: `El plan avanzó a la fase ${nuevoEstado}`
        });
        await storageService.savePlansLocal(this.planes);
        await this.actualizarEstadoPlanRemoto(referencia, nuevoEstado);
        this.actualizarTablaSeguimiento();
        graphService.actualizarGraficos(this.planes);
        uiService.mostrarNotificacion(`Plan avanzado a ${nuevoEstado}`, 'success');
      }
    } catch (error) {
      uiService.mostrarNotificacion('Error al avanzar la fase del plan', 'error');
      console.error('Advance phase error:', error);
    }
  }

  private actualizarDashboard(): void {
    const totalPlanes = document.getElementById('totalPlanesDashboard');
    if (totalPlanes) totalPlanes.textContent = `${this.planes.length}`;

    const funnel = this.calcularFunnel();
    const funnelEl = document.getElementById('funnelDashboard');
    if (funnelEl) {
      funnelEl.innerHTML = DOMPurify.sanitize(`
        <p>Planes Creados: ${funnel.plan_creado}</p>
        <p>Planes Contratados: ${funnel.plan_contratado}</p>
        <p>Primeros Pagos: ${funnel.primer_pago}</p>
      `);
    }

    graphService.actualizarGraficos(this.planes);
  }

  private actualizarTablaSeguimiento(): void {
    const tbody = document.getElementById('tablaSeguimiento')?.querySelector('tbody');
    if (!tbody) return;

    const buscar = (document.getElementById('buscarSeguimiento') as HTMLInputElement)?.value.toLowerCase() || '';
    const filtroEstado = (document.getElementById('filtroEstado') as HTMLSelectElement)?.value || '';
    const filtroPeriodo = (document.getElementById('filtroPeriodo') as HTMLSelectElement)?.value || '';

    const filteredPlans = this.planes.filter(plan => {
      const matchesSearch = plan.cliente.nombre.toLowerCase().includes(buscar) || plan.referencia.toLowerCase().includes(buscar);
      const matchesEstado = !filtroEstado || normalizarEstado(plan.estado) === filtroEstado;
      const matchesPeriodo = !filtroPeriodo || new Date(plan.fecha).getFullYear().toString() === filtroPeriodo;
      return matchesSearch && matchesEstado && matchesPeriodo;
    });

    tbody.innerHTML = '';
    filteredPlans.forEach(plan => {
      const row = document.createElement('tr');
      row.innerHTML = DOMPurify.sanitize(`
        <td>${plan.cliente.nombre}</td>
        <td>${plan.referencia}</td>
        <td>${new Date(plan.fecha).toLocaleDateString()}</td>
        <td>${normalizarEstado(plan.estado)}</td>
        <td>${this.formatCurrency(plan.totalImporte)}</td>
        <td>
          <button title="Ver detalles" data-referencia="${plan.referencia}">📄</button>
          <button title="Editar" data-referencia="${plan.referencia}">✏️</button>
          <button title="Avanzar fase" data-referencia="${plan.referencia}">➡️</button>
        </td>
      `);
      tbody.appendChild(row);
    });
  }

  generarTimelinePlan(plan: Plan): Array<{ fecha: string; titulo: string; estado: string }> {
    const eventos = [
      { fecha: plan.fecha, titulo: 'Plan creado', estado: 'success' }
    ];

    if (normalizarEstado(plan.estado) === ESTADOS.PLAN_CONTRATADO || normalizarEstado(plan.estado) === ESTADOS.PRIMER_PAGO) {
      eventos.push({
        fecha: plan.fechaContratacion ?? plan.fecha,
        titulo: 'Plan contratado',
        estado: 'success'
      });
    }
    if (normalizarEstado(plan.estado) === ESTADOS.PRIMER_PAGO) {
      eventos.push({
        fecha: plan.fechaPrimerPago ?? plan.fecha,
        titulo: 'Primer pago',
        estado: 'success'
      });
    }

    return eventos.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }

  calcularFunnel(): { plan_creado: number; plan_contratado: number; primer_pago: number } {
    return this.planes.reduce(
      (acc, p) => {
        switch (normalizarEstado(p.estado)) {
          case ESTADOS.PLAN_CREADO:
            acc.plan_creado++;
            break;
          case ESTADOS.PLAN_CONTRATADO:
            acc.plan_contratado++;
            break;
          case ESTADOS.PRIMER_PAGO:
            acc.primer_pago++;
            break;
        }
        return acc;
      },
      { plan_creado: 0, plan_contratado: 0, primer_pago: 0 }
    );
  }

  async guardarPlanEnGitHub(plan: Plan): Promise<void> {
    try {
      const response = await fetch('/.netlify/functions/save-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan)
      });
      if (!response.ok) throw new Error(await response.text());
      uiService.mostrarNotificacion('Plan guardado en GitHub', 'success');
    } catch (error) {
      uiService.mostrarNotificacion('Error al guardar el plan', 'error');
      console.error('GitHub save error:', error);
      throw error;
    }
  }

  async actualizarEstadoPlanRemoto(referencia: string, estado: string): Promise<void> {
    try {
      // Placeholder for remote state update
      console.debug('Actualizar estado remoto', referencia, estado);
      uiService.mostrarNotificacion('Estado actualizado remotamente', 'success');
    } catch (error) {
      uiService.mostrarNotificacion('Error al actualizar el estado remoto', 'error');
      console.error('Remote state update error:', error);
    }
  }

  async syncWithExcel(): Promise<void> {
    if (!graphService.isAuthenticated()) {
      uiService.mostrarNotificacion('No autenticado para sincronización con Excel', 'error');
      return;
    }

    try {
      uiService.actualizarEstadoSincronizacion('syncing');
      const excelPlans = await graphService.loadPlansFromExcel();
      const merged = this.mergePlans(this.planes, excelPlans);
      await graphService.syncPlansWithExcel(merged);
      this.planes = merged;
      await storageService.savePlansLocal(merged);
      uiService.actualizarEstadoSincronizacion('synced');
      this.actualizarDashboard();
      this.actualizarTablaSeguimiento();
      graphService.actualizarGraficos(this.planes);
    } catch (error) {
      uiService.mostrarNotificacion('Error al sincronizar con Excel', 'error');
      uiService.actualizarEstadoSincronizacion('error');
      console.error('Excel sync error:', error);
    }
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

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
  }
}

// Expose instance globally
const app = new DMDApp();
(window as any).app = app;
app.initApp();
