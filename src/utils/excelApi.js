import { config } from '../config/config.js';
import { authService } from './auth.js';

class ExcelApiService {
  constructor() {
    this.baseUrl = config.graph.baseUrl;
    this.fileId = config.graph.excelFileId;
    this.sheets = config.graph.sheets;
    // Nota: Asegúrate de que las claves en config.graph.tables estén en minúsculas
    this.tables = config.graph.tables || { planes: 'TablePlanes', entradas: 'TableEntradas' }; // Claves en minúsculas
    this.sessionId = null; // Almacenar el ID de la sesión persistente
  }

  // Crear una sesión persistente
  async createSession() {
    try {
      const token = await authService.getToken();
      const response = await fetch(`${this.baseUrl}/me/drive/items/${this.fileId}/workbook/createSession`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ persistChanges: true })
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.status} ${response.statusText}`);
      }

      const { id } = await response.json();
      this.sessionId = id;
      return id;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  // Escapar comillas simples en nombres de hojas para OData
  escapeSheetName(sheetName) {
    return sheetName.replace(/'/g, "''");
  }

  async makeRequest(endpoint, method = 'GET', body = null) {
    try {
      // Asegurarse de que existe una sesión activa
      if (!this.sessionId) {
        await this.createSession();
      }

      const token = await authService.getToken();
      const options = {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'workbook-session-id': this.sessionId // Incluir el ID de la sesión
        }
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, options);

      if (!response.ok) {
        // Si la sesión expira (401 o 403), intentar crear una nueva
        if (response.status === 401 || response.status === 403) {
          this.sessionId = null; // Resetear sesión
          await this.createSession();
          options.headers['workbook-session-id'] = this.sessionId;
          const retryResponse = await fetch(`${this.baseUrl}${endpoint}`, options);
          if (!retryResponse.ok) {
            throw new Error(`Graph API error: ${retryResponse.status} ${retryResponse.statusText}`);
          }
          return await retryResponse.json();
        }
        throw new Error(`Graph API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Excel API request error:', error);
      // Nota: Las funciones consumidoras deben manejar este error para mostrar mensajes amigables en la UI
      throw error;
    }
  }

  // Leer datos de una hoja
  async readSheet(sheetName) {
    // Nota: El parámetro 'range' fue eliminado porque no se usa actualmente.
    // Puede reincorporarse si se necesita especificar un rango específico en el futuro.
    const escapedSheetName = this.escapeSheetName(sheetName);
    const endpoint = `/me/drive/items/${this.fileId}/workbook/worksheets('${escapedSheetName}')/usedRange`;
    return await this.makeRequest(endpoint);
  }

  // Escribir datos en una hoja
  async writeSheet(sheetName, range, values) {
    const escapedSheetName = this.escapeSheetName(sheetName);
    const endpoint = `/me/drive/items/${this.fileId}/workbook/worksheets('${escapedSheetName}')/range(address='${range}')`;
    const body = { values };
    return await this.makeRequest(endpoint, 'PATCH', body);
  }

  // Agregar nueva fila (o múltiples filas)
  async appendRow(sheetName, values) {
    // Nota: No se codifica sheetName porque el endpoint usa el nombre de la tabla.
    // Puede añadirse escapeSheetName si se desea escribir directamente en la hoja en el futuro.
    const tableName = this.tables[sheetName.toLowerCase()] || 'Table1'; // Búsqueda en minúsculas
    const endpoint = `/me/drive/items/${this.fileId}/workbook/tables('${tableName}')/rows`;
    const body = { values: Array.isArray(values[0]) ? values : [values] }; // Soporta una o varias filas
    return await this.makeRequest(endpoint, 'POST', body);
  }

  // Obtener todos los planes
  async getPlanes() {
    try {
      const result = await this.readSheet(this.sheets.planes);
      if (!result.values || result.values.length < 2) return [];

      const headers = result.values[0];
      const rows = result.values.slice(1);

      // Mapear índices de columnas dinámicamente
      const columnMap = {
        referencia: headers.indexOf('Referencia'),
        contrato: headers.indexOf('Contrato'),
        producto: headers.indexOf('Producto'),
        entidad: headers.indexOf('Entidad'),
        antiguedad: headers.indexOf('Antigüedad'),
        importeOriginal: headers.indexOf('ImporteOriginal'),
        descuento: headers.indexOf('Descuento'),
        importeFinal: headers.indexOf('ImporteFinal'),
        fecha: headers.indexOf('Fecha'),
        estado: headers.indexOf('Estado')
      };

      // Validar que todas las columnas necesarias existen
      if (Object.values(columnMap).includes(-1)) {
        throw new Error('Missing required columns in Planes sheet');
      }

      // Agrupar por referencia
      const planesMap = new Map();

      rows.forEach(row => {
        const referencia = row[columnMap.referencia];
        if (!referencia) return;

        const deuda = {
          contrato: row[columnMap.contrato] || '',
          producto: row[columnMap.producto] || '',
          entidad: row[columnMap.entidad] || '',
          antiguedad: row[columnMap.antiguedad] || '',
          importeOriginal: parseFloat(row[columnMap.importeOriginal]) || 0,
          descuento: parseFloat(row[columnMap.descuento]) || 0,
          importeFinal: parseFloat(row[columnMap.importeFinal]) || 0
        };

        if (!planesMap.has(referencia)) {
          planesMap.set(referencia, {
            referencia,
            fecha: row[columnMap.fecha] || '',
            estado: row[columnMap.estado] || '',
            deudas: []
          });
        }

        planesMap.get(referencia).deudas.push(deuda);
      });

      return Array.from(planesMap.values());
    } catch (error) {
      console.error('Error reading planes:', error);
      // Nota: Las funciones consumidoras deben manejar este error para mostrar mensajes amigables en la UI
      throw error;
    }
  }

  // Guardar plan
  async savePlan(plan) {
    try {
      const values = plan.deudas.map(deuda => [
        plan.referencia,
        deuda.contrato || '',
        deuda.producto || '',
        deuda.entidad || '',
        deuda.antiguedad || '',
        deuda.importeOriginal || 0,
        deuda.descuento || 0,
        deuda.importeFinal || 0,
        plan.fecha || new Date().toISOString(),
        plan.estado || 'plan_creado'
      ]);

      // Enviar todas las filas en una sola llamada
      await this.appendRow(this.sheets.planes, values);
      return true;
    } catch (error) {
      console.error('Error saving plan:', error);
      // Nota: Las funciones consumidoras deben manejar este error para mostrar mensajes amigables en la UI
      throw error;
    }
  }

  // Obtener entradas
  async getEntradas() {
    try {
      const result = await this.readSheet(this.sheets.entradas);
      if (!result.values || result.values.length < 2) return [];

      const headers = result.values[0];
      const rows = result.values.slice(1);

      // Mapear índices de columnas dinámicamente
      const columnMap = {
        fecha: headers.indexOf('Fecha'),
        cliente: headers.indexOf('Cliente'),
        dni: headers.indexOf('DNI'),
        deudaOriginal: headers.indexOf('DeudaOriginal'),
        deudaFinal: headers.indexOf('DeudaFinal'),
        estado: headers.indexOf('Estado')
      };

      // Validar que todas las columnas necesarias existen
      if (Object.values(columnMap).includes(-1)) {
        throw new Error('Missing required columns in Entradas sheet');
      }

      return rows.map(row => ({
        fecha: row[columnMap.fecha] || '',
        cliente: row[columnMap.cliente] || '',
        dni: row[columnMap.dni] || '',
        deudaOriginal: parseFloat(row[columnMap.deudaOriginal]) || 0,
        deudaFinal: parseFloat(row[columnMap.deudaFinal]) || 0,
        estado: row[columnMap.estado] || ''
      }));
    } catch (error) {
      console.error('Error reading entradas:', error);
      // Nota: Las funciones consumidoras deben manejar este error para mostrar mensajes amigables en la UI
      throw error;
    }
  }

  // Guardar entrada
  async saveEntrada(entrada) {
    try {
      const values = [
        entrada.fecha,
        entrada.cliente,
        entrada.dni,
        entrada.deudaOriginal,
        entrada.deudaFinal,
        entrada.estado
      ];

      await this.appendRow(this.sheets.entradas, values);
      return true;
    } catch (error) {
      console.error('Error saving entrada:', error);
      // Nota: Las funciones consumidoras deben manejar este error para mostrar mensajes amigables en la UI
      throw error;
    }
  }
}

export const excelApi = new ExcelApiService();