// utils/auth.js
import { config } from '../config/config.js';

class AuthService {
  constructor() {
    this.msalConfig = {
      auth: {
        ...config.auth
      },
      cache: {
        cacheLocation: config.auth.cacheLocation,
        storeAuthStateInCookie: config.auth.storeAuthStateInCookie
      },
      system: {
        loggerOptions: {
          loggerCallback: (level, message, containsPii) => {
            if (containsPii) return;
            if (config.app.debug) console.log('[MSAL]', message);
          }
        }
      }
    };

    // Requiere MSAL Browser global como `msal`
    this.msalInstance = new msal.PublicClientApplication(this.msalConfig);
    this.account = null;
  }

  // ===== Helpers de normalización/parseo =====
  _norm = (v) => String(v ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();

  _capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  _normalizePerfil(rawPerfil) {
    const val = this._norm(rawPerfil || 'Gestion');
    // alias → clave canónica en minúsculas
    const aliases = {
      admin: 'admin',
      administrador: 'admin',
      administracion: 'admin',
      supervisor: 'supervisor',
      gestion: 'gestion',
      gestora: 'gestion',
      gestor: 'gestion',
      comercial: 'comercial',
      ventas: 'comercial',
      auditor: 'auditoria',
      auditoria: 'auditoria',
      invitado: 'invitado',
      viewer: 'invitado',
      lectura: 'invitado',
      negociacion: 'negociacion',
      negociador: 'negociacion'
    };
    const key = aliases[val] || val;
    const title = this._capitalize(key);
    const allowed = new Set(['Admin','Supervisor','Gestion','Comercial','Auditoria','Invitado','Negociacion']);
    return allowed.has(title) ? title : 'Gestion';
  }

  _toBool(v, defaultVal = true) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    const s = this._norm(v);
    if (!s) return defaultVal;
    if (['true','1','si','sí','s','y','yes','activo','active'].includes(s)) return true;
    if (['false','0','no','n','inactivo','inactive','disabled'].includes(s)) return false;
    return defaultVal;
  }

  _getUserEmailFromAccount() {
    return (
      this.account?.username ||
      this.account?.mail ||
      this.account?.userPrincipalName ||
      ''
    );
  }

  _extractEmailFromRow(rowObj) {
    // acepta múltiples variantes de encabezado
    const candidates = Object.keys(rowObj || {}).filter(k => {
      const nk = this._norm(k);
      return ['email','correo','user_upn','upn','correo corporativo','correo_corporativo'].includes(nk);
    });
    for (const k of candidates) {
      const v = rowObj[k];
      if (v && String(v).includes('@')) return String(v).trim();
    }
    // fallback a propiedades estándar si existieran
    if (rowObj?.email) return String(rowObj.email).trim();
    if (rowObj?.user_upn) return String(rowObj.user_upn).trim();
    if (rowObj?.upn) return String(rowObj.upn).trim();
    return '';
  }

  _extractActivoFromRow(rowObj) {
    // intenta leer 'Activo' o equivalentes
    const keys = Object.keys(rowObj || {});
    for (const k of keys) {
      const nk = this._norm(k);
      if (['activo','active','estado','enabled'].includes(nk)) {
        return this._toBool(rowObj[k], true);
      }
    }
    // si la propiedad ya viene "normalizada"
    if ('activo' in (rowObj || {})) return this._toBool(rowObj.activo, true);
    return true; // por defecto activos
  }

  _extractPerfilFromRow(rowObj) {
    // intenta leer 'Perfil' con tolerancia
    if (!rowObj) return 'Gestion';
    const keys = Object.keys(rowObj);
    for (const k of keys) {
      const nk = this._norm(k);
      if (['perfil','rol','role','perfil_app'].includes(nk)) {
        return this._normalizePerfil(rowObj[k]);
      }
    }
    // si ya viene campo 'perfil'
    if ('perfil' in rowObj) return this._normalizePerfil(rowObj.perfil);
    return 'Gestion';
  }

  _extractNombreFromRow(rowObj) {
    if (!rowObj) return '';
    const keys = Object.keys(rowObj);
    for (const k of keys) {
      const nk = this._norm(k);
      if (['nombre','name','displayname'].includes(nk)) {
        return String(rowObj[k] ?? '').trim();
      }
    }
    return '';
  }

