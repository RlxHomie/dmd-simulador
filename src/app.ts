import { DMDApp } from './DMDApp';
import { graphService } from './services/graphService';
import { storageService } from './services/storageService';
import { uiService } from './services/uiService';

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Iniciando aplicación DMD v3.0...');
    
    // Show loading screen
    uiService.mostrarCargando('Cargando configuración...');
    
    // Add sync animation styles
    uiService.addSyncAnimationStyles();
    
    // Initialize Graph service
    await graphService.initialize();
    
    // Create app instance
    const app = new DMDApp();
    
    // Make app globally available for existing event handlers
    (window as any).app = app;
    
    // Initialize app
    await app.initApp();
    
    // Check for OneDrive integration
    if (graphService.isAuthenticated()) {
      uiService.actualizarEstadoSincronizacion('synced');
      
      // Try to sync with Excel
      try {
        await app.syncWithExcel();
      } catch (error) {
        console.error('Error syncing with Excel:', error);
      }
    } else {
      // Add OneDrive login button to status bar
      addOneDriveButton();
    }
    
    // Hide loading screen
    uiService.ocultarCargando();
    
    // Clean up old data periodically
    setInterval(() => {
      storageService.cleanupOldData();
    }, 24 * 60 * 60 * 1000); // Once per day
    
  } catch (error) {
    console.error('Error crítico al inicializar la aplicación:', error);
    
    // Show error screen
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
      loadingScreen.innerHTML = `
        <div class="loading-content">
          <h3 style="color: var(--danger);">Error al cargar la aplicación</h3>
          <p>${error instanceof Error ? error.message : 'Error desconocido'}</p>
          <button onclick="location.reload()" class="btn btn-primario">Recargar</button>
        </div>
      `;
    }
  }
});

// Add OneDrive login button
function addOneDriveButton(): void {
  const statusBar = document.querySelector('.status-bar');
  const buttonsContainer = statusBar?.querySelector('.d-flex.gap-1');
  
  if (buttonsContainer) {
    const oneDriveBtn = document.createElement('button');
    oneDriveBtn.className = 'btn btn-primario';
    oneDriveBtn.style.cssText = 'padding: 0.5rem 1rem; font-size: 0.875rem;';
    oneDriveBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
      Conectar OneDrive
    `;
    
    oneDriveBtn.addEventListener('click', async () => {
      uiService.mostrarCargando('Conectando con OneDrive...');
      
      try {
        const success = await graphService.login();
        if (success) {
          uiService.mostrarNotificacion('Conectado a OneDrive exitosamente', 'success');
          uiService.actualizarEstadoSincronizacion('synced');
          
          // Replace button with sync status
          oneDriveBtn.remove();
          
          // Sync with Excel
          const app = (window as any).app;
          if (app) {
            await app.syncWithExcel();
          }
        } else {
          uiService.mostrarNotificacion('No se pudo conectar a OneDrive', 'error');
        }
      } catch (error) {
        uiService.mostrarNotificacion('Error al conectar con OneDrive', 'error');
      } finally {
        uiService.ocultarCargando();
      }
    });
    
    buttonsContainer.appendChild(oneDriveBtn);
  }
}

// Handle unhandled errors
window.addEventListener('error', (event) => {
  console.error('Error no capturado:', event.error);
  uiService.mostrarNotificacion('Se produjo un error inesperado', 'error');
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Promesa rechazada no manejada:', event.reason);
  uiService.mostrarNotificacion('Error de conexión o procesamiento', 'error');
});

// Handle online/offline events
window.addEventListener('online', () => {
  uiService.actualizarEstadoConexion(true);
  
  // Try to sync pending operations
  const app = (window as any).app;
  if (app) {
    app.syncPendingOperations();
  }
});

window.addEventListener('offline', () => {
  uiService.actualizarEstadoConexion(false);
  uiService.mostrarNotificacion('Trabajando sin conexión', 'warning');

});
