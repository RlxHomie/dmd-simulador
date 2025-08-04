import { config } from '../config/config.js';

class AuthService {
  constructor() {
    this.msalConfig = {
      auth: config.auth,
      cache: {
        cacheLocation: config.auth.cacheLocation,
        storeAuthStateInCookie: config.auth.storeAuthStateInCookie
      },
      system: {
        loggerOptions: {
          loggerCallback: (level, message, containsPii) => {
            if (containsPii) return;
            if (config.app.debug) console.log(message);
          }
        }
      }
    };
    
    this.msalInstance = new msal.PublicClientApplication(this.msalConfig);
    this.account = null;
  }
  
  async initialize() {
    try {
      // Handle redirect promise
      const response = await this.msalInstance.handleRedirectPromise();
      if (response) {
        this.account = response.account;
      } else {
        // Check if user is already signed in
        const accounts = this.msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          this.account = accounts[0];
        }
      }
      return this.account;
    } catch (error) {
      console.error('Error initializing auth:', error);
      throw error;
    }
  }
  
  async login() {
    try {
      const loginRequest = {
        scopes: config.graph.scopes
      };
      
      // Try popup first, fallback to redirect
      try {
        const response = await this.msalInstance.loginPopup(loginRequest);
        this.account = response.account;
        return this.account;
      } catch (popupError) {
        // Popup blocked, use redirect
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
        // Silent token acquisition failed, use popup/redirect
        if (silentError instanceof msal.InteractionRequiredAuthError) {
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