// Configuración de la aplicación
export const config = {
  // Azure AD Configuration
  auth: {
    clientId: process.env.AZURE_CLIENT_ID || 'YOUR_CLIENT_ID_HERE',
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'YOUR_TENANT_ID_HERE'}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false
  },
  
  // Microsoft Graph Configuration
  graph: {
    baseUrl: 'https://graph.microsoft.com/v1.0',
    scopes: ['user.read', 'files.readwrite', 'sites.readwrite.all'],
    excelFileId: process.env.EXCEL_FILE_ID || 'YOUR_EXCEL_FILE_ID_HERE',
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
