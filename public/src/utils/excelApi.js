// utils/excelApi.js
import { config } from '../config/config.js';
import { authService } from './auth.js';

class ExcelApiService {
  constructor() {
    this.baseUrl = config.graph.baseUrl;
    this.fileId = config.graph.excelFileId;
    this.sheets = config.graph.sheets;

    // Nota: Asegúrate de que las claves en config.graph.tables estén en minúsculas
    this.tables = config.graph.tables || { planes: 'TablePlanes', entradas: 'TableEntradas' };

    // Añadir tabla de usuarios si existe en config
    if (config.graph.tables && config.graph.tables.usuarios) {
      this.tables.usuarios = config.graph.tables.usuarios;
    }

    this.sessionId = null; // ID de la sesión persistente
  }

  // ========= Helpers de normalización =========
  _norm(v) {
    return String(v ?? '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toLowerCase();
  }

  _toBool(v, defaultVal = true) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    const s = this._norm(v);
    if (!s) return defaultVal;
    if (['true','1','si','sí','s','y','yes','activo','active','enabled'].includes(s)) return true;
    if (['false','0','no','n','inactivo','inactive','disabled','off'].includes(s)) return false;
    return defaultVal;
  }

  // Crear una sesión persistente
  async createSession() {
    try {
      const token = await authService.getToken();
      const response = await fetch(
        `${this.baseUrl}/me/drive/items/${this.fileId}/workbook/createSession`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ persistChanges: true })
        }
      );

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
      // Asegurar sesión activa
      if (!this.sessionId) {
        await this.createSession();
      }

      const token = await authService.getToken();
      const options = {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'workbook-session-id': this.sessionId
        }
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, options);

      if (!response.ok) {
        // Reintentar si la sesión expiró o permisos
        if (response.status === 401 || response.status === 403) {
          this.sessionId = null;
          await this.createSession();
          options.headers['workbook-session-id'] = this.sessionId;
          const retryResponse = await fetch(url, options);
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
      throw error;
    }
  }

  // ========= Utilidades de lectura =========
  // Leer rango de una TABLA (incluye encabezados y filas)
  async readTableRange(tableName) {
    const endpoint = `/me/drive/items/${this.fileId}/workbook/tables('${tableName}')/range`;
    return await this.makeRequest(endpoint);
  }

  // Leer datos de una HOJA (usedRange)
  async readSheet(sheetName) {
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

  // Agregar nueva fila (o múltiples filas) a una tabla
  async appendRow(sheetKey, values) {
    // sheetKey aquí se usa como clave para this.tables (en minúsculas)
    const tableName = this.tables[String(sheetKey).toLowerCase()] || 'Table1';
    const endpoint = `/me/drive/items/${this.fileId}/workbook/tables('${tableName}')/rows`;
    const body = { values: Array.isArray(values[0]) ? values : [values] };
    return await this.makeRequest(endpoint, 'POST', body);
  }

  // ========= PLANES =========

  async getPlanes() {
    try {
      const result = await this.readSheet(this.sheets.planes);
      if (!result.values || result.values.length < 2) return [];

      const headers = result.values[0];
      const rows = result.values.slice(1);

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

      if (Object.values(columnMap).includes(-1)) {
        throw new Error('Missing required columns in Planes sheet');
      }

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
      throw error;
    }
  }

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

      await this.appendRow(this.sheets.planes, values); // 'Planes' → tables['planes']
      return true;
    } catch (error) {
      console.error('Error saving plan:', error);
      throw error;
    }
  }

  // ========= ENTRADAS =========

  async getEntradas() {
    try {
      const result = await this.readSheet(this.sheets.entradas);
      if (!result.values || result.values.length < 2) return [];

      const headers = result.values[0];
      const rows = result.values.slice(1);

      const columnMap = {
        fecha: headers.indexOf('Fecha'),
        cliente: headers.indexOf('Cliente'),
        dni: headers.indexOf('DNI'),
        deudaOriginal: headers.indexOf('DeudaOriginal'),
        deudaFinal: headers.indexOf('DeudaFinal'),
        estado: headers.indexOf('Estado')
      };

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
      throw error;
    }
  }

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

      await this.appendRow(this.sheets.entradas, values); // 'Entradas' → tables['entradas']
      return true;
    } catch (error) {
      console.error('Error saving entrada:', error);
      throw error;
    }
  }

  // ========= USUARIOS =========
  /**
   * Lee Usuarios desde:
   *  - Tabla (preferida) si existe `config.graph.tables.usuarios` (e.g., 'TableUsuarios')
   *  - Hoja 'Usuarios' (usedRange) como fallback
   *
   * Encabezados tolerantes:
   *  - Nombre:  Nombre | Name | DisplayName
   *  - Email:   Email | Correo | user_upn | UPN | Correo Corporativo | Correo_Corporativo
   *  - Perfil:  Perfil | Rol | Role | Perfil App
   *  - Activo:  Activo | Active | Estado | Enabled
   */
  async getUsuarios() {
    try {
      let result;

      if (this.tables.usuarios) {
        const tableName = this.tables.usuarios;
        result = await this.readTableRange(tableName);
      } else {
        const sheetName = this.sheets.usuarios || 'Usuarios';
        result = await this.readSheet(sheetName);
      }

      const values = result?.values || [];
      if (!values.length || values.length < 2) return [];

      const rawHeaders = values[0].map(h => String(h || '').trim());
      const headersNorm = rawHeaders.map(h => this._norm(h));
      const rows = values.slice(1);

      // Helper: indexOf con normalización y múltiples alias
      const idx = (aliases) => {
        const arr = Array.isArray(aliases) ? aliases : [aliases];
        for (const a of arr) {
          const i = headersNorm.findIndex(hn => hn === this._norm(a));
          if (i !== -1) return i;
        }
        return -1;
      };

      const colNombre = idx(['Nombre','Name','DisplayName']);
      const colPerfil = idx(['Perfil','Rol','Role','Perfil App','Perfil_App']);
      const colEmail  = idx(['Email','Correo','user_upn','UPN','Correo Corporativo','Correo_Corporativo']);
      const colActivo = idx(['Activo','Active','Estado','Enabled']);

      return rows.map(r => ({
        nombre: colNombre !== -1 ? (r[colNombre] ?? '') : '',
        email:  colEmail  !== -1 ? (r[colEmail]  ?? '') : '',
        perfil: colPerfil !== -1 ? (r[colPerfil] ?? 'Gestion') : 'Gestion',
        activo: colActivo !== -1 ? this._toBool(r[colActivo], true) : true
      }));
    } catch (error) {
      console.error('Error reading usuarios:', error);
      // Si no existe la hoja/tabla o hay error, devolver array vacío
      return [];
    }
  }
}

export const excelApi = new ExcelApiService();
