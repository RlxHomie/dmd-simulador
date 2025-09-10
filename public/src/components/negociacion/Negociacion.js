import { storageService } from '../../utils/storage.js';
import { showNotification } from '../../utils/notifications.js';
import { excelApi } from '../../utils/excelApi.js';

export class Negociacion {
    constructor(container) {
        this.container = container;
        this.allClientsData = [];
        this.currentClientIndex = -1;
        this.selectedClient = null;
        this.debtsData = [];
        this.movementsData = [];
        this.savingsData = { ahorroReal: 0, ahorroDisponible: 0 };
    }

    async render() {
        this.container.innerHTML = `
            <div class="negociacion-container">
                <!-- Barra de herramientas -->
                <div class="toolbar-negociacion">
                    <div class="toolbar-left">
                        <button id="btnNuevoCliente" class="btn btn-primario">
                            <i class="fas fa-user-plus"></i>
                            Nuevo Cliente
                        </button>
                        <button id="btnGuardarCambios" class="btn btn-success">
                            <i class="fas fa-save"></i>
                            Guardar Cambios
                        </button>
                    </div>
                    <div class="toolbar-right">
                        <button id="btnRefrescar" class="btn btn-secundario">
                            <i class="fas fa-sync"></i>
                            Actualizar
                        </button>
                    </div>
                </div>

                <!-- Búsqueda de clientes -->
                <section class="section-card">
                    <div class="section-header bg-blue">
                        <h2><i class="fas fa-search"></i> Buscar Cliente</h2>
                    </div>
                    <div class="section-body">
                        <div class="search-container">
                            <input type="text" id="clientSearchInput" 
                                   placeholder="Buscar por nombre, apellidos o DNI..." 
                                   class="search-input">
                            <button id="btnBuscar" class="btn btn-primario">
                                <i class="fas fa-search"></i>
                                Buscar
                            </button>
                        </div>
                        <div id="searchResults" class="search-results"></div>
                    </div>
                </section>

                <!-- Datos del cliente -->
                <section class="section-card">
                    <div class="section-header bg-green">
                        <h2><i class="fas fa-user"></i> Datos del Cliente</h2>
                        <button id="btnGuardarCliente" class="btn btn-small btn-light">
                            <i class="fas fa-save"></i>
                            Guardar Cliente
                        </button>
                    </div>
                    <div class="section-body">
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="nombre">Nombre</label>
                                <input type="text" id="nombre" class="form-control">
                            </div>
                            <div class="form-group">
                                <label for="apellidos">Apellidos</label>
                                <input type="text" id="apellidos" class="form-control">
                            </div>
                            <div class="form-group">
                                <label for="dni">DNI</label>
                                <input type="text" id="dni" class="form-control">
                            </div>
                            <div class="form-group">
                                <label for="direccion">Dirección</label>
                                <input type="text" id="direccion" class="form-control">
                            </div>
                            <div class="form-group">
                                <label for="telefono">Teléfono</label>
                                <input type="tel" id="telefono" class="form-control">
                            </div>
                            <div class="form-group">
                                <label for="correo">Correo Electrónico</label>
                                <input type="email" id="correo" class="form-control">
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Panel de deudas -->
                <section class="section-card">
                    <div class="section-header bg-red">
                        <h2><i class="fas fa-credit-card"></i> Panel de Deudas</h2>
                        <button id="btnAgregarDeuda" class="btn btn-small btn-light">
                            <i class="fas fa-plus"></i>
                            Agregar Deuda
                        </button>
                    </div>
                    <div class="section-body">
                        <div class="table-responsive">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Entidad</th>
                                        <th>Entidad Original</th>
                                        <th>Producto</th>
                                        <th>Nº Crédito</th>
                                        <th>Estado</th>
                                        <th>Importe</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody id="debtsTableBody"></tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <!-- Panel de ahorros -->
                <section class="section-card">
                    <div class="section-header bg-purple">
                        <h2><i class="fas fa-piggy-bank"></i> Panel de Ahorros</h2>
                        <button id="btnAgregarMovimiento" class="btn btn-small btn-light">
                            <i class="fas fa-plus"></i>
                            Nuevo Movimiento
                        </button>
                    </div>
                    <div class="section-body">
                        <!-- Resumen de ahorros -->
                        <div class="savings-summary">
                            <div class="savings-card gradient-green">
                                <div class="savings-info">
                                    <p class="savings-label">Ahorro Real</p>
                                    <p id="ahorroReal" class="savings-value">€0.00</p>
                                </div>
                                <i class="fas fa-wallet savings-icon"></i>
                            </div>
                            <div class="savings-card gradient-blue">
                                <div class="savings-info">
                                    <p class="savings-label">Ahorro Disponible</p>
                                    <p id="ahorroDisponible" class="savings-value">€0.00</p>
                                </div>
                                <i class="fas fa-coins savings-icon"></i>
                            </div>
                        </div>

                        <!-- Histórico de movimientos -->
                        <h3 class="subsection-title">
                            <i class="fas fa-history"></i> Histórico de Movimientos
                        </h3>
                        <div class="table-responsive">
                            <table class="data-table">
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
            </div>
        `;

        this.attachEventListeners();
        await this.loadClientsData();
        this.addStyles();
    }

