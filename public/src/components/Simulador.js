import { storageService } from '../utils/storage.js';
import { showNotification, showConfirm } from '../utils/notifications.js';
import { exportPlanToPDF } from '../utils/pdfExport.js'; // ← NUEVA IMPORTACIÓN

export class Simulador {
  constructor(container, onUpdate) {
    this.container = container;
    this.onUpdate = onUpdate;
    this.debtCounter = 0;
    this.currentPlan = null;
  }
  
  // ====== NUEVO MÉTODO PARA DESCARGAR PDF ======
  async descargarPDF() {
    try {
      if (!this.currentPlan) {
        showNotification('No hay un plan para descargar. Primero simula o carga un plan.', 'warning');
        return;
      }

      // Usar el módulo de exportación PDF
      await exportPlanToPDF(this.currentPlan);

      // Actualizar dashboard si hay callback
      if (this.onUpdate) {
        this.onUpdate();
      }

    } catch (error) {
      console.error('Error al generar PDF:', error);
      showNotification(`Error al generar PDF: ${error.message}`, 'error');
    }
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
                    <th>N° Contrato</th>
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
              <line x1="12" y
