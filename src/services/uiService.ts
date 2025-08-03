export type NotificationType = 'info' | 'success' | 'error' | 'warning';

interface NotificationOptions {
  duracion?: number;
  icono?: string;
}

class UIService {
  mostrarNotificacion(
    mensaje: string, 
    tipo: NotificationType = 'info', 
    opciones: NotificationOptions = {}
  ): void {
    const { duracion = 3000 } = opciones;
    
    const iconos = {
      info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
      success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
      error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
      warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
    };

    const notificacion = document.createElement('div');
    notificacion.className = `notificacion ${tipo}`;
    notificacion.innerHTML = `${opciones.icono || iconos[tipo]} <span>${mensaje}</span>`;
    document.body.appendChild(notificacion);

    setTimeout(() => {
      notificacion.style.animation = 'slideOut 0.3s ease-in forwards';
      setTimeout(() => notificacion.remove(), 300);
    }, duracion);
  }

  actualizarEstadoConexion(online: boolean): void {
    const badge = document.getElementById('statusBadge');
    const text = document.getElementById('statusText');

    if (badge && text) {
      if (online) {
        badge.classList.remove('offline');
        text.textContent = 'Conectado';
      } else {
        badge.classList.add('offline');
        text.textContent = 'Sin conexión';
      }
    }
  }

  actualizarUltimaActualizacion(): void {
    const element = document.getElementById('lastUpdate');
    if (element) {
      element.textContent = `Última actualización: ${new Date().toLocaleTimeString('es-ES')}`;
    }
  }

  mostrarCargando(mensaje: string = 'Cargando...'): void {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
      const loadingMessage = loadingScreen.querySelector('p');
      if (loadingMessage) {
        loadingMessage.textContent = mensaje;
      }
      loadingScreen.style.display = 'flex';
      loadingScreen.style.opacity = '1';
    }
  }

  ocultarCargando(): void {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 300);
    }
  }

  confirmar(mensaje: string): Promise<boolean> {
    return new Promise((resolve) => {
      const result = window.confirm(mensaje);
      resolve(result);
    });
  }

  async mostrarModalConflicto(
    localData: any, 
    remoteData: any
  ): Promise<'local' | 'remote' | 'cancel'> {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.style.display = 'flex';
      
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
          <div class="modal-header">
            <h3>Conflicto de Sincronización</h3>
          </div>
          <div class="modal-body">
            <p>Se detectó un conflicto. El archivo ha sido modificado por otro usuario.</p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
              <div style="border: 1px solid var(--border); padding: 1rem; border-radius: var(--radius);">
                <h4>Versión Local</h4>
                <p><small>Última modificación: ${new Date(localData.ultimaActualizacion || Date.now()).toLocaleString('es-ES')}</small></p>
                <pre style="font-size: 0.8rem; overflow: auto; max-height: 200px;">${JSON.stringify(localData, null, 2)}</pre>
              </div>
              
              <div style="border: 1px solid var(--border); padding: 1rem; border-radius: var(--radius);">
                <h4>Versión Remota</h4>
                <p><small>Última modificación: ${new Date(remoteData.ultimaActualizacion || Date.now()).toLocaleString('es-ES')}</small></p>
                <pre style="font-size: 0.8rem; overflow: auto; max-height: 200px;">${JSON.stringify(remoteData, null, 2)}</pre>
              </div>
            </div>
            
            <div style="text-align: right; margin-top: 1.5rem; display: flex; gap: 0.5rem; justify-content: flex-end;">
              <button class="btn btn-secundario" data-action="cancel">Cancelar</button>
              <button class="btn btn-primario" data-action="remote">Usar Versión Remota</button>
              <button class="btn btn-success" data-action="local">Usar Versión Local</button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Event handlers
      modal.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const action = target.getAttribute('data-action');
        
        if (action) {
          modal.remove();
          resolve(action as 'local' | 'remote' | 'cancel');
        }
        
        if (target === modal) {
          modal.remove();
          resolve('cancel');
        }
      });
    });
  }

  actualizarEstadoSincronizacion(estado: 'syncing' | 'synced' | 'error' | 'offline'): void {
    const statusBadge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    
    if (!statusBadge || !statusText) return;
    
    const estados = {
      syncing: {
        texto: 'Sincronizando...',
        clase: '',
        icono: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>'
      },
      synced: {
        texto: 'Sincronizado',
        clase: '',
        icono: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>'
      },
      error: {
        texto: 'Error de sincronización',
        clase: 'offline',
        icono: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>'
      },
      offline: {
        texto: 'Sin conexión',
        clase: 'offline',
        icono: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 2h6v6"></path><path d="M15 2l-3.5 3.5"></path><path d="M2 12h6"></path><path d="M22 12h-4"></path><path d="M12 22v-6"></path><path d="M12 8V2"></path></svg>'
      }
    };
    
    const config = estados[estado];
    statusBadge.className = `status-badge ${config.clase}`;
    statusBadge.innerHTML = `${config.icono} <span>${config.texto}</span>`;
  }

  scrollToElement(elementId: string, options: ScrollIntoViewOptions = { behavior: 'smooth', block: 'nearest' }): void {
    const element = document.getElementById(elementId);
    element?.scrollIntoView(options);
  }

  // Método para añadir estilos de animación para sincronización
  addSyncAnimationStyles(): void {
    if (!document.getElementById('sync-animation-styles')) {
      const style = document.createElement('style');
      style.id = 'sync-animation-styles';
      style.textContent = `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .spin {
          animation: spin 2s linear infinite;
        }
      `;
      document.head.appendChild(style);
    }
  }
}

export const uiService = new UIService();