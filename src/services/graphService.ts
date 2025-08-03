import { Client } from '@microsoft/microsoft-graph-client';
import { PublicClientApplication, InteractionRequiredAuthError, AccountInfo } from '@azure/msal-browser';
import { storageService } from './storageService';

interface GraphConfig {
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

interface ExcelRange {
  values: any[][];
  etag?: string;
}

export class GraphService {
  private msalInstance: PublicClientApplication;
  private graphClient: Client | null = null;
  private account: AccountInfo | null = null;
  private config: GraphConfig;
  
  constructor(config: GraphConfig) {
    this.config = config;
    this.msalInstance = new PublicClientApplication({
      auth: {
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        authority: 'https://login.microsoftonline.com/common'
      },
      cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false
      }
    });
  }

  async initialize(): Promise<void> {
    try {
      // Handle redirect promise
      await this.msalInstance.handleRedirectPromise();
      
      // Check if user is already logged in
      const accounts = this.msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        this.account = accounts[0];
        await this.initializeGraphClient();
      }
    } catch (error) {
      console.error('Error initializing MSAL:', error);
    }
  }

  async login(): Promise<boolean> {
    try {
      const loginResponse = await this.msalInstance.loginPopup({
        scopes: this.config.scopes
      });
      
      this.account = loginResponse.account;
      await this.initializeGraphClient();
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  }

  async logout(): Promise<void> {
    if (this.account) {
      await this.msalInstance.logoutPopup({
        account: this.account
      });
      this.account = null;
      this.graphClient = null;
    }
  }

  isAuthenticated(): boolean {
    return !!this.account;
  }

  private async getToken(): Promise<string> {
    if (!this.account) {
      throw new Error('No authenticated account');
    }

    const tokenRequest = {
      scopes: this.config.scopes,
      account: this.account
    };

    try {
      // Try silent token acquisition
      const response = await this.msalInstance.acquireTokenSilent(tokenRequest);
      return response.accessToken;
    } catch (error) {
      // If silent fails, try interactive
      if (error instanceof InteractionRequiredAuthError) {
        const response = await this.msalInstance.acquireTokenPopup(tokenRequest);
        return response.accessToken;
      }
      throw error;
    }
  }

  private async initializeGraphClient(): Promise<void> {
    this.graphClient = Client.init({
      authProvider: async (done) => {
        try {
          const token = await this.getToken();
          done(null, token);
        } catch (error) {
          done(error as Error, null);
        }
      }
    });
  }

  // Excel operations
  async readExcelFile(filePath: string, sheetName: string, range: string): Promise<ExcelRange | null> {
    if (!this.graphClient) {
      throw new Error('Graph client not initialized');
    }

    try {
      // Check cache first
      const cached = storageService.getExcelCache(filePath);
      if (cached && !this.isOnline()) {
        return cached.data;
      }

      const endpoint = `/me/drive/root:${filePath}:/workbook/worksheets('${sheetName}')/range(address='${range}')`;
      const response = await this.graphClient.api(endpoint).get();
      
      const data: ExcelRange = {
        values: response.values,
        etag: response['@odata.etag']
      };

      // Update cache
      storageService.setExcelCache(filePath, data);
      
      return data;
    } catch (error) {
      console.error('Error reading Excel file:', error);
      
      // Return cached data if available
      const cached = storageService.getExcelCache(filePath);
      if (cached) {
        return cached.data;
      }
      
      return null;
    }
  }

  async writeExcelFile(
    filePath: string, 
    sheetName: string, 
    range: string, 
    values: any[][], 
    etag?: string
  ): Promise<boolean> {
    if (!this.graphClient) {
      throw new Error('Graph client not initialized');
    }

    try {
      const endpoint = `/me/drive/root:${filePath}:/workbook/worksheets('${sheetName}')/range(address='${range}')`;
      
      const headers: any = {
        'Content-Type': 'application/json'
      };
      
      // Add etag for conflict detection
      if (etag) {
        headers['If-Match'] = etag;
      }

      await this.graphClient
        .api(endpoint)
        .headers(headers)
        .patch({ values });

      // Invalidate cache
      storageService.clearExcelCache(filePath);
      
      return true;
    } catch (error: any) {
      if (error.statusCode === 412) {
        // Conflict detected
        throw new Error('CONFLICT: The file has been modified by another user');
      }
      console.error('Error writing to Excel:', error);
      return false;
    }
  }

  async syncPlansWithExcel(plans: any[]): Promise<void> {
    const filePath = '/Simulador/plans.xlsx';
    const sheetName = 'Planes';
    
    // Convert plans to Excel format
    const headers = [
      'Referencia', 'Cliente', 'DNI', 'Email', 'Fecha', 'Estado',
      'Total Importe', 'Descuento Medio', 'Cuota Mensual', 'Ahorro',
      'Última Actualización'
    ];
    
    const values = [headers];
    
    plans.forEach(plan => {
      values.push([
        plan.referencia,
        plan.cliente?.nombre || plan.cliente || '',
        plan.cliente?.dni || plan.dni || '',
        plan.cliente?.email || '',
        new Date(plan.fecha).toLocaleDateString('es-ES'),
        plan.estado || 'plan_creado',
        plan.totalImporte || 0,
        plan.descuentoMedio || 0,
        plan.cuotaMensual || 0,
        plan.ahorro || 0,
        new Date().toISOString()
      ]);
    });

    const range = `A1:K${values.length}`;
    await this.writeExcelFile(filePath, sheetName, range, values);
  }

  async loadPlansFromExcel(): Promise<any[]> {
    const filePath = '/Simulador/plans.xlsx';
    const sheetName = 'Planes';
    const range = 'A1:K1000'; // Read up to 1000 rows
    
    const data = await this.readExcelFile(filePath, sheetName, range);
    if (!data || !data.values || data.values.length <= 1) {
      return [];
    }

    // Skip header row and convert to plan objects
    const plans: any[] = [];
    for (let i = 1; i < data.values.length; i++) {
      const row = data.values[i];
      if (!row[0]) continue; // Skip empty rows
      
      plans.push({
        referencia: row[0],
        cliente: {
          nombre: row[1],
          dni: row[2],
          email: row[3]
        },
        fecha: row[4],
        estado: row[5] || 'plan_creado',
        totalImporte: parseFloat(row[6]) || 0,
        descuentoMedio: parseFloat(row[7]) || 0,
        cuotaMensual: parseFloat(row[8]) || 0,
        ahorro: parseFloat(row[9]) || 0,
        ultimaActualizacion: row[10]
      });
    }

    return plans;
  }

  private isOnline(): boolean {
    return navigator.onLine;
  }

  async createExcelFileIfNotExists(filePath: string): Promise<void> {
    if (!this.graphClient) {
      throw new Error('Graph client not initialized');
    }

    try {
      // Check if file exists
      await this.graphClient.api(`/me/drive/root:${filePath}`).get();
    } catch (error: any) {
      if (error.statusCode === 404) {
        // File doesn't exist, create it
        const content = this.generateEmptyExcelContent();
        await this.graphClient
          .api(`/me/drive/root:${filePath}:/content`)
          .put(content);
      }
    }
  }

  private generateEmptyExcelContent(): ArrayBuffer {
    // This is a simplified approach - in production, use a library like ExcelJS
    // to generate proper Excel files
    
    // For now, return empty buffer - implement proper Excel generation
    return new ArrayBuffer(0);
  }
}

 // Create singleton instance
 export const graphService = new GraphService({
   clientId: import.meta.env.VITE_AZURE_CLIENT_ID || '',
   redirectUri: import.meta.env.VITE_AZURE_REDIRECT_URI || window.location.origin,
   scopes: ['Files.ReadWrite', 'offline_access', 'User.Read']
 });
