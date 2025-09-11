// /src/components/negociacion/Negociacion.js
import { excelApi } from '../../utils/excelApi.js';
import { storageService } from '../../utils/storage.js';
import { showNotification } from '../../utils/notifications.js';

export class Negociacion {
  constructor(container) {
    this.container = container;
    this.allClients = [];
    this.selectedClient = null;
    this.selectedClientDebts = [];
    this.selectedClientMovements = [];
    this._listenersBound = false;
    this._stylesInjected = false;
  }

  // ============ PUBLIC ============
  async render() {
    this._injectStyles();

    this.container.innerHTML = `
      <div class="neg-wrap">
        <!-- Header -->
        <div class="neg-header">
          <h2>Módulo de Negociación</h2>
          <p class="neg-subtitle">Gestión integral de clientes, deudas y movimientos financieros</p>
        </div>

        <!-- Búsqueda de Cliente -->
        <section class="neg-card">
          <div class="neg-card-head">
            <h3><i class="fas fa-search"></i> Búsqueda de Cliente</h3>
          </div>
          <div class="neg-card-body">
            <div class="neg-search-box">
              <input 
                id="clientSearch" 
                type="text" 
                class="neg-input" 
                placeholder="Buscar por nombre, apellidos o DNI..."
              />
              <button id="searchBtn" class="neg-btn neg-btn-primary">
                <i class="fas fa-search"></i> Buscar
              </button>
            </div>
            <div id="searchResults" class="neg-search-results"></div>
          </div>
        </section>

        <!-- Datos del Cliente Seleccionado -->
        <section id="selectedClientSection" class="neg-card hidden">
          <div class="neg-card-head">
            <h3><i class="fas fa-user-check"></i> Cliente Seleccionado</h3>
            <button id="clearClientBtn" class="neg-btn neg-btn-secondary">
              <i class="fas fa-times"></i> Limpiar
            </button>
          </div>
          <div class="neg-card-body">
            <div class="neg-client-grid">
              <div class="neg-field">
                <label>Nombre</label>
                <div id="clientNombre" class="neg-field-value"></div>
              </div>
              <div class="neg-field">
                <label>Apellidos</label>
                <div id="clientApellidos" class="neg-field-value"></div>
              </div>
              <div class="neg-field">
                <label>DNI</label>
                <div id="clientDni" class="neg-field-value"></div>
              </div>
              <div class="neg-field">
                <label>Dirección</label>
                <div id="clientDireccion" class="neg-field-value"></div>
              </div>
              <div class="neg-field">
                <label>Teléfono</label>
                <div id="clientTelefono" class="neg-field-value"></div>
              </div>
              <div class="neg-field">
                <label>Correo</label>
                <div id="clientCorreo" class="neg-field-value"></div>
              </div>
            </div>
          </div>
        </section>

        <!-- Panel de Deudas -->
        <section id="debtsSection" class="neg-card hidden">
          <div class="neg-card-head">
            <h3><i class="fas fa-credit-card"></i> Deudas del Cliente</h3>
            <button id="addDebtBtn" class="neg-btn neg-btn-danger">
              <i class="fas fa-plus"></i> Agregar Deuda
            </button>
          </div>
          <div class="neg-card-body">
            <div class="neg-table-wrap">
              <table class="neg-table">
                <thead>
                  <tr>
                    <th>Entidad</th>
                    <th>Producto</th>
                    <th>Nº Contrato</th>
                    <th>Estado</th>
                    <th>Importe Original</th>
                    <th>Descuento %</th>
                    <th>Importe Final</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody id="debtsTableBody"></tbody>
              </table>
            </div>
            <div class="neg-totals">
              <div class="neg-total-item">
                <span>Total Original:</span>
                <span id="totalOriginal" class="neg-amount">€0.00</span>
              </div>
              <div class="neg-total-item">
                <span>Total con Descuento:</span>
                <span id="totalFinal" class="neg-amount neg-success">€0.00</span>
              </div>
              <div class="neg-total-item">
                <span>Ahorro Total:</span>
                <span id="totalAhorro" class="neg-amount neg-info">€0.00</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Panel de Movimientos Financieros -->
        <section id="movementsSection" class="neg-card hidden">
          <div class="neg-card-head">
            <h3><i class="fas fa-exchange-alt"></i> Movimientos Financieros</h3>
            <button id="addMovementBtn" class="neg-btn neg-btn-success">
              <i class="fas fa-plus"></i> Nuevo Movimiento
            </button>
          </div>
          <div class="neg-card-body">
            <!-- Resumen de Ahorros -->
            <div class="neg-savings-grid">
              <div class="neg-savings-card green">
                <div class="neg-savings-icon">
                  <i class="fas fa-wallet"></i>
                </div>
                <div class="neg-savings-content">
                  <p class="neg-savings-label">Ahorro Real</p>
                  <p id="ahorroReal" class="neg-savings-value">€0.00</p>
                </div>
              </div>
              <div class="neg-savings-card blue">
                <div class="neg-savings-icon">
                  <i class="fas fa-coins"></i>
                </div>
                <div class="neg-savings-content">
                  <p class="neg-savings-label">Ahorro Disponible</p>
                  <p id="ahorroDisponible" class="neg-savings-value">€0.00</p>
                </div>
              </div>
            </div>

            <!-- Tabla de Movimientos -->
            <div class="neg-table-wrap">
              <table class="neg-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Clase</th>
                    <th>Aportaciones</th>
                    <th>Comisión Mensual</th>
                    <th>Liquidación</th>
                    <th>Provisiones</th>
                    <th>Comisión Éxito</th>
                    <th>Coste Devolución</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody id="movementsTableBody"></tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- Botón de Guardar Cambios -->
        <div id="saveSection" class="neg-save-section hidden">
          <button id="saveAllBtn" class="neg-btn neg-btn-primary neg-btn-large">
            <i class="fas fa-save"></i> Guardar Todos los Cambios
          </button>
        </div>
      </div>
    `;

    await this._loadData();
    this._bindEvents();
  }

