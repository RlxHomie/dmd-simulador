import { authService } from './utils/auth.js';
import { storageService } from './utils/storage.js';
import { showNotification, initNotifications } from './utils/notifications.js';
import { Dashboard } from './components/Dashboard.js';
import { Simulador } from './components/Simulador.js';
import { Seguimiento } from './components/Seguimiento.js';

class App {
  constructor() {
    this.currentTab = 'dashboard';
    this.components = {};
    this.statusInterval = null;
  }
  
  async initialize() {
    try {
      // Show loading screen
      this.showLoading(true);
      
      // Initialize notifications
      initNotifications();
      
      // Initialize auth
      const account = await authService.initialize();
      
      // Initialize storage
      await storageService.initialize();
      
      // Create app structure
      this.createAppStructure();
      
      // Initialize components
      this.initializeComponents();
      
      // Check authentication
      if (!account) {
        this.showAuthRequired();
      } else {
        this.showApp();
      }
      
      // Hide loading screen
      this.showLoading(false);
      
      // Start status monitoring
      this.startStatusMonitoring();
      
    } catch (error) {
      console.error('App initialization error:', error);
      showNotification('Error al inicializar la aplicación', 'error');
      this.showLoading(false);
    }
  }
  
  createAppStructure() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <!-- Loading Screen -->
      <div class="loading-screen" id="loadingScreen" style="display: none;">
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <p>Cargando...</p>
        </div>
      </div>

      <!-- Auth Required Screen -->
      <div id="authRequired" style="display: none; padding: 2rem; text-align: center;">
        <div class="contenedor-simulador" style="max-width: 400px; margin: 0 auto;">
          <img src="/logo.png" alt="Logo DMD Asesores" class="logo" style="margin-bottom: 2rem;">
          <h2>Autenticación Requerida</h2>
          <p style="color: var(--text-secondary); margin-bottom: 2rem;">
            Por favor, inicia sesión con tu cuenta corporativa para acceder al sistema.
          </p>
          <button class="btn btn-primario" id="btnLogin">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
              <polyline points="10 17 15 12 10 7"></polyline>
              <line x1="15" y1="12" x2="3" y2="12"></line>
            </svg>
            Iniciar Sesión con Microsoft
          </button>
        </div>
      </div>

      <!-- Main App -->
      <div id="mainApp" style="display: none;">
        <!-- Status Bar -->
        <div class="status-bar">
          <div class="status-info">
            <div class="status-badge" id="statusBadge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span id="statusText">Conectado</span>
            </div>
            <span id="lastUpdate" style="color: var(--text-secondary); font-size: 0.75rem;"></span>
            <span id="userInfo" style="color: var(--text-secondary); font-size: 0.875rem; margin-left: 1rem;"></span>
          </div>
          <div class="d-flex gap-1">
            <button class="btn btn-secundario" style="padding: 0.5rem 1rem; font-size: 0.875rem;" id="btnSync">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="syncIcon">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              Sincronizar
            </button>
            <button class="btn btn-secundario" style="padding: 0.5rem 1rem; font-size: 0.875rem;" id="btnLogout">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Cerrar Sesión
            </button>
          </div>
        </div>

        <div class="main-wrapper">
          <!-- Navigation Tabs -->
          <div class="nav-tabs">
            <button class="nav-tab active" data-tab="dashboard">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              Dashboard
            </button>
            <button class="nav-tab" data-tab="simulador">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
              Simulador
            </button>
            <button class="nav-tab" data-tab="seguimiento">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
              Seguimiento
            </button>
          </div>

