// App.js
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
    this.profileRendered = null; // 'Gestion' | 'Negociacion'
  }

  async initialize() {
    try {
      this.showLoading(true);

      // Notificaciones
      initNotifications();

      // Auth y storage
      const account = await authService.initialize();
      await storageService.initialize();

      // Estructura base
      this.createAppStructure();

      // Mostrar según autenticación
      if (!account) {
        this.showAuthRequired();
      } else {
        this.showApp(); // aquí se decide Negociación vs Gestión
      }

      this.showLoading(false);
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
          <!-- Navigation Tabs (Gestión) -->
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

    // Listeners
    this.attachEventListeners();
  }

// ==== NUEVA LÓGICA DE PERFILES ====

function normPerfil(p) {
  return String(p ?? '')
    .normalize('NFD').replace(/\p{Diacritic}/gu,'')
    .trim().toLowerCase();
}

// Modificado: muestra app y decide UI por perfil (robusto)
showApp() {
  document.getElementById('authRequired').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';

  const account = authService.getAccount();
  if (account) {
    document.getElementById('userInfo').textContent = account.name || account.username || '';
    const perfil = account.perfil || 'Gestion';
    const perfilNorm = normPerfil(perfil);

    // Evitar re-render de la misma UI si el perfil no cambió
    if (this.profileRendered && normPerfil(this.profileRendered) === perfilNorm) {
      return;
    }

    if (perfilNorm === 'negociacion') {
      this.showNegociacionUI();
      this.profileRendered = 'Negociacion';
    } else {
      this.showGestionUI();
      this.profileRendered = 'Gestion';
    }
  } else {
    if (this.profileRendered !== 'Gestion') {
      this.showGestionUI();
      this.profileRendered = 'Gestion';
    }
  }
}


// UI específica para Negociación (con fallbacks y diagnóstico)
async showNegociacionUI() {
  // Ocultar tabs de gestión
  const navTabs = document.querySelector('.nav-tabs');
  if (navTabs) navTabs.style.display = 'none';

  // Destruir componentes de gestión si estaban creados
  this.teardownGestionComponents();

  // Contenedor
  const container = document.getElementById('contentContainer');
  container.innerHTML = `
    <div class="negociacion-header">
      <h1 style="font-size: 1.5rem; font-weight: bold; color: var(--text-primary);">
        Módulo de Negociación
      </h1>
      <p style="color: var(--text-secondary); margin-top: 0.5rem;">
        Gestión integral de clientes, deudas y movimientos financieros
      </p>
    </div>
  `;

  // Intentaremos varias rutas por si el fichero no está donde esperamos
  const candidates = [
    './components/negociacion/Negociacion.js', // carpeta negociacion/
    './components/Negociacion.js',             // directamente en components/
    '../components/negociacion/Negociacion.js' // por si app.js está anidado distinto
  ];

  // Helper de diagnóstico: comprueba qué devuelve el servidor
  const probe = async (url) => {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      const ct = res.headers.get('content-type') || '';
      const text = await res.text();
      console.log('[Negociacion probe]', { url, status: res.status, contentType: ct, preview: text.slice(0, 120) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      // Si parece HTML o JSON, no es módulo
      if (/^\s*</.test(text) || /^\s*[{[]/.test(text)) {
        throw new SyntaxError('Contenido no es JS módulo ES');
      }
      // Crea un blob para forzar MIME JS y evitar problemas de content-type
      const blob = new Blob([text], { type: 'text/javascript' });
      const objURL = URL.createObjectURL(blob);
      try {
        const mod = await import(/* @vite-ignore */ objURL);
        URL.revokeObjectURL(objURL);
        return mod;
      } catch (e) {
        URL.revokeObjectURL(objURL);
        throw e;
      }
    } catch (e) {
      console.warn('[Negociacion] Falló import de', url, e);
      return null;
    }
  };

  // Prueba rutas hasta que una funcione
  let mod = null;
  for (const url of candidates) {
    // Primer diagnóstico: ¿qué hay realmente en esa URL?
    const res = await fetch(url, { cache: 'no-store' }).catch(() => null);
    if (res && res.ok) {
      const ct = res.headers.get('content-type') || '';
      const head = await res.clone().text();
      console.log('[Negociacion fetch]', { url, status: res.status, contentType: ct, preview: head.slice(0, 120) });
    } else {
      console.warn('[Negociacion fetch] No accesible:', url, res && res.status);
    }

    // Luego intenta importarlo de forma segura
    mod = await probe(url);
    if (mod) break;
  }

  if (!mod) {
    showNotification('No se pudo cargar el módulo de Negociación (revisa ruta y contenido del archivo)', 'error');
    console.error('Todas las rutas fallaron:', candidates);
    return;
  }

  // Acepta export nombrado o default
  const Ctor = mod.Negociacion || mod.default;
  if (typeof Ctor !== 'function') {
    showNotification('El módulo de Negociación no exporta una clase válida', 'error');
    console.error('Exports encontrados:', Object.keys(mod));
    return;
  }

  try {
    this.components.negociacion = new Ctor(container);
    await this.components.negociacion.render();
  } catch (err) {
    console.error('Error iniciando Negociacion:', err);
    showNotification('No se pudo iniciar Negociación', 'error');
  }
}


  // UI de Gestión (tabs clásicas)
  showGestionUI() {
    // Mostrar tabs
    const navTabs = document.querySelector('.nav-tabs');
    if (navTabs) navTabs.style.display = 'flex';

    // Destruir componente negociación si existía
    if (this.components.negociacion?.destroy) {
      try { this.components.negociacion.destroy(); } catch (_) {}
    }
    this.components.negociacion = null;

    // Inicializar componentes de gestión si no existen
    this.initializeComponents();

    // Abrir dashboard por defecto
    this.switchTab('dashboard');
  }

  // Inicializa componentes de Gestión evitando duplicados
  initializeComponents() {
    const container = document.getElementById('contentContainer');

    if (!this.components.dashboard) {
      this.components.dashboard = new Dashboard(container);
    }
    if (!this.components.simulador) {
      this.components.simulador = new Simulador(container, () => this.refreshDashboard());
    }
    if (!this.components.seguimiento) {
      this.components.seguimiento = new Seguimiento(
        container,
        () => this.refreshDashboard(),
        (tab, plan) => {
          this.switchTab(tab).then(() => {
            if (plan && this.components.simulador?.loadPlan) {
              this.components.simulador.loadPlan(plan);
            }
          });
        }
      );
    }

    // Accesos globales
    window.simulador = this.components.simulador;
    window.DMDAsesores = {
      app: this,
      simulador: this.components.simulador
    };
  }

  // Limpia componentes de Gestión (cuando cambiamos a Negociación)
  teardownGestionComponents() {
    ['dashboard', 'simulador', 'seguimiento'].forEach(key => {
      if (this.components[key]?.destroy) {
        try { this.components[key].destroy(); } catch (_) {}
      }
      this.components[key] = null;
    });
    // Limpiar contenedor visible
    const container = document.getElementById('contentContainer');
    if (container) container.innerHTML = '';
  }

  attachEventListeners() {
    // Login
    const btnLogin = document.getElementById('btnLogin');
    if (btnLogin) {
      btnLogin.addEventListener('click', () => this.login());
    }

    // Logout
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => this.logout());
    }

    // Sync
    const btnSync = document.getElementById('btnSync');
    if (btnSync) {
      btnSync.addEventListener('click', () => this.syncData());
    }

    // Tabs Gestión
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
      // Re-iniciar flujo completo (recalcula perfil y UI)
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
      // Limpieza UI/estado
      this.destroy();
      // Volver a pantalla de auth
      this.showAuthRequired();
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
    const authRequired = document.getElementById('authRequired');
    const mainApp = document.getElementById('mainApp');
    if (authRequired) authRequired.style.display = 'block';
    if (mainApp) mainApp.style.display = 'none';
  }

  async switchTab(tabName) {
    // Si estamos en perfil Negociación, ignorar tabs
    if (this.profileRendered === 'Negociacion') return;

    // Actualiza estado visual de tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      const isActive = tab.dataset.tab === tabName;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-current', isActive ? 'page' : 'false');
    });

    // Render componente
    const container = document.getElementById('contentContainer');
    if (container) container.innerHTML = '';

    this.currentTab = tabName;

    const comp = this.components[tabName];
    if (comp?.render) {
      await comp.render();
    }

    if (tabName === 'simulador' && this.components.simulador?.resetView) {
      this.components.simulador.resetView();
    }

    // Actualiza referencia global
    if (window.DMDAsesores) {
      window.DMDAsesores.app = this;
    }
  }

  async refreshDashboard() {
    if (this.profileRendered === 'Gestion' && this.currentTab === 'dashboard' && this.components.dashboard?.refresh) {
      await this.components.dashboard.refresh();
    }
  }

  async syncData() {
    const syncIcon = document.getElementById('syncIcon');
    const btnSync = document.getElementById('btnSync');

    // Animación
    if (syncIcon) syncIcon.classList.add('spin');
    if (btnSync) btnSync.disabled = true;

    try {
      await storageService.syncPendingData();

      // Refrescar vista actual
      if (this.profileRendered === 'Gestion') {
        if (this.currentTab === 'dashboard' && this.components.dashboard?.refresh) {
          await this.components.dashboard.refresh();
        } else if (this.currentTab === 'seguimiento' && this.components.seguimiento?.updateTable) {
          await this.components.seguimiento.updateTable();
        }
      } else if (this.profileRendered === 'Negociacion' && this.components.negociacion?.refresh) {
        await this.components.negociacion.refresh();
      }

      showNotification('Sincronización completada', 'success');
    } catch (error) {
      console.error('Sync error:', error);
      showNotification('Error al sincronizar', 'error');
    } finally {
      if (syncIcon) syncIcon.classList.remove('spin');
      if (btnSync) btnSync.disabled = false;
    }
  }

  startStatusMonitoring() {
    const updateStatus = () => {
      const status = storageService.getSyncStatus?.() || { isOnline: true, pendingCount: 0 };
      const badge = document.getElementById('statusBadge');
      const text = document.getElementById('statusText');
      const lastUpdate = document.getElementById('lastUpdate');

      if (badge && text) {
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
      }

      if (lastUpdate) {
        lastUpdate.textContent = `Actualizado: ${new Date().toLocaleTimeString('es-ES')}`;
      }
    };

    updateStatus();
    this.statusInterval = setInterval(updateStatus, 10000);
  }

  destroy() {
    if (this.statusInterval) clearInterval(this.statusInterval);
    this.statusInterval = null;

    // Destruir storage si aplica
    try { storageService.destroy?.(); } catch (_) {}

    // Destruir todos los componentes
    Object.values(this.components).forEach(component => {
      try { component?.destroy?.(); } catch (_) {}
    });

    this.components = {};
    this.currentTab = 'dashboard';
    this.profileRendered = null;
  }
}

// Inicializar app
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.initialize();

  // Exponer globalmente
  window.app = app;
});

export { App };

