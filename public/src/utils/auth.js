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

    // Requiere msal (MSAL Browser) disponible en global como `msal`
    this.msalInstance = new msal.PublicClientApplication(this.msalConfig);
    this.account = null;
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

  // === NUEVO: carga perfil desde la hoja/tabla "Usuarios" ===
  async loadUserProfile() {
    if (!this.account) return;

    try {
      // Import dinámico para evitar dependencias circulares
      // ⚠️ Ajusta la ruta si tu excelApi vive en otro lugar
      const { excelApi } = await import('../api/excelApi.js');

      // Se espera que getUsuarios() devuelva un array de objetos con al menos: { email, perfil }
      const usuarios = await excelApi.getUsuarios();

      const userEmail =
        this.account.username ||
        this.account.mail ||
        this.account.userPrincipalName ||
        '';

      const norm = (v) => String(v || '').trim().toLowerCase();

      // Búsqueda por email corporativo
      let usuario = usuarios.find(u => norm(u.email) === norm(userEmail));

      // Fallbacks comunes por si la columna se llama distinto
      if (!usuario) {
        usuario =
          usuarios.find(u => norm(u.user_upn) === norm(userEmail)) ||
          usuarios.find(u => norm(u.correo) === norm(userEmail));
      }

      if (usuario) {
        this.account.perfil = usuario.perfil || 'Gestion';
      } else {
        // Perfil por defecto si no existe en hoja
        this.account.perfil = 'Gestion';
        if (config.app.debug) {
          console.log('Usuario no encontrado en hoja Usuarios, usando perfil "Gestion" por defecto');
        }
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      // En caso de error, usar perfil por defecto
      this.account.perfil = 'Gestion';
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
        // Si requiere interacción, intentar popup y, si falla, redirect
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
