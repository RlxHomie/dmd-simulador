// Configuración de la aplicación
export const config = {
  // Azure AD Configuration
  auth: {
    clientId: process.env.AZURE_CLIENT_ID || 'b5c6f963-3def-4d73-ac74-6bbf6cf37a62',
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'a70783e2-cf58-4e38-bfd7-b403c7c833af'}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false
  },
  
  // Microsoft Graph Configuration
  graph: {
    baseUrl: 'https://graph.microsoft.com/v1.0',
    scopes: ['user.read', 'files.readwrite', 'sites.readwrite.all'],
    excelFileId: process.env.EXCEL_FILE_ID || '01WYAE7MT4WASPPHSYWVGLEAAYVUZCF2O5',
    sheets: {
      entradas: 'Entradas',
      usuarios: 'Usuarios',
      planes: 'Planes'
    },
    tables: {               // 👈 aquí defines los nombres de las tablas
      planes: 'TablePlanes',
      entradas: 'TableEntradas'
    }
  },
  
  // Application Configuration
  app: {
    name: 'DMD Asesores - Simulador de Deuda',
    version: '1.0.0',
    syncInterval: 30000, // 30 segundos
    offlineMode: true,
    debug: process.env.NODE_ENV !== 'production'
  }
};