          <!-- Content Container -->
          <div id="contentContainer"></div>
        </div>
      </div>
    `;
    
    // Add event listeners
    this.attachEventListeners();
  }
  
  initializeComponents() {
    const container = document.getElementById('contentContainer');
    
    this.components.dashboard = new Dashboard(container);
    this.components.simulador = new Simulador(container, () => this.refreshDashboard());
    this.components.seguimiento = new Seguimiento(
      container,                       // contenedor principal
      () => this.refreshDashboard(),   // callback onUpdate para KPIGrid y Dashboard
      (tab, plan) => {                 // onSwitchTab ← nuevo callback
        this.switchTab(tab).then(() => {
          if (plan && this.components.simulador?.loadPlan) this.components.simulador.loadPlan(plan);
        });
      }
    );
    
    // Make simulador globally accessible for inline handlers
    window.simulador = this.components.simulador; // Mantener para compatibilidad
    window.DMDAsesores = {
      app: this,
      simulador: this.components.simulador
    };
  }
  
  attachEventListeners() {
    // Login button
    const btnLogin = document.getElementById('btnLogin');
    if (btnLogin) {
      btnLogin.addEventListener('click', () => this.login());
    }
    
    // Logout button
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => this.logout());
    }
    
    // Sync button
    const btnSync = document.getElementById('btnSync');
    if (btnSync) {
      btnSync.addEventListener('click', () => this.syncData());
    }
    
    // Navigation tabs
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.currentTarget.dataset.tab;
        this.switchTab(tabName);
      });
    });
  }
  
  async login() {
    try {
      this.showLoading(true);
      await authService.login();
      
      // Re-initialize after login
      await this.initialize();
    } catch (error) {
      console.error('Login error:', error);
      showNotification('Error al iniciar sesión', 'error');
      this.showLoading(false);
    }
  }
  
  async logout() {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
      showNotification('Error al cerrar sesión', 'error');
    }
  }
  
  showLoading(show) {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
      loadingScreen.style.display = show ? 'flex' : 'none';
    }
  }
  
  showAuthRequired() {
    document.getElementById('authRequired').style.display = 'block';
    document.getElementById('mainApp').style.display = 'none';
  }
  
  showApp() {
    document.getElementById('authRequired').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    
    // Update user info
    const account = authService.getAccount();
    if (account) {
      document.getElementById('userInfo').textContent = account.name || account.username || '';
    }
    
    // Show dashboard by default
    this.switchTab('dashboard');
  }
  
  async switchTab(tabName) {
    // Update active tab
    document.querySelectorAll('.nav-tab').forEach(tab => {
      const isActive = tab.dataset.tab === tabName;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
    
    // Clear container
    const container = document.getElementById('contentContainer');
    container.innerHTML = '';
    
    // Render component
    this.currentTab = tabName;
    await this.components[tabName].render();
    
    // Update app reference in global namespace
    window.DMDAsesores.app = this;
  }
  
  async refreshDashboard() {
    if (this.currentTab === 'dashboard' && this.components.dashboard) {
      await this.components.dashboard.refresh();
    }
  }
  
  async syncData() {
    const syncIcon = document.getElementById('syncIcon');
    const btnSync = document.getElementById('btnSync');
    
    // Add spinning animation
    syncIcon.classList.add('spin');
    btnSync.disabled = true;
    
    try {
      await storageService.syncPendingData();
      
      // Refresh current view
      if (this.components[this.currentTab]) {
        if (this.currentTab === 'dashboard') {
          await this.components[this.currentTab].refresh();
        } else if (this.currentTab === 'seguimiento') {
          await this.components[this.currentTab].updateTable();
        }
      }
      
      showNotification('Sincronización completada', 'success');
    } catch (error) {
      console.error('Sync error:', error);
      showNotification('Error al sincronizar', 'error');
    } finally {
      syncIcon.classList.remove('spin');
      btnSync.disabled = false;
    }
  }
  
  startStatusMonitoring() {
    const updateStatus = () => {
      const status = storageService.getSyncStatus();
      const badge = document.getElementById('statusBadge');
      const text = document.getElementById('statusText');
      const lastUpdate = document.getElementById('lastUpdate');
      
      if (status.isOnline) {
        badge.classList.remove('offline');
        text.textContent = 'Conectado';
        
        if (status.pendingCount > 0) {
          text.textContent += ` (${status.pendingCount} pendientes)`;
        }
      } else {
        badge.classList.add('offline');
        text.textContent = 'Modo Offline';
      }
      
      lastUpdate.textContent = `Actualizado: ${new Date().toLocaleTimeString('es-ES')}`;
    };
    
    // Update immediately
    updateStatus();
    
    // Update every 10 seconds
    this.statusInterval = setInterval(updateStatus, 10000);
  }
  
  destroy() {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }
    
    storageService.destroy();
    
    Object.values(this.components).forEach(component => {
      if (component.destroy) component.destroy();
    });
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.initialize();
  
  // Make app globally accessible
  window.app = app;
});