  async refresh() {
    await this._loadData();
    if (this.selectedClient) {
      this._updateSelectedClientDisplay();
    }
  }

  destroy() {
    this.container.innerHTML = '';
  }

  // ============ DATA LOADING ============
  async _loadData() {
    try {
      // Cargar datos desde las tablas existentes
      const [entradas, planes] = await Promise.all([
        excelApi.getEntradas(),
        storageService.getPlans()
      ]);

      // Construir lista de clientes únicos
      const clientsMap = new Map();

      // Desde Entradas
      entradas.forEach(entrada => {
        const dni = this._norm(entrada.dni);
        if (dni && !clientsMap.has(dni)) {
          clientsMap.set(dni, {
            nombre: this._extractNombre(entrada.cliente),
            apellidos: this._extractApellidos(entrada.cliente),
            dni: dni,
            direccion: '',
            telefono: '',
            correo: entrada.email || '',
            deudas: [],
            movimientos: []
          });
        }
      });

      // Desde Planes
      planes.forEach(plan => {
        const dni = this._norm(plan.dni);
        if (dni) {
          if (!clientsMap.has(dni)) {
            clientsMap.set(dni, {
              nombre: this._extractNombre(plan.cliente),
              apellidos: this._extractApellidos(plan.cliente),
              dni: dni,
              direccion: '',
              telefono: '',
              correo: plan.email || '',
              deudas: [],
              movimientos: []
            });
          }

          // Agregar deudas del plan al cliente
          const client = clientsMap.get(dni);
          if (plan.deudas && Array.isArray(plan.deudas)) {
            plan.deudas.forEach(deuda => {
              client.deudas.push({
                ...deuda,
                planRef: plan.referencia,
                estado: plan.estado || 'plan_creado'
              });
            });
          }

          // Agregar movimientos si existen
          if (plan.historial && Array.isArray(plan.historial)) {
            plan.historial.forEach(hist => {
              client.movimientos.push({
                fecha: hist.fecha,
                clase: hist.accion || 'Movimiento',
                descripcion: hist.descripcion,
                aportaciones: 0,
                comisionMensual: 0,
                liquidacion: 0,
                provisiones: 0,
                comisionExito: 0,
                costeDevolucion: 0
              });
            });
          }
        }
      });

      this.allClients = Array.from(clientsMap.values());
      console.log('Clientes cargados:', this.allClients.length);

    } catch (error) {
      console.error('Error cargando datos:', error);
      showNotification('Error al cargar los datos', 'error');
    }
  }