  // === MODIFICADO: ahora también carga el perfil tras resolver la cuenta ===
  async initialize() {
    try {
      const response = await this.msalInstance.handleRedirectPromise();
      if (response) {
        this.account = response.account;
        await this.loadUserProfile(); // ← Añadido
      } else {
        const accounts = this.msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          this.account = accounts[0];
          await this.loadUserProfile(); // ← Añadido
        }
      }
      return this.account;
    } catch (error) {
      console.error('Error initializing auth:', error);
      throw error;
    }
  }

  // === NUEVO/MEJORADO: carga perfil desde la hoja/tabla "Usuarios" con normalización y Activo ===
  async loadUserProfile() {
    if (!this.account) return;

    try {
      // Import dinámico para evitar dependencias circulares
      const { excelApi } = await import('./excelApi.js');

      // Se espera: array de objetos (mínimo { email, perfil }), pero soportamos encabezados variables
      const usuarios = await excelApi.getUsuarios();
      const userEmail = this._getUserEmailFromAccount();
      const nUserEmail = this._norm(userEmail);

      // Busca por múltiples posibles campos de email/UPN
      let usuario = null;
      for (const u of (usuarios || [])) {
        const rowEmail = this._extractEmailFromRow(u);
        if (this._norm(rowEmail) === nUserEmail) {
          usuario = u;
          break;
        }
      }

      if (usuario) {
        const activo = this._extractActivoFromRow(usuario);              // TRUE/FALSE (default TRUE)
        const perfilNorm = this._extractPerfilFromRow(usuario);          // Admin/Gestion/etc
        const nombre = this._extractNombreFromRow(usuario) || this.account?.name || '';

        // Si no está activo, degradamos a Invitado
        this.account.perfil = activo ? perfilNorm : 'Invitado';
        this.account.isActive = !!activo;
        this.account.nombreHoja = nombre;

        if (config.app.debug) {
          console.log('[AUTH] Usuario encontrado en hoja Usuarios:', {
            email: userEmail,
            perfil: this.account.perfil,
            activo: this.account.isActive,
            nombre: this.account.nombreHoja
          });
        }
      } else {
        // Perfil por defecto si no existe en hoja
        this.account.perfil = 'Gestion';
        this.account.isActive = true;
        if (config.app.debug) {
          console.log('[AUTH] Usuario no encontrado en hoja Usuarios. Usando perfil "Gestion" por defecto:', userEmail);
        }
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      // En caso de error, usar perfil por defecto
      this.account.perfil = 'Gestion';
      this.account.isActive = true;
    }
  }

  // === MODIFICADO: tras login popup, carga perfil antes de devolver la cuenta ===
  async login() {
    try {
      const loginRequest = {
        scopes: config.graph.scopes
      };

      try {
        const response = await this.msalInstance.loginPopup(loginRequest);
        this.account = response.account;
        await this.loadUserProfile(); // ← Añadido
        return this.account;
      } catch (popupError) {
        // Si el popup es bloqueado, usamos redirect
        await this.msalInstance.loginRedirect(loginRequest);
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async logout() {
    try {
      const logoutRequest = {
        account: this.account,
        postLogoutRedirectUri: config.auth.postLogoutRedirectUri
      };
      await this.msalInstance.logoutRedirect(logoutRequest);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  async getToken() {
    try {
      if (!this.account) {
        throw new Error('No authenticated user');
      }

      const silentRequest = {
        scopes: config.graph.scopes,
        account: this.account
      };

      try {
        const response = await this.msalInstance.acquireTokenSilent(silentRequest);
        return response.accessToken;
      } catch (silentError) {
        const needsInteraction =
          (typeof msal !== 'undefined' && silentError instanceof msal.InteractionRequiredAuthError) ||
          String(silentError?.errorCode || '').includes('interaction_required');

        if (needsInteraction) {
          try {
            const response = await this.msalInstance.acquireTokenPopup(silentRequest);
            return response.accessToken;
          } catch (popupError) {
            await this.msalInstance.acquireTokenRedirect(silentRequest);
          }
        } else {
          throw silentError;
        }
      }
    } catch (error) {
      console.error('Get token error:', error);
      throw error;
    }
  }

  isAuthenticated() {
    return !!this.account;
  }

  getAccount() {
    return this.account;
  }
}

export const authService = new AuthService();