    attachEventListeners() {
        // Botones principales
        document.getElementById('btnNuevoCliente')?.addEventListener('click', () => this.nuevoCliente());
        document.getElementById('btnGuardarCambios')?.addEventListener('click', () => this.guardarCambios());
        document.getElementById('btnRefrescar')?.addEventListener('click', () => this.loadClientsData());
        document.getElementById('btnGuardarCliente')?.addEventListener('click', () => this.guardarCliente());
        
        // Búsqueda
        document.getElementById('btnBuscar')?.addEventListener('click', () => this.buscarClientes());
        document.getElementById('clientSearchInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.buscarClientes();
        });
        
        // Deudas y movimientos
        document.getElementById('btnAgregarDeuda')?.addEventListener('click', () => this.agregarDeuda());
        document.getElementById('btnAgregarMovimiento')?.addEventListener('click', () => this.agregarMovimiento());
        
        // Validaciones
        this.setupValidations();
    }

    setupValidations() {
        // Validación DNI
        document.getElementById('dni')?.addEventListener('blur', (e) => {
            const dniRegex = /^[0-9]{8}[A-Za-z]$/;
            if (e.target.value && !dniRegex.test(e.target.value)) {
                showNotification('Formato de DNI inválido (8 números + 1 letra)', 'error');
                e.target.classList.add('input-error');
            } else {
                e.target.classList.remove('input-error');
            }
        });
        
        // Validación email
        document.getElementById('correo')?.addEventListener('blur', (e) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (e.target.value && !emailRegex.test(e.target.value)) {
                showNotification('Formato de email inválido', 'error');
                e.target.classList.add('input-error');
            } else {
                e.target.classList.remove('input-error');
            }
        });
        
        // Validación teléfono
        document.getElementById('telefono')?.addEventListener('blur', (e) => {
            const phoneRegex = /^[+]?[\d\s\-()]{9,}$/;
            if (e.target.value && !phoneRegex.test(e.target.value)) {
                showNotification('Formato de teléfono inválido', 'error');
                e.target.classList.add('input-error');
            } else {
                e.target.classList.remove('input-error');
            }
        });
    }

    async loadClientsData() {
        try {
            showNotification('Cargando datos...', 'info');
            
            // Cargar clientes desde Excel usando excelApi
            const response = await excelApi.makeRequest(
                `/me/drive/items/${excelApi.fileId}/workbook/worksheets('Clientes')/usedRange`
            );
            
            if (response && response.values && response.values.length > 1) {
                const headers = response.values[0];
                const rows = response.values.slice(1);
                
                this.allClientsData = rows.map(row => {
                    const client = {};
                    headers.forEach((header, index) => {
                        client[header.toLowerCase()] = row[index] || '';
                    });
                    return client;
                });
            }
            
            showNotification('Datos cargados correctamente', 'success');
        } catch (error) {
            console.error('Error cargando datos:', error);
            // Si no existe la hoja Clientes, inicializar vacío
            this.allClientsData = [];
            showNotification('No se encontraron datos de clientes', 'warning');
        }
    }

    buscarClientes() {
        const searchTerm = document.getElementById('clientSearchInput').value.toLowerCase();
        const resultsContainer = document.getElementById('searchResults');
        
        if (!searchTerm) {
            resultsContainer.innerHTML = '';
            return;
        }
        
        const results = this.allClientsData.filter(client =>
            (client.nombre && client.nombre.toLowerCase().includes(searchTerm)) ||
            (client.apellidos && client.apellidos.toLowerCase().includes(searchTerm)) ||
            (client.dni && client.dni.toLowerCase().includes(searchTerm))
        );
        
        resultsContainer.innerHTML = results.map((client, index) => `
            <div class="search-result-item" onclick="window.negociacion.seleccionarCliente(${index})">
                <h4>${client.nombre} ${client.apellidos}</h4>
                <p>DNI: ${client.dni} | Tel: ${client.telefono}</p>
            </div>
        `).join('');
        
        if (results.length === 0) {
            resultsContainer.innerHTML = '<p class="no-results">No se encontraron resultados</p>';
        }
    }

    seleccionarCliente(index) {
        this.currentClientIndex = index;
        this.selectedClient = this.allClientsData[index];
        
        // Cargar datos en el formulario
        document.getElementById('nombre').value = this.selectedClient.nombre || '';
        document.getElementById('apellidos').value = this.selectedClient.apellidos || '';
        document.getElementById('dni').value = this.selectedClient.dni || '';
        document.getElementById('direccion').value = this.selectedClient.direccion || '';
        document.getElementById('telefono').value = this.selectedClient.telefono || '';
        document.getElementById('correo').value = this.selectedClient.correo || '';
        
        // Cargar deudas y movimientos
        this.cargarDeudasCliente();
        this.cargarMovimientosCliente();
        
        // Limpiar búsqueda
        document.getElementById('searchResults').innerHTML = '';
        document.getElementById('clientSearchInput').value = '';
        
        showNotification(`Cliente ${this.selectedClient.nombre} seleccionado`, 'success');
    }

    async cargarDeudasCliente() {
        if (!this.selectedClient) return;
        
        try {
            const response = await excelApi.makeRequest(
                `/me/drive/items/${excelApi.fileId}/workbook/worksheets('Deudas')/usedRange`
            );
            
            if (response && response.values) {
                const headers = response.values[0];
                const rows = response.values.slice(1);
                
                // Filtrar deudas del cliente actual
                this.debtsData = rows
                    .filter(row => row[headers.indexOf('DNI')] === this.selectedClient.dni)
                    .map(row => ({
                        entidad: row[headers.indexOf('Entidad')] || '',
                        entidadOriginal: row[headers.indexOf('Entidad Original')] || '',
                        producto: row[headers.indexOf('Producto')] || '',
                        numeroCredito: row[headers.indexOf('Nº Crédito')] || '',
                        estado: row[headers.indexOf('Estado')] || 'Activa',
                        importe: parseFloat(row[headers.indexOf('Importe')] || 0)
                    }));
                
                this.actualizarTablaDeudas();
            }
        } catch (error) {
            console.error('Error cargando deudas:', error);
            this.debtsData = [];
        }
    }

    async cargarMovimientosCliente() {
        if (!this.selectedClient) return;
        
        try {
            const response = await excelApi.makeRequest(
                `/me/drive/items/${excelApi.fileId}/workbook/worksheets('Ahorros')/usedRange`
            );
            
            if (response && response.values) {
                const headers = response.values[0];
                const rows = response.values.slice(1);
                
                // Filtrar movimientos del cliente actual
                this.movementsData = rows
                    .filter(row => row[headers.indexOf('DNI')] === this.selectedClient.dni)
                    .map(row => ({
                        fecha: row[headers.indexOf('Fecha')] || '',
                        clase: row[headers.indexOf('Clase')] || '',
                        aportaciones: parseFloat(row[headers.indexOf('Aportaciones')] || 0),
                        comisionMensual: parseFloat(row[headers.indexOf('Comisión Mensual')] || 0),
                        liquidacion: parseFloat(row[headers.indexOf('Liquidación')] || 0),
                        provisiones: parseFloat(row[headers.indexOf('Provisiones')] || 0),
                        comisionExito: parseFloat(row[headers.indexOf('Comisión De Éxito')] || 0),
                        costeDevolucion: parseFloat(row[headers.indexOf('Coste Devolución')] || 0)
                    }));
                
                this.calcularAhorros();
                this.actualizarTablaMovimientos();
            }
        } catch (error) {
            console.error('Error cargando movimientos:', error);
            this.movementsData = [];
        }
    }

    calcularAhorros() {
        let totalAportaciones = 0;
        let totalComisionMensual = 0;
        let totalLiquidacion = 0;
        let totalProvisiones = 0;
        let totalComisionExito = 0;
        let totalCosteDevolucion = 0;
        
        this.movementsData.forEach(mov => {
            totalAportaciones += mov.aportaciones || 0;
            totalComisionMensual += mov.comisionMensual || 0;
            totalLiquidacion += mov.liquidacion || 0;
            totalProvisiones += mov.provisiones || 0;
            totalComisionExito += mov.comisionExito || 0;
            totalCosteDevolucion += mov.costeDevolucion || 0;
        });
        
        this.savingsData.ahorroReal = totalAportaciones - totalComisionMensual - 
            totalLiquidacion - totalComisionExito - totalCosteDevolucion;
        this.savingsData.ahorroDisponible = this.savingsData.ahorroReal - totalProvisiones;
        
        // Actualizar UI
        document.getElementById('ahorroReal').textContent = this.formatCurrency(this.savingsData.ahorroReal);
        document.getElementById('ahorroDisponible').textContent = this.formatCurrency(this.savingsData.ahorroDisponible);
    }

    actualizarTablaDeudas() {
        const tbody = document.getElementById('debtsTableBody');
        tbody.innerHTML = this.debtsData.map((debt, index) => `
            <tr>
                <td><input type="text" value="${debt.entidad}" onchange="window.negociacion.updateDebt(${index}, 'entidad', this.value)" class="table-input"></td>
                <td><input type="text" value="${debt.entidadOriginal}" onchange="window.negociacion.updateDebt(${index}, 'entidadOriginal', this.value)" class="table-input"></td>
                <td><input type="text" value="${debt.producto}" onchange="window.negociacion.updateDebt(${index}, 'producto', this.value)" class="table-input"></td>
                <td><input type="text" value="${debt.numeroCredito}" onchange="window.negociacion.updateDebt(${index}, 'numeroCredito', this.value)" class="table-input"></td>
                <td>
                    <select onchange="window.negociacion.updateDebt(${index}, 'estado', this.value)" class="table-input">
                        <option value="Activa" ${debt.estado === 'Activa' ? 'selected' : ''}>Activa</option>
                        <option value="Pendiente" ${debt.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                        <option value="Cancelada" ${debt.estado === 'Cancelada' ? 'selected' : ''}>Cancelada</option>
                    </select>
                </td>
                <td><input type="number" value="${debt.importe}" onchange="window.negociacion.updateDebt(${index}, 'importe', parseFloat(this.value))" class="table-input"></td>
                <td>
                    <button onclick="window.negociacion.eliminarDeuda(${index})" class="btn btn-danger btn-small">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    actualizarTablaMovimientos() {
        const tbody = document.getElementById('movementsTableBody');
        tbody.innerHTML = this.movementsData.map((mov, index) => `
            <tr>
                <td><input type="date" value="${this.formatDateForInput(mov.fecha)}" onchange="window.negociacion.updateMovement(${index}, 'fecha', this.value)" class="table-input"></td>
                <td>
                    <select onchange="window.negociacion.updateMovement(${index}, 'clase', this.value)" class="table-input">
                        <option value="Cuota" ${mov.clase === 'Cuota' ? 'selected' : ''}>Cuota</option>
                        <option value="Aportación Extra" ${mov.clase === 'Aportación Extra' ? 'selected' : ''}>Aportación Extra</option>
                        <option value="Liquidación" ${mov.clase === 'Liquidación' ? 'selected' : ''}>Liquidación</option>
                        <option value="Provisión" ${mov.clase === 'Provisión' ? 'selected' : ''}>Provisión</option>
                    </select>
                </td>
                <td><input type="number" value="${mov.aportaciones}" onchange="window.negociacion.updateMovement(${index}, 'aportaciones', parseFloat(this.value))" class="table-input text-green"></td>
                <td><input type="number" value="${mov.comisionMensual}" onchange="window.negociacion.updateMovement(${index}, 'comisionMensual', parseFloat(this.value))"
class="table-input text-red"></td>
               <td><input type="number" value="${mov.liquidacion}" onchange="window.negociacion.updateMovement(${index}, 'liquidacion', parseFloat(this.value))" class="table-input text-blue"></td>
               <td><input type="number" value="${mov.provisiones}" onchange="window.negociacion.updateMovement(${index}, 'provisiones', parseFloat(this.value))" class="table-input text-orange"></td>
               <td><input type="number" value="${mov.comisionExito}" onchange="window.negociacion.updateMovement(${index}, 'comisionExito', parseFloat(this.value))" class="table-input text-purple"></td>
               <td><input type="number" value="${mov.costeDevolucion}" onchange="window.negociacion.updateMovement(${index}, 'costeDevolucion', parseFloat(this.value))" class="table-input text-red"></td>
               <td>
                   <button onclick="window.negociacion.eliminarMovimiento(${index})" class="btn btn-danger btn-small">
                       <i class="fas fa-trash"></i>
                   </button>
               </td>
           </tr>
       `).join('');
   }

   nuevoCliente() {
       this.currentClientIndex = -1;
       this.selectedClient = null;
       this.debtsData = [];
       this.movementsData = [];
       
       // Limpiar formulario
       document.getElementById('nombre').value = '';
       document.getElementById('apellidos').value = '';
       document.getElementById('dni').value = '';
       document.getElementById('direccion').value = '';
       document.getElementById('telefono').value = '';
       document.getElementById('correo').value = '';
       
       // Limpiar tablas
       document.getElementById('debtsTableBody').innerHTML = '';
       document.getElementById('movementsTableBody').innerHTML = '';
       
       // Resetear ahorros
       this.savingsData = { ahorroReal: 0, ahorroDisponible: 0 };
       document.getElementById('ahorroReal').textContent = '€0.00';
       document.getElementById('ahorroDisponible').textContent = '€0.00';
       
       showNotification('Formulario listo para nuevo cliente', 'info');
   }

   async guardarCliente() {
       const clientData = {
           nombre: document.getElementById('nombre').value,
           apellidos: document.getElementById('apellidos').value,
           dni: document.getElementById('dni').value,
           direccion: document.getElementById('direccion').value,
           telefono: document.getElementById('telefono').value,
           correo: document.getElementById('correo').value
       };
       
       // Validar campos requeridos
       if (!clientData.nombre || !clientData.dni) {
           showNotification('Nombre y DNI son campos obligatorios', 'error');
           return;
       }
       
       if (this.currentClientIndex === -1) {
           // Nuevo cliente
           this.allClientsData.push(clientData);
           this.currentClientIndex = this.allClientsData.length - 1;
       } else {
           // Actualizar cliente existente
           this.allClientsData[this.currentClientIndex] = clientData;
       }
       
       this.selectedClient = clientData;
       showNotification('Cliente guardado localmente. Use "Guardar Cambios" para sincronizar', 'success');
   }

   async guardarCambios() {
       try {
           showNotification('Guardando cambios en Excel...', 'info');
           
           // Guardar clientes
           await this.guardarClientesEnExcel();
           
           // Guardar deudas
           await this.guardarDeudasEnExcel();
           
           // Guardar movimientos
           await this.guardarMovimientosEnExcel();
           
           showNotification('Todos los cambios guardados correctamente', 'success');
       } catch (error) {
           console.error('Error guardando cambios:', error);
           showNotification('Error al guardar cambios', 'error');
       }
   }

   async guardarClientesEnExcel() {
       const headers = ['Nombre', 'Apellidos', 'DNI', 'Direccion', 'Telefono', 'Correo'];
       const values = [headers];
       
       this.allClientsData.forEach(client => {
           values.push([
               client.nombre || '',
               client.apellidos || '',
               client.dni || '',
               client.direccion || '',
               client.telefono || '',
               client.correo || ''
           ]);
       });
       
       await excelApi.writeSheet('Clientes', `A1:F${values.length}`, values);
   }

   async guardarDeudasEnExcel() {
       if (!this.selectedClient) return;
       
       // Primero obtener todas las deudas existentes
       let allDebts = [];
       try {
           const response = await excelApi.makeRequest(
               `/me/drive/items/${excelApi.fileId}/workbook/worksheets('Deudas')/usedRange`
           );
           
           if (response && response.values && response.values.length > 1) {
               const headers = response.values[0];
               const rows = response.values.slice(1);
               
               // Filtrar deudas que no son del cliente actual
               allDebts = rows.filter(row => 
                   row[headers.indexOf('DNI')] !== this.selectedClient.dni
               );
           }
       } catch (error) {
           console.log('Hoja de deudas no existe, se creará');
       }
       
       // Agregar las deudas del cliente actual
       const headers = ['DNI', 'Entidad', 'Entidad Original', 'Producto', 'Nº Crédito', 'Estado', 'Importe'];
       const values = [headers];
       
       // Agregar deudas de otros clientes
       allDebts.forEach(debt => values.push(debt));
       
       // Agregar deudas del cliente actual
       this.debtsData.forEach(debt => {
           values.push([
               this.selectedClient.dni,
               debt.entidad,
               debt.entidadOriginal,
               debt.producto,
               debt.numeroCredito,
               debt.estado,
               debt.importe
           ]);
       });
       
       await excelApi.writeSheet('Deudas', `A1:G${values.length}`, values);
   }

   async guardarMovimientosEnExcel() {
       if (!this.selectedClient) return;
       
       // Primero obtener todos los movimientos existentes
       let allMovements = [];
       try {
           const response = await excelApi.makeRequest(
               `/me/drive/items/${excelApi.fileId}/workbook/worksheets('Ahorros')/usedRange`
           );
           
           if (response && response.values && response.values.length > 1) {
               const headers = response.values[0];
               const rows = response.values.slice(1);
               
               // Filtrar movimientos que no son del cliente actual
               allMovements = rows.filter(row => 
                   row[headers.indexOf('DNI')] !== this.selectedClient.dni
               );
           }
       } catch (error) {
           console.log('Hoja de ahorros no existe, se creará');
       }
       
       // Preparar datos para guardar
       const headers = ['DNI', 'Fecha', 'Clase', 'Aportaciones', 'Comisión Mensual', 
                       'Liquidación', 'Provisiones', 'Comisión De Éxito', 'Coste Devolución'];
       const values = [headers];
       
       // Agregar movimientos de otros clientes
       allMovements.forEach(mov => values.push(mov));
       
       // Agregar movimientos del cliente actual
       this.movementsData.forEach(mov => {
           values.push([
               this.selectedClient.dni,
               mov.fecha,
               mov.clase,
               mov.aportaciones,
               mov.comisionMensual,
               mov.liquidacion,
               mov.provisiones,
               mov.comisionExito,
               mov.costeDevolucion
           ]);
       });
       
       await excelApi.writeSheet('Ahorros', `A1:I${values.length}`, values);
   }

   agregarDeuda() {
       const newDebt = {
           entidad: '',
           entidadOriginal: '',
           producto: '',
           numeroCredito: '',
           estado: 'Activa',
           importe: 0
       };
       
       this.debtsData.push(newDebt);
       this.actualizarTablaDeudas();
       showNotification('Nueva deuda agregada', 'success');
   }

   agregarMovimiento() {
       const newMovement = {
           fecha: new Date().toISOString().split('T')[0],
           clase: 'Cuota',
           aportaciones: 0,
           comisionMensual: 0,
           liquidacion: 0,
           provisiones: 0,
           comisionExito: 0,
           costeDevolucion: 0
       };
       
       this.movementsData.unshift(newMovement);
       this.actualizarTablaMovimientos();
       this.calcularAhorros();
       showNotification('Nuevo movimiento agregado', 'success');
   }

   updateDebt(index, field, value) {
       if (this.debtsData[index]) {
           this.debtsData[index][field] = value;
       }
   }

   updateMovement(index, field, value) {
       if (this.movementsData[index]) {
           this.movementsData[index][field] = value;
           this.calcularAhorros();
       }
   }

   eliminarDeuda(index) {
       if (confirm('¿Está seguro de eliminar esta deuda?')) {
           this.debtsData.splice(index, 1);
           this.actualizarTablaDeudas();
           showNotification('Deuda eliminada', 'success');
       }
   }

   eliminarMovimiento(index) {
       if (confirm('¿Está seguro de eliminar este movimiento?')) {
           this.movementsData.splice(index, 1);
           this.actualizarTablaMovimientos();
           this.calcularAhorros();
           showNotification('Movimiento eliminado', 'success');
       }
   }

   formatCurrency(amount) {
       return new Intl.NumberFormat('es-ES', {
           style: 'currency',
           currency: 'EUR'
       }).format(amount);
   }

   formatDateForInput(dateString) {
       if (!dateString) return '';
       const date = new Date(dateString);
       return date.toISOString().split('T')[0];
   }

   addStyles() {
       const style = document.createElement('style');
       style.textContent = `
           .negociacion-container {
               padding: 20px;
               max-width: 1400px;
               margin: 0 auto;
           }
           
           .toolbar-negociacion {
               display: flex;
               justify-content: space-between;
               margin-bottom: 20px;
               padding: 15px;
               background: white;
               border-radius: 8px;
               box-shadow: 0 2px 4px rgba(0,0,0,0.1);
           }
           
           .toolbar-left, .toolbar-right {
               display: flex;
               gap: 10px;
           }
           
           .section-card {
               background: white;
               border-radius: 8px;
               box-shadow: 0 2px 4px rgba(0,0,0,0.1);
               margin-bottom: 20px;
               overflow: hidden;
           }
           
           .section-header {
               padding: 15px 20px;
               color: white;
               display: flex;
               justify-content: space-between;
               align-items: center;
           }
           
           .section-header h2 {
               margin: 0;
               font-size: 1.2rem;
               display: flex;
               align-items: center;
               gap: 10px;
           }
           
           .section-body {
               padding: 20px;
           }
           
           .bg-blue { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
           .bg-green { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
           .bg-red { background: linear-gradient(135deg, #ee0979 0%, #ff6a00 100%); }
           .bg-purple { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
           
           .form-grid {
               display: grid;
               grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
               gap: 15px;
           }
           
           .form-group label {
               display: block;
               margin-bottom: 5px;
               font-weight: 500;
               color: #333;
           }
           
           .form-control {
               width: 100%;
               padding: 8px 12px;
               border: 1px solid #ddd;
               border-radius: 4px;
               font-size: 14px;
           }
           
           .form-control:focus {
               outline: none;
               border-color: #667eea;
               box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
           }
           
           .input-error {
               border-color: #ee0979 !important;
           }
           
           .search-container {
               display: flex;
               gap: 10px;
               margin-bottom: 20px;
           }
           
           .search-input {
               flex: 1;
               padding: 10px;
               border: 1px solid #ddd;
               border-radius: 4px;
           }
           
           .search-results {
               max-height: 300px;
               overflow-y: auto;
           }
           
           .search-result-item {
               padding: 15px;
               border: 1px solid #e5e7eb;
               border-radius: 4px;
               margin-bottom: 10px;
               cursor: pointer;
               transition: all 0.2s;
           }
           
           .search-result-item:hover {
               background: #f9fafb;
               border-color: #667eea;
           }
           
           .search-result-item h4 {
               margin: 0 0 5px 0;
               color: #111827;
           }
           
           .search-result-item p {
               margin: 0;
               color: #6b7280;
               font-size: 14px;
           }
           
           .data-table {
               width: 100%;
               border-collapse: collapse;
           }
           
           .data-table th {
               background: #f9fafb;
               padding: 12px;
               text-align: left;
               font-weight: 600;
               color: #374151;
               border-bottom: 2px solid #e5e7eb;
           }
           
           .data-table td {
               padding: 8px 12px;
               border-bottom: 1px solid #e5e7eb;
           }
           
           .table-input {
               width: 100%;
               padding: 4px 8px;
               border: 1px solid transparent;
               background: transparent;
               border-radius: 4px;
           }
           
           .table-input:focus {
               border-color: #667eea;
               background: white;
               outline: none;
           }
           
           .table-responsive {
               overflow-x: auto;
           }
           
           .savings-summary {
               display: grid;
               grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
               gap: 20px;
               margin-bottom: 30px;
           }
           
           .savings-card {
               padding: 20px;
               border-radius: 8px;
               color: white;
               display: flex;
               justify-content: space-between;
               align-items: center;
           }
           
           .gradient-green {
               background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
           }
           
           .gradient-blue {
               background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
           }
           
           .savings-info {
               flex: 1;
           }
           
           .savings-label {
               margin: 0 0 5px 0;
               font-size: 14px;
               opacity: 0.9;
           }
           
           .savings-value {
               margin: 0;
               font-size: 24px;
               font-weight: bold;
           }
           
           .savings-icon {
               font-size: 32px;
               opacity: 0.8;
           }
           
           .subsection-title {
               margin: 20px 0 15px 0;
               font-size: 1.1rem;
               color: #374151;
               display: flex;
               align-items: center;
               gap: 10px;
           }
           
           .btn {
               padding: 8px 16px;
               border: none;
               border-radius: 4px;
               cursor: pointer;
               font-size: 14px;
               display: inline-flex;
               align-items: center;
               gap: 8px;
               transition: all 0.2s;
           }
           
           .btn-primario {
               background: #667eea;
               color: white;
           }
           
           .btn-primario:hover {
               background: #5a67d8;
           }
           
           .btn-success {
               background: #10b981;
               color: white;
           }
           
           .btn-success:hover {
               background: #059669;
           }
           
           .btn-secundario {
               background: #6b7280;
               color: white;
           }
           
           .btn-secundario:hover {
               background: #4b5563;
           }
           
           .btn-danger {
               background: #ef4444;
               color: white;
           }
           
           .btn-danger:hover {
               background: #dc2626;
           }
           
           .btn-light {
               background: rgba(255, 255, 255, 0.2);
               color: white;
               border: 1px solid rgba(255, 255, 255, 0.3);
           }
           
           .btn-light:hover {
               background: rgba(255, 255, 255, 0.3);
           }
           
           .btn-small {
               padding: 4px 8px;
               font-size: 12px;
           }
           
           .text-green { color: #10b981; }
           .text-red { color: #ef4444; }
           .text-blue { color: #3b82f6; }
           .text-orange { color: #f97316; }
           .text-purple { color: #8b5cf6; }
           
           .no-results {
               text-align: center;
               color: #6b7280;
               padding: 20px;
           }
       `;
       document.head.appendChild(style);
       
       // Hacer disponible globalmente para eventos inline
       window.negociacion = this;
   }
}