  // ============ EVENT HANDLERS ============
  _bindEvents() {
    if (this._listenersBound) return;
    this._listenersBound = true;

    // Búsqueda
    const searchBtn = this.container.querySelector('#searchBtn');
    const searchInput = this.container.querySelector('#clientSearch');
    
    searchBtn?.addEventListener('click', () => this._searchClients());
    searchInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this._searchClients();
    });
    searchInput?.addEventListener('input', (e) => {
      if (e.target.value.length >= 2) this._searchClients();
    });

    // Limpiar cliente
    const clearBtn = this.container.querySelector('#clearClientBtn');
    clearBtn?.addEventListener('click', () => this._clearSelectedClient());

    // Agregar deuda
    const addDebtBtn = this.container.querySelector('#addDebtBtn');
    addDebtBtn?.addEventListener('click', () => this._addNewDebt());

    // Agregar movimiento
    const addMovementBtn = this.container.querySelector('#addMovementBtn');
    addMovementBtn?.addEventListener('click', () => this._addNewMovement());

    // Guardar cambios
    const saveBtn = this.container.querySelector('#saveAllBtn');
    saveBtn?.addEventListener('click', () => this._saveAllChanges());
  }

  // ============ SEARCH ============
  _searchClients() {
    const searchTerm = this.container.querySelector('#clientSearch')?.value.trim().toLowerCase();
    const resultsDiv = this.container.querySelector('#searchResults');
    
    if (!searchTerm || searchTerm.length < 2) {
      resultsDiv.innerHTML = '';
      return;
    }

    const results = this.allClients.filter(client => 
      (client.nombre && client.nombre.toLowerCase().includes(searchTerm)) ||
      (client.apellidos && client.apellidos.toLowerCase().includes(searchTerm)) ||
      (client.dni && client.dni.toLowerCase().includes(searchTerm))
    );

    resultsDiv.innerHTML = results.length === 0 
      ? '<p class="neg-no-results">No se encontraron clientes</p>'
      : results.map(client => `
          <div class="neg-result-item" data-dni="${client.dni}">
            <div class="neg-result-info">
              <strong>${client.nombre} ${client.apellidos}</strong>
              <span>DNI: ${client.dni}</span>
              ${client.correo ? `<span>${client.correo}</span>` : ''}
            </div>
            <div class="neg-result-stats">
              <span class="neg-badge">${client.deudas.length} deudas</span>
            </div>
          </div>
        `).join('');

    // Event listeners para resultados
    resultsDiv.querySelectorAll('.neg-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const dni = item.dataset.dni;
        const client = this.allClients.find(c => c.dni === dni);
        if (client) this._selectClient(client);
      });
    });
  }

  // ============ CLIENT SELECTION ============
  _selectClient(client) {
    this.selectedClient = client;
    this.selectedClientDebts = [...client.deudas];
    this.selectedClientMovements = [...client.movimientos];
    
    // Limpiar búsqueda
    this.container.querySelector('#clientSearch').value = '';
    this.container.querySelector('#searchResults').innerHTML = '';
    
    // Mostrar secciones
    this._showSections(['selectedClientSection', 'debtsSection', 'movementsSection', 'saveSection']);
    
    // Actualizar display
    this._updateSelectedClientDisplay();
    
    showNotification(`Cliente ${client.nombre} ${client.apellidos} seleccionado`, 'success');
  }

  _clearSelectedClient() {
    this.selectedClient = null;
    this.selectedClientDebts = [];
    this.selectedClientMovements = [];
    
    this._hideSections(['selectedClientSection', 'debtsSection', 'movementsSection', 'saveSection']);
    showNotification('Cliente deseleccionado', 'info');
  }

  _updateSelectedClientDisplay() {
    if (!this.selectedClient) return;

    // Actualizar datos del cliente
    this.container.querySelector('#clientNombre').textContent = this.selectedClient.nombre || '-';
    this.container.querySelector('#clientApellidos').textContent = this.selectedClient.apellidos || '-';
    this.container.querySelector('#clientDni').textContent = this.selectedClient.dni || '-';
    this.container.querySelector('#clientDireccion').textContent = this.selectedClient.direccion || 'No especificada';
    this.container.querySelector('#clientTelefono').textContent = this.selectedClient.telefono || 'No especificado';
    this.container.querySelector('#clientCorreo').textContent = this.selectedClient.correo || 'No especificado';

    // Actualizar tablas
    this._updateDebtsTable();
    this._updateMovementsTable();
    this._calculateSavings();
  }

  // ============ DEBTS MANAGEMENT ============
  _updateDebtsTable() {
    const tbody = this.container.querySelector('#debtsTableBody');
    tbody.innerHTML = this.selectedClientDebts.map((debt, index) => `
      <tr>
        <td><input type="text" value="${debt.entidad || ''}" onchange="window.negociacion._updateDebt(${index}, 'entidad', this.value)" class="neg-input-inline"></td>
        <td><input type="text" value="${debt.producto || ''}" onchange="window.negociacion._updateDebt(${index}, 'producto', this.value)" class="neg-input-inline"></td>
        <td><input type="text" value="${debt.contrato || ''}" onchange="window.negociacion._updateDebt(${index}, 'contrato', this.value)" class="neg-input-inline"></td>
        <td>
          <select onchange="window.negociacion._updateDebt(${index}, 'estado', this.value)" class="neg-input-inline">
            <option value="plan_creado" ${debt.estado === 'plan_creado' ? 'selected' : ''}>Creado</option>
            <option value="plan_contratado" ${debt.estado === 'plan_contratado' ? 'selected' : ''}>Contratado</option>
            <option value="primer_pago" ${debt.estado === 'primer_pago' ? 'selected' : ''}>Pagando</option>
          </select>
        </td>
        <td><input type="number" value="${debt.importeOriginal || 0}" onchange="window.negociacion._updateDebt(${index}, 'importeOriginal', parseFloat(this.value))" class="neg-input-inline"></td>
        <td><input type="number" value="${debt.descuento || 0}" onchange="window.negociacion._updateDebt(${index}, 'descuento', parseFloat(this.value))" class="neg-input-inline" min="0" max="100"></td>
        <td class="neg-success">${this._formatEUR(debt.importeFinal || 0)}</td>
        <td>
          <button onclick="window.negociacion._removeDebt(${index})" class="neg-btn-icon neg-danger">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');

    this._updateDebtTotals();
  }

  _updateDebt(index, field, value) {
    if (this.selectedClientDebts[index]) {
      this.selectedClientDebts[index][field] = value;
      
      // Recalcular importe final si se cambia el original o descuento
      if (field === 'importeOriginal' || field === 'descuento') {
        const debt = this.selectedClientDebts[index];
        debt.importeFinal = debt.importeOriginal * (1 - (debt.descuento / 100));
      }
      
      this._updateDebtsTable();
    }
  }

  _removeDebt(index) {
    if (confirm('¿Eliminar esta deuda?')) {
      this.selectedClientDebts.splice(index, 1);
      this._updateDebtsTable();
      showNotification('Deuda eliminada', 'success');
    }
  }

  _addNewDebt() {
    this.selectedClientDebts.push({
      entidad: '',
      producto: '',
      contrato: '',
      estado: 'plan_creado',
      importeOriginal: 0,
      descuento: 0,
      importeFinal: 0
    });
    this._updateDebtsTable();
  }

  _updateDebtTotals() {
    const totalOriginal = this.selectedClientDebts.reduce((sum, d) => sum + (d.importeOriginal || 0), 0);
    const totalFinal = this.selectedClientDebts.reduce((sum, d) => sum + (d.importeFinal || 0), 0);
    const totalAhorro = totalOriginal - totalFinal;

    this.container.querySelector('#totalOriginal').textContent = this._formatEUR(totalOriginal);
    this.container.querySelector('#totalFinal').textContent = this._formatEUR(totalFinal);
    this.container.querySelector('#totalAhorro').textContent = this._formatEUR(totalAhorro);
  }

  // ============ MOVEMENTS MANAGEMENT ============
  _updateMovementsTable() {
    const tbody = this.container.querySelector('#movementsTableBody');
    tbody.innerHTML = this.selectedClientMovements.map((mov, index) => `
      <tr>
        <td><input type="date" value="${this._formatDateForInput(mov.fecha)}" onchange="window.negociacion._updateMovement(${index}, 'fecha', this.value)" class="neg-input-inline"></td>
        <td>
          <select onchange="window.negociacion._updateMovement(${index}, 'clase', this.value)" class="neg-input-inline">
            <option value="Cuota" ${mov.clase === 'Cuota' ? 'selected' : ''}>Cuota</option>
            <option value="Aportación Extra" ${mov.clase === 'Aportación Extra' ? 'selected' : ''}>Aportación Extra</option>
            <option value="Liquidación" ${mov.clase === 'Liquidación' ? 'selected' : ''}>Liquidación</option>
            <option value="Provisión" ${mov.clase === 'Provisión' ? 'selected' : ''}>Provisión</option>
          </select>
        </td>
        <td><input type="number" value="${mov.aportaciones || 0}" onchange="window.negociacion._updateMovement(${index}, 'aportaciones', parseFloat(this.value))" class="neg-input-inline neg-success"></td>
        <td><input type="number" value="${mov.comisionMensual || 0}" onchange="window.negociacion._updateMovement(${index}, 'comisionMensual', parseFloat(this.value))" class="neg-input-inline neg-danger"></td>
        <td><input type="number" value="${mov.liquidacion || 0}" onchange="window.negociacion._updateMovement(${index}, 'liquidacion', parseFloat(this.value))" class="neg-input-inline neg-info"></td>
        <td><input type="number" value="${mov.provisiones || 0}" onchange="window.negociacion._updateMovement(${index}, 'provisiones', parseFloat(this.value))" class="neg-input-inline neg-warning"></td>
        <td><input type="number" value="${mov.comisionExito || 0}" onchange="window.negociacion._updateMovement(${index}, 'comisionExito', parseFloat(this.value))" class="neg-input-inline"></td>
        <td><input type="number" value="${mov.costeDevolucion || 0}" onchange="window.negociacion._updateMovement(${index}, 'costeDevolucion', parseFloat(this.value))" class="neg-input-inline neg-danger"></td>
        <td>
          <button onclick="window.negociacion._removeMovement(${index})" class="neg-btn-icon neg-danger">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  _updateMovement(index, field, value) {
    if (this.selectedClientMovements[index]) {
      this.selectedClientMovements[index][field] = value;
      this._calculateSavings();
    }
  }

  _removeMovement(index) {
    if (confirm('¿Eliminar este movimiento?')) {
      this.selectedClientMovements.splice(index, 1);
      this._updateMovementsTable();
      this._calculateSavings();
      showNotification('Movimiento eliminado', 'success');
    }
  }

  _addNewMovement() {
    this.selectedClientMovements.unshift({
      fecha: new Date().toISOString().split('T')[0],
      clase: 'Cuota',
      aportaciones: 0,
      comisionMensual: 0,
      liquidacion: 0,
      provisiones: 0,
      comisionExito: 0,
      costeDevolucion: 0
    });
    this._updateMovementsTable();
    this._calculateSavings();
  }

  _calculateSavings() {
    let totalAportaciones = 0;
    let totalComisionMensual = 0;
    let totalLiquidacion = 0;
    let totalProvisiones = 0;
    let totalComisionExito = 0;
    let totalCosteDevolucion = 0;

    this.selectedClientMovements.forEach(mov => {
      totalAportaciones += mov.aportaciones || 0;
      totalComisionMensual += mov.comisionMensual || 0;
      totalLiquidacion += mov.liquidacion || 0;
      totalProvisiones += mov.provisiones || 0;
      totalComisionExito += mov.comisionExito || 0;
      totalCosteDevolucion += mov.costeDevolucion || 0;
    });

    const ahorroReal = totalAportaciones - totalComisionMensual - totalLiquidacion - totalComisionExito - totalCosteDevolucion;
    const ahorroDisponible = ahorroReal - totalProvisiones;

    this.container.querySelector('#ahorroReal').textContent = this._formatEUR(ahorroReal);
    this.container.querySelector('#ahorroDisponible').textContent = this._formatEUR(ahorroDisponible);
  }

  // ============ SAVE ============
  async _saveAllChanges() {
    if (!this.selectedClient) {
      showNotification('No hay cliente seleccionado', 'warning');
      return;
    }

    try {
      // Actualizar el cliente en la lista
      const clientIndex = this.allClients.findIndex(c => c.dni === this.selectedClient.dni);
      if (clientIndex !== -1) {
        this.allClients[clientIndex].deudas = [...this.selectedClientDebts];
        this.allClients[clientIndex].movimientos = [...this.selectedClientMovements];
      }

      // Aquí podrías guardar en Excel/Storage si es necesario
      showNotification('Cambios guardados correctamente', 'success');
      
    } catch (error) {
      console.error('Error guardando cambios:', error);
      showNotification('Error al guardar los cambios', 'error');
    }
  }

  // ============ UTILITIES ============
  _norm(s) {
    return String(s || '').trim().toLowerCase();
  }

  _formatEUR(n) {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(n || 0);
  }

  _formatDateForInput(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    return '';
  }

  _extractNombre(fullName) {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    return parts[0] || '';
  }

  _extractApellidos(fullName) {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    return parts.slice(1).join(' ') || '';
  }

  _showSections(sectionIds) {
    sectionIds.forEach(id => {
      const section = this.container.querySelector(`#${id}`);
      if (section) section.classList.remove('hidden');
    });
  }

  _hideSections(sectionIds) {
    sectionIds.forEach(id => {
      const section = this.container.querySelector(`#${id}`);
      if (section) section.classList.add('hidden');
    });
  }

  // ============ STYLES ============
  _injectStyles() {
    if (this._stylesInjected) return;
    this._stylesInjected = true;

    const style = document.createElement('style');
    style.id = 'negociacion-styles';
    style.textContent = `
      .neg-wrap {
        padding: 20px;
        max-width: 1400px;
        margin: 0 auto;
      }

      .neg-header {
        margin-bottom: 30px;
      }

      .neg-header h2 {
        color: var(--text-primary);
        margin-bottom: 8px;
      }

      .neg-subtitle {
        color: var(--text-secondary);
        font-size: 14px;
      }

      .neg-card {
        background: white;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        margin-bottom: 24px;
        overflow: hidden;
      }

      .neg-card.hidden {
        display: none;
      }

      .neg-card-head {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .neg-card-head h3 {
        margin: 0;
        font-size: 18px;
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .neg-card-body {
        padding: 20px;
      }

      .neg-search-box {
        display: flex;
        gap: 12px;
        margin-bottom: 20px;
      }

      .neg-input {
        flex: 1;
        padding: 10px 16px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        font-size: 14px;
        transition: all 0.2s;
      }

      .neg-input:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }

      .neg-input-inline {
        width: 100%;
        padding: 6px 10px;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        font-size: 13px;
        transition: all 0.2s;
      }

      .neg-input-inline:focus {
        outline: none;
        border-color: #667eea;
        background: #f9fafb;
      }

      .neg-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .neg-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }

      .neg-btn-primary {
        background: #667eea;
        color: white;
      }

      .neg-btn-secondary {
        background: #6b7280;
        color: white;
      }

      .neg-btn-success {
        background: #10b981;
        color: white;
      }

      .neg-btn-danger {
        background: #ef4444;
        color: white;
      }

      .neg-btn-large {
        padding: 12px 24px;
        font-size: 16px;
      }

      .neg-btn-icon {
        padding: 6px;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: 6px;
        transition: all 0.2s;
      }

      .neg-btn-icon:hover {
        background: #f3f4f6;
      }

      .neg-btn-icon.neg-danger:hover {
        background: #fee2e2;
        color: #dc2626;
      }

      .neg-search-results {
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
      }

      .neg-result-item {
        padding: 12px;
        border-bottom: 1px solid #f3f4f6;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .neg-result-item:hover {
        background: #f9fafb;
      }

      .neg-result-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .neg-result-info strong {
        color: #1f2937;
        font-size: 15px;
      }

      .neg-result-info span {
        color: #6b7280;
        font-size: 13px;
      }

      .neg-badge {
        background: #667eea;
        color: white;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
      }

      .neg-no-results {
        padding: 24px;
        text-align: center;
        color: #6b7280;
      }

      .neg-client-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
      }

      .neg-field {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .neg-field label {
        font-size: 12px;
        font-weight: 600;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .neg-field-value {
        padding: 10px 14px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        color: #1f2937;
        font-size: 14px;
      }

      .neg-table-wrap {
        overflow-x: auto;
        margin: 20px 0;
      }

      .neg-table {
        width: 100%;
        border-collapse: collapse;
      }

      .neg-table thead th {
        background: #f9fafb;
        padding: 12px;
        text-align: left;
        font-size: 12px;
        font-weight: 600;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 2px solid #e5e7eb;
      }

      .neg-table tbody td {
        padding: 12px;
        border-bottom: 1px solid #f3f4f6;
        font-size: 14px;
      }

      .neg-table tbody tr:hover {
        background: #f9fafb;
      }

      .neg-totals {
        display: flex;
        justify-content: flex-end;
        gap: 24px;
        padding: 16px;
        background: #f9fafb;
        border-radius: 8px;
        margin-top: 20px;
      }

      .neg-total-item {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .neg-total-item span:first-child {
        color: #6b7280;
        font-size: 14px;
      }

      .neg-amount {
        font-size: 18px;
        font-weight: 600;
        color: #1f2937;
      }

      .neg-success {
        color: #10b981 !important;
      }

      .neg-info {
        color: #3b82f6 !important;
      }

      .neg-warning {
        color: #f59e0b !important;
      }

      .neg-danger {
        color: #ef4444 !important;
      }

      .neg-savings-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
      }

      .neg-savings-card {
        padding: 20px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .neg-savings-card.green {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
      }

      .neg-savings-card.blue {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
      }

      .neg-savings-icon {
        width: 48px;
        height: 48px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
      }

      .neg-savings-content {
        flex: 1;
      }

      .neg-savings-label {
        font-size: 12px;
        opacity: 0.9;
        margin-bottom: 4px;
      }

      .neg-savings-value {
        font-size: 24px;
        font-weight: 700;
      }

      .neg-save-section {
        text-align: center;
        padding: 24px;
        background: #f9fafb;
        border-radius: 12px;
        margin-top: 24px;
      }

      .neg-save-section.hidden {
        display: none;
      }

      @media (max-width: 768px) {
        .neg-client-grid {
          grid-template-columns: 1fr;
        }

        .neg-savings-grid {
          grid-template-columns: 1fr;
        }

        .neg-search-box {
          flex-direction: column;
        }

        .neg-totals {
          flex-direction: column;
          gap: 12px;
        }

        .neg-table {
          font-size: 12px;
        }

        .neg-table thead th,
        .neg-table tbody td {
          padding: 8px;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

// Export por defecto también
export default Negociacion;

// Hacer accesible globalmente para los event handlers inline
window.negociacion = null